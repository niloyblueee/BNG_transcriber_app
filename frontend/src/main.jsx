import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from "@react-oauth/google";
import './index.css'
import App from './App.jsx'
import Header from './Header.jsx'
import AuthWrapper from './AuthWrapper/Authwrapper.jsx'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AuthWrapper>
        <Header />
        <App />
      </AuthWrapper>
    </GoogleOAuthProvider>
  </StrictMode>,
)
