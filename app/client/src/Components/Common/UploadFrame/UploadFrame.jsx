// import React, { useRef } from 'react';
// import { Card, Button } from 'react-bootstrap';
// import './UploadFrame.css';

// const UploadFrame = ({ title, colorClass, thumbnail, onUpload, onDelete }) => {
//   const fileInputRef = useRef(null);

//   const handleFileSelect = () => {
//     fileInputRef.current.click();
//   };

//   const handleFileChange = (e) => {
//     if (e.target.files && e.target.files[0]) {
//       onUpload(e.target.files[0]);
//     }
//   };

//   const handleDelete = () => {
//     // Show confirmation dialog
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
//               src={`http://localhost:5000${thumbnail}`} 
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
      
//       <div className="mt-2">
//         <input
//           type="file"
//           ref={fileInputRef}
//           onChange={handleFileChange}
//           accept="video/mp4,video/avi,video/*"
//           style={{ display: 'none' }}
//         />
//         <Button 
//           variant="primary" 
//           onClick={handleFileSelect}
//           className="upload-btn"
//         >
//           Upload {title}
//         </Button>
//       </div>
//     </div>
//   );
// };

// export default UploadFrame;


import React, { useRef, useState } from 'react';
import { Card, Button, ProgressBar } from 'react-bootstrap';
import axios from 'axios';
import './UploadFrame.css';

const UploadFrame = ({ title, colorClass, thumbnail, onUpload, onDelete, sessionId, fileType }) => {
  const fileInputRef = useRef(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId);

    try {
      const response = await axios.post(
        `http://localhost:5000/api/upload/${fileType}`,
        formData,
        {
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        }
      );

      if (response.data.success) {
        onUpload(file); // Optional: only if your parent uses this callback
        setUploadProgress(0); // Reset progress bar
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadProgress(0);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete this ${title}?`)) {
      onDelete();
    }
  };

  return (
    <div className="upload-frame">
      <h5>{title}</h5>
      <div className={`thumbnail-container ${colorClass}`}>
        {thumbnail ? (
          <>
            <img 
              src={`http://localhost:5000${thumbnail}`} 
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
        />
        <Button 
          variant="primary" 
          onClick={handleFileSelect}
          className="upload-btn"
        >
          Upload {title}
        </Button>
      </div>
    </div>
  );
};

export default UploadFrame;
