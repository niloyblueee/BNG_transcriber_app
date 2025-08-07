import { useState } from 'react';
import './App.css';
import Header  from './Header';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FooterAd from './Footer/FooterAd';

//import Authwrapper from './AuthWrapper/Authwrapper.jsx';

console.log("Browser origin: in app.jsx", window.location.origin);


function App() {
  const [transcription, setTranscription] = useState("");
  const [summary, setSummary] = useState("");
  const [keyPoints, setKeyPoints] = useState([]);
  const [selectedFile,setSelectedFile] = useState([])
  const [user, setUser] = useState("");
  const [loading, setLoading] = useState(false); 
  const [tokens, setTokens] = useState(0);
  

  console.log("Env Client ID: in app.jsx", import.meta.env.VITE_GOOGLE_CLIENT_ID);

  
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };


  const handleUpload = async () => {
  if (!selectedFile) {
    console.error("No file selected");
    setModalMessage("Please select a file to upload.");
    return;
  }

  const formData = new FormData();
  formData.append("file", selectedFile); // MUST match Flask: request.files["file"]
  formData.append("language", "bn");
  formData.append("email", user.email);
  formData.append("name", user.name ?? ""); // Optional, if name is not provided
 

  try {
    setLoading(true);
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/transcribe_local`, {
      method: "POST",
      body: formData, // Don't set headers manually here
    });
  

    const data = await res.json();
    
    setLoading(false);

    if (res.ok) {
      setTranscription(data.transcription);
      setSummary(data.summary);
      setKeyPoints(data.keyPoints);
      setTokens(data.tokens_left);

    }
    else if (res.status === 402) {
      toast.error("Not enough tokens, please recharge.");
    }

    else {
      toast.error(`Transcription failed: ${data.error || "Unknown error"}`);
      console.error("Transcription error:", data.error);
    }
    
  } catch (error) {
    setLoading(false);
    setModalMessage("Upload error: " + error.message);
    console.error("upload error ==>>", error);
  }
};

if (!user) {
  return (
    <div className="app">
      <Header user={user} 
      setUser={setUser}
      tokens={tokens}
      setTokens={setTokens}
      onLogout={() => setUser(null)} />
    </div>
  );
}


  return (
    <div className="app">
      <Header user={user} 
      setUser={setUser} 
      tokens={tokens}
      setTokens={setTokens}
      onLogout={() => setUser(null)} />
      <ToastContainer position="top-center" autoClose={3000} />

      {user && (
        <main>
          <div className="upload-area">
            <input type="file" accept="audio/*" onChange={handleFileChange} />
            <button onClick={handleUpload}>Upload and Transcribe</button>
          </div>

          {loading && (
            <div className="loading-animation">
              <span>🎤 TRANSCRIBING</span>
              <span className="dot">.</span>
              <span className="dot">.</span>
              <span className="dot">.</span>
            </div>
          )}

          {!loading && !transcription && (
            <div className="no-output">
              <p>No transcription available. Please upload an audio file.</p>
            </div>
          )}
          
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
      <FooterAd />
    </div>
  );
}

export default App;
