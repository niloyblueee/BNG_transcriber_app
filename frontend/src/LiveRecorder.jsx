import React, { useState, useRef, useEffect } from "react";
import './LiveRecorder.css';
import { toast } from "react-toastify";

// LiveRecorder.jsx
// Records audio via MediaRecorder, saves latest recording into IndexedDB,
// uploads to /transcribe_smart_chunk, and populates parent state on success.

const DB_NAME = "live-recorder-db";
const STORE_NAME = "recordings";
const RECORDING_KEY = "lastRecording"; // id used in IndexedDB
const LS_FLAG = "lastRecordingFlag"; // small localStorage flag

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveBlobToIndexedDb(key, blob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const putReq = store.put(blob, key);
    putReq.onsuccess = () => {
      resolve(true);
      db.close();
    };
    putReq.onerror = () => {
      reject(putReq.error);
      db.close();
    };
  });
}

async function getBlobFromIndexedDb(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(key);
    getReq.onsuccess = () => {
      resolve(getReq.result || null);
      db.close();
    };
    getReq.onerror = () => {
      reject(getReq.error);
      db.close();
    };
  });
}

export default function LiveRecorder({ user, setTranscription, setSummary, setKeyPoints, setSeconds, setLoading }) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  // add refs to coordinate onstop completion
  const savedResolveRef = useRef(null);
  const savedPromiseRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setStatusMessage("Requesting microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const options = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus";
      }
      const mr = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      // create a promise that will be resolved when onstop processing completes
      savedPromiseRef.current = new Promise(resolve => { savedResolveRef.current = resolve; });

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstart = () => {
        setRecording(true);
        setStatusMessage("Recording...");
      };

      mr.onstop = async () => {
        setRecording(false);
        setStatusMessage("Processing recording...");
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
        try {
          await saveBlobToIndexedDb(RECORDING_KEY, blob);
          localStorage.setItem(LS_FLAG, "1");
          setStatusMessage("Saved recording locally (IndexedDB). Ready to upload.");
        } catch (err) {
          console.error("Failed to save blob to IndexedDB:", err);
          setStatusMessage("Failed to save locally");
        }

        try {
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
        } catch (e) {
          console.warn(e);
        }

        // resolve the promise so callers waiting for the stop+save know it's finished
        if (savedResolveRef.current) {
          savedResolveRef.current();
          savedResolveRef.current = null;
          savedPromiseRef.current = null;
        }
      };

      mr.start();
    } catch (e) {
      console.error("startRecording error", e);
      setStatusMessage("Microphone permission denied or unavailable.");
    }
  };

  // stopRecording now returns a Promise that resolves after onstop processing completes
  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      return savedPromiseRef.current || Promise.resolve();
    } catch (e) {
      console.error("stopRecording error", e);
      return Promise.resolve();
    }
  };

  const uploadLastRecording = async () => {
    if (!user || !user.email) {
      setStatusMessage("No user logged in — please login first.");
      return;
    }

    setLoading(true);
    setStatusMessage("Preparing upload...");

    try {
      const blob = await getBlobFromIndexedDb(RECORDING_KEY);
      if (!blob) {
        setStatusMessage("No saved recording found.");
        setLoading(false);
        return;
      }
      
      
      

      const filename = `live_recording_${Date.now()}.webm`;
      const file = new File([blob], filename, { type: blob.type || "audio/webm" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("email", user.email);
      formData.append("name", user.name || "");
      formData.append("language", "bn");
      
      setStatusMessage("Uploading to server... (this may take a while)");

      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/transcribe_smart_chunk`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setTranscription(data.transcription);
        setSummary(data.summary);
        setKeyPoints(data.keyPoints || []);
        setSeconds(data.free_seconds_left ?? 0);
        setStatusMessage("Transcription complete.");
        toast.success("Transcription successful!");

      } else if (res.status === 402) {
        setStatusMessage("Not enough free seconds. Please recharge.");
      } else {
        setStatusMessage(`Upload failed: ${data.error || res.statusText}`);
        console.error("Upload error body:", data);
      }
    } catch (e) {
      console.error("uploadLastRecording error", e);
      setStatusMessage("Upload failed due to network or server error.");
      setLoading(false);
    }
  };

  const playPreview = () => {
    if (!audioUrl) return;
    const a = new Audio(audioUrl);
    a.play();
  };

  const clearSaved = async () => {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(RECORDING_KEY);
      tx.oncomplete = () => {
        localStorage.removeItem(LS_FLAG);
        setAudioUrl(null);
        setStatusMessage("Local recording cleared.");
        db.close();
      };
      tx.onerror = () => {
        console.warn("Failed to clear recording");
        db.close();
      };
    } catch (e) {
      console.error(e);
    }
  };

    // place this inside the LiveRecorder component, alongside other functions
    const handleUploadClick = async () => {
      try {
        // If user is recording, stop first and wait for the onstop/save to finish
        if (recording) {
          setStatusMessage("Stopping recording and preparing upload...");
          await stopRecording();
          // savedPromise resolves after the blob is saved to IndexedDB
        }

        // Check IndexedDB for a saved recording
        const blob = await getBlobFromIndexedDb(RECORDING_KEY);

        if (!blob) {
          // nothing to upload
          toast.error("No recording found to upload.");
          setStatusMessage("No saved recording found.");
          return;
        }

        // we have a blob -> show success toast and proceed to upload
        toast.success("Uploaded recording for transcription.");
        await uploadLastRecording();
      } catch (err) {
        console.error("handleUploadClick error:", err);
        toast.error("Failed to start upload.");
        setStatusMessage("Upload failed to start.");
      }
    };

  return (
    <div className={`live-recorder ${recording ? 'is-recording' : ''} glow-dot-container`}>

        <div className="glow-trail" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
        </div>

        {/* main dot */}
        <div className="glow-dot" aria-hidden="true"></div>


      <div className="controls">
        <p className="recorder-note">

        <strong> Record Live and Upload for transcription</strong>. <br />  
        🎙️Click "Start Recording" to begin         
        </p>
        <div className="left-controls">
          {!recording ? (
            <button className="cursor-target" id="btn" onClick={startRecording}>
              Start Recording
            </button>
          ) : (
            <button className="cursor-target" id="btn recording-btn" onClick={stopRecording}>
              Stop Recording
            </button>
          )}

          <button className="cursor-target" id="btn" onClick={playPreview} disabled={!audioUrl}>
            Play Preview
          </button>

          <button className="cursor-target" id="btn_primary"
            onClick={handleUploadClick }>
            Upload & Transcribe
          </button>

          <button className="cursor-target" id="btn" onClick={clearSaved}>
            Clear Local
          </button>
        </div>

        <div className="status-area">
          {recording && <span className="recording-indicator" aria-hidden="true"></span>}
          <div className="status"><small>{statusMessage}</small></div>
          <div className="saved-flag"><small>Saved locally: {localStorage.getItem(LS_FLAG) ? 'yes' : 'no'}</small></div>
        </div>
      </div>

      {/* optional hidden preview element if you want a native control */}
      {audioUrl && (
        <audio className="audio-preview" controls src={audioUrl} />
      )}
    </div>
  );
}
