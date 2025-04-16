import React, { useState } from 'react';
import { Card, Form, Button } from 'react-bootstrap';
import ExpandableOptionFrame from '../../Common/ExpandableOptionFrame/ExpandableOptionFrame';
// import './TrainingMenu.css';

const TrainingMenu = ({ sessionId, sessionData, onRefreshData }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [methodsSelection, setMethodsSelection] = useState({
    removeBlackFrames: false,
    removeWhiteFrames: false,
    thresholdingMethods: false,
  });

  const [pipelineSelection, setPipelineSelection] = useState({
    patternThresholding: true,
    modelObjectDetection: true,
    solidColorDetection: true,
  });

  // Update methods selection
  const handleMethodChange = (e) => {
    setMethodsSelection(prev => ({
      ...prev,
      [e.target.name]: e.target.checked
    }));
  };

  // Update pipeline selection
  const handlePipelineChange = (e) => {
    setPipelineSelection(prev => ({
      ...prev,
      [e.target.name]: e.target.checked
    }));
  };

  // Apply methods to dataset
  const handleApplyMethods = async () => {
    // TODO: Implement method application
    console.log('Applying methods:', methodsSelection);
  };

  // Run pipeline with selected processes
  const handleRunPipeline = async () => {
    setIsRunning(true);
    
    try {
      const response = await fetch('http://localhost:5000/api/run-pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          processes: {
            'Pattern Thresholding': pipelineSelection.patternThresholding,
            'Model Object Detection': pipelineSelection.modelObjectDetection,
            'Solid Color Detection': pipelineSelection.solidColorDetection,
          }
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Pipeline results:', data.results);
        // Refresh session data
        onRefreshData();
      }
    } catch (error) {
      console.error('Error running pipeline:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="training-menu">
      <ExpandableOptionFrame title="Methods">
        <Form>
          <Form.Check 
            type="checkbox"
            id="remove-black-frames"
            label="Remove all black frames"
            name="removeBlackFrames"
            checked={methodsSelection.removeBlackFrames}
            onChange={handleMethodChange}
          />
          <Form.Check 
            type="checkbox"
            id="remove-white-frames"
            label="Remove all white frames"
            name="removeWhiteFrames"
            checked={methodsSelection.removeWhiteFrames}
            onChange={handleMethodChange}
          />
          <Form.Check 
            type="checkbox"
            id="thresholding-methods"
            label="Thresholding Methods"
            name="thresholdingMethods"
            checked={methodsSelection.thresholdingMethods}
            onChange={handleMethodChange}
          />
          <Button 
            variant="outline-success" 
            className="w-100 mt-3"
            onClick={handleApplyMethods}
          >
            Apply Methods
          </Button>
        </Form>
      </ExpandableOptionFrame>

      <ExpandableOptionFrame title="Pipeline" className="mt-4">
        <Form>
          <Form.Check 
            type="checkbox"
            id="pattern-thresholding"
            label="Pattern Thresholding"
            name="patternThresholding"
            checked={pipelineSelection.patternThresholding}
            onChange={handlePipelineChange}
            disabled={true}
          />
          <Form.Check 
            type="checkbox"
            id="model-object-detection"
            label="Model Object Detection"
            name="modelObjectDetection"
            checked={pipelineSelection.modelObjectDetection}
            onChange={handlePipelineChange}
          />
          <Form.Check 
            type="checkbox"
            id="solid-color-detection"
            label="Solid Color Detection"
            name="solidColorDetection"
            checked={pipelineSelection.solidColorDetection}
            onChange={handlePipelineChange}
          />
          <Button 
            variant="outline-danger" 
            className="w-100 mt-3"
            onClick={handleRunPipeline}
            disabled={isRunning}
          >
            {isRunning ? 'Running...' : 'Run Pipeline'}
          </Button>
        </Form>
      </ExpandableOptionFrame>
    </div>
  );
};

export default TrainingMenu;