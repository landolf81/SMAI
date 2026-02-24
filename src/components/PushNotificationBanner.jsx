/**
 * PushNotificationBanner - 푸시 알림 구독 유도 배너
 * 로그인 사용자에게 1회 표시, 허용/거부 후 다시 묻지 않음
 * 홈 화면 공판장 카드 스타일에 맞춤
 */

import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { pushNotificationService } from '../services/pushNotificationService';

const DISMISSED_KEY = 'push_banner_dismissed';

const PushNotificationBanner = () => {
  const { currentUser } = useContext(AuthContext);
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    if (!pushNotificationService.isSupported()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const permission = pushNotificationService.getPermissionStatus();
    if (permission === 'denied') return;

    // 미구독이면 배너 표시 (permission이 default든 granted든)
    pushNotificationService.isSubscribed().then((subscribed) => {
      if (!subscribed) {
        setVisible(true);
      }
    });
  }, [currentUser]);

  const handleAllow = async () => {
    setSubscribing(true);
    const success = await pushNotificationService.subscribe(currentUser.id);
    setSubscribing(false);

    if (success) {
      localStorage.setItem(DISMISSED_KEY, 'subscribed');
    } else {
      localStorage.setItem(DISMISSED_KEY, 'denied');
    }
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'dismissed');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-4 rounded-2xl overflow-hidden shadow-md border border-gray-100 bg-white">
      {/* 상단 그라데이션 바 */}
      <div
        className="h-1"
        style={{ background: 'linear-gradient(to right, #1D4ED8, #16A34A)' }}
      />

      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          {/* 벨 아이콘 (SVG 직접 사용 - MUI 의존 제거) */}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#154734' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">알림 받기</p>
            <p className="text-xs text-gray-500">시세 변동, 새 소식을 바로 알려드려요</p>
          </div>
          {/* 닫기 */}
          <button
            onClick={handleDismiss}
            className="p-1.5 text-gray-300 hover:text-gray-500 transition-colors"
            aria-label="닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 버튼 영역 */}
        <div className="flex gap-2">
          <button
            onClick={handleAllow}
            disabled={subscribing}
            className="flex-1 bg-gradient-to-r from-[#1D4ED8] to-[#16A34A] text-white font-semibold py-2.5 px-4 rounded-lg hover:opacity-90 transition-all duration-200 shadow-sm text-sm"
          >
            {subscribing ? '설정 중...' : '허용하기'}
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all duration-200"
          >
            다음에
          </button>
        </div>
      </div>
    </div>
  );
};

export default PushNotificationBanner;
