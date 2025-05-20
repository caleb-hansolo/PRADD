from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, Request, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os
import shutil
import uuid
import cv2
import numpy as np
from PIL import Image
import logging
import json
from typing import Dict, Optional, List
from pydantic import BaseModel
from dotenv import load_dotenv
from pipeline import process_video_frames
import time
import asyncio


# load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure directories
UPLOAD_DIR = Path("uploads")
DOWNLOAD_DIR = Path("downloads")
FRAMES_DIR = Path("frames")
MIRROR_DIR = Path("mirror")
PATTERN_DIR = Path("pattern")
CHUNK_DIR = Path("uploaded_chunks")
PIPELINE_OUTPUT_DIR = Path("pipeline_output")


# Ensure directories exist
for folder in [UPLOAD_DIR, DOWNLOAD_DIR, FRAMES_DIR, MIRROR_DIR, PATTERN_DIR, CHUNK_DIR, PIPELINE_OUTPUT_DIR]:
    folder.mkdir(exist_ok=True)

# Default threshold parameters
DEFAULT_PATTERN_THRES = 200 # SIFT distance threshold for pattern matching
DEFAULT_SOLID_THRES = 0.60 # Percentage for black/white detection
DEFAULT_OBJ_PROMPT = "Analyze the image and determine with at least 70% confidence whether it contains man-made objects (buildings, houses, light poles, cars, sheds, or artificial structures) that affect depth; exclude natural elements like trees or paths in mostly tree-covered images, and explicitly state 'True' or 'False' before listing identified objects or explaining uncertainty."
DEFAULT_BLACK_THRES = 30 # Pixel value for black in BW check
DEFAULT_WHITE_THRES = 225 # Pixel value for white in BW check

# Store session data
sessions: Dict[str, dict] = {}
pipeline_jobs: Dict[str, Dict[str, any]] = {} # In-memory job store


app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files directory for serving uploads and downloads
app.mount("/downloads", StaticFiles(directory="downloads"), name="downloads")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
# Serve pattern images directly if needed by UI, e.g. for display after upload
app.mount("/patterns", StaticFiles(directory=PATTERN_DIR), name="patterns")


@app.get("/api/new-session")
async def create_session():
    """Create a new session for the user"""
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        'dataset_path': None,
        'mirror_path': None,
        'pattern_paths': [],
        'thres_params': {
            'Pattern Thresholding Value': DEFAULT_PATTERN_THRES, # SIFT distance
            'Solid Color Detection': DEFAULT_SOLID_THRES,  # BW percentage
            'Object Detection Prompt': DEFAULT_OBJ_PROMPT,
            'Black Threshold BW': DEFAULT_BLACK_THRES,
            'White Threshold BW': DEFAULT_WHITE_THRES,
        },
        'pipeline_processes': {
            'Pattern Thresholding': True,
            'Model Object Detection': True,
            'Solid Color Detection': True
        },
        'thumbnails': {
            'dataset': None,
            'mirror': None,
            'pattern': []
        },
    }
    logger.info(f"New session created: {session_id}")
    return {"session_id": session_id}

@app.post("/api/init-upload")
async def init_upload():
    """Initialize a new upload job"""
    job_id = str(uuid.uuid4())
    logger.debug(f"🎯 Initialized new job: {job_id}")
    return {"job_id": job_id}

def generate_thumbnail(source_path_str: str, unique_id: str, file_type: str, is_video_file: bool):
    """Generates a thumbnail and saves it to UPLOAD_DIR."""
    try:
        thumb_name_prefix = Path(source_path_str).stem # Use source stem for more uniqueness
        thumbnail_filename = f"{thumb_name_prefix}_{unique_id}_{file_type}_thumbnail.png"
        thumbnail_path = UPLOAD_DIR / thumbnail_filename
        
        if is_video_file:
            cap = cv2.VideoCapture(source_path_str)
            if not cap.isOpened():
                logger.error(f"Thumbnail: Could not open video {source_path_str}")
                return None
            success, frame = cap.read()
            cap.release()
            if success:
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(frame_rgb)
                pil_image.thumbnail((200, 200)) # Resize thumbnail
                pil_image.save(str(thumbnail_path))
                return f"/uploads/{thumbnail_filename}"
            else:
                logger.warning(f"Thumbnail: Failed to read frame from video {source_path_str}")
                return None
        else: # It's an image
            img = Image.open(source_path_str)
            img.thumbnail((200, 200)) # Create a small thumbnail
            img.save(str(thumbnail_path))
            return f"/uploads/{thumbnail_filename}"
    except Exception as e:
        logger.error(f"Failed to generate thumbnail for {source_path_str}: {e}", exc_info=True)
        return None


