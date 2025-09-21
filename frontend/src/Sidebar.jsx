import React from "react";
import "./Sidebar.css";

export default function Sidebar({ visible, onClose, history = [], onSelect }) {
  return (
    <>
      <div className={`sidebar-overlay ${visible ? "visible" : ""}`} onClick={onClose} />
      <aside className={`sidebar-panel ${visible ? "visible" : ""}`} role="dialog" aria-hidden={!visible}>
        <header className="sidebar-header">
          <h3>History</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close history">×</button>
        </header>

        <div className="sidebar-content">
          {history.length === 0 ? (
            <div className="empty">No history available.</div>
          ) : (
            <ul className="history-list">
              {history.map((entry, idx) => (
                <li key={entry.id ?? idx} className="history-item" onClick={() => onSelect?.(entry)}>
                  <div className="history-meta">
                    <div className="history-time">{entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}</div>
                  </div>
                  <div className="history-summary">
                    <strong>Summary:</strong>
                    <div className="summary-text">{entry.summary || "(no summary)"}</div>
                  </div>
                  <div className="history-keypoints">
                    {(entry.keypoints && entry.keypoints.length) ? (
                      <ul className="kp-list">
                        {entry.keypoints.slice(0,5).map((kp, i) => <li key={i}>{kp}</li>)}
                      </ul>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
