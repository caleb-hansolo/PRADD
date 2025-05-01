import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import TrainingMenu from './TrainingMenu/TrainingMenu.jsx';
import UploadFrame from '../Common/UploadFrame/UploadFrame.jsx';
import './Training.css';
import useSessionData from '../../hooks/useSessionData';

const TrainingPage = ({ sessionId }) => {
  const { sessionData, thumbnails, refresh } = useSessionData(sessionId);

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

  // debugging
  console.log("training: dataset: ", thumbnails.dataset);

  return (
    <Container fluid className="training-container">
      <Row className="h-100">
        <Col md={3} className="menu-col">
          <TrainingMenu sessionId={sessionId} sessionData={sessionData} onRefreshData={refresh} />
        </Col>

        <Col md={9} className="content-col">
          <Row className="h-50">
            <Col md={6} className="upload-col">
              <UploadFrame
                title="Dataset"
                colorClass="dataset-color"
                thumbnail={thumbnails.dataset}
                onUpload={refresh}
                onDelete={() => handleDelete('dataset')}
                sessionId={sessionId}
                fileType="dataset"
              />
            </Col>

            <Col md={6} className="upload-col">
              <UploadFrame
                title="Mirror Dataset"
                colorClass="mirror-color"
                thumbnail={thumbnails.mirror}
                onUpload={refresh}
                onDelete={() => handleDelete('mirror')}
                sessionId={sessionId}
                fileType="mirror"
              />
            </Col>
          </Row>

          <hr className="divider" />

          <Row className="h-50">
            <Col md={6} className="mx-auto upload-col">
              <UploadFrame
                title="Training/Pattern Matching Data"
                colorClass="pattern-color"
                thumbnail={thumbnails.pattern}
                onUpload={refresh}
                onDelete={() => handleDelete('pattern')}
                sessionId={sessionId}
                fileType="pattern"
              />
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};

export default TrainingPage;
