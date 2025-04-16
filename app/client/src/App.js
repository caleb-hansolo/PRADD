// import React, {useState, useEffect } from 'react';

// function App() {


//   const [data, setData] = useState([{}]);

//   // whatever response the members route returns from the backend, we are going to put the data from that json into the data variable
//   useEffect(() => {
//     fetch('/members').then(
//       res => res.json()
//     ).then(
//       data => {
//         setData(data)
//         console.log(data)
//       }
//     )
//   })

//   return (
//     <div className="App">
//       {(typeof data.members === 'undefined') ? (
//         <p>Loading...</p>  
//       ) : (
//         data.members.map((member, i) => (
//           <p key={i}>{member}</p>
//         ))
//       )}
//     </div>
//   )
// }

// export default App

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Tabs, Tab } from 'react-bootstrap';
import TrainingPage from './Components/Training/TrainingPage';
import AdvancedSettingsPage from './Components/AdvancedSettings/AdvancedSettingsPage';
import MetricsPage from './Components/Metrics/MetricsPage';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('training');

  // Initialize session when app loads
  useEffect(() => {
    const initSession = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/new-session');
        const data = await response.json();
        setSessionId(data.session_id);
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing session:', error);
        setIsLoading(false);
      }
    };

    initSession();
  }, []);

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Router>
      <div className="app-container">
        {/* <h1 className="app-title">Thresholding and Machine Learning App</h1> */}
        
        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
          <Tab eventKey="training" title="Training and Testing">
            <TrainingPage sessionId={sessionId} />
          </Tab>
          <Tab eventKey="advanced" title="Advanced Settings">
            <AdvancedSettingsPage sessionId={sessionId} />
          </Tab>
          <Tab eventKey="metrics" title="Metrics">
            <MetricsPage sessionId={sessionId} />
          </Tab>
        </Tabs>
      </div>
    </Router>
  );
}

export default App;
