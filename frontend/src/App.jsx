import { useState } from 'react';
import './App.css';
import Header  from './Header';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FooterAd from './Footer/FooterAd';
import Particles from './Particles';
import TargetCursor from './TargetCursor';
import ClickSpark from './ClickSpark';
import LiveRecorder from './LiveRecorder';





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





 // -----------------------------
  // Copy transcription
  // -----------------------------
  const handleCopyTranscription = async () => {
    if (!transcription) {
      toast.info("No transcription to copy.");
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(transcription);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = transcription;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success("Transcription copied to clipboard.");
    } catch (err) {
      console.error("copy failed", err);
      toast.error("Failed to copy transcription.");
    }
  };

// -----------------------------
// DOC export (.doc file)
// -----------------------------
const handleExportDoc = async () => {
  if (!(transcription || summary || (keyPoints && keyPoints.length))) {
    toast.info("Nothing to export.");
    return;
  }

  try {
    let content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset="utf-8"><title>Exported Document</title></head>
      <body style="font-family:Arial,Helvetica,sans-serif;font-size:12pt;line-height:1.4;">
        <h1>Transcription</h1>
        <div>${transcription ? transcription.replace(/\n/g, "<br/>") : "<em>No transcription</em>"}</div>
        
        <h1>Summary</h1>
        <div>${summary ? summary.replace(/\n/g, "<br/>") : "<em>No summary</em>"}</div>
        
        <h1>Key Points</h1>
        ${
          keyPoints && keyPoints.length
            ? `<ol>${keyPoints.map(k => `<li>${k}</li>`).join("")}</ol>`
            : `<div><em>No key points</em></div>`
        }

        <div style="margin-top:20px;font-size:10pt;color:#666;">
          Generated: ${new Date().toLocaleString()}
        </div>
      </body></html>
    `;

    const blob = new Blob(['\ufeff', content], {
      type: "application/msword;charset=utf-8"
    });

    const filename = `transcription_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.doc`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("DOC exported / download started.");
  } catch (err) {
    console.error("DOC export error:", err);
    toast.error("Failed to generate DOC. Try again.");
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
          <LiveRecorder
            user={user}
            setTranscription={setTranscription}
            setSummary={setSummary}
            setKeyPoints={setKeyPoints}
            setSeconds={setSeconds}
            setLoading={setLoading}
          />
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
                <ol>
                  {keyPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ol>
              ) : (
                <p>No key points available.</p>
                  )}
            </div>

                {/* Buttons for copy & export (PDF) */}
              <div id="actionButtons" className="action-buttons" style={{ marginTop: 12 }}>
                <button
                  id="copyBtn"
                  className="cursor-target"
                  onClick={handleCopyTranscription}
                  disabled={!transcription}
                  title={!transcription ? "No transcription to copy" : "Copy transcription to clipboard"}
                  style={{ marginRight: 8 }}
                >
                  Copy Transcription
                </button>

                <button
                  id="exportBtn"
                  className="cursor-target"
                  onClick={handleExportDoc}
                  disabled={!(transcription || summary || (keyPoints && keyPoints.length))}
                  title={!(transcription || summary || (keyPoints && keyPoints.length)) ? "Nothing to export" : "Export all output to PDF"}
                >
                  Export DOC (Transcription, Summary, Key Points)
                </button>
              </div>
            
              <br />
              <br />
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
