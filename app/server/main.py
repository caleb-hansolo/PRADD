from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, Request
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
from pipeline import videos_to_frames, create_zip_from_directory

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

# Ensure directories exist
for folder in [UPLOAD_DIR, DOWNLOAD_DIR, FRAMES_DIR, MIRROR_DIR, PATTERN_DIR, CHUNK_DIR]:
    folder.mkdir(exist_ok=True)

# Default threshold parameters
DEFAULT_PATTERN_THRES = 200
DEFAULT_SOLID_THRES = 0.60
DEFAULT_OBJ_PROMPT = "Analyze the image and determine with at least 70% confidence whether it contains man-made objects (buildings, houses, light poles, cars, sheds, or artificial structures) that affect depth; exclude natural elements like trees or paths in mostly tree-covered images, and explicitly state 'True' or 'False' before listing identified objects or explaining uncertainty."

# Store session data
sessions: Dict[str, dict] = {}

app = FastAPI()

#
origins = [

]

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

@app.get("/api/new-session")
async def create_session():
    """Create a new session for the user"""
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        'dataset_path': None,
        'mirror_path': None,
        'pattern_path': None,
        'thres_params': {
            'Pattern Thresholding': DEFAULT_PATTERN_THRES,
            'Solid Color Detection': DEFAULT_SOLID_THRES,
            'Object Detection Prompt': DEFAULT_OBJ_PROMPT
        },
        'pipeline_processes': {
            'Pattern Thresholding': True,
            'Model Object Detection': True,
            'Solid Color Detection': True
        },
        'thumbnails': {
            'dataset': None,
            'mirror': None,
            'pattern': None
        },
    }
    return {"session_id": session_id}

@app.post("/api/init-upload")
async def init_upload():
    """Initialize a new upload job"""
    job_id = str(uuid.uuid4())
    logger.debug(f"🎯 Initialized new job: {job_id}")
    return {"job_id": job_id}

@app.post("/api/upload-chunk")
async def upload_chunk(request: Request):
    """Handle file chunk uploads"""
    try:
        form = await request.form()
        filename = form.get("filename")
        job_id = form.get("job_id")
        index = int(form.get("chunk_index"))
        total = int(form.get("total_chunks"))
        chunk = form.get("chunk")
        file_type = form.get("file_type", "dataset")  # Default to dataset if not specified

        if index == 0 or index == total - 1:
            logger.info(
                f"Chunk {index + 1}/{total} received for job_id={job_id}, file={filename}"
            )

        if not filename or not job_id or chunk is None:
            logger.error("❌ Invalid chunk upload request")
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Invalid upload"},
            )

        chunk_name = f"{job_id}_{filename}_chunk_{index}"
        chunk_path = CHUNK_DIR / chunk_name
        with open(chunk_path, "wb") as f:
            f.write(await chunk.read())

        logger.debug(f"🧩 Received chunk {index+1}/{total} for {filename} ({job_id})")

        # If this is the last chunk, assemble the full file
        if index + 1 == total:
            output_path = UPLOAD_DIR / f"{job_id}_{filename}"
            with open(output_path, "wb") as out:
                for i in range(total):
                    part = CHUNK_DIR / f"{job_id}_{filename}_chunk_{i}"
                    with open(part, "rb") as chunk_file:
                        out.write(chunk_file.read())
                    os.remove(part)
            
            # Generate thumbnail
            thumbnail_url = extract_first_frame(str(output_path), job_id, file_type)
            
            logger.debug(f"✅ File assembled for {job_id}: {output_path.name}")
            
            # Update session with file info if provided
            session_id = form.get("session_id")
            if session_id and session_id in sessions:
                if file_type == "dataset":
                    sessions[session_id]["dataset_path"] = str(output_path)
                elif file_type == "mirror":
                    sessions[session_id]["mirror_path"] = str(output_path)
                elif file_type == "pattern":
                    sessions[session_id]["pattern_path"] = str(output_path)

                # Update thumbnail in session
                if thumbnail_url:
                    sessions[session_id]["thumbnails"][file_type] = thumbnail_url

            
            return {
                "status": "complete", 
                "filename": f"{job_id}_{filename}",
                "thumbnail_url": thumbnail_url,
                "thumbnails": sessions[session_id]["thumbnails"],
            }
        else:
            return {"status": "partial", "chunk_index": index}

    except Exception as e:
        logger.error(f"❌ Error during chunk upload: {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Server error during upload: {str(e)}"},
        )

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
async def update_threshold(threshold_data: dict):
    """Update threshold parameters"""
    session_id = threshold_data.get('session_id')
    threshold_type = threshold_data.get('threshold_type')
    value = threshold_data.get('value')
    
    if not session_id or session_id not in sessions:
        return JSONResponse(status_code=400, content={"success": False, "message": "Invalid session ID"})
    
    # Update the threshold value
    if threshold_type == 'pattern_threshold':
        sessions[session_id]['thres_params']['Pattern Thresholding'] = value
    elif threshold_type == 'solid_threshold':
        sessions[session_id]['thres_params']['Solid Color Detection'] = value
    elif threshold_type == 'object_prompt':
        sessions[session_id]['thres_params']['Object Detection Prompt'] = value
    else:
        return JSONResponse(status_code=400, content={"success": False, "message": "Invalid threshold type"})
    
    # Apply threshold to preview images if they exist
    # TODO: Need to update this globally so the right variables get passed to the pipeline
    #   - will need to check if the corresponding checkbox is checked in the training and testing page
    path_key = None
    if threshold_type == 'pattern_threshold':
        path_key = 'pattern_path'
    elif threshold_type == 'solid_threshold':
        path_key = 'dataset_path'
    elif threshold_type == 'object_prompt':
        path_key = 'dataset_path'
    
    if path_key and sessions[session_id].get(path_key):
        # apply appropriate threshold to the image
        apply_threshold_to_preview(session_id, threshold_type, value)
        return {"success": True}

    return JSONResponse(status_code=400, content={"error": "Invalid parameter name"})
    
    

