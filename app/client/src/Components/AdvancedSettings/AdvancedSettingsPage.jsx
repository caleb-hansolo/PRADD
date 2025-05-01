import React, { useState } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import ExpandableOptionFrame from '../Common/ExpandableOptionFrame/ExpandableOptionFrame';
import UploadFrame from '../Common/UploadFrame/UploadFrame';
import useSessionData from '../../hooks/useSessionData';
import './AdvancedSettings.css';

const AdvancedSettingsPage = ({ sessionId }) => {
  const { thumbnails, refresh } = useSessionData(sessionId);

  const [patternThreshold, setPatternThreshold] = useState(200);
  const [solidThreshold, setSolidThreshold] = useState(0.60);
  const [objectPrompt, setObjectPrompt] = useState(
    "Analyze the image and determine with at least 70% confidence whether it contains natural elements like trees or mostly tree-covered images, and explicitly state 'True' or 'False' before listing identified objects or explaining uncertainty."
  );

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

  const handlePatternThresholdChange = async (event) => {
    const value = Number(event.target.value);
    setPatternThreshold(value);
    await updateThreshold('pattern_threshold', value);
  };

  const handleSolidThresholdChange = async (event) => {
    const value = Number(event.target.value);
    setSolidThreshold(value);
    await updateThreshold('solid_threshold', value);
  };

  const handleObjectPromptChange = async (event) => {
    const value = event.target.value;
    setObjectPrompt(value);
    await updateThreshold('object_prompt', value);
  };

  const handleRestoreDefaults = async () => {
    try {
      await fetch(`${process.env.REACT_APP_API_BASE_URL}/restore-defaults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      refresh();
    } catch (error) {
      console.error('Error restoring defaults:', error);
    }
  };

  const updateThreshold = async (thresholdType, value) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/update-threshold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          threshold_type: thresholdType,
          value: value,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        console.error('Failed to update threshold:', data.message);
      }
    } catch (err) {
      console.error('Error updating threshold:', err);
    }
  };

  // debugging
  console.log("advanced settings: dataset: ", thumbnails.dataset);

  return (
    <Container fluid className="advanced-settings-container">
      <Row className="h-100">
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

            <div className="d-grid gap-2 mb-4">
              <Button variant="secondary" onClick={handleRestoreDefaults}>
                Restore Defaults
              </Button>
            </div>
          </div>
        </Col>

        <Col md={9} className="content-col">
          <Row className="h-50">
            <Col md={6} className="upload-col">
              <UploadFrame
                title="Dataset Preview"
                colorClass="dataset-color"
                thumbnail={thumbnails.dataset}
                onUpload={refresh}
                onDelete={() => handleDelete('dataset')}
                sessionId={sessionId}
                fileType="dataset"
                isPreview={true}
              />
            </Col>

            <Col md={6} className="upload-col">
              <UploadFrame
                title="Mirror Dataset Preview"
                colorClass="mirror-color"
                thumbnail={thumbnails.mirror}
                onUpload={refresh}
                onDelete={() => handleDelete('mirror')}
                sessionId={sessionId}
                fileType="mirror"
                isPreview={true}
              />
            </Col>
          </Row>

          <hr className="divider" />

          <Row className="h-50">
            <Col md={6} className="mx-auto upload-col">
              <UploadFrame
                title="Pattern Matching Preview"
                colorClass="pattern-color"
                thumbnail={thumbnails.pattern}
                onUpload={refresh}
                onDelete={() => handleDelete('pattern')}
                sessionId={sessionId}
                fileType="pattern"
                isPreview={true}
              />
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};

export default AdvancedSettingsPage;
