/**
 * QnA 페이지
 * 역할: Q&A + 영농 정보 탭 시스템 (농약정보, 비닐 등)
 */
import React, { useState, useEffect, useRef, startTransition, lazy, Suspense } from 'react';
import QnAList from '../components/QnAList';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';

const PesticideInfo = lazy(() => import('../components/PesticideInfo'));
const VinylInfo = lazy(() => import('../components/VinylInfo'));
const PestDiseaseInfo = lazy(() => import('../components/PestDiseaseInfo'));

/** 탭 목록 - 향후 탭 추가 시 여기에 추가 */
const TABS = [
  { key: 'qna', label: 'Q&A' },
  { key: 'pest', label: '병충해' },
  { key: 'pesticide', label: '농약정보' },
  { key: 'vinyl', label: '비닐' },
];

const QnA = () => {
  const [activeTab, setActiveTab] = useState('qna');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);

  // 검색 모드 진입 이벤트 리스너 - startTransition으로 최적화
  useEffect(() => {
    const handleSearchOpen = () => {
      // Q&A 탭이 아니면 Q&A 탭으로 전환
      setActiveTab('qna');
      setIsSearchMode(true);

      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });

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
    <div className="qna-page min-h-screen bg-cloud-dancer pt-14">
      {/* 탭 바 */}
      <div className="sticky top-14 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                if (tab.key !== 'qna') {
                  setIsSearchMode(false);
                  setSearchTerm('');
                }
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 ${
                activeTab === tab.key
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Q&A 탭 */}
      {activeTab === 'qna' && (
        <>
          {isSearchMode && (
            <div className="sticky top-[6.5rem] z-20 bg-white/90 backdrop-blur-md border-b border-gray-200 p-4 shadow-sm animate-slide-down">
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
        </>
      )}

      {/* 병충해 탭 */}
      {activeTab === 'pest' && (
        <Suspense fallback={
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-md text-teal-500"></span>
          </div>
        }>
          <PestDiseaseInfo />
        </Suspense>
      )}

      {/* 농약정보 탭 */}
      {activeTab === 'pesticide' && (
        <Suspense fallback={
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-md text-teal-500"></span>
          </div>
        }>
          <PesticideInfo />
        </Suspense>
      )}

      {/* 비닐 탭 */}
      {activeTab === 'vinyl' && (
        <Suspense fallback={
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-md text-teal-500"></span>
          </div>
        }>
          <VinylInfo />
        </Suspense>
      )}
    </div>
  );
};

export default QnA;
