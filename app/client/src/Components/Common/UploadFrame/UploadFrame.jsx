import React, { useRef, useState, useEffect } from 'react';
import { Card, Button, ProgressBar } from 'react-bootstrap';
import './UploadFrame.css';

const UploadFrame = ({ title, colorClass, thumbnail, onUpload, onDelete, sessionId, fileType, isPreview = false }) => {
  const fileInputRef = useRef(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  // const [previewThumbnail, setPreviewThumbnail] = useState(thumbnail);
  console.log(title, " upload thumbnail: ", thumbnail);

  // Update previewThumbnail when thumbnail prop changes
  // useEffect(() => {
  //   setPreviewThumbnail(thumbnail);
  // }, [thumbnail]);

  // In a real implementation, we'd fetch a preview with applied thresholds
  // For preview mode, we would update this thumbnail when thresholds change
  // useEffect(() => {
  //   if (isPreview && sessionId && thumbnail) {
  //     // Every few seconds, check if we need to update the preview
  //     const intervalId = setInterval(() => {
  //       checkForUpdatedPreview();
  //     }, 3000);
      
  //     return () => clearInterval(intervalId);
  //   }
  // }, [isPreview, sessionId, thumbnail]);

  const checkForUpdatedPreview = async () => {
    try {
      // In a real implementation, this would fetch the latest processed thumbnail
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/session/${sessionId}`);
      const data = await response.json();
      console.log(" upload data: ", data);
      
      
      // if (data.thumbnails) {
      //   if (fileType === 'dataset' && data.thumbnails.dataset) {
      //     setPreviewThumbnail(data.thumbnails.dataset);
      //   } else if (fileType === 'mirror' && data.thumbnails.mirror) {
      //     setPreviewThumbnail(data.thumbnails.mirror);
      //   } else if (fileType === 'pattern' && data.thumbnails.pattern) {
      //     setPreviewThumbnail(data.thumbnails.pattern);
      //   }
      //   console.log("  ***** thumbnails: ", data.thumbnails);
      // }

      
    } catch (error) {
      console.error('Error checking for preview updates:', error);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    setIsUploading(true);
    
    try {
      // Initialize upload and get job ID
      const initResponse = await fetch(`${process.env.REACT_APP_API_BASE_URL}/init-upload`, {
        method: 'POST'
      });
      const initData = await initResponse.json();
      const jobId = initData.job_id;
      
      // Prepare for chunk upload
      const chunkSize = 1024 * 1024; // 1MB chunks
      const totalChunks = Math.ceil(file.size / chunkSize);
      
      // Upload each chunk
      for (let i = 0; i < totalChunks; i++) {
        const chunk = file.slice(i * chunkSize, Math.min((i + 1) * chunkSize, file.size));
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('filename', file.name);
        formData.append('job_id', jobId);
        formData.append('chunk_index', i);
        formData.append('total_chunks', totalChunks);
        formData.append('file_type', fileType);
        formData.append('session_id', sessionId);
        
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/upload-chunk`, {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        
        // Update progress
        const progress = Math.round(((i + 1) / totalChunks) * 100);
        setUploadProgress(progress);
        
        // If complete, handle success
        if (data.status === 'complete') {
          onUpload && onUpload({
            filename: data.filename,
            thumbnail: data.thumbnail_url
          });
          // setPreviewThumbnail(data.thumbnail_url);
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete this ${title}?`)) {
      onDelete();
      // setPreviewThumbnail(null);
    }
  };

  
  // console.log("     preview thumbnail: ", previewThumbnail);

  return (
    <div className="upload-frame">
      <h5>{title}</h5>
      <div className={`thumbnail-container ${colorClass}`}>
        {thumbnail ? (
          <>
            <img 
              src={`${process.env.REACT_APP_BASE_URL}${thumbnail}`} 
              alt={`${title} thumbnail`} 
              className="thumbnail-image"
            />
            <Button 
              variant="danger"
              size="sm"
              className="delete-btn"
              onClick={handleDelete}
            >
              X
            </Button>
          </>
        ) : (
          <div className="no-thumbnail">
            <p>No file selected</p>
          </div>
        )}
      </div>

      {uploadProgress > 0 && (
        <ProgressBar
          now={uploadProgress}
          label={`${uploadProgress}%`}
          className="mt-2"
          striped
          animated
        />
      )}

      <div className="mt-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="video/mp4,video/avi,video/*"
          style={{ display: 'none' }}
          disabled={isUploading}
        />
        <Button 
          variant="primary" 
          onClick={handleFileSelect}
          className="upload-btn"
          disabled={isUploading}
        >
          {isUploading ? 'Uploading...' : `Upload ${title}`}
        </Button>
      </div>
    </div>
  );
};

export default UploadFrame;