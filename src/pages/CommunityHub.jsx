import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

// 기존 컴포넌트 임베딩
import Community from './Community';
import QnA from './QnA';
import SecondHand from './SecondHand';

// Icons
import ForumIcon from '@mui/icons-material/Forum';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';

const TABS = [
  { id: 'community', label: '커뮤니티', Component: Community, icon: ForumIcon },
  { id: 'qna', label: 'Q&A', Component: QnA, icon: HelpOutlineIcon },
  { id: 'secondhand', label: '사고팔고', Component: SecondHand, icon: ShoppingBagIcon }
];

const TAB_STORAGE_KEY = 'community_hub_active_tab';

const CommunityHub = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [searchParams] = useSearchParams();
  const swiperRef = useRef(null);

  // 1. 탭 상태 관리
  const getInitialTab = () => {
    // URL 쿼리 파라미터 우선
    const tabParam = searchParams.get('tab');
    if (tabParam && TABS.some(t => t.id === tabParam)) {
      return TABS.findIndex(t => t.id === tabParam);
    }

    // 뒤로가기(POP)인 경우 localStorage에서 복원
    if (navigationType === 'POP') {
      const savedTab = localStorage.getItem(TAB_STORAGE_KEY);
      if (savedTab) {
        const savedIndex = TABS.findIndex(t => t.id === savedTab);
        if (savedIndex !== -1) return savedIndex;
      }
    }

    // location.state에서 복원 (상세페이지에서 돌아온 경우)
    if (location.state?.fromDetail && location.state?.activeTab) {
      const stateIndex = TABS.findIndex(t => t.id === location.state.activeTab);
      if (stateIndex !== -1) return stateIndex;
    }

    return 0; // 기본값: 커뮤니티
  };

  const [activeTabIndex, setActiveTabIndex] = useState(getInitialTab);

  // 2. 탭 변경 시 localStorage 저장 및 URL 동기화
  useEffect(() => {
    const activeTab = TABS[activeTabIndex];
    localStorage.setItem(TAB_STORAGE_KEY, activeTab.id);

    // URL 쿼리 파라미터 업데이트 (history 추가 없이)
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', activeTab.id);
    navigate(`?${newSearchParams.toString()}`, { replace: true, state: location.state });
  }, [activeTabIndex]);

  // 3. Swiper 탭 전환 핸들러
  const handleSlideChange = (swiper) => {
    setActiveTabIndex(swiper.activeIndex);
  };

  // 4. 탭 버튼 클릭 핸들러
  const handleTabClick = (index) => {
    if (swiperRef.current) {
      swiperRef.current.slideTo(index);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 탭 헤더 (고정) */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center">
          {TABS.map((tab, index) => {
            const IconComponent = tab.icon;
            const isActive = activeTabIndex === index;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(index)}
                className={`flex-1 flex items-center justify-center gap-2 py-4 transition-all duration-200 ${
                  isActive
                    ? 'text-[#FFC425] border-b-2 border-[#FFC425] font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
              >
                <IconComponent fontSize="small" />
                <span className="text-sm">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Swiper 컨테이너 */}
      <Swiper
        spaceBetween={0}
        slidesPerView={1}
        initialSlide={activeTabIndex}
        onSwiper={(swiper) => { swiperRef.current = swiper; }}
        onSlideChange={handleSlideChange}
        touchRatio={1}
        resistanceRatio={0.85}
        threshold={10}
        className="community-hub-swiper"
      >
        {TABS.map((tab) => (
          <SwiperSlide key={tab.id}>
            {/* 각 탭의 스크롤 독립성을 위해 개별 wrapper */}
            <div
              className="tab-content-wrapper"
              id={`tabpanel-${tab.id}`}
              role="tabpanel"
            >
              <tab.Component hubMode={true} activeTab={tab.id} />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default CommunityHub;
