import React  from 'react'
import ReactDOM from 'react-dom/client'

// chunk 로드 실패 시 자동 새로고침 (배포 전환 중 구버전 chunk 단절 대응)
// ⚠️ sessionStorage 가드: 세션당 1회만 새로고침 → 구버전 chunk가 계속 404일 때
//    무한 새로고침으로 iOS Safari가 충돌하는 것을 방지.
window.addEventListener('vite:preloadError', () => {
  try {
    if (sessionStorage.getItem('vite-preload-reloaded')) return;
    sessionStorage.setItem('vite-preload-reloaded', '1');
  } catch {
    /* sessionStorage 불가 환경(사파리 프라이빗 등)에서는 가드 없이 1회 시도 */
  }
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
