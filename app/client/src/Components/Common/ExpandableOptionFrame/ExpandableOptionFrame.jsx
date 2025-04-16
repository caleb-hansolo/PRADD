import React, { useState } from 'react';
import { Card, Button } from 'react-bootstrap';
import './ExpandableOptionFrame.css';

const ExpandableOptionFrame = ({ title, children, className }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Card className={`expandable-frame ${className || ''}`}>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>{title}</span>
        <Button 
          variant="outline-primary"
          size="sm"
          onClick={toggleExpand}
          className="toggle-btn"
        >
          {isExpanded ? '-' : '+'}
        </Button>
      </Card.Header>
      
      {isExpanded && (
        <Card.Body className="frame-content">
          {children}
        </Card.Body>
      )}
    </Card>
  );
};

export default ExpandableOptionFrame;