@app.post("/api/upload-chunk")
async def upload_chunk(request: Request):
    form = await request.form()
    original_filename = form.get("filename")
    upload_job_id = form.get("job_id") # ID for this specific file upload
    chunk_index = int(form.get("chunk_index"))
    total_chunks = int(form.get("total_chunks"))
    chunk_file: Optional[UploadFile] = form.get("chunk")
    file_type = form.get("file_type", "dataset")
    session_id = form.get("session_id")

    if not all([original_filename, upload_job_id, chunk_file, session_id]):
        raise HTTPException(status_code=400, detail="Missing required form fields for chunk upload.")
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")

    chunk_filename = f"{upload_job_id}_{original_filename}_chunk_{chunk_index}"
    chunk_path = CHUNK_DIR / chunk_filename
    
    if not chunk_file: # Add a check for chunk_file existence
        logger.error("Chunk file is missing in the form data.")
        raise HTTPException(status_code=400, detail="Chunk file is missing.")

    try:
        content = await chunk_file.read() # Use await chunk_file.read() directly
        
        with open(chunk_path, "wb") as f:
            f.write(content)
    except Exception as e:
        logger.error(f"Error writing chunk {chunk_path}: {e}", exc_info=True) # Added exc_info for more details
        raise HTTPException(status_code=500, detail="Error saving chunk.")
    finally:
        if chunk_file: # Add a finally block to ensure the file is closed
            await chunk_file.close()

    logger.debug(f"Chunk {chunk_index + 1}/{total_chunks} for {original_filename} (job:{upload_job_id}, session:{session_id}) saved to {chunk_path}")

    if chunk_index + 1 == total_chunks:
        # All chunks received, assemble the file
        # Assembled file will have a unique name using upload_job_id to avoid collision before moving
        assembled_file_name_tmp = f"{upload_job_id}_{original_filename}"
        temp_assembled_path = UPLOAD_DIR / assembled_file_name_tmp # Assemble in UPLOAD_DIR first

        with open(temp_assembled_path, "wb") as outfile:
            for i in range(total_chunks):
                part_path = CHUNK_DIR / f"{upload_job_id}_{original_filename}_chunk_{i}"
                with open(part_path, "rb") as infile:
                    outfile.write(infile.read())
                os.remove(part_path) # Clean up chunk

        logger.info(f"File {original_filename} assembled at {temp_assembled_path} for job {upload_job_id}, session {session_id}")

        final_stored_path_str = ""
        is_video = file_type in ["dataset", "mirror"]
        current_session = sessions[session_id]

        if file_type == "pattern":
            # Store pattern images in a session-specific subfolder within PATTERN_UPLOAD_DIR
            session_pattern_dir = PATTERN_DIR / session_id
            session_pattern_dir.mkdir(parents=True, exist_ok=True)
            # Use a unique name for the stored pattern file to avoid clashes if user uploads 'image.png' multiple times
            unique_pattern_filename = f"{str(uuid.uuid4())}_{original_filename}"
            final_dest_path = session_pattern_dir / unique_pattern_filename
            shutil.move(str(temp_assembled_path), str(final_dest_path))
            final_stored_path_str = str(final_dest_path)
            current_session['pattern_paths'].append(final_stored_path_str)
        elif is_video:
            # Videos are stored directly in UPLOAD_DIR with their temp assembled name for now
            # Or move them too if a different final naming convention is desired
            final_stored_path_str = str(temp_assembled_path)
            if file_type == "dataset":
                current_session["dataset_path"] = final_stored_path_str
            elif file_type == "mirror":
                current_session["mirror_path"] = final_stored_path_str
        else:
            os.remove(temp_assembled_path) # Clean up if not used
            logger.warning(f"Unknown file type '{file_type}' for {original_filename}. Assembled file removed.")
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_type}")

        # Generate thumbnail for the newly stored file
        # Use original_filename or a part of it for thumbnail name for better UX
        thumbnail_url = generate_thumbnail(final_stored_path_str, upload_job_id, file_type, is_video_file=is_video)

        if thumbnail_url:
            if file_type == "pattern":
                current_session["thumbnails"]["pattern"].append(thumbnail_url)
            else: # dataset or mirror
                current_session["thumbnails"][file_type] = thumbnail_url
        
        logger.info(f"File processing complete for {original_filename}. Final path: {final_stored_path_str}. Thumbnail: {thumbnail_url}")
        return {
            "status": "complete",
            "filename": original_filename, # Original filename for FE
            "stored_filename": Path(final_stored_path_str).name, # Actual name on disk
            "file_type": file_type,
            "thumbnail_url": thumbnail_url, # Thumbnail for this specific file
            "all_session_thumbnails": current_session["thumbnails"], # All thumbnails for the session
        }
    else:
        return {"status": "partial", "chunk_index": chunk_index, "filename": original_filename}

