// import React, { useRef, useState, useEffect } from 'react';
// import { Card, Button, ProgressBar } from 'react-bootstrap';
// import './UploadFrame.css';

// const UploadFrame = ({ title, colorClass, thumbnail, onUpload, onDelete, sessionId, fileType, isPreview = false }) => {
//   const fileInputRef = useRef(null);
//   const [uploadProgress, setUploadProgress] = useState(0);
//   const [isUploading, setIsUploading] = useState(false);

//   const checkForUpdatedPreview = async () => {
//     try {
//       // In a real implementation, this would fetch the latest processed thumbnail
//       const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/session/${sessionId}`);
//       const data = await response.json();      
//     } catch (error) {
//       console.error('Error checking for preview updates:', error);
//     }
//   };

//   const handleFileSelect = () => {
//     fileInputRef.current.click();
//   };

//   const handleFileChange = async (e) => {
//     if (!e.target.files || !e.target.files[0]) return;
    
//     const file = e.target.files[0];
//     setIsUploading(true);
    
//     try {
//       // Initialize upload and get job ID
//       const initResponse = await fetch(`${process.env.REACT_APP_API_BASE_URL}/init-upload`, {
//         method: 'POST'
//       });
//       const initData = await initResponse.json();
//       const jobId = initData.job_id;
      
//       // Prepare for chunk upload
//       const chunkSize = 1024 * 1024; // 1MB chunks
//       const totalChunks = Math.ceil(file.size / chunkSize);
      
//       // Upload each chunk
//       for (let i = 0; i < totalChunks; i++) {
//         const chunk = file.slice(i * chunkSize, Math.min((i + 1) * chunkSize, file.size));
//         const formData = new FormData();
//         formData.append('chunk', chunk);
//         formData.append('filename', file.name);
//         formData.append('job_id', jobId);
//         formData.append('chunk_index', i);
//         formData.append('total_chunks', totalChunks);
//         formData.append('file_type', fileType);
//         formData.append('session_id', sessionId);
        
//         const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/upload-chunk`, {
//           method: 'POST',
//           body: formData
//         });
        
//         const data = await response.json();
        
//         // Update progress
//         const progress = Math.round(((i + 1) / totalChunks) * 100);
//         setUploadProgress(progress);
        
//         // If complete, handle success
//         if (data.status === 'complete') {
//           onUpload && onUpload({
//             filename: data.filename,
//             thumbnail: data.thumbnail_url
//           });
//         }
//       }
//     } catch (error) {
//       console.error('Upload failed:', error);
//     } finally {
//       setIsUploading(false);
//       setUploadProgress(0);
//     }
//   };

//   const handleDelete = () => {
//     if (window.confirm(`Are you sure you want to delete this ${title}?`)) {
//       onDelete();
//     }
//   };

  
//   return (
//     <div className="upload-frame">
//       <h5>{title}</h5>
//       <div className={`thumbnail-container ${colorClass}`}>
//         {thumbnail ? (
//           <>
//             <img 
//               src={`${process.env.REACT_APP_BASE_URL}${thumbnail}`} 
//               alt={`${title} thumbnail`} 
//               className="thumbnail-image"
//             />
//             <Button 
//               variant="danger"
//               size="sm"
//               className="delete-btn"
//               onClick={handleDelete}
//             >
//               X
//             </Button>
//           </>
//         ) : (
//           <div className="no-thumbnail">
//             <p>No file selected</p>
//           </div>
//         )}
//       </div>

//       {uploadProgress > 0 && (
//         <ProgressBar
//           now={uploadProgress}
//           label={`${uploadProgress}%`}
//           className="mt-2"
//           striped
//           animated
//         />
//       )}

