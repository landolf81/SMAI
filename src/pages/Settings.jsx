import React, { useState } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SecurityIcon from '@mui/icons-material/Security';
import PaletteIcon from '@mui/icons-material/Palette';

const Settings = () => {
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <SettingsIcon className="mr-3 text-gray-600" />
          설정
        </h1>
        <p className="text-gray-600 mt-2">계정 및 앱 설정을 관리하세요</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 프로필 설정 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <PersonIcon className="mr-2 text-blue-500" />
            프로필 설정
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                사용자명
              </label>
              <input 
                type="text" 
                className="input input-bordered w-full"
                defaultValue="admin"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <input 
                type="email" 
                className="input input-bordered w-full"
                defaultValue="admin@test.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                연락처
              </label>
              <input 
                type="tel" 
                className="input input-bordered w-full"
                placeholder="010-0000-0000"
              />
            </div>
            
            <button className="btn btn-primary w-full">
              프로필 업데이트
            </button>
          </div>
        </div>

        {/* 알림 설정 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <NotificationsIcon className="mr-2 text-yellow-500" />
            알림 설정
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">가격 알림</span>
              <input 
                type="checkbox" 
                className="toggle toggle-primary"
                checked={notifications.priceAlerts}
                onChange={() => handleNotificationChange('priceAlerts')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-700">시장 소식</span>
              <input 
                type="checkbox" 
                className="toggle toggle-primary"
                checked={notifications.marketNews}
                onChange={() => handleNotificationChange('marketNews')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-700">시스템 업데이트</span>
              <input 
                type="checkbox" 
                className="toggle toggle-primary"
                checked={notifications.systemUpdates}
                onChange={() => handleNotificationChange('systemUpdates')}
              />
            </div>
            
            <div className="pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                알림 방식
              </label>
              <select className="select select-bordered w-full">
                <option>브라우저 알림</option>
                <option>이메일</option>
                <option>SMS</option>
              </select>
            </div>
          </div>
        </div>

        {/* 보안 및 기타 설정 */}
        <div className="space-y-6">
          {/* 보안 설정 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <SecurityIcon className="mr-2 text-red-500" />
              보안 설정
            </h2>
            
            <div className="space-y-3">
              <button className="btn btn-outline w-full">
                비밀번호 변경
              </button>
              
              <button className="btn btn-outline w-full">
                2단계 인증 설정
              </button>
              
              <button className="btn btn-outline btn-error w-full">
                계정 비활성화
              </button>
            </div>
          </div>

          {/* 테마 설정 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <PaletteIcon className="mr-2 text-green-500" />
              테마 설정
            </h2>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">다크 모드</span>
                <input type="checkbox" className="toggle toggle-primary" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  언어 설정
                </label>
                <select className="select select-bordered w-full">
                  <option>한국어</option>
                  <option>English</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