async def run_pipeline_background_task(
    pipeline_job_id: str, session_id: str, raw_video_path: str, realsense_video_path: str,
    pattern_img_paths: List[str], session_thres_params: dict, session_pipeline_processes: dict
):
    logger.info(f"Pipeline Job {pipeline_job_id} (Session: {session_id}): Starting background processing...")
    pipeline_jobs[pipeline_job_id] = {
        "status": "running", "session_id": session_id, "start_time": time.time(),
        "message": "Processing started."
    }
    try:
        # Call the refactored processing function from processes/__init__.py
        processed_frames_count, output_zip_filename = process_video_frames(
            job_id=pipeline_job_id, # Pass pipeline_job_id for unique output folder naming
            path_to_raw_video=raw_video_path,
            path_to_realsense_video=realsense_video_path,
            pattern_image_paths=pattern_img_paths,
            thres_params=session_thres_params,
            pipeline_processes_config=session_pipeline_processes
        )

        if output_zip_filename:
            download_url = f"/downloads/{output_zip_filename}" # Assuming zip is in DOWNLOAD_DIR
            pipeline_jobs[pipeline_job_id].update({
                "status": "completed",
                "message": f"Successfully processed {processed_frames_count} frames.",
                "download_url": download_url,
                "output_filename": output_zip_filename,
                "end_time": time.time()
            })
            logger.info(f"Pipeline Job {pipeline_job_id}: Completed. Download at {download_url}")
        else:
             pipeline_jobs[pipeline_job_id].update({
                "status": "completed_no_output",
                "message": f"Processed {processed_frames_count} frames, but no images were accepted into the output.",
                "end_time": time.time()
            })
             logger.info(f"Pipeline Job {pipeline_job_id}: Completed but no output ZIP generated.")

    except Exception as e:
        logger.error(f"Pipeline Job {pipeline_job_id}: Failed. Error: {e}", exc_info=True)
        pipeline_jobs[pipeline_job_id].update({
            "status": "failed",
            "error": str(e),
            "message": "An error occurred during pipeline processing.",
            "end_time": time.time()
        })

def extract_first_frame(video_path, job_id, file_type):
    """Extract the first frame from a video file and save as thumbnail"""
    try:
        cap = cv2.VideoCapture(video_path)
        success, frame = cap.read()
        cap.release()
        
        if success:
            # Convert BGR to RGB
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame)
            
            # Save thumbnail
            thumbnail_filename = f"{job_id}_{file_type}_thumbnail.png"
            thumbnail_path = UPLOAD_DIR / thumbnail_filename
            pil_image.save(str(thumbnail_path))
            
            return f"/uploads/{thumbnail_filename}"
        
        return None
    except Exception as e:
        logger.error(f"Failed to extract frame: {e}")
        return None



