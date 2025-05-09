// import React, { useState } from 'react';
// import { Card, Form, Button } from 'react-bootstrap';
// import ExpandableOptionFrame from '../../Common/ExpandableOptionFrame/ExpandableOptionFrame';
// // import './TrainingMenu.css';

// const TrainingMenu = ({ sessionId, sessionData, onRefreshData }) => {
//   const [isRunning, setIsRunning] = useState(false);
//   const [methodsSelection, setMethodsSelection] = useState({
//     removeBlackFrames: false,
//     removeWhiteFrames: false,
//     thresholdingMethods: false,
//   });

//   const [pipelineSelection, setPipelineSelection] = useState({
//     patternThresholding: true,
//     modelObjectDetection: true,
//     solidColorDetection: true,
//   });

//   // Update methods selection
//   const handleMethodChange = (e) => {
//     setMethodsSelection(prev => ({
//       ...prev,
//       [e.target.name]: e.target.checked
//     }));
//   };

//   // Update pipeline selection
//   const handlePipelineChange = (e) => {
//     setPipelineSelection(prev => ({
//       ...prev,
//       [e.target.name]: e.target.checked
//     }));
//   };

//   // Apply methods to dataset
//   const handleApplyMethods = async () => {
//     // TODO: Implement method application
//     console.log('Applying methods:', methodsSelection);
//   };

//   // Run pipeline with selected processes
//   const handleRunPipeline = async () => {
//     setIsRunning(true);
    
//     try {
//       const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/run-pipeline`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           session_id: sessionId,
//           processes: {
//             'Pattern Thresholding': pipelineSelection.patternThresholding,
//             'Model Object Detection': pipelineSelection.modelObjectDetection,
//             'Solid Color Detection': pipelineSelection.solidColorDetection,
//           }
//         }),
//       });

//       const data = await response.json();
      
//       if (data.success) {
//         console.log('Pipeline results:', data.results);
//         // Refresh session data
//         onRefreshData();
//       }
//     } catch (error) {
//       console.error('Error running pipeline:', error);
//     } finally {
//       setIsRunning(false);
//     }
//   };

//   return (
//     <div className="training-menu">
//       <ExpandableOptionFrame title="Methods">
//         <Form>
//           <Form.Check 
//             type="checkbox"
//             id="remove-black-frames"
//             label="Remove all black frames"
//             name="removeBlackFrames"
//             checked={methodsSelection.removeBlackFrames}
//             onChange={handleMethodChange}
//           />
//           <Form.Check 
//             type="checkbox"
//             id="remove-white-frames"
//             label="Remove all white frames"
//             name="removeWhiteFrames"
//             checked={methodsSelection.removeWhiteFrames}
//             onChange={handleMethodChange}
//           />
//           <Form.Check 
//             type="checkbox"
//             id="thresholding-methods"
//             label="Thresholding Methods"
//             name="thresholdingMethods"
//             checked={methodsSelection.thresholdingMethods}
//             onChange={handleMethodChange}
//           />
//           <Button 
//             variant="outline-success" 
//             className="w-100 mt-3"
//             onClick={handleApplyMethods}
//           >
//             Apply Methods
//           </Button>
//         </Form>
//       </ExpandableOptionFrame>

//       <ExpandableOptionFrame title="Pipeline" className="mt-4">
//         <Form>
//           <Form.Check 
//             type="checkbox"
//             id="pattern-thresholding"
//             label="Pattern Thresholding"
//             name="patternThresholding"
//             checked={pipelineSelection.patternThresholding}
//             onChange={handlePipelineChange}
//             disabled={true}
//           />
//           <Form.Check 
//             type="checkbox"
//             id="model-object-detection"
//             label="Model Object Detection"
//             name="modelObjectDetection"
//             checked={pipelineSelection.modelObjectDetection}
//             onChange={handlePipelineChange}
//           />
//           <Form.Check 
//             type="checkbox"
//             id="solid-color-detection"
//             label="Solid Color Detection"
//             name="solidColorDetection"
//             checked={pipelineSelection.solidColorDetection}
//             onChange={handlePipelineChange}
//           />
//           <Button 
//             variant="outline-danger" 
//             className="w-100 mt-3"
//             onClick={handleRunPipeline}
//             disabled={isRunning}
//           >
//             {isRunning ? 'Running...' : 'Run Pipeline'}
//           </Button>
//         </Form>
//       </ExpandableOptionFrame>
//     </div>
//   );
// };

