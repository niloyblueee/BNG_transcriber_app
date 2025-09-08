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
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';



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
  // PDF export (html2canvas + jsPDF)
  // -----------------------------
  const handleExportPdf = async () => {
    if (!(transcription || summary || (keyPoints && keyPoints.length))) {
      toast.info("Nothing to export.");
      return;
    }

    setLoading(true);
    try {
      // Build a hidden DOM node containing nicely formatted content
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '800px'; // width used to render; controls layout in PDF
      container.style.padding = '20px';
      container.style.background = '#ffffff';
      container.style.color = '#000';
      container.style.fontFamily = 'Arial, Helvetica, sans-serif';
      container.style.fontSize = '12px';
      container.style.lineHeight = '1.4';
      container.innerHTML = `
        <div style="max-width:760px; margin:0 auto;">
          <h1 style="font-size:18px; margin-bottom:8px;">Transcription</h1>
          <div style="white-space:pre-wrap; margin-bottom:16px;">${escapeHtml(transcription) || "<em>No transcription</em>"}</div>

          <h1 style="font-size:18px; margin-bottom:8px;">Summary</h1>
          <div style="white-space:pre-wrap; margin-bottom:16px;">${escapeHtml(summary) || "<em>No summary</em>"}</div>

          <h1 style="font-size:18px; margin-bottom:8px;">Key Points</h1>
          ${ (keyPoints && keyPoints.length) ? `<ol style="margin-left:16px;">${keyPoints.map(k => `<li style="margin-bottom:6px;">${escapeHtml(k)}</li>`).join('')}</ol>` : `<div><em>No key points</em></div>` }
          
          <div style="margin-top:20px; font-size:10px; color:#666;">Generated: ${new Date().toLocaleString()}</div>
        </div>
      `;

      document.body.appendChild(container);

      // Render with html2canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true
      });

      const imgData = canvas.toDataURL('image/png');

      // Create jsPDF (A4)
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // calculate image dimensions in mm
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pdfWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      // Save PDF (this triggers download)
      const filename = `transcription_${new Date().toISOString().slice(0,19).replace(/[:T]/g, "-")}.pdf`;
      pdf.save(filename);

      // Cleanup
      document.body.removeChild(container);
      toast.success("PDF exported / download started.");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to generate PDF. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // small helper to sanitize text (keeps line breaks)
  const escapeHtml = (unsafe) => {
    if (!unsafe && unsafe !== "") return "";
    return String(unsafe)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
            <div className="action-buttons" style={{ marginTop: 12 }}>
              <button
                className="cursor-target"
                onClick={handleCopyTranscription}
                disabled={!transcription}
                title={!transcription ? "No transcription to copy" : "Copy transcription to clipboard"}
                style={{ marginRight: 8 }}
              >
                Copy Transcription
              </button>

              <button
                className="cursor-target"
                onClick={handleExportPdf}
                disabled={!(transcription || summary || (keyPoints && keyPoints.length))}
                title={!(transcription || summary || (keyPoints && keyPoints.length)) ? "Nothing to export" : "Export all output to PDF"}
              >
                Export PDF (Transcription, Summary, Key Points)
              </button>
            </div>
            
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
