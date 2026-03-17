import React  from 'react'
import ReactDOM from 'react-dom/client'

// chunk 로드 실패 시 자동 새로고침 (배포 전환 중 구버전 chunk 단절 대응)
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});
import App from './App.jsx'
import './index.css'
import './enhanced-instagram.css'
// slick-carousel CSS 제거: react-slick 미사용 확인 (FCP 개선)
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
