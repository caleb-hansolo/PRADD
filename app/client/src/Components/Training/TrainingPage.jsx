// import React from 'react';
// import { Container, Row, Col } from 'react-bootstrap';
// import TrainingMenu from './TrainingMenu/TrainingMenu.jsx';
// import UploadFrame from '../Common/UploadFrame/UploadFrame.jsx';
// import './Training.css';
// import useSessionData from '../../hooks/useSessionData';

// const TrainingPage = ({ sessionId }) => {
//   const { sessionData, thumbnails, refresh } = useSessionData(sessionId);

//   const handleDelete = async (fileType) => {
//     try {
//       await fetch(`${process.env.REACT_APP_API_BASE_URL}/delete/${fileType}`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ session_id: sessionId }),
//       });
//       refresh();
//     } catch (error) {
//       console.error(`Error deleting ${fileType}:`, error);
//     }
//   };

//   return (
//     <Container fluid className="training-container">
//       <Row className="h-100">
//         <Col md={3} className="menu-col">
//           <TrainingMenu sessionId={sessionId} sessionData={sessionData} onRefreshData={refresh} />
//         </Col>

//         <Col md={9} className="content-col">
//           <Row className="h-50">
//             <Col md={6} className="upload-col">
//               <UploadFrame
//                 title="Dataset"
//                 colorClass="dataset-color"
//                 thumbnail={thumbnails.dataset}
//                 onUpload={refresh}
//                 onDelete={() => handleDelete('dataset')}
//                 sessionId={sessionId}
//                 fileType="dataset"
//               />
//             </Col>

//             <Col md={6} className="upload-col">
//               <UploadFrame
//                 title="Mirror Dataset"
//                 colorClass="mirror-color"
//                 thumbnail={thumbnails.mirror}
//                 onUpload={refresh}
//                 onDelete={() => handleDelete('mirror')}
//                 sessionId={sessionId}
//                 fileType="mirror"
//               />
//             </Col>
//           </Row>

//           <hr className="divider" />

//           <Row className="h-50">
//             <Col md={6} className="mx-auto upload-col">
//               <UploadFrame
//                 title="Training/Pattern Matching Data"
//                 colorClass="pattern-color"
//                 thumbnail={thumbnails.pattern}
//                 onUpload={refresh}
//                 onDelete={() => handleDelete('pattern')}
//                 sessionId={sessionId}
//                 fileType="pattern"
//               />
//             </Col>
//           </Row>
//         </Col>
//       </Row>
//     </Container>
//   );
// };

// export default TrainingPage;


import React, { useEffect, useState } from 'react'; // Added useEffect, useState for local processing state
import { Container, Row, Col, Alert } from 'react-bootstrap'; // Added Alert
import TrainingMenu from './TrainingMenu/TrainingMenu.jsx';
import UploadFrame from '../Common/UploadFrame/UploadFrame.jsx';
import './Training.css';
import useSessionData from '../../hooks/useSessionData';