//       <div className="mt-2">
//         <input
//           type="file"
//           ref={fileInputRef}
//           onChange={handleFileChange}
//           accept="video/mp4,video/avi,video/*"
//           style={{ display: 'none' }}
//           disabled={isUploading}
//         />
//         <Button 
//           variant="primary" 
//           onClick={handleFileSelect}
//           className="upload-btn"
//           disabled={isUploading}
//         >
//           {isUploading ? 'Uploading...' : `Upload ${title}`}
//         </Button>
//       </div>
//     </div>
//   );
// };

// export default UploadFrame;

import React, { useRef, useState, useEffect } from 'react';
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
  // New props for flexibility:
  acceptFileTypes, // e.g., "video/*" or "image/*"
  allowMultipleFiles, // boolean
  // isPreview = false // This prop was there, usage unclear from provided context
}) => {
  const fileInputRef = useRef(null);
  const [uploadProgress, setUploadProgress] = useState(0); // Overall/current file progress
  const [isUploading, setIsUploading] = useState(false);
  const [currentUploadingFileName, setCurrentUploadingFileName] = useState('');

  const handleFileSelect = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const filesToUpload = Array.from(e.target.files);
    setIsUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      setCurrentUploadingFileName(file.name);
      let fileSpecificProgress = 0;

      try {
        // Each file (even if multiple are selected) gets its own upload job_id for chunking
        const initResponse = await fetch(`${process.env.REACT_APP_API_BASE_URL}/init-upload`, {
          method: 'POST',
        });
        if (!initResponse.ok) throw new Error(`Failed to init upload for ${file.name}`);
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
          fileSpecificProgress = Math.round(((chunkIdx + 1) / totalChunks) * 100);
          setUploadProgress(fileSpecificProgress); // Show progress for the current file chunk

          if (data.status === 'complete') {
            console.log(`Upload complete for ${file.name}`, data);
            onUpload && onUpload({ // Parent component handles updating its state with this new file info
              fileType: data.file_type,
              filename: data.filename, // Original filename
              stored_filename: data.stored_filename, // Name on server
              thumbnail_url: data.thumbnail_url, // Thumbnail for *this* file
              all_session_thumbnails: data.all_session_thumbnails, // All thumbs for session
            });
            setUploadProgress(100); // Briefly show 100% for this file
          }
        }
      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error);
        // Optionally, notify user about the specific file failure
        setUploadProgress(0); // Reset progress for this file if it fails
        // Decide if to continue with next files or stop
      }
    } // End loop over filesToUpload

    setIsUploading(false);
    setUploadProgress(0);
    setCurrentUploadingFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = null; // Reset file input to allow re-selecting same file(s)
    }
  };

  const handleDeleteClick = () => {
    if (window.confirm(`Are you sure you want to delete all ${title}?`)) {
      onDelete({ fileType }); // Pass fileType to parent delete handler
    }
  };

  // Determine how to display thumbnails
  let displayThumbnails = [];
  if (thumbnails) {
    if (Array.isArray(thumbnails)) {
      displayThumbnails = thumbnails;
    } else if (typeof thumbnails === 'string') {
      displayThumbnails = [thumbnails];
    }
  }

  return (
    <div className="upload-frame mb-3"> {/* Added mb-3 for spacing */}
      <h5>{title}</h5>
      <Card className={`${colorClass}-light`}> {/* Using a lighter variant for card bg */}
        <Card.Body>
          {displayThumbnails.length > 0 ? (
            <div className="d-flex flex-wrap justify-content-start align-items-center">
              {displayThumbnails.map((thumbUrl, index) => (
                <div key={index} className="m-1 position-relative" style={{maxWidth: '100px', maxHeight: '100px'}}>
                  <img
                    src={`${process.env.REACT_APP_API_BASE_URL}${thumbUrl}`}
                    alt={`${title} thumbnail ${index + 1}`}
                    className="img-thumbnail" // Bootstrap class for simple border and padding
                    style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                  />
                   {/* Individual delete for pattern images could be added here if needed */}
                </div>
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
                    onClick={handleDeleteClick} // This deletes ALL for this fileType
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