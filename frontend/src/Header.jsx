import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import React, { useState, useEffect, useRef } from "react";
import TextType from "./TextType";
import { useNavigate } from "react-router-dom";


// Header component for the application
// Displays user information, login/logout, and time balance.
// Features a responsive design for mobile and desktop views.

function Header({ user, setUser, onLogout, seconds, setSeconds }) {
  // State to manage the visibility of the profile dropdown menu
  const [isProfileOpen, setProfileOpen] = useState(false);
  // Ref to detect clicks outside of the profile menu to close it
  const profileRef = useRef(null);

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
        setSeconds(data.free_seconds); // Changed from 'tokens' to 'free_seconds'
      } else {
        console.error("Login error:", data.error);
      }
    } catch (error) {
      console.error("Error during login:", error);
    }
  };

  const handleLogout = () => {
    setProfileOpen(false); // Close menu on logout
    setUser(null);
    setSeconds(0); // Changed from 'setTokens' to 'setSeconds'
    onLogout();
  };

  // Effect to handle clicks outside the profile menu to close it
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }
    // Add event listener when the component mounts
    document.addEventListener("mousedown", handleClickOutside);
    // Clean up the event listener when the component unmounts
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileRef]);



  const navigate = useNavigate();
  
  useEffect(() => {
    // Modern navigation API
    const navEntries = performance.getEntriesByType && performance.getEntriesByType("navigation");
    const navType = navEntries && navEntries.length
      ? navEntries[0].type
      // fallback for older browsers
      : (performance && performance.navigation && performance.navigation.type === 1 ? "reload" : "");

    if (navType === "reload") {
      // send user to "/" on reload; replace avoids adding a history entry
      navigate("/", { replace: true });
    }
  }, [navigate]);

  return (
    <header className="app-header">
      {/* This top bar contains elements that will be positioned left and right */}
      <div className="header-top-bar">
        <div className="token-section">
          {user && (
            <>
              {/* Displaying seconds instead of tokens */}
              <span className="tokens">💰 {seconds} sec</span> 
              {/* Button text changed from "Buy Tokens" to "Buy Time" */}
              <button className="buy-tokens-btn cursor-target" onClick={() => navigate("/packages")}>Buy Time</button>
            </>
          )}
        </div>

        <div className="account-section">
          {user ? (
            // Use the ref here to track the profile section area
            <div className="profile-section" ref={profileRef}>
              <img
                src={user.picture}
                alt="User Avatar"
                className="user-avatar"
                onClick={() => setProfileOpen(!isProfileOpen)} // Toggle menu on click
              />
              {/* Conditionally render the profile menu */}
              {isProfileOpen && (
                <div className="profile-menu">
                  <span className="profile-name">{user.name}</span>
                  <span className="profile-email">{user.email}</span>
                   {/* Added cursor-target back to this button */}
                  <button className="logout-btn cursor-target" onClick={handleLogout}>
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Display Google Login button if no user is logged in
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => {
                console.error("Login Failed");
              }}
            />
          )}
        </div>
      </div>

      {/* Main title and subtitle, including your TextType component */}
      <div className="title-section">
        <h1>Branscriber</h1>
        <TextType
          text={["Transcribe your voice notes ALMOST immediately"]}
          as="p"
          loop={true}
        />
      </div>
    </header>
  );
}

export default Header;