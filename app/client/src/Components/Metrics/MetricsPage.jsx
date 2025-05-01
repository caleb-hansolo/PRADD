import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import './Metrics.css';

const MetricsPage = ({ sessionId }) => {
  const [metrics, setMetrics] = useState({
    processedFrames: 0,
    detectedObjects: 0,
    patternMatches: 0,
    solidColorFrames: 0
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      fetchMetrics();
    }
  }, [sessionId]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/metrics/${sessionId}`);
      const data = await response.json();
      
      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container fluid className="metrics-container">
      <Row className="h-100">
        <Col>
          <h3 className="mb-4">Analysis Metrics</h3>
          
          {loading ? (
            <div className="text-center">
              <p>Loading metrics...</p>
            </div>
          ) : (
            <div className="metrics-grid">
              <Card className="metric-card">
                <Card.Body>
                  <Card.Title>Processed Frames</Card.Title>
                  <div className="metric-value">{metrics.processedFrames}</div>
                </Card.Body>
              </Card>
              
              <Card className="metric-card">
                <Card.Body>
                  <Card.Title>Detected Objects</Card.Title>
                  <div className="metric-value">{metrics.detectedObjects}</div>
                </Card.Body>
              </Card>
              
              <Card className="metric-card">
                <Card.Body>
                  <Card.Title>Pattern Matches</Card.Title>
                  <div className="metric-value">{metrics.patternMatches}</div>
                </Card.Body>
              </Card>
              
              <Card className="metric-card">
                <Card.Body>
                  <Card.Title>Solid Color Frames</Card.Title>
                  <div className="metric-value">{metrics.solidColorFrames}</div>
                </Card.Body>
              </Card>
            </div>
          )}
          
          <Row className="mt-4">
            <Col md={12}>
              <Card>
                <Card.Body>
                  <Card.Title>Processing Results</Card.Title>
                  <p>This section will display detailed results of video processing...</p>
                  {/* Here you could add charts, graphs, or more detailed metrics */}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};

export default MetricsPage;