/**
 * Settings.jsx — 앱 설정 페이지
 *
 * 기능: 테마(다크모드) 설정, 알림 설정
 * 카카오 OAuth 전용이므로 프로필/보안 설정은 제외
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsIcon from '@mui/icons-material/Settings';
import PaletteIcon from '@mui/icons-material/Palette';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import { useTheme } from '../context/ThemeContext';

const Settings = () => {
  const navigate = useNavigate();
  const { theme, setTheme, isDark } = useTheme();
  const [notifications, setNotifications] = useState({
    priceAlerts: true,
    marketNews: false,
    systemUpdates: true
  });

  const handleNotificationChange = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // 테마 옵션 목록
  const themeOptions = [
    { value: 'light', label: '라이트', icon: <LightModeIcon />, desc: '밝은 테마' },
    { value: 'dark', label: '다크', icon: <DarkModeIcon />, desc: '어두운 테마' },
    { value: 'system', label: '시스템', icon: <SettingsBrightnessIcon />, desc: '기기 설정에 따름' },
  ];

  return (
    <div className="min-h-screen bg-base-200 pt-14 pb-24">
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-base-100 hover:bg-base-300 transition-colors"
          >
            <ArrowBackIcon className="text-base-content" fontSize="small" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-base-content flex items-center gap-2">
              <SettingsIcon className="text-base-content/60" fontSize="small" />
              설정
            </h1>
          </div>
        </div>

        {/* 테마 설정 */}
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-5 mb-4">
          <h2 className="text-base font-semibold text-base-content mb-4 flex items-center gap-2">
            <PaletteIcon className="text-[#004225]" fontSize="small" />
            화면 테마
          </h2>

          <div className="space-y-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${
                  theme === opt.value
                    ? 'bg-[#004225]/10 border-2 border-[#004225] text-[#004225]'
                    : 'bg-base-200 border-2 border-transparent hover:bg-base-300 text-base-content'
                }`}
              >
                <span className={`text-xl ${theme === opt.value ? 'text-[#004225]' : 'text-base-content/50'}`}>
                  {opt.icon}
                </span>
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className={`text-xs ${theme === opt.value ? 'text-[#004225]/70' : 'text-base-content/50'}`}>
                    {opt.desc}
                  </div>
                </div>
                {theme === opt.value && (
                  <div className="w-5 h-5 rounded-full bg-[#004225] flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 알림 설정 */}
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-5 mb-4">
          <h2 className="text-base font-semibold text-base-content mb-4 flex items-center gap-2">
            <NotificationsIcon className="text-amber-500" fontSize="small" />
            알림 설정
          </h2>

          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 py-3 rounded-xl hover:bg-base-200 transition-colors">
              <div>
                <span className="text-sm font-medium text-base-content">가격 알림</span>
                <p className="text-xs text-base-content/50">시세 변동 시 알림 받기</p>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-success"
                checked={notifications.priceAlerts}
                onChange={() => handleNotificationChange('priceAlerts')}
              />
            </div>

            <div className="flex items-center justify-between px-2 py-3 rounded-xl hover:bg-base-200 transition-colors">
              <div>
                <span className="text-sm font-medium text-base-content">시장 소식</span>
                <p className="text-xs text-base-content/50">새 시장 정보 알림</p>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-success"
                checked={notifications.marketNews}
                onChange={() => handleNotificationChange('marketNews')}
              />
            </div>

            <div className="flex items-center justify-between px-2 py-3 rounded-xl hover:bg-base-200 transition-colors">
              <div>
                <span className="text-sm font-medium text-base-content">시스템 업데이트</span>
                <p className="text-xs text-base-content/50">앱 업데이트 및 공지사항</p>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-success"
                checked={notifications.systemUpdates}
                onChange={() => handleNotificationChange('systemUpdates')}
              />
            </div>
          </div>
        </div>

        {/* 앱 정보 */}
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-5">
          <div className="text-center text-base-content/40 text-xs space-y-1">
            <p>참외이야기 v1.0</p>
            <p>© 2026 참외이야기. All rights reserved.</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;
