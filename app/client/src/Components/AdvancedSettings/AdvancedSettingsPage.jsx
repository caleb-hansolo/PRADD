import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Form, Alert } from 'react-bootstrap'; // Added Form, Alert
import ExpandableOptionFrame from '../Common/ExpandableOptionFrame/ExpandableOptionFrame';
import UploadFrame from '../Common/UploadFrame/UploadFrame.jsx'; // Corrected path if necessary
import useSessionData from '../../hooks/useSessionData';
import './AdvancedSettings.css';

const AdvancedSettingsPage = ({ sessionId }) => {
  // useSessionData provides the sessionData which includes thres_params
  const { sessionData, thumbnails, refresh, loading, error: sessionError } = useSessionData(sessionId);

  // Local state for threshold values, initialized AFTER sessionData is loaded
  const [patternSiftDistance, setPatternSiftDistance] = useState(200); // Corresponds to 'Pattern Thresholding Value'
  const [solidDetectionPercentage, setSolidDetectionPercentage] = useState(0.60); // Corresponds to 'Solid Color Detection'
  const [objectPrompt, setObjectPrompt] = useState("Analyze the image...");
  const [blackThresholdBW, setBlackThresholdBW] = useState(30); // New: 'Black Threshold BW'
  const [whiteThresholdBW, setWhiteThresholdBW] = useState(225); // New: 'White Threshold BW'

  // const [updateStatus, setUpdateStatus] = useState({ message: '', type: '' });


  useEffect(() => {
    if (sessionData?.thres_params) {
      setPatternSiftDistance(sessionData.thres_params['Pattern Thresholding Value'] || 200);
      setSolidDetectionPercentage(sessionData.thres_params['Solid Color Detection'] || 0.60);
      setObjectPrompt(sessionData.thres_params['Object Detection Prompt'] || "Analyze the image...");
      setBlackThresholdBW(sessionData.thres_params['Black Threshold BW'] || 30);
      setWhiteThresholdBW(sessionData.thres_params['White Threshold BW'] || 225);
    }
  }, [sessionData]);

  const handleUploadComplete = (uploadData) => {
    console.log('Upload complete in AdvancedSettingsPage:', uploadData);
    refresh();
  };

  const handleDelete = async (fileType) => {
    try {
      await fetch(`${process.env.REACT_APP_API_BASE_URL}/delete/${fileType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      refresh();
    } catch (error) {
      console.error(`Error deleting ${fileType}:`, error);
    }
  };

  // Generic handler for numeric threshold changes from sliders/inputs
  const handleThresholdValueChange = async (paramName, value, localSetter) => {
    const numericValue = Number(value);
    localSetter(numericValue); // Update local state immediately for responsive UI
    await updateBackendThreshold(paramName, numericValue);
  };

  // Handler for text prompt change
  const handlePromptChange = async (paramName, value, localSetter) => {
    localSetter(value); // Update local state
    await updateBackendThreshold(paramName, value);
  };

  const updateBackendThreshold = async (paramName, value) => {
    // setUpdateStatus({ message: '', type: '' });
    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/update-threshold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          param_name: paramName, // Use the exact key the backend expects
          value: value,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // setUpdateStatus({ message: `${paramName.replace(/([A-Z])/g, ' $1').trim()} updated successfully!`, type: 'success' });
        refresh(); // Refresh session data to confirm changes
      } else {
        throw new Error(data.message || data.detail || 'Failed to update threshold');
      }
    } catch (err) {
      console.error(`Error updating ${paramName}:`, err);
      // setUpdateStatus({ message: `Error updating ${paramName}: ${err.message}`, type: 'danger' });
    }
  };


  const handleRestoreDefaults = async () => {
    // setUpdateStatus({ message: '', type: '' });
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/restore-defaults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        // setUpdateStatus({ message: 'Defaults restored successfully!', type: 'success' });
        refresh(); // This will re-fetch session data and trigger useEffect to update local state
      } else {
         throw new Error(data.message || data.detail || 'Failed to restore defaults');
      }
    } catch (error) {
      console.error('Error restoring defaults:', error);
      // setUpdateStatus({ message: `Error restoring defaults: ${error.message}`, type: 'danger' });
    }
  };

  if (loading) return <p>Loading settings...</p>;
  if (sessionError) return <Alert variant="danger">Error loading session data for settings: {sessionError.message || "Unknown error"}</Alert>;
  if (!sessionData) return <p>No session data found for settings.</p>;

  return (
    <Container fluid className="advanced-settings-container">
       {/* {updateStatus.message && <Alert variant={updateStatus.type || 'info'} className="mt-2">{updateStatus.message}</Alert>} */}
      <Row className="h-100">
        <Col md={3} className="menu-col">
          <div className="settings-menu">
            {/* Pattern SIFT Distance */}
            <ExpandableOptionFrame title="Pattern SIFT Distance">
              <Form.Group className="slider-container p-2">
                <Form.Label>Threshold Value: {patternSiftDistance}</Form.Label>
                <Form.Control
                  type="range"
                  min="10" // Adjusted min for SIFT distance
                  max="500"
                  step="1"
                  value={patternSiftDistance}
                  onChange={(e) => handleThresholdValueChange('Pattern Thresholding Value', e.target.value, setPatternSiftDistance)}
                />
              </Form.Group>
            </ExpandableOptionFrame>

            {/* Solid Color Detection Percentage */}
            <ExpandableOptionFrame title="Solid Color Detection Percentage">
              <Form.Group className="slider-container p-2">
                <Form.Label>Threshold: {solidDetectionPercentage.toFixed(2)}</Form.Label>
                <Form.Control
                  type="range"
                  min="0.05"
                  max="0.95"
                  step="0.01"
                  value={solidDetectionPercentage}
                  onChange={(e) => handleThresholdValueChange('Solid Color Detection', e.target.value, setSolidDetectionPercentage)}
                />
              </Form.Group>
            </ExpandableOptionFrame>

            {/* Black Threshold for B/W Check */}
            <ExpandableOptionFrame title="Black Pixel Threshold">
              <Form.Group className="slider-container p-2">
                <Form.Label>Value (1-100): {blackThresholdBW}</Form.Label>
                <Form.Control
                  type="range"
                  min="1"
                  max="100" // Practical upper limit for "black"
                  step="1"
                  value={blackThresholdBW}
                  onChange={(e) => handleThresholdValueChange('Black Threshold BW', e.target.value, setBlackThresholdBW)}
                />
              </Form.Group>
            </ExpandableOptionFrame>

            {/* White Threshold for B/W Check */}
            <ExpandableOptionFrame title="White Pixel Threshold">
              <Form.Group className="slider-container p-2">
                <Form.Label>Value (150-255): {whiteThresholdBW}</Form.Label>
                <Form.Control
                  type="range"
                  min="150" // Practical lower limit for "white"
                  max="255"
                  step="1"
                  value={whiteThresholdBW}
                  onChange={(e) => handleThresholdValueChange('White Threshold BW', e.target.value, setWhiteThresholdBW)}
                />
              </Form.Group>
            </ExpandableOptionFrame>

            {/* Object Detection Prompt */}
            <ExpandableOptionFrame title="Object Detection Prompt">
              <Form.Group className="input-container p-2">
                <Form.Control
                  as="textarea"
                  value={objectPrompt}
                  onChange={(e) => handlePromptChange('Object Detection Prompt', e.target.value, setObjectPrompt)}
                  rows="6"
                />
              </Form.Group>
            </ExpandableOptionFrame>

            <div className="d-grid gap-2 mt-3 mb-4 p-2">
              <Button variant="secondary" onClick={handleRestoreDefaults}>
                Restore Defaults
              </Button>
            </div>
          </div>
        </Col>

        <Col md={9} className="content-col">
          {/* Previews - pass correct props to UploadFrame */}
          <Row className="h-50">
            <Col md={6} className="upload-col">
              <UploadFrame
                title="Raw Video Preview"
                colorClass="dataset-color"
                thumbnails={thumbnails?.dataset}
                onUpload={handleUploadComplete}
                onDelete={() => handleDelete('dataset')}
                sessionId={sessionId}
                fileType="dataset"
                acceptFileTypes="video/*"
                allowMultipleFiles={false}
                // isPreview={true} // This prop's usage was unclear; keep or remove as needed
              />
            </Col>
            <Col md={6} className="upload-col">
              <UploadFrame
                title="Realsense Depth Video Preview"
                colorClass="mirror-color"
                thumbnails={thumbnails?.mirror}
                onUpload={handleUploadComplete}
                onDelete={() => handleDelete('mirror')}
                sessionId={sessionId}
                fileType="mirror"
                acceptFileTypes="video/*"
                allowMultipleFiles={false}
                // isPreview={true}
              />
            </Col>
          </Row>
          <hr className="divider" />
          <Row className="h-50">
            <Col md={6} className="mx-auto upload-col">
              <UploadFrame
                title="Pattern Matching Preview"
                colorClass="pattern-color"
                thumbnails={thumbnails?.pattern || []}
                onUpload={handleUploadComplete}
                onDelete={() => handleDelete('pattern')}
                sessionId={sessionId}
                fileType="pattern"
                acceptFileTypes="image/*"
                allowMultipleFiles={true}
                // isPreview={true}
              />
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};

export default AdvancedSettingsPage;