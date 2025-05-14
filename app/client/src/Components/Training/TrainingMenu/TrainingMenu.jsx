import React, { useState, useEffect } from 'react';
import { Form, Button, Alert } from 'react-bootstrap'; // Make sure Alert is imported if using updateStatus
import ExpandableOptionFrame from '../../Common/ExpandableOptionFrame/ExpandableOptionFrame';

// Props now include onRunPipeline, isPipelineRunning, and pipelineStatus
const TrainingMenu = ({ sessionId, sessionData, onRefreshData, onRunPipeline, isPipelineRunning, pipelineStatus }) => {
  const [pipelineSelection, setPipelineSelection] = useState({
    'Pattern Thresholding': true,
    'Model Object Detection': true,
    'Solid Color Detection': true,
  });
  const [updateStatus, setUpdateStatus] = useState({ message: '', type: '' }); // For checkbox updates

  useEffect(() => {
    if (sessionData?.pipeline_processes) {
      setPipelineSelection(sessionData.pipeline_processes);
    }
  }, [sessionData]);

  const handlePipelineChange = async (e) => {
    const { name, checked } = e.target;
    const updatedSelection = { // Keep a local copy for immediate UI update if desired
      ...pipelineSelection,
      [name]: checked,
    };
    setPipelineSelection(updatedSelection);


    setUpdateStatus({ message: '', type: '' }); // Clear previous status
    try {
      // Send the entire processes_config object for consistency with backend expectation
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/update-pipeline-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          processes_config: updatedSelection, // Send the whole updated selection
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        // The onRefreshData will fetch the latest sessionData, which then updates pipelineSelection via useEffect
        onRefreshData(); 
        setUpdateStatus({ message: `Pipeline config updated.`, type: 'success' });

      } else {
        // Revert local state on failure if desired
        // setPipelineSelection(prev => ({ ...prev, [name]: !checked }));
        throw new Error(data.message || data.detail || `Failed to update ${name}`);
      }
    } catch (error) {
      console.error('Error updating pipeline configuration:', error);
      setUpdateStatus({ message: `Error updating config: ${error.message}`, type: 'danger' });
    }
  };

  const handleRunPipelineClick = () => {
    if (onRunPipeline) {
      onRunPipeline();
    }
  };

  // Determine if the download button should be enabled
  const canDownload = pipelineStatus?.status === 'completed' && pipelineStatus?.download_url;

  return (
    <div className="training-menu p-3 border rounded bg-light">
      <h5 className="mb-3">Training Configuration</h5>

      {updateStatus.message && (
        <Alert variant={updateStatus.type || 'info'} onClose={() => setUpdateStatus({message:'', type:''})} dismissible className="mt-2 mb-2">
          {updateStatus.message}
        </Alert>
      )}

      <ExpandableOptionFrame title="Pipeline Processes" className="mt-3">
        <Form>
          {Object.keys(pipelineSelection).map((key) => (
            <Form.Check
              key={key}
              type="checkbox"
              id={`pipeline-${key.toLowerCase().replace(/\s+/g, '-')}`}
              label={key.replace(/([A-Z])/g, ' $1').trim()}
              name={key}
              checked={pipelineSelection[key]}
              onChange={handlePipelineChange}
              disabled={key === 'Pattern Thresholding'} // Example: keep Pattern Thresholding always checked
            />
          ))}
          <Button
            variant="danger"
            className="w-100 mt-3"
            onClick={handleRunPipelineClick}
            disabled={isPipelineRunning}
          >
            {isPipelineRunning ? 'Pipeline Running...' : 'Run Full Pipeline'}
          </Button>

          
        </Form>
      </ExpandableOptionFrame>
      {/* Download Button */}
          <Button
            variant="success" // Or "primary", "info", etc.
            className="w-100 mt-2" // Added some margin-top
            href={canDownload ? `${process.env.REACT_APP_BASE_URL}${pipelineStatus.download_url}` : undefined}
            target="_blank" // Open in new tab
            rel="noopener noreferrer" // Security for target="_blank"
            disabled={!canDownload || isPipelineRunning} // Disable if not ready or pipeline is busy
            download // Suggests to the browser to download the linked file
          >
            {isPipelineRunning ? 'Processing...' : (canDownload ? 'Download Results' : 'Download Results (Not Ready)')}
          </Button>
    </div>
  );
};

export default TrainingMenu;