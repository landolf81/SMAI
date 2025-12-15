import React, { useState, useEffect, useRef, useCallback } from 'react';
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
const TAB_SCROLL_POSITIONS_KEY = 'community_hub_scroll_positions';

const CommunityHub = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [searchParams] = useSearchParams();
  const swiperRef = useRef(null);
  const slideContainersRef = useRef([]); // 각 슬라이드 컨테이너 ref
  const resizeObserverRef = useRef(null);
  const heightUpdateTimeoutRef = useRef(null);

  // 탭별 스크롤 위치 저장
  const scrollPositionsRef = useRef({
    community: 0,
    qna: 0,
    secondhand: 0
  });

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

  // Swiper 높이 업데이트 함수 (디바운스 적용)
  const updateSwiperHeight = useCallback(() => {
    if (heightUpdateTimeoutRef.current) {
      clearTimeout(heightUpdateTimeoutRef.current);
    }
    heightUpdateTimeoutRef.current = setTimeout(() => {
      if (swiperRef.current && swiperRef.current.params) {
        swiperRef.current.updateAutoHeight();
      }
    }, 50); // 50ms 디바운스
  }, []);

  // 3. ResizeObserver로 콘텐츠 크기 변화 감지
  useEffect(() => {
    // ResizeObserver 생성
    resizeObserverRef.current = new ResizeObserver(() => {
      updateSwiperHeight();
    });

    // 현재 활성 슬라이드 관찰
    const activeContainer = slideContainersRef.current[activeTabIndex];
    if (activeContainer) {
      resizeObserverRef.current.observe(activeContainer);
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (heightUpdateTimeoutRef.current) {
        clearTimeout(heightUpdateTimeoutRef.current);
      }
    };
  }, [activeTabIndex, updateSwiperHeight]);

  // 탭 전환 시 ResizeObserver 대상 업데이트
  useEffect(() => {
    if (!resizeObserverRef.current) return;

    // 모든 슬라이드 관찰 해제
    resizeObserverRef.current.disconnect();

    // 현재 활성 슬라이드만 관찰
    const activeContainer = slideContainersRef.current[activeTabIndex];
    if (activeContainer) {
      resizeObserverRef.current.observe(activeContainer);
    }
  }, [activeTabIndex]);

  // 4. Swiper 탭 전환 핸들러 (스크롤 위치 저장/복원)
  const handleSlideChange = (swiper) => {
    const prevTabIndex = activeTabIndex;
    const newTabIndex = swiper.activeIndex;

    // 이전 탭의 스크롤 위치 저장
    const prevTabId = TABS[prevTabIndex]?.id;
    if (prevTabId) {
      scrollPositionsRef.current[prevTabId] = window.scrollY;
    }

    setActiveTabIndex(newTabIndex);

    // 새 탭의 스크롤 위치 복원
    const newTabId = TABS[newTabIndex]?.id;
    const savedPosition = scrollPositionsRef.current[newTabId] || 0;

    // 즉시 높이 업데이트 후 스크롤 위치 복원
    updateSwiperHeight();

    // requestAnimationFrame으로 DOM 업데이트 후 스크롤 복원
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedPosition, behavior: 'instant' });
    });
  };

  // 5. 탭 버튼 클릭 핸들러
  const handleTabClick = (index) => {
    if (swiperRef.current && index !== activeTabIndex) {
      // 현재 탭 스크롤 위치 저장
      const currentTabId = TABS[activeTabIndex]?.id;
      if (currentTabId) {
        scrollPositionsRef.current[currentTabId] = window.scrollY;
      }
      swiperRef.current.slideTo(index);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-14">
      {/* 탭 헤더 - sticky + 반투명 */}
      <div className="sticky top-14 z-40 bg-white/70 backdrop-blur-md border-b border-white/30">
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

      {/* Swiper 컨테이너 - window 스크롤 사용 */}
      <Swiper
        spaceBetween={0}
        slidesPerView={1}
        initialSlide={activeTabIndex}
        onSwiper={(swiper) => { swiperRef.current = swiper; }}
        onSlideChange={handleSlideChange}
        touchRatio={1}
        resistanceRatio={0.85}
        threshold={10}
        autoHeight={true}
        className="community-hub-swiper"
      >
        {TABS.map((tab, index) => (
          <SwiperSlide key={tab.id}>
            {/* 각 탭의 스크롤 독립성을 위해 개별 wrapper */}
            <div
              ref={(el) => { slideContainersRef.current[index] = el; }}
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