// export default TrainingMenu;

import React, { useState, useEffect } from 'react';
import { Form, Button, Alert } from 'react-bootstrap'; // Added Alert
import ExpandableOptionFrame from '../../Common/ExpandableOptionFrame/ExpandableOptionFrame';
// import './TrainingMenu.css'; // Assuming you have this CSS file

// Props now include onRunPipeline and isPipelineRunning from TrainingPage
const TrainingMenu = ({ sessionId, sessionData, onRefreshData, onRunPipeline, isPipelineRunning }) => {
  // Local state for UI checkboxes, initialized from sessionData
  const [pipelineSelection, setPipelineSelection] = useState({
    'Pattern Thresholding': true,
    'Model Object Detection': true,
    'Solid Color Detection': true,
  });
  const [updateStatus, setUpdateStatus] = useState({ message: '', type: '' });

  // This "Methods" section seems distinct from the core pipeline processes.
  // Its functionality ("Apply Methods") was a TODO. If it's still needed,
  // it would require its own backend logic and API endpoints.
  // For now, focusing on the main pipeline.
  const [methodsSelection, setMethodsSelection] = useState({
    removeBlackFrames: false,
    removeWhiteFrames: false,
    thresholdingMethods: false, // This might be redundant if covered by pipelineSelection
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
    setPipelineSelection(updatedSelection); // Update local UI state immediately

    // Persist this change to the backend
    setUpdateStatus({ message: '', type: '' });
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
        setUpdateStatus({ message: `${name.replace(/([A-Z])/g, ' $1').trim()} setting updated.`, type: 'success' });
        onRefreshData(); // Refresh parent's sessionData to confirm
      } else {
        throw new Error(data.message || data.detail || `Failed to update ${name}`);
      }
    } catch (error) {
      console.error('Error updating pipeline configuration:', error);
      setUpdateStatus({ message: `Error updating config: ${error.message}`, type: 'danger' });
      // Optionally revert local state if backend update fails
      // setPipelineSelection(prev => ({ ...prev, [name]: !checked }));
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

  // TODO: Implement method application if this section is still relevant
  const handleApplyMethods = async () => {
    console.log('Applying methods (Not Implemented):', methodsSelection);
    alert("Functionality for 'Apply Methods' is not yet implemented.");
  };
   const handleMethodChange = (e) => {
    setMethodsSelection(prev => ({
      ...prev,
      [e.target.name]: e.target.checked
    }));
  };


  return (
    <div className="training-menu p-3 border rounded bg-light"> {/* Added some styling classes */}
      <h5 className="mb-3">Training Configuration</h5>

      {updateStatus.message && (
        <Alert variant={updateStatus.type || 'info'} onClose={() => setUpdateStatus({message:'', type:''})} dismissible>
          {updateStatus.message}
        </Alert>
      )}

      {/* "Methods" Section - review if still needed or how it integrates */}
      <ExpandableOptionFrame title="Pre-processing Methods (Example)">
        <Form>
          <Form.Check
            type="checkbox"
            id="remove-black-frames"
            label="Remove all black frames (Example)"
            name="removeBlackFrames"
            checked={methodsSelection.removeBlackFrames}
            onChange={handleMethodChange}
            disabled // Disabled as it's an example
          />
          {/* ... other method checkboxes ... */}
          <Button
            variant="outline-secondary" // Changed variant
            className="w-100 mt-3"
            onClick={handleApplyMethods}
            disabled // Disabled as it's an example
          >
            Apply Methods (Example)
          </Button>
        </Form>
      </ExpandableOptionFrame>

      <ExpandableOptionFrame title="Pipeline Processes" className="mt-3">
        <Form>
          {/* Iterate over keys in pipelineSelection to create checkboxes dynamically */}
          {Object.keys(pipelineSelection).map((key) => (
            <Form.Check
              key={key}
              type="checkbox"
              id={`pipeline-${key.toLowerCase().replace(/\s+/g, '-')}`}
              label={key.replace(/([A-Z])/g, ' $1').trim()} // Add spaces for readability
              name={key} // This should match the keys in sessionData.pipeline_processes
              checked={pipelineSelection[key]}
              onChange={handlePipelineChange}
              // Example: disable pattern thresholding if no pattern images uploaded -
              // This logic would require knowing if pattern images exist, passed via props or sessionData.
              // disabled={key === 'Pattern Thresholding' && !hasPatternImages}
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