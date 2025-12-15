import React, { useState, useEffect, useRef, startTransition } from 'react';
import QnAList from '../components/QnAList';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';

const QnA = () => {
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);

  // 검색 모드 진입 이벤트 리스너 - startTransition으로 최적화
  useEffect(() => {
    const handleSearchOpen = () => {
      // 즉시 검색 모드 활성화 (우선순위 높음)
      setIsSearchMode(true);

      // requestAnimationFrame으로 DOM 렌더링 후 포커스
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });

      // 플로팅 메뉴 닫기는 낮은 우선순위로 처리
      startTransition(() => {
        window.dispatchEvent(new CustomEvent('close-floating-menu'));
      });
    };

    window.addEventListener('qna-search-open', handleSearchOpen);
    return () => window.removeEventListener('qna-search-open', handleSearchOpen);
  }, []);

  // 검색 종료 - startTransition으로 최적화
  const handleCloseSearch = () => {
    startTransition(() => {
      setIsSearchMode(false);
      setSearchTerm('');
    });
  };

  return (
    <div className="qna-page min-h-screen bg-gray-50 pt-14">
      {/* 상단 고정 검색창 (검색 모드) */}
      {isSearchMode && (
        <div className="sticky top-14 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200 p-4 shadow-sm animate-slide-down">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="질문 제목 검색..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={handleCloseSearch}
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}

      <QnAList
        isSearchMode={isSearchMode}
        searchTerm={searchTerm}
      />
    </div>
  );
};

export default QnA;
