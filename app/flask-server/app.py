from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import os
import cv2
import numpy as np
from PIL import Image
import uuid
import json
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure upload folders
UPLOAD_FOLDER = 'uploads'
FRAMES_FOLDER = 'frames'
MIRROR_FOLDER = 'mirror'
PATTERN_FOLDER = 'pattern'

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['FRAMES_FOLDER'] = FRAMES_FOLDER
app.config['MIRROR_FOLDER'] = MIRROR_FOLDER
app.config['PATTERN_FOLDER'] = PATTERN_FOLDER

# Ensure directories exist
for folder in [UPLOAD_FOLDER, FRAMES_FOLDER, MIRROR_FOLDER, PATTERN_FOLDER]:
    os.makedirs(folder, exist_ok=True)

# Default threshold parameters
DEFAULT_PATTERN_THRES = 200
DEFAULT_SOLID_THRES = 0.60
DEFAULT_OBJ_PROMPT = "Analyze the image and determine with at least 70% confidence whether it contains man-made objects (buildings, houses, light poles, cars, sheds, or artificial structures) that affect depth; exclude natural elements like trees or paths in mostly tree-covered images, and explicitly state 'True' or 'False' before listing identified objects or explaining uncertainty."

# Store session data
sessions = {}

@app.route('/api/new-session', methods=['GET'])
def create_session():
    """Create a new session for the user"""
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        'dataset_path': None,
        'mirror_path': None,
        'pattern_path': None,
        'thres_params': {
            'Object Detection Prompt': DEFAULT_OBJ_PROMPT,
            'Pattern Thresholding': DEFAULT_PATTERN_THRES,
            'Solid Color Detection': DEFAULT_SOLID_THRES
        },
        'pipeline_processes': {
            'Pattern Thresholding': True,
            'Model Object Detection': True,
            'Solid Color Detection': True
        }
    }
    return jsonify({'session_id': session_id})

@app.route('/api/upload/<file_type>', methods=['POST'])
def upload_file(file_type):
    """Handle file uploads for dataset, mirror, or pattern"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    session_id = request.form.get('session_id')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'Invalid session ID'}), 400
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{session_id}_{filename}")
        file.save(file_path)
        
        # Extract first frame for thumbnail
        thumbnail_url = extract_first_frame(file_path, session_id, file_type)
        
        # Update session data
        if file_type == 'dataset':
            sessions[session_id]['dataset_path'] = file_path
        elif file_type == 'mirror':
            sessions[session_id]['mirror_path'] = file_path
        elif file_type == 'pattern':
            sessions[session_id]['pattern_path'] = file_path
        
        return jsonify({
            'success': True,
            'file_path': file_path,
            'thumbnail_url': thumbnail_url
        })

def extract_first_frame(video_path, session_id, file_type):
    """Extract the first frame from a video file and save as thumbnail"""
    cap = cv2.VideoCapture(video_path)
    success, frame = cap.read()
    cap.release()
    
    if success:
        # Convert BGR to RGB
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(frame)
        
        # Save thumbnail
        thumbnail_filename = f"{session_id}_{file_type}_thumbnail.png"
        thumbnail_path = os.path.join(app.config['UPLOAD_FOLDER'], thumbnail_filename)
        pil_image.save(thumbnail_path)
        
        return f"/api/uploads/{thumbnail_filename}"
    
    return None

@app.route('/api/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/update-threshold', methods=['POST'])
def update_threshold():
    """Update threshold parameters"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'Invalid session ID'}), 400
    
    param_name = data.get('param_name')
    value = data.get('value')
    
    if param_name and param_name in sessions[session_id]['thres_params']:
        sessions[session_id]['thres_params'][param_name] = value
        return jsonify({'success': True})
    
    return jsonify({'error': 'Invalid parameter name'}), 400

@app.route('/api/update-pipeline', methods=['POST'])
def update_pipeline():
    """Update pipeline process selection"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'Invalid session ID'}), 400
    
    processes = data.get('processes')
    
    if processes:
        for process_name, value in processes.items():
            if process_name in sessions[session_id]['pipeline_processes']:
                sessions[session_id]['pipeline_processes'][process_name] = value
        
        return jsonify({'success': True})
    
    return jsonify({'error': 'Invalid processes data'}), 400

@app.route('/api/run-pipeline', methods=['POST'])
def run_pipeline():
    """Run the selected pipeline processes"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'Invalid session ID'}), 400
    
    session = sessions[session_id]
    
    # Check if required files are uploaded
    if not session['dataset_path']:
        return jsonify({'error': 'Dataset not uploaded'}), 400
    
    # Run the selected processes
    results = {}
    processes = session['pipeline_processes']
    
    # Example pipeline execution
    if processes.get('Pattern Thresholding', False):
        # Implement your pattern thresholding logic here
        results['pattern_thresholding'] = 'Pattern thresholding completed'
    
    if processes.get('Model Object Detection', False):
        # Implement your object detection logic here
        results['object_detection'] = 'Object detection completed'
    
    if processes.get('Solid Color Detection', False):
        # Implement your solid color detection logic here
        results['solid_color_detection'] = 'Solid color detection completed'
    
    return jsonify({
        'success': True,
        'results': results
    })

@app.route('/api/delete/<file_type>', methods=['POST'])
def delete_file(file_type):
    """Delete uploaded file"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': 'Invalid session ID'}), 400
    
    if file_type == 'dataset':
        file_path = sessions[session_id]['dataset_path']
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        sessions[session_id]['dataset_path'] = None
    elif file_type == 'mirror':
        file_path = sessions[session_id]['mirror_path']
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        sessions[session_id]['mirror_path'] = None
    elif file_type == 'pattern':
        file_path = sessions[session_id]['pattern_path']
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        sessions[session_id]['pattern_path'] = None
    
    return jsonify({'success': True})

@app.route('/api/session/<session_id>', methods=['GET'])
def get_session(session_id):
    """Get session data"""
    if session_id not in sessions:
        return jsonify({'error': 'Invalid session ID'}), 400
    
    session = sessions[session_id]
    
    # Generate thumbnail URLs
    thumbnails = {}
    for file_type in ['dataset', 'mirror', 'pattern']:
        path = session.get(f'{file_type}_path')
        if path:
            thumbnail_filename = f"{session_id}_{file_type}_thumbnail.png"
            if os.path.exists(os.path.join(app.config['UPLOAD_FOLDER'], thumbnail_filename)):
                thumbnails[file_type] = f"/api/uploads/{thumbnail_filename}"
    
    return jsonify({
        'session_data': session,
        'thumbnails': thumbnails
    })

if __name__ == '__main__':
    app.run(debug=True)
    