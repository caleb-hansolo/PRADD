import React, { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import TrainingMenu from './TrainingMenu/TrainingMenu.jsx';
import UploadFrame from '../Common/UploadFrame/UploadFrame.jsx';
import './Training.css';

const TrainingPage = ({ sessionId }) => {
  const [datasetThumbnail, setDatasetThumbnail] = useState(null);
  const [mirrorThumbnail, setMirrorThumbnail] = useState(null);
  const [patternThumbnail, setPatternThumbnail] = useState(null);
  const [sessionData, setSessionData] = useState(null);

  // Fetch session data when component mounts or sessionId changes
  useEffect(() => {
    if (sessionId) {
      fetchSessionData();
    }
  }, [sessionId]);

  const fetchSessionData = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/session/${sessionId}`);
      const data = await response.json();
      
      setSessionData(data.session_data);
      
      // Set thumbnails if available
      if (data.thumbnails) {
        if (data.thumbnails.dataset) setDatasetThumbnail(data.thumbnails.dataset);
        if (data.thumbnails.mirror) setMirrorThumbnail(data.thumbnails.mirror);
        if (data.thumbnails.pattern) setPatternThumbnail(data.thumbnails.pattern);
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
    }
  };

  const handleUpload = async (fileType, file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId);

    try {
      const response = await fetch(`http://localhost:5000/api/upload/${fileType}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        // Update thumbnail
        if (fileType === 'dataset') {
          setDatasetThumbnail(data.thumbnail_url);
        } else if (fileType === 'mirror') {
          setMirrorThumbnail(data.thumbnail_url);
        } else if (fileType === 'pattern') {
          setPatternThumbnail(data.thumbnail_url);
        }
        
        // Refresh session data
        fetchSessionData();
      }
    } catch (error) {
      console.error(`Error uploading ${fileType}:`, error);
    }
  };

  const handleDelete = async (fileType) => {
    try {
      const response = await fetch(`http://localhost:5000/api/delete/${fileType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionId }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Clear thumbnail
        if (fileType === 'dataset') {
          setDatasetThumbnail(null);
        } else if (fileType === 'mirror') {
          setMirrorThumbnail(null);
        } else if (fileType === 'pattern') {
          setPatternThumbnail(null);
        }
        
        // Refresh session data
        fetchSessionData();
      }
    } catch (error) {
      console.error(`Error deleting ${fileType}:`, error);
    }
  };

  return (
    <Container fluid className="training-container">
      <Row className="h-100">
        {/* Left menu */}
        <Col md={3} className="menu-col">
          <TrainingMenu 
            sessionId={sessionId}
            sessionData={sessionData}
            onRefreshData={fetchSessionData}
          />
        </Col>
        
        {/* Main content */}
        <Col md={9} className="content-col">
          <Row className="h-50">
            {/* Dataset upload */}
            <Col md={6} className="upload-col">
              <UploadFrame
                title="Dataset"
                colorClass="dataset-color"
                thumbnail={datasetThumbnail}
                onUpload={(file) => handleUpload('dataset', file)}
                onDelete={() => handleDelete('dataset')}
                sessionId={sessionId}
                fileType="dataset"
              />
            </Col>
            
            {/* Mirror dataset upload */}
            <Col md={6} className="upload-col">
              <UploadFrame
                title="Mirror Dataset"
                colorClass="mirror-color"
                thumbnail={mirrorThumbnail}
                onUpload={(file) => handleUpload('mirror', file)}
                onDelete={() => handleDelete('mirror')}
                sessionId={sessionId}
                fileType="dataset"
              />
            </Col>
          </Row>
          
          <hr className="divider" />
          
          <Row className="h-50">
            {/* Pattern matching data upload */}
            <Col md={6} className="mx-auto upload-col">
              <UploadFrame
                title="Training/Pattern Matching Data"
                colorClass="pattern-color"
                thumbnail={patternThumbnail}
                onUpload={(file) => handleUpload('pattern', file)}
                onDelete={() => handleDelete('pattern')}
                sessionId={sessionId}
                fileType="dataset"
              />
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};

export default TrainingPage;