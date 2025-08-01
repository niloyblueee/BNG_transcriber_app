import { useState } from 'react';
import './App.css';
import Header  from './Header';
//import Authwrapper from './AuthWrapper/Authwrapper.jsx';

console.log("Browser origin: in app.jsx", window.location.origin);


function App() {
  const [transcription, setTranscription] = useState("");
  const [summary, setSummary] = useState("");
  const [keyPoints, setKeyPoints] = useState([]);
  const [selectedFile,setSelectedFile] = useState([])
  const [user, setUser] = useState("");

  console.log("Env Client ID: in app.jsx", import.meta.env.VITE_GOOGLE_CLIENT_ID);

  
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };


  const handleUpload = async () => {
  if (!selectedFile) {
    console.error("No file selected");
    return;
  }

  const formData = new FormData();
  formData.append("file", selectedFile); // MUST match Flask: request.files["file"]
  formData.append("language", "bn");
 

  try {
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/transcribe_local`, {
      method: "POST",
      body: formData, // Don't set headers manually here
    });
  

    const data = await res.json();



    if (res.ok) {
      setTranscription(data.transcription);
      setSummary(data.summary);
      setKeyPoints(data.keyPoints);


    }
    
    else {
      console.error("Transcription Failed".data.error)
    }
    
  } catch (error) {
    console.error("failed ==>>", error);
  }
};

if (!user) {
  return (
    <div className="app">
      <Header user={user} setUser={setUser} onLogout={() => setUser(null)} />
    </div>
  );
}


  return (
    <div className="app">
      <Header user={user} setUser={setUser} onLogout={() => setUser(null)} />

      {user && (
        <main>
          <div className="upload-area">
            <input type="file" accept="audio/*" onChange={handleFileChange} />
            <button onClick={handleUpload}>Upload and Transcribe</button>
          </div>
          <div className="output-container">
            <div className="transcription-box">
              <h2>Transcription</h2>
              <p>{transcription}</p>
            </div>
            <div className="summary-box">
              <h2>Summary</h2>
              <p>{summary}</p>
            </div>
            <div className="keypoints-box">
              <h2>Key Points</h2>
              {keyPoints.length ? (
                <ul>
                  {keyPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              ) : (
                <p>No key points available.</p>
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
