import { useState } from 'react';
import './App.css';

function App() {
  const [transcription, setTranscription] = useState("");
  const [summary, setSummary] = useState("");
  const [keyPoints, setKeyPoints] = useState([]);
  const [selectedFile,setSelectedFile] = useState([])


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

  return (
    <div className="app">
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
            {Array.isArray(keyPoints) && keyPoints.length > 0 ? (
              <ul>
                  {keyPoints.slice(1).map((point, index) => (
                    <ol key={index}>{point}</ol>
                  ))}
              </ul>
            ) : (
              <p > No key points available. </p>
            )}

          </div>
       </div>

      </main>
    </div>
  );
}

export default App;
