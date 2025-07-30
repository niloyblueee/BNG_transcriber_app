import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

function Header({ user, setUser, onLogout }) {

  const handleSuccess = (credentialResponse) => {
    const token = credentialResponse.credential;
    const userInfo = jwtDecode(token);
    setUser(userInfo);
    
  };
  return (
    <header className="app-header">
      <h1>Transcriber</h1>
      <p>Transcribe your voice notes ALMOST immediately</p>

      <div className="account-section">
        {user ? (
          <>
            <span>👤 {user?.name}</span>
            <button onClick={onLogout}>Log out</button>
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