const TrainingPage = ({ sessionId }) => {
  const { sessionData, thumbnails, refresh, loading, error: sessionError } = useSessionData(sessionId); // Assuming useSessionData provides loading/error

  // State for pipeline job
  const [pipelineJobId, setPipelineJobId] = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [pipelineError, setPipelineError] = useState(null);
  const [pollingIntervalId, setPollingIntervalId] = useState(null);

  const handleUploadComplete = (uploadData) => {
    // The onUpload prop in UploadFrame now passes an object like:
    // { fileType, filename, stored_filename, thumbnail_url, all_session_thumbnails }
    // The useSessionData's refresh() should ideally handle updating based on all_session_thumbnails
    // or by re-fetching the session.
    console.log('Upload complete in TrainingPage:', uploadData);
    refresh(); // Refresh should ideally fetch the latest session data which includes all thumbnails
  };

  const handleDelete = async (fileType) => {
    // This is passed to UploadFrame's onDelete, which now expects an object like { fileType }
    // However, the direct call here is fine.
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

  const pollPipelineStatus = async (jobId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/pipeline-status/${jobId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to fetch status" }));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setPipelineStatus(data);
      setPipelineError(null);

      if (data.status === 'completed' || data.status === 'failed' || data.status === 'completed_no_output') {
        if (pollingIntervalId) {
          clearInterval(pollingIntervalId);
          setPollingIntervalId(null);
        }
        setPipelineJobId(null); // Clear job ID after completion/failure to allow new run
      }
    } catch (err) {
      console.error('Error polling pipeline status:', err);
      setPipelineError(err.message);
      if (pollingIntervalId) {
         clearInterval(pollingIntervalId);
         setPollingIntervalId(null);
      }
      setPipelineJobId(null); // Also clear on error
    }
  };

  const handleRunPipeline = async () => {
    if (pipelineJobId && (pipelineStatus?.status === 'running' || pipelineStatus?.status === 'queued')) {
        alert("A pipeline is already running or queued.");
        return;
    }
    setPipelineStatus(null);
    setPipelineError(null);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/run-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({error: "Failed to start pipeline"}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.job_id) {
        setPipelineJobId(data.job_id);
        setPipelineStatus({ status: data.status || 'queued', message: data.message });
        // Start polling
        const intervalId = setInterval(() => pollPipelineStatus(data.job_id), 3000); // Poll every 3 seconds
        setPollingIntervalId(intervalId);
      } else {
        throw new Error(data.error || "Failed to get job ID from pipeline start response.");
      }
    } catch (error) {
      console.error('Error running pipeline:', error);
      setPipelineError(error.message);
      setPipelineJobId(null);
    }
  };

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, [pollingIntervalId]);

  if (loading) return <p>Loading session...</p>;
  if (sessionError) return <Alert variant="danger">Error loading session data: {sessionError.message || "Unknown error"}</Alert>;
  if (!sessionData) return <p>No session data found.</p>;


  return (
    <Container fluid className="training-container">
      <Row className="h-100">
        <Col md={3} className="menu-col">
          <TrainingMenu
            sessionId={sessionId}
            sessionData={sessionData}
            onRefreshData={refresh}
            onRunPipeline={handleRunPipeline} // Pass handler to menu
            isPipelineRunning={pipelineJobId !== null && (pipelineStatus?.status === 'running' || pipelineStatus?.status === 'queued')}
          />
           {/* Display Pipeline Status */}
           {pipelineJobId && pipelineStatus && (
            <div className="mt-3 p-2 border rounded">
              <h6>Pipeline Status (Job: {pipelineJobId.substring(0,8)}...)</h6>
              <p className={`mb-1 fw-bold text-${pipelineStatus.status === 'running' || pipelineStatus.status === 'queued' ? 'primary' : pipelineStatus.status === 'completed' ? 'success' : pipelineStatus.status === 'completed_no_output' ? 'warning' : 'danger'}`}>
                Status: {pipelineStatus.status}
              </p>
              <p className="mb-1" style={{fontSize: '0.9em'}}>{pipelineStatus.message}</p>
              {pipelineStatus.status === 'running' && pipelineStatus.start_time && (
                <small className="text-muted">Running for: {Math.round(Date.now()/1000 - pipelineStatus.start_time)}s</small>
              )}
              {pipelineStatus.status === 'completed' && pipelineStatus.download_url && (
                <Button variant="success" size="sm" href={`${process.env.REACT_APP_API_BASE_URL}${pipelineStatus.download_url}`} target="_blank">
                  Download Results
                </Button>
              )}
               {pipelineStatus.duration_seconds && (
                 <p className="mb-0 mt-1"><small>Duration: {pipelineStatus.duration_seconds}s</small></p>
               )}
            </div>
          )}
          {pipelineError && (
            <Alert variant="danger" className="mt-3">
              Pipeline Error: {pipelineError}
            </Alert>
          )}
        </Col>

        <Col md={9} className="content-col">
          <Row className="h-50">
            <Col md={6} className="upload-col">
              <UploadFrame
                title="Dataset"
                colorClass="dataset-color"
                thumbnails={thumbnails?.dataset} // Use optional chaining
                onUpload={handleUploadComplete}
                onDelete={() => handleDelete('dataset')}
                sessionId={sessionId}
                fileType="dataset"
                acceptFileTypes="video/*"
                allowMultipleFiles={false}
              />
            </Col>

            <Col md={6} className="upload-col">
              <UploadFrame
                title="Mirror Dataset"
                colorClass="mirror-color"
                thumbnails={thumbnails?.mirror} // Use optional chaining
                onUpload={handleUploadComplete}
                onDelete={() => handleDelete('mirror')}
                sessionId={sessionId}
                fileType="mirror"
                acceptFileTypes="video/*"
                allowMultipleFiles={false}
              />
            </Col>
          </Row>

          <hr className="divider" />

          <Row className="h-50">
            <Col md={6} className="mx-auto upload-col">
              <UploadFrame
                title="Training/Pattern Matching Data"
                colorClass="pattern-color"
                thumbnails={thumbnails?.pattern || []} // Expects array, default to empty if undefined
                onUpload={handleUploadComplete}
                onDelete={() => handleDelete('pattern')} // This will delete all patterns for the session
                sessionId={sessionId}
                fileType="pattern"
                acceptFileTypes="image/*"
                allowMultipleFiles={true}
              />
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};

export default TrainingPage;