@app.post("/api/update-threshold")
async def update_threshold_endpoint(threshold_data: dict):
    session_id = threshold_data.get('session_id')
    param_name = threshold_data.get('param_name') # e.g., 'Pattern Thresholding Value'
    value = threshold_data.get('value')

    if not session_id or session_id not in sessions:
        raise HTTPException(status_code=404, detail="Invalid session ID")
    if param_name not in sessions[session_id]['thres_params']:
        raise HTTPException(status_code=400, detail=f"Invalid threshold parameter name: {param_name}")

    try:
        # Attempt to cast to appropriate type if needed (e.g., float, int)
        if isinstance(sessions[session_id]['thres_params'][param_name], (int, float)):
            if isinstance(value, str): # Attempt conversion if string value from JS
                 try:
                    value = float(value) if '.' in value else int(value)
                 except ValueError:
                    raise HTTPException(status_code=400, detail=f"Invalid value type for {param_name}. Expected number.")
        sessions[session_id]['thres_params'][param_name] = value
        logger.info(f"Session {session_id}: Updated threshold '{param_name}' to '{value}'")
        return {"success": True, "updated_params": sessions[session_id]['thres_params']}
    except Exception as e:
        logger.error(f"Error updating threshold for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Error updating threshold.")


def apply_threshold_to_preview(session_id, threshold_type, value):
    """Apply threshold to generate a preview image"""
    if session_id not in sessions:
        logger.error(f"Invalid session ID: {session_id}")
        return False
    
    session = sessions[session_id]
    
    if threshold_type == 'pattern_threshold':
        # Apply pattern threshold to pattern image
        if not session.get('pattern_paths'):
            logger.warning("No pattern image to apply threshold to")
            return False
        
        try:
            # Extract a frame from the video
            video_path = session['pattern_paths']
            cap = cv2.VideoCapture(video_path)
            success, frame = cap.read()
            cap.release()
            
            if not success:
                logger.error(f"Failed to read frame from {video_path}")
                return False
            
            # Apply pattern threshold
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, value, 255, cv2.THRESH_BINARY)
            
            # Convert back to RGB for thumbnail
            color_thresh = cv2.cvtColor(thresh, cv2.COLOR_GRAY2RGB)
            
            # Save as thumbnail
            thumbnail_filename = f"{session_id}_pattern_thumbnail.png"
            thumbnail_path = UPLOAD_DIR / thumbnail_filename
            cv2.imwrite(str(thumbnail_path), color_thresh)
            
            logger.info(f"Generated preview thumbnail for pattern threshold: {value}")
            return True
            
        except Exception as e:
            logger.error(f"Error applying pattern threshold: {e}")
            return False
            
    elif threshold_type == 'solid_threshold':
        # Apply solid threshold to dataset image
        if not session.get('dataset_path'):
            logger.warning("No dataset image to apply threshold to")
            return False
        
        try:
            # Extract a frame from the video
            video_path = session['dataset_path']
            cap = cv2.VideoCapture(video_path)
            success, frame = cap.read()
            cap.release()
            
            if not success:
                logger.error(f"Failed to read frame from {video_path}")
                return False
            
            # Apply solid color detection
            # (This is a simplified example - real implementation would be more complex)
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            h, s, v = cv2.split(hsv)
            
            # Create a binary mask where pixels with saturation below the threshold are white
            # and others are black (representing potential solid color areas)
            _, mask = cv2.threshold(s, int(value * 255), 255, cv2.THRESH_BINARY_INV)
            
            # Apply mask to the original frame
            result = cv2.bitwise_and(frame, frame, mask=mask)
            
            # Save as thumbnail
            thumbnail_filename = f"{session_id}_dataset_thumbnail.png"
            thumbnail_path = UPLOAD_DIR / thumbnail_filename
            cv2.imwrite(str(thumbnail_path), result)
            
            logger.info(f"Generated preview thumbnail for solid threshold: {value}")
            return True
            
        except Exception as e:
            logger.error(f"Error applying solid threshold: {e}")
            return False
            
    elif threshold_type == 'object_prompt':
        # For object detection prompt, we would typically call a model
        # Here we just log the change since this would require AI integration
        logger.info(f"Object detection prompt updated: {value}")
        return True
    
    return False

