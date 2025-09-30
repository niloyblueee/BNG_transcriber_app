import { useState, useEffect, useRef } from 'react';
import './App.css';
import Header  from './Header';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FooterAd from './Footer/FooterAd';
import Particles from './Particles';
import TargetCursor from './TargetCursor';
import ClickSpark from './ClickSpark';
import LiveRecorder from './LiveRecorder';
import { Route, Routes } from 'react-router-dom';
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import PackagePage from './components/PackagePage';
import Sidebar from './Sidebar'; // new


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
  const [showSidebar, setShowSidebar] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const outputRef = useRef(null);

  const prevRef = useRef({
    transcription: "",
    summary: "",
    keyPoints: 0
  })

  useEffect(() => {
  const prev = prevRef.current;
  const hasNewTranscription = !prev.transcription && !!transcription;
  const hasNewSummary = !prev.summary && !!summary;
  const hasNewKeyPoints = prev.keyPointsLen === 0 && (keyPoints && keyPoints.length > 0);

  if (hasNewTranscription || hasNewSummary || hasNewKeyPoints) {
    // run scroll on next paint to ensure layout is ready
    const rafId = requestAnimationFrame(() => {
      try {
        console.log("[App] Auto-scroll triggered:", { hasNewTranscription, hasNewSummary, hasNewKeyPoints });
        if (outputRef.current) {
          outputRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          console.warn("[App] outputRef.current is null");
        }
      } catch (err) {
        console.error("[App] scrollIntoView error", err);
      }
    });

    // cleanup in case effect re-runs quickly
    return () => cancelAnimationFrame(rafId);
  }

  // update prev snapshot
  prevRef.current = {
    transcription,
    summary,
    keyPointsLen: keyPoints ? keyPoints.length : 0,
  };
}, [transcription, summary, keyPoints]);

//------------------------------------------------
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
// DOCX export (.doc file)
// -----------------------------
const handleExportDocx = async () => {
  if (!transcription && !summary && (!keyPoints || !keyPoints.length)) {
    toast.info("Nothing to export.");
    return;
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ text: "Transcription", heading: "Heading1" }),
          new Paragraph({ text: transcription || "No transcription available." }),

          new Paragraph({ text: "Summary", heading: "Heading1" }),
          new Paragraph({ text: summary || "No summary available." }),

          new Paragraph({ text: "Key Points", heading: "Heading1" }),
          ...(keyPoints && keyPoints.length
            ? keyPoints.map(
                (point) => new Paragraph({ text: point, bullet: { level: 0 } })
              )
            : [new Paragraph({ text: "No key points available." })]),

          new Paragraph({ text: `Generated: ${new Date().toLocaleString()}`, spacing: { before: 300 } }),
          new Paragraph({ text: "Thank you for using our service!", spacing: { before: 300 } }),
          new Paragraph({ text: "https://branscriber.up.railway.app", style: "Hyperlink" }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `transcription_${new Date().toISOString().slice(0,19).replace(/[:T]/g, "-")}.docx`);
  toast.success("DOCX file exported.");
};











  const toggleSidebar = async () => {
    const willOpen = !showSidebar;
    setShowSidebar(willOpen);
    if (willOpen && user && user.email) {
      try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/get_history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email })
        });
        const json = await res.json();
        if (res.ok) {
          setHistoryList(json.history || []);
        } else {
          console.error("Failed to fetch history:", json.error);
          setHistoryList([]);
        }
      } catch (err) {
        console.error("History fetch error:", err);
        setHistoryList([]);
      }
    }
  };

  const handleSelectHistory = (entry) => {
    // load selected history entry into main view
    setTranscription(entry.transcription || "");
    setSummary(entry.summary || "");
    setKeyPoints(entry.keypoints || []);
    setShowSidebar(false);
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
      duration={400}
    >
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



        {/* Route-based page content */}
        <Routes>
          <Route 
            path="/" 
            element={
              <>
              {/* Header & Toast are only rendered on the "/" route */}
              <Header 
                user={user} 
                setUser={setUser} 
                seconds={seconds}
                setSeconds={setSeconds}
                onLogout={() => setUser(null)} 
              />
              <ToastContainer position="top-center" autoClose={3000} />
                {/* Toggle Sidebar button (floating) */}
                <button
                  onClick={toggleSidebar}
                  className='cursor-target history-btn'
                  title="Toggle history"
                  style={{
                    display: showSidebar ? 'none' : 'block', // <-- hide when sidebar is open

                  }}
                >
                  History
                </button>

                {/* Sidebar component */}
                <Sidebar
                  visible={showSidebar}
                  onClose={() => setShowSidebar(false)}
                  history={historyList}
                  onSelect={handleSelectHistory}
                />
                      
              <main>
                {user && (
                  <>
                    <div className="upload-area">
                      <input 
                        className="cursor-target" 
                        type="file" 
                        accept="audio/*,video/*, .mp4, .m4a, .acc, audio/mp4, audio/aac, audio/x-m4a, audio/mp3, audio/x-mp3" 
                        onChange={handleFileChange} 
                      />
                      <button className="cursor-target Upload-btn" onClick={handleUpload}>
                        Upload and Transcribe
                      </button>
                    </div>

                    {loading && (
                      <div className="loading-animation">
                        <span className='loading-text'>🎤 TRANSCRIBING</span>
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

                    <div className="output-container" ref={outputRef}>
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

                      {/* Buttons */}
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
                          onClick={handleExportDocx}
                          disabled={!(transcription || summary || (keyPoints && keyPoints.length))}
                          title={!(transcription || summary || (keyPoints && keyPoints.length)) ? "Nothing to export" : "Export all output to DOCX"}
                        >
                          Export DOCX (Transcription, Summary, Key Points)
                        </button>
                      </div>
                      <br /><br />
                    </div>
                  </>
                )}
              </main>
              </>
            } 
          />

          <Route path="/packages" element={<PackagePage />} />
        </Routes>

        {/* Footer */}
        <FooterAd />
      </div>
    </ClickSpark>
  </>
);

}

export default App;
