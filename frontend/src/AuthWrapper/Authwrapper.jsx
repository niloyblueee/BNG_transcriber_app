import { useGoogleLogin } from "@react-oauth/google";
import styles from "./Authwrapper.module.css";

export default function Authwrapper({ onLogin }) {
  console.log("Authwrapper rendered");

  const login = useGoogleLogin({
    flow: "auth-code",
    scope: "openid email profile",
    prompt: "consent",
    onSuccess: async (tokenResponse) => {
      console.log("we in this bitch now");
      console.log("✅ Auth code response:", tokenResponse);

      try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/verify_google_token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: tokenResponse.code }), // must match backend
        });

        const data = await res.json();
        console.log("Backend verify response:", data);

        if (res.ok && data.user) {
          onLogin(data.user);
        } else {
          console.error("Login failed:", data);
        }
      } catch (err) {
        console.error("❌ Fetch error:", err);
      }
    },
    onError: (err) => console.log("❌ Google Login Error:", err),
  });

  return (
    <div className={styles.authWrapper}>
      <h1>Transcriber</h1>
      <h2>Please sign in:</h2>
      <button onClick={() => {console.log("▶ Login button clicked"); login(); }} className={styles.googleBtn}>
        Sign in with Google
      </button>
    </div>
  );
}
// Authwrapper.jsx