@app.post("/api/run-pipeline")
async def run_pipeline_endpoint(pipeline_data: dict, background_tasks: BackgroundTasks):
    session_id = pipeline_data.get('session_id')
    if not session_id or session_id not in sessions:
        raise HTTPException(status_code=404, detail="Invalid session ID")

    session = sessions[session_id]
    raw_path = session.get("dataset_path")
    realsense_path = session.get("mirror_path")
    pattern_paths = session.get("pattern_paths", []) # List of paths

    if not raw_path: # Mirror might be optional depending on pipeline
        raise HTTPException(status_code=400, detail="Dataset video not uploaded.")
    if not realsense_path: # Mirror might be optional depending on pipeline
        raise HTTPException(status_code=400, detail="Mirror video not uploaded.")
    
    # Check if pattern images are required
    if session['pipeline_processes'].get('Pattern Thresholding', False) and not pattern_paths:
        raise HTTPException(status_code=400, detail="Pattern Thresholding is enabled, but no pattern images are uploaded.")

    pipeline_job_id = str(uuid.uuid4())
    pipeline_jobs[pipeline_job_id] = {"status": "queued", "session_id": session_id, "message": "Pipeline job is queued."}

    # praying that this corrects pipeline not running in background
    asyncio.create_task(
        run_pipeline_background_task(
            pipeline_job_id,
            session_id,
            raw_path,
            realsense_path,
            pattern_paths,
            session['thres_params'],
            session['pipeline_processes']
        )
    )
    logger.info(f"Pipeline job {pipeline_job_id} for session {session_id} added to background queue.")
    return {"job_id": pipeline_job_id, "status": "queued", "message": "Pipeline processing initiated in background."}

@app.get("/api/pipeline-status/{job_id}")
async def get_pipeline_status(job_id: str):
    job_info = pipeline_jobs.get(job_id)
    if not job_info:
        raise HTTPException(status_code=404, detail="Pipeline job not found.")
    # Optionally calculate duration if start/end times exist
    if "start_time" in job_info and "end_time" in job_info:
        job_info["duration_seconds"] = round(job_info["end_time"] - job_info["start_time"], 2)
    return job_info

@app.post("/api/update-pipeline")
async def update_pipeline(pipeline_data: dict):
    """Update pipeline process selection"""
    session_id = pipeline_data.get('session_id')
    
    if not session_id or session_id not in sessions:
        return JSONResponse(status_code=400, content={"error": "Invalid session ID"})
    
    processes = pipeline_data.get('processes')
    
    if processes:
        for process_name, value in processes.items():
            if process_name in sessions[session_id]['pipeline_processes']:
                sessions[session_id]['pipeline_processes'][process_name] = value
        
        return {"success": True}
    
    return JSONResponse(status_code=400, content={"error": "Invalid processes data"})


