import styles from "./AuthWrapper.module.css";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

export default function AuthWrapper({ onLogin = () => {} }) {

  const handleLoginSuccess = async (credentialResponse) => {
    const token = credentialResponse.credential;
    const userInfo = jwtDecode(token);

    const res = await fetch("http://localhost:5000/verify_google_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }), // match Flask
    });

    const data = await res.json();
    if (data.user) {
      onLogin(data.user); // lift user info up
    } else {
      console.error("Login failed:", data.error);
    }
  };

  return (
    <div className={styles.authWrapper}>
        <h1>Transcriber</h1>
        <h2>Please sign in:</h2>
        <GoogleLogin
          onSuccess={handleLoginSuccess}
          onError={() => console.log("Login Failed")}
        />
    </div>
  );
}