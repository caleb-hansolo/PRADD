import React, { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import ExpandableOptionFrame from '../Common/ExpandableOptionFrame/ExpandableOptionFrame';
import UploadFrame from '../Common/UploadFrame/UploadFrame';
import './AdvancedSettings.css';

const AdvancedSettingsPage = ({ sessionId }) => {
  const [datasetThumbnail, setDatasetThumbnail] = useState(null);
  const [mirrorThumbnail, setMirrorThumbnail] = useState(null);
  const [patternThumbnail, setPatternThumbnail] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  
  // Threshold parameters
  const [patternThreshold, setPatternThreshold] = useState(200);
  const [solidThreshold, setSolidThreshold] = useState(0.60);
  const [objectPrompt, setObjectPrompt] = useState(
    "Analyze the image and determine with at least 70% confidence whether it contains natural elements like trees or mostly tree-covered images, and explicitly state 'True' or 'False' before listing identified objects or explaining uncertainty."
  );

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
      
      // Set threshold values if available
      if (data.session_data && data.session_data.thresholds) {
        if (data.session_data.thresholds.pattern_threshold) {
          setPatternThreshold(data.session_data.thresholds.pattern_threshold);
        }
        if (data.session_data.thresholds.solid_threshold) {
          setSolidThreshold(data.session_data.thresholds.solid_threshold);
        }
        if (data.session_data.thresholds.object_prompt) {
          setObjectPrompt(data.session_data.thresholds.object_prompt);
        }
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

  const handlePatternThresholdChange = async (event) => {
    const value = Number(event.target.value);
    setPatternThreshold(value);
    
    try {
      await updateThreshold('pattern_threshold', value);
    } catch (error) {
      console.error('Error updating pattern threshold:', error);
    }
  };

  const handleSolidThresholdChange = async (event) => {
    const value = Number(event.target.value);
    setSolidThreshold(value);
    
    try {
      await updateThreshold('solid_threshold', value);
    } catch (error) {
      console.error('Error updating solid threshold:', error);
    }
  };

  const handleObjectPromptChange = async (event) => {
    const value = event.target.value;
    setObjectPrompt(value);
    
    try {
      await updateThreshold('object_prompt', value);
    } catch (error) {
      console.error('Error updating object prompt:', error);
    }
  };

  const updateThreshold = async (thresholdType, value) => {
    try {
      const response = await fetch(`http://localhost:5000/api/update-threshold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          session_id: sessionId,
          threshold_type: thresholdType,
          value: value
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        console.error('Failed to update threshold:', data.message);
      }
    } catch (error) {
      console.error(`Error updating threshold:`, error);
      throw error;
    }
  };

  return (
    <Container fluid className="advanced-settings-container">
      <Row className="h-100">
        {/* Left menu */}
        <Col md={3} className="menu-col">
          <div className="settings-menu">
            <ExpandableOptionFrame title="Pattern Threshold">
              <div className="slider-container">
                <label>Threshold Value: {patternThreshold}</label>
                <input 
                  type="range" 
                  min="50" 
                  max="500" 
                  value={patternThreshold} 
                  onChange={handlePatternThresholdChange} 
                  className="form-range"
                />
              </div>
            </ExpandableOptionFrame>
            
            <ExpandableOptionFrame title="Solid Color Detection">
              <div className="slider-container">
                <label>Threshold Value: {solidThreshold.toFixed(2)}</label>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01"
                  value={solidThreshold} 
                  onChange={handleSolidThresholdChange} 
                  className="form-range"
                />
              </div>
            </ExpandableOptionFrame>
            
            <ExpandableOptionFrame title="Object Detection Prompt">
              <div className="input-container">
                <textarea 
                  value={objectPrompt} 
                  onChange={handleObjectPromptChange} 
                  className="form-control" 
                  rows="6"
                ></textarea>
              </div>
            </ExpandableOptionFrame>
          </div>
        </Col>
        
        {/* Main content */}
        <Col md={9} className="content-col">
          <Row className="h-50">
            {/* Dataset visualization */}
            <Col md={6} className="upload-col">
              <UploadFrame
                title="Dataset Preview"
                colorClass="dataset-color"
                thumbnail={datasetThumbnail}
                onUpload={(file) => handleUpload('dataset', file)}
                onDelete={() => handleDelete('dataset')}
                sessionId={sessionId}
                fileType="dataset"
              />
            </Col>
            
            {/* Mirror dataset visualization */}
            <Col md={6} className="upload-col">
              <UploadFrame
                title="Mirror Dataset Preview"
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
            {/* Pattern matching data visualization */}
            <Col md={6} className="mx-auto upload-col">
              <UploadFrame
                title="Pattern Matching Preview"
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

export default AdvancedSettingsPage;