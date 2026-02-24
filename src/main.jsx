import React  from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './enhanced-instagram.css'
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { AuthContextProvider } from './context/AuthContext.jsx'
import './utils/logger.js' // console.log 제어

// Service Worker 등록 (푸시 알림용)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[SW] 등록 실패:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>

  <AuthContextProvider>
  <App />

  </AuthContextProvider>


  </React.StrictMode>,
)
