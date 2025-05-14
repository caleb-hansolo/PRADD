import React, { useState, useEffect } from 'react';
import { Form, Button, Alert } from 'react-bootstrap'; // Added Alert
import ExpandableOptionFrame from '../../Common/ExpandableOptionFrame/ExpandableOptionFrame';
// import './TrainingMenu.css'; // this dont exist yet

// Props now include onRunPipeline and isPipelineRunning from TrainingPage
const TrainingMenu = ({ sessionId, sessionData, onRefreshData, onRunPipeline, isPipelineRunning }) => {
  // Local state for UI checkboxes, initialized from sessionData
  const [pipelineSelection, setPipelineSelection] = useState({
    'Pattern Thresholding': true,
    'Model Object Detection': true,
    'Solid Color Detection': true,
  });

  // Initialize pipelineSelection from sessionData when available or changed
  useEffect(() => {
    if (sessionData?.pipeline_processes) {
      setPipelineSelection(sessionData.pipeline_processes);
    }
  }, [sessionData]);

  // Update pipeline selection and send to backend
  const handlePipelineChange = async (e) => {
    const { name, checked } = e.target;
    const updatedSelection = {
      ...pipelineSelection,
      [name]: checked,
    };

    // Persist this change to the backend
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/update-pipeline-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          processes_config: { [name]: checked }, // Send only the changed process or the whole object
                                                // Backend expects {processes_config: updatedSelection}
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        onRefreshData(); // Refresh parent's sessionData to confirm
      } else {
        throw new Error(data.message || data.detail || `Failed to update ${name}`);
      }
    } catch (error) {
      console.error('Error updating pipeline configuration:', error);
    }
  };


  // Handler for the "Run Pipeline" button click
  const handleRunPipelineClick = () => {
    // The actual API call and state management for running the pipeline
    // is handled by the onRunPipeline function passed from TrainingPage.
    // TrainingMenu just needs to ensure the latest pipeline selections are saved before running.
    // The handlePipelineChange already saves them.
    if (onRunPipeline) {
      onRunPipeline();
    }
  };


  return (
    <div className="training-menu p-3 border rounded bg-light"> 
      <h5 className="mb-3">Training Configuration</h5>
      <ExpandableOptionFrame title="Pipeline Processes" className="mt-3">
        <Form>
          {/* Iterate over keys in pipelineSelection to create checkboxes dynamically */}
          {Object.keys(pipelineSelection).map((key) => (
            <Form.Check
              key={key}
              type="checkbox"
              id={`pipeline-${key.toLowerCase().replace(/\s+/g, '-')}`}
              label={key.replace(/([A-Z])/g, ' $1').trim()} 
              name={key} // This should match the keys in sessionData.pipeline_processes
              checked={pipelineSelection[key]}
              onChange={handlePipelineChange}
              // disable pattern thresholding checkbox (should always be on)
              disabled={key === 'Pattern Thresholding'}
            />
          ))}
          <Button
            variant="danger" // Kept original variant
            className="w-100 mt-3"
            onClick={handleRunPipelineClick} // Calls the prop from TrainingPage
            disabled={isPipelineRunning} // Uses the prop from TrainingPage
          >
            {isPipelineRunning ? 'Pipeline Running...' : 'Run Full Pipeline'}
          </Button>
        </Form>
      </ExpandableOptionFrame>
    </div>
  );
};

export default TrainingMenu;