def apply_threshold_to_preview(session_id, threshold_type, value):
    """Apply threshold to generate a preview image"""
    if session_id not in sessions:
        logger.error(f"Invalid session ID: {session_id}")
        return False
    
    session = sessions[session_id]
    
    if threshold_type == 'pattern_threshold':
        # Apply pattern threshold to pattern image
        if not session.get('pattern_path'):
            logger.warning("No pattern image to apply threshold to")
            return False
        
        try:
            # Extract a frame from the video
            video_path = session['pattern_path']
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


# def apply_threshold_to_preview(session_id, param_name, value):
#     """Apply threshold to generate a preview image"""
#     # This would contain logic to apply the threshold to the image
#     # For now, we'll just log it
#     logger.info(f"Applying {param_name}={value} to preview for session {session_id}")
#     # Actual implementation would process the image and save a new preview

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

# @app.post("/api/run-pipeline")
# async def run_pipeline(pipeline_data: dict):
#     """Run the selected pipeline processes"""
#     session_id = pipeline_data.get('session_id')
    
#     if not session_id or session_id not in sessions:
#         return JSONResponse(status_code=400, content={"error": "Invalid session ID"})
    
#     session = sessions[session_id]
    
#     # Check if required files are uploaded
#     if not session['dataset_path']:
#         return JSONResponse(status_code=400, content={"error": "Dataset not uploaded"})
    
#     # Run the selected processes
#     results = {}
#     processes = pipeline_data.get('processes', {})
    
#     # Example pipeline execution
#     if processes.get('Pattern Thresholding', False):
#         # Process pattern thresholding logic would go here
#         results['pattern_thresholding'] = 'Pattern thresholding completed'
    
#     if processes.get('Model Object Detection', False):
#         # Process object detection logic would go here
#         results['object_detection'] = 'Object detection completed'
    
#     if processes.get('Solid Color Detection', False):
#         # Process solid color detection logic would go here
#         results['solid_color_detection'] = 'Solid color detection completed'
    
