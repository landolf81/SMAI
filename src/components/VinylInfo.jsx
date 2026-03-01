/**
 * VinylInfo 컴포넌트
 * 역할: 참외 재배용 비닐 정보 UI
 * 데이터 소스 미정 - UI 껍데기 + 플레이스홀더
 */
import { useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';

const VinylInfo = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* 헤더 */}
      <h2 className="text-lg font-bold text-gray-800 mb-1">참외 재배 비닐 정보</h2>
      <p className="text-sm text-gray-500 mb-4">참외 재배에 사용되는 비닐 종류와 규격을 검색하세요.</p>

      {/* 검색 */}
      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fontSize="small" />
        <input
          type="text"
          placeholder="비닐 종류 검색..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 플레이스홀더 - 데이터 연동 전 안내 */}
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mb-4">
          <span className="text-3xl">📦</span>
        </div>
        <p className="text-gray-600 font-medium mb-1">데이터 준비 중입니다</p>
        <p className="text-sm text-gray-400">참외 재배 비닐 정보가 곧 제공될 예정입니다.</p>
      </div>
    </div>
  );
};

export default VinylInfo;
