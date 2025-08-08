
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import React from "react";
import TextType from "./TextType";

// Header component for the application
// Displays user information and allows login/logout functionality
// Uses Google OAuth for authentication
// Fetches user tokens from the backend after login

function Header({ user, setUser, onLogout, tokens, setTokens }) {
  const handleSuccess = async (credentialResponse) => {
    const token = credentialResponse.credential;
    const userInfo = jwtDecode(token);
    setUser(userInfo);
    console.log("User info from Google:", userInfo);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/login_user`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setTokens(data.tokens);
      } else {
        console.error("Login error:", data.error);
      }
    } catch (error) {
      console.error("Error during login:", error);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setTokens(0);
    onLogout();
  };


  return (
    <header className="app-header">
      <h1>Transcriber</h1>
      <TextType text={["Transcribe your voice notes ALMOST immediately"]} as="p" loop={true} />

      <div className="account-section">
        {user ? (
          <>
            <span>👤 {user?.name}</span>
            <span>💰 {tokens}</span>
            <img src={user?.picture} alt="User Avatar" className="user-avatar"/>
            <span className="email">{user?.email}</span>
            <button className="cursor-target" onClick={onLogout}>Log out</button>
          </>
          
        ) : (
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => {
              console.error("Login Failed");
            }}
          />
        )}
      </div>
    </header>
  );
}

export default Header;
