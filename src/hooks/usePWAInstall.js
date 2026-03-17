// PWA 설치 프롬프트 캡처 및 설치 트리거 hook
// beforeinstallprompt 이벤트를 전역 캡처하여 광고 클릭 시 네이티브 설치 팝업 트리거
// 이미 PWA로 설치된 환경에서는 isInstalled = true → pwa-install 광고 비노출

import { useState, useEffect, useCallback } from 'react';

/** PWA 독립 실행 모드인지 (이미 설치됨) */
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

/** iOS Safari 감지 */
export const isIOSSafari = () => {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios/i.test(ua);
};

// 모듈 레벨에서 prompt 이벤트 저장 (hook 마운트 전 이벤트 발생 대비)
let savedPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  savedPrompt = e;
});

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(savedPrompt);
  const [isInstalled, setIsInstalled] = useState(isStandalone());

  useEffect(() => {
    const handlePrompt = (e) => {
      e.preventDefault();
      savedPrompt = e;
      setDeferredPrompt(e);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      savedPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  /** Android 네이티브 설치 프롬프트 트리거 */
  const promptInstall = useCallback(() => {
    const prompt = deferredPrompt || savedPrompt;
    if (!prompt) return;

    // prompt 먼저 정리 (1회성이므로 재사용 불가)
    setDeferredPrompt(null);
    savedPrompt = null;

    try {
      prompt.prompt();
      prompt.userChoice.then(({ outcome }) => {
        if (outcome === 'accepted') {
          setIsInstalled(true);
        }
      }).catch(() => {});
    } catch (error) {
      console.warn('[PWA] Install prompt failed:', error);
    }
  }, [deferredPrompt]);

  /** Android 설치 가능 여부 (prompt 존재) */
  const canInstall = !!(deferredPrompt || savedPrompt);

  return { canInstall, isInstalled, isIOS: isIOSSafari(), promptInstall };
};
