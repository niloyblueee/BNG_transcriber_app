import { useState } from 'react';
import './App.css';
import Header  from './Header';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FooterAd from './Footer/FooterAd';
import Particles from './Particles';
import TargetCursor from './TargetCursor';
import ClickSpark from './ClickSpark';


//import Authwrapper from './AuthWrapper/Authwrapper.jsx';

console.log("Browser origin: in app.jsx", window.location.origin);


function App() {
  const [transcription, setTranscription] = useState("");
  const [summary, setSummary] = useState("");
  const [keyPoints, setKeyPoints] = useState([]);
  const [selectedFile,setSelectedFile] = useState([])
  const [user, setUser] = useState("");
  const [loading, setLoading] = useState(false); 
  const [seconds, setSeconds] = useState(0);
  

  console.log("Env Client ID: in app.jsx", import.meta.env.VITE_GOOGLE_CLIENT_ID);

  
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };


  const handleUpload = async () => {
  if (!selectedFile) {
    console.error("No file selected");
    //setModalMessage("Please select a file to upload."); // This was commented out in your original code
    return;
  }

  const formData = new FormData();
  formData.append("file", selectedFile); // MUST match Flask: request.files["file"]
  formData.append("language", "bn");
  formData.append("email", user.email);
  formData.append("name", user.name ?? ""); // Optional, if name is not provided
 

  try {
    setLoading(true);
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/transcribe_smart_chunk`, {
      method: "POST",
      body: formData, // Don't set headers manually here
    });
  

    const data = await res.json();
    
    setLoading(false);

    if (res.ok) {
      setTranscription(data.transcription);
      setSummary(data.summary);
      setKeyPoints(data.keyPoints);
      setSeconds(data.free_seconds_left); // Changed from `tokens_left` to `free_seconds_left`

    }
    else if (res.status === 402) {
      toast.error("Not enough seconds, please recharge.");
    }

    else {
      toast.error(`Transcription failed: ${data.error || "Unknown error"}`);
      console.error("Transcription error:", data.error);
    }
    
  } catch (error) {
    setLoading(false);
    //setModalMessage("Upload error: " + error.message); // This was commented out in your original code
    console.error("upload error ==>>", error);
  }
};

if (!user) {
  return (

    <>
    
    <ClickSpark 
    sparkColor='#fff'
    sparkSize={10}
    sparkRadius={15}
    sparkCount={8}
    duration={400}>

    <div style={{ position: "relative", minHeight: "100vh", zIndex: 2 }}> 

      <TargetCursor 
        spinDuration={2}
        hideDefaultCursor={true}
        style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 9999 }}
      />

      <div className='particle-background'>
        <Particles
          particleColors={['#ffffff', '#ffffff']}
          particleCount={200}
          particleSpread={10}
          speed={0.1}
          particleBaseSize={100}
          moveParticlesOnHover={true}
          alphaParticles={false}
          disableRotation={false}
        />
      </div>
      
        <div className="app">
          <Header user={user} 
          setUser={setUser}
          seconds={seconds}
          setSeconds={setSeconds}
          onLogout={() => setUser(null)} />
        </div>
      </div>
      </ClickSpark>
   </>

  );
}

return (


  <>
  <ClickSpark 
    sparkColor='#fff'
    sparkSize={10}
    sparkRadius={15}
    sparkCount={8}
    duration={400}>


    <div style={{ position: "relative", minHeight: "100vh", zIndex: 2 }}> 

      <TargetCursor 
        spinDuration={2}
        hideDefaultCursor={true}
        style={{ position: "fixed", top: 0, left: 0, width: "50vw", height: "50vh", zIndex: 9999 }}
      />
    

    <div className="particle-background">
      <Particles
        particleColors={['#ffffff', '#ffffff']}
        particleCount={200}
        particleSpread={10}
        speed={0.1}
        particleBaseSize={100}
        moveParticlesOnHover={true}
        alphaParticles={false}
        disableRotation={false}
      />
    </div>

    {/* Foreground App Content */}
    <div className="app-content">
      <Header user={user} 
        setUser={setUser} 
        seconds={seconds}
        setSeconds={setSeconds}
        onLogout={() => setUser(null)} />
      <ToastContainer position="top-center" autoClose={3000} />

      {user && (
        <main>
          <div className="upload-area">
            <input className="cursor-target" type="file" accept="audio/*,video/*, .mp4, .m4a, .acc, audio/mp4, audio/aac, audio/x-m4a, audio/mp3, audio/x-mp3" onChange={handleFileChange} />
            <button className="cursor-target" onClick={handleUpload}>Upload and Transcribe</button>
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
  </div>
  </ClickSpark>
  </>
);
}

export default App;
