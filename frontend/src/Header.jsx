import { useState } from "react";
import { GoogleLogin, googleLogout } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { GoogleOAuthProvider } from "@react-oauth/google";

function Header({ user, onLogout }) {
  
  /*
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  
  const handleLoginSuccess = (credentialResponse) => {
    const token = credentialResponse.credential;
    const userInfo = jwtDecode(token);
    console.log("User Info:", userInfo);

    // send token to backend for verification
    fetch("http://localhost:5000/verify_google_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUser(userInfo);
          setIsLoggedIn(true);
          setShowPopup(false);
        } else {
          console.error("Token verification failed:", data.message);
        }
      })
      .catch((err) => console.error("Verification error:", err));
  };

  const handleLogout = () => {
    googleLogout(); 
    setIsLoggedIn(false);
    setUser(null);
    setShowPopup(false);
  };
  */

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <header className="app-header">

        <h1>Transcriber</h1>
        <p>Transcribe your voice notes ALMOST immediately</p>
        <div className="account-section">
          <span>👤 {user?.name}</span>
          <button onClick={onLogout}>Log out</button>
        </div>

      </header>
    </GoogleOAuthProvider>
  );
}
export default Header;