@app.post("/api/delete/{file_type}")
async def delete_file_endpoint(file_type: str, delete_data: dict):
    session_id = delete_data.get('session_id')
    # `item_to_delete_identifier` could be a filename or path for specific pattern image deletion
    item_identifier = delete_data.get('identifier', None) 

    if not session_id or session_id not in sessions:
        raise HTTPException(status_code=404, detail="Invalid session ID")

    session = sessions[session_id]
    deleted_items_count = 0

    if file_type == "dataset" or file_type == "mirror":
        path_key = f"{file_type}_path"
        file_path_to_delete = session.get(path_key)
        if file_path_to_delete and Path(file_path_to_delete).exists():
            Path(file_path_to_delete).unlink()
            logger.info(f"Deleted {file_type} file: {file_path_to_delete} for session {session_id}")
            deleted_items_count +=1
        session[path_key] = None
        # Delete associated thumbnail
        thumb_url = session["thumbnails"].get(file_type)
        if thumb_url:
            thumb_path = UPLOAD_DIR / Path(thumb_url).name
            if thumb_path.exists():
                thumb_path.unlink()
            session["thumbnails"][file_type] = None
            
    elif file_type == "pattern":
        # This deletes ALL pattern images for the session as per original high-level request
        # "delete the contents of the patterns directory"
        session_pattern_dir = PATTERN_DIR / session_id
        if session_pattern_dir.exists():
            for item in session_pattern_dir.iterdir(): # Delete files within the folder
                 item.unlink()
                 deleted_items_count +=1
            # shutil.rmtree(session_pattern_dir) # To delete the folder itself
            logger.info(f"Deleted all pattern images in {session_pattern_dir} for session {session_id}")
        
        # Clear from session
        session['pattern_paths'] = []
        # Delete associated thumbnails
        if isinstance(session["thumbnails"].get("pattern"), list):
            for thumb_url in session["thumbnails"]["pattern"]:
                if thumb_url:
                    thumb_path = UPLOAD_DIR / Path(thumb_url).name
                    if thumb_path.exists():
                        thumb_path.unlink()
            session["thumbnails"]["pattern"] = []
    else:
        raise HTTPException(status_code=400, detail="Invalid file type for deletion.")

    return {"success": True, "message": f"Deleted {deleted_items_count} item(s) of type '{file_type}'.", "updated_thumbnails": session["thumbnails"]}


@app.get("/api/session/{session_id}")
async def get_session_data(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Invalid session ID")
    # No specific thumbnail regeneration here, should be up-to-date
    return {"session_data": sessions[session_id]}

@app.get("/api/metrics/{session_id}")
async def get_metrics(session_id: str):
    """Get metrics for a session"""
    if session_id not in sessions:
        return JSONResponse(status_code=400, content={"error": "Invalid session ID"})
    
    # TODO: get metric data and put it here
    # In a real app, these would come from processing results
    # For now, we'll return mock data
    metrics = {
        "processedFrames": 120,
        "detectedObjects": 45,
        "patternMatches": 30,
        "solidColorFrames": 15
    }
    
    return {
        "success": True,
        "metrics": metrics
    }

@app.post("/api/update-pipeline-config") # Renamed for clarity
async def update_pipeline_config_endpoint(pipeline_config_data: dict):
    session_id = pipeline_config_data.get('session_id')
    processes_config = pipeline_config_data.get('processes_config') # Dict like {'Pattern Thresholding': True, ...}

    if not session_id or session_id not in sessions:
        raise HTTPException(status_code=404, detail="Invalid session ID")
    if not isinstance(processes_config, dict):
        raise HTTPException(status_code=400, detail="Invalid processes_config data format.")

    for process_name, is_active in processes_config.items():
        if process_name in sessions[session_id]['pipeline_processes']:
            sessions[session_id]['pipeline_processes'][process_name] = bool(is_active)
    
    logger.info(f"Session {session_id}: Updated pipeline processes configuration.")
    return {"success": True, "updated_config": sessions[session_id]['pipeline_processes']}


@app.post("/api/restore-defaults")
async def restore_defaults_endpoint(data: dict):
    session_id = data.get('session_id')
    if not session_id or session_id not in sessions:
        raise HTTPException(status_code=404, detail="Invalid session ID")

    sessions[session_id]['thres_params'] = {
        'Pattern Thresholding Value': DEFAULT_PATTERN_THRES,
        'Solid Color Detection': DEFAULT_SOLID_THRES,
        'Object Detection Prompt': DEFAULT_OBJ_PROMPT,
        'Black Threshold BW': DEFAULT_BLACK_THRES,
        'White Threshold BW': DEFAULT_WHITE_THRES,
    }
    sessions[session_id]['pipeline_processes'] = {
        'Pattern Thresholding': True, 'Model Object Detection': True, 'Solid Color Detection': True
    }
    logger.info(f"Session {session_id}: Restored to default parameters and pipeline config.")
    return {"success": True, "thres_params": sessions[session_id]['thres_params'], "pipeline_processes": sessions[session_id]['pipeline_processes']}


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("BACKEND_PORT", 8000)) # Common port for FastAPI dev
    logger.info(f"Starting server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)

