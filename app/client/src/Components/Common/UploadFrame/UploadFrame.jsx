import React, { useRef, useState } from 'react';
import { Card, Button, ProgressBar } from 'react-bootstrap';
// import './UploadFrame.css'; // Assuming you have this CSS file

const UploadFrame = ({
  title,
  colorClass,
  thumbnails, // Expects string for single, array of strings for multiple
  onUpload,   // Callback after successful upload(s)
  onDelete,   // Callback for delete action
  sessionId,
  fileType,   // 'dataset', 'mirror', 'pattern'
  acceptFileTypes, // e.g., "video/*" or "image/*"
  allowMultipleFiles, // boolean
}) => {
  const fileInputRef = useRef(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUploadingFileName, setCurrentUploadingFileName] = useState('');

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const filesToUpload = Array.from(e.target.files);
    setIsUploading(true);
    setUploadProgress(0); // Reset progress for the batch or first file

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      setCurrentUploadingFileName(file.name);
      // Reset progress for each individual file if you want to show per-file progress clearly
      // If you have a single progress bar for all, this might jump around.
      // For now, let's assume the progress bar reflects the currently uploading file.
      setUploadProgress(0); 


      try {
        const initResponse = await fetch(`${process.env.REACT_APP_API_BASE_URL}/init-upload`, {
          method: 'POST',
        });
        if (!initResponse.ok) throw new Error(`Failed to init upload for ${file.name}. Status: ${initResponse.status}`);
        const initData = await initResponse.json();
        const fileUploadJobId = initData.job_id;

        const chunkSize = 1024 * 1024; // 1MB
        const totalChunks = Math.ceil(file.size / chunkSize);

        for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
          const chunk = file.slice(chunkIdx * chunkSize, (chunkIdx + 1) * chunkSize);
          const formData = new FormData();
          formData.append('chunk', chunk);
          formData.append('filename', file.name);
          formData.append('job_id', fileUploadJobId);
          formData.append('chunk_index', chunkIdx);
          formData.append('total_chunks', totalChunks);
          formData.append('file_type', fileType);
          formData.append('session_id', sessionId);

          const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/upload-chunk`, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Unknown upload error" }));
            throw new Error(`Upload chunk failed for ${file.name}: ${errorData.detail || response.statusText}`);
          }
          
          const data = await response.json();
          const fileSpecificProgress = Math.round(((chunkIdx + 1) / totalChunks) * 100);
          setUploadProgress(fileSpecificProgress);

          if (data.status === 'complete') {
            console.log(`Upload complete for ${file.name}`, data);
            onUpload && onUpload({
              fileType: data.file_type,
              filename: data.filename,
              stored_filename: data.stored_filename,
              thumbnail_url: data.thumbnail_url,
              all_session_thumbnails: data.all_session_thumbnails,
            });
            // No need to setUploadProgress(100) here as it's covered by fileSpecificProgress
          }
        }
      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error);
        setUploadProgress(0); // Reset progress for this file on error
        // Consider how to inform the user about the specific file failure.
      }
    }

    setIsUploading(false);
    setUploadProgress(0); // Reset progress after all files in the batch are processed
    setCurrentUploadingFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  const handleDeleteClick = () => {
    if (window.confirm(`Are you sure you want to delete all ${title}?`)) {
      onDelete({ fileType });
    }
  };

  let displayThumbnails = [];
  if (thumbnails) {
    if (Array.isArray(thumbnails)) {
      displayThumbnails = thumbnails;
    } else if (typeof thumbnails === 'string') {
      displayThumbnails = [thumbnails];
    }
  }

  return (
    <div className="upload-frame mb-3">
      <h5>{title}</h5>
      <Card className={`${colorClass}-light`}>
        <Card.Body>
          {displayThumbnails.length > 0 ? (
            <div className="d-flex flex-wrap justify-content-start align-items-center">
              {displayThumbnails.map((thumbUrl, index) => (
                thumbUrl ? ( // check to ensure thumbUrl is not undefined
                  <div key={index} className="m-1 position-relative" style={{maxWidth: '100px', maxHeight: '100px'}}>
                    <img
                      src={`${process.env.REACT_APP_BASE_URL}${thumbUrl}`} 
                      alt={`${title} thumbnail ${index + 1}`}
                      className="img-thumbnail"
                      style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                      onError={(e) => { 
                        // Handle image load errors, show a placeholder
                        e.target.onerror = null; // Prevent infinite loop if placeholder also fails
                        // e.target.src = "/path/to/default/placeholder.png"; 
                        console.warn(`Failed to load thumbnail: ${process.env.REACT_APP_BASE_URL}${thumbUrl}`);
                      }}
                    />
                  </div>
                ) : null // Don't render an img tag if thumbUrl is falsy
              ))}
            </div>
          ) : (
            <div className="text-center p-3 border rounded bg-light">
              <p className="mb-0 text-muted">No file(s) selected</p>
            </div>
          )}

          {isUploading && (
            <div className="mt-2">
              <ProgressBar
                now={uploadProgress}
                label={`${uploadProgress}% ${currentUploadingFileName ? `(${currentUploadingFileName})` : ''}`}
                striped
                animated
              />
            </div>
          )}

          <div className="mt-3 d-flex justify-content-between">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept={acceptFileTypes}
              multiple={allowMultipleFiles}
              style={{ display: 'none' }}
              disabled={isUploading}
            />
            <Button
              variant="primary"
              onClick={handleFileSelect}
              className="upload-btn"
              disabled={isUploading}
            >
              {isUploading ? `Uploading ${currentUploadingFileName}...` : `Upload ${title}`}
            </Button>
            {displayThumbnails.length > 0 && (
                 <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={handleDeleteClick}
                    disabled={isUploading}
                 >
                    Delete All {title}
                 </Button>
            )}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default UploadFrame;