#     return {
#         "success": True,
#         "results": results
#     }

@app.post("/api/run-pipeline")
async def run_pipeline(pipeline_data: dict):
    """Run the full pipeline process and return ZIP file path"""
    session_id = pipeline_data.get('session_id')

    if not session_id or session_id not in sessions:
        return JSONResponse(status_code=400, content={"error": "Invalid session ID"})

    session = sessions[session_id]

    # currently using dataset path for raw and mirror for realsense
    raw_path = session.get("dataset_path")
    realsense_path = session.get("mirror_path")

    # need a way to get pattern images extracted and into pipeline?
    # maybe make pattern able to handle folder of images and also video? not sure

    if not raw_path or not realsense_path:
        return JSONResponse(status_code=400, content={"error": "Missing input videos"})

    try:
        frame_count = videos_to_frames(raw_path, realsense_path)
        zip_path = create_zip_from_directory("Accepted_images")
        return {
            "success": True,
            "message": f"Processed {frame_count} frames",
            "download_url": f"/downloads/{Path(zip_path).name}"
        }
    except Exception as e:
        logger.error(f"Pipeline execution failed: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})



@app.post("/api/delete/{file_type}")
async def delete_file(file_type: str, delete_data: dict):
    """Delete uploaded file and clear thumbnail"""
    session_id = delete_data.get('session_id')

    if not session_id or session_id not in sessions:
        return JSONResponse(status_code=400, content={"error": "Invalid session ID"})

    session = sessions[session_id]
    thumbnails = session.get("thumbnails")

    # Define mapping of file types to paths and thumbnails
    file_key_map = {
        'dataset': 'dataset_path',
        'mirror': 'mirror_path',
        'pattern': 'pattern_path'
    }

    if file_type not in file_key_map:
        return JSONResponse(status_code=400, content={"error": "Invalid file type"})

    path_key = file_key_map[file_type]
    file_path = session.get(path_key)

    # Delete actual file if it exists
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
        session[path_key] = None

    # Delete thumbnail file if it exists
    thumbnail_url = thumbnails.get(file_type)
    if thumbnail_url:
        # Get only the filename part from the URL path
        thumbnail_filename = Path(thumbnail_url).name
        thumbnail_file_path = UPLOAD_DIR / thumbnail_filename

        if thumbnail_file_path.exists():
            os.remove(thumbnail_file_path)
            session["thumbnails"][file_type] = None

    return {"success": True}


@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    """Get session data"""
    if session_id not in sessions:
        return JSONResponse(status_code=400, content={"error": "Invalid session ID"})
    
    session = sessions[session_id]
    
    # Generate thumbnail URLs
    thumbnails = {}
    for file_type in ['dataset', 'mirror', 'pattern']:
        path = session.get(f'{file_type}_path')
        if path:
            thumbnail_filename = f"{session_id}_{file_type}_thumbnail.png"
            if os.path.exists(os.path.join(UPLOAD_DIR, thumbnail_filename)):
                thumbnails[file_type] = f"/uploads/{thumbnail_filename}"
    
    return {
        "session_data": session,
        "thumbnails": thumbnails
    }

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


@app.post("/api/restore-defaults")
async def restore_defaults(data: dict):
    """Restore default threshold values"""
    session_id = data.get('session_id')
    
    if not session_id or session_id not in sessions:
        return JSONResponse(status_code=400, content={"success": False, "message": "Invalid session ID"})
    
    # Reset to default values
    sessions[session_id]['thres_params'] = {
        'Pattern Thresholding': DEFAULT_PATTERN_THRES,
        'Solid Color Detection': DEFAULT_SOLID_THRES,
        'Object Detection Prompt': DEFAULT_OBJ_PROMPT
    }
    
    # Regenerate preview images with default settings
    # This would apply the default thresholds to the images
    
    return {"success": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host=os.getenv("BACKEND_HOST", "127.0.0.1"), 
        port=int(os.getenv("BACKEND_PORT", 5000))
    )