import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Alert, Button } from 'react-bootstrap';
import TrainingMenu from './TrainingMenu/TrainingMenu.jsx';
import UploadFrame from '../Common/UploadFrame/UploadFrame.jsx';
import './Training.css';
import useSessionData from '../../hooks/useSessionData';

const TrainingPage = ({ sessionId }) => {
  const { sessionData, thumbnails, refresh, loading, error: sessionError } = useSessionData(sessionId);

  const [pipelineJobId, setPipelineJobId] = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState(null); // This holds { status, message, download_url, ... }
  const [pipelineError, setPipelineError] = useState(null);
  const [pollingIntervalId, setPollingIntervalId] = useState(null);

  const handleUploadComplete = (uploadData) => {
    console.log('Upload complete in TrainingPage:', uploadData);
    refresh();
  };

  const handleDelete = async (fileType) => {
    try {
      await fetch(`${process.env.REACT_APP_BASE_URL}/api/delete/${fileType}`, {
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
      setPipelineStatus(data); // data will contain { status, message, download_url, ... }
      setPipelineError(null);

      if (data.status === 'completed' || data.status === 'failed' || data.status === 'completed_no_output') {
        if (pollingIntervalId) {
          clearInterval(pollingIntervalId);
          setPollingIntervalId(null);
        }
        // pipelineJobId -> download button to remain active based on the last job
        // setPipelineJobId(null); // clear job ID, makes run pipeline button active immediately
      }
    } catch (err) {
      console.error('Error polling pipeline status:', err);
      setPipelineError(err.message);
      if (pollingIntervalId) {
         clearInterval(pollingIntervalId);
         setPollingIntervalId(null);
      }
      // setPipelineJobId(null);
    }
  };

  const handleRunPipeline = async () => {
    // prevent running if already running
    if (pipelineJobId && (pipelineStatus?.status === 'running' || pipelineStatus?.status === 'queued')) {
        alert("A pipeline is already running or queued.");
        return;
    }
    // clear previous status and errors for a new run
    setPipelineStatus(null);
    setPipelineError(null);
    setPipelineJobId(null); // clear old job ID before starting a new one

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
        setPipelineJobId(data.job_id); // Set new job ID
        setPipelineStatus({ status: data.status || 'queued', message: data.message }); // Initial status
        const intervalId = setInterval(() => pollPipelineStatus(data.job_id), 3000);
        setPollingIntervalId(intervalId);
      } else {
        throw new Error(data.error || "Failed to get job ID from pipeline start response.");
      }
    } catch (error) {
      console.error('Error running pipeline:', error);
      setPipelineError(error.message);
      setPipelineJobId(null); // Clear job ID on error
    }
  };

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
            onRunPipeline={handleRunPipeline}
            isPipelineRunning={pipelineJobId !== null && (pipelineStatus?.status === 'running' || pipelineStatus?.status === 'queued')}
            pipelineStatus={pipelineStatus} // Pass the whole status object
          />
           {/* Display Pipeline Status - This part is good as is */}
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
              {/* Moved download button to TrainingMenu, but this is a good place for status text */}
               {pipelineStatus.status === 'completed' && pipelineStatus.download_url && (
                 <p className="mb-0 mt-1 text-success"><small>Results ready for download.</small></p>
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

        {/* Rest of the TrainingPage.jsx for UploadFrames */}
        <Col md={9} className="content-col">
          {/* ... UploadFrame components ... */}
          <Row className="h-50">
            <Col md={6} className="upload-col">
              <UploadFrame
                title="Dataset"
                colorClass="dataset-color"
                thumbnails={thumbnails?.dataset}
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
                thumbnails={thumbnails?.mirror}
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
                thumbnails={thumbnails?.pattern || []}
                onUpload={handleUploadComplete}
                onDelete={() => handleDelete('pattern')}
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