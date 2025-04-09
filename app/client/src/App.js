import React, {useState, useEffect } from 'react';

function App() {


  const [data, setData] = useState([{}]);

  // whatever response the members route returns from the backend, we are going to put the data from that json into the data variable
  useEffect(() => {
    fetch('/members').then(
      res => res.json()
    ).then(
      data => {
        setData(data)
        console.log(data)
      }
    )
  })

  return (
    <div className="App">
      {(typeof data.members === 'undefined') ? (
        <p>Loading...</p>  
      ) : (
        data.members.map((member, i) => (
          <p key={i}>{member}</p>
        ))
      )}
    </div>
  )
}

export default App
