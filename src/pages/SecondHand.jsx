import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigationType } from 'react-router-dom';
import { postService, adService } from '../services';
import SecondHandCard from '../components/SecondHandCard';
import MobileAdDisplay from '../components/MobileAdDisplay';
import { AuthContext } from '../context/AuthContext';
import { isMobileDevice } from '../utils/deviceDetector';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import { useScrollRestore } from '../hooks/useScrollRestore';
import { useNavigate } from 'react-router-dom';

const SecondHand = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile] = useState(() => isMobileDevice());

  // 순차적 렌더링을 위한 상태
  const [renderedCount, setRenderedCount] = useState(0);
  const renderIntervalRef = useRef(null);

  // 글쓰기 버튼 회전 애니메이션 상태
  const [isWriteButtonSpinning, setIsWriteButtonSpinning] = useState(false);

  // 중고거래 페이지 스크롤 위치 복원 (검색어 고려)
  const { resetScrollPosition, scrollToTop } = useScrollRestore(
    'secondhand',
    null,
    searchTerm || null
  );

  // post_type = 'secondhand'로 필터링된 게시물 조회 (단순 시간순)
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['secondHandPosts', searchTerm],
    queryFn: () => postService.getPosts({ postType: 'secondhand', search: searchTerm, sortBy: 'latest' }),
    enabled: !!currentUser
  });

  // 광고 조회 (모바일에서만)
  const { data: adsData } = useQuery({
    queryKey: ['active-ads'],
    queryFn: adService.getActiveAds,
    enabled: isMobile,
    staleTime: 5 * 60 * 1000 // 5분
  });

  // 게시물에 광고 삽입
  const postsWithAds = useMemo(() => {
    if (!posts || posts.length === 0) return [];

    const result = [];
    const ads = adsData || [];

    if (ads.length === 0) {
      return posts.map((post, index) => ({
        type: 'post',
        data: post,
        key: `post-${post.id}-${index}`
      }));
    }

    let adCounter = 0;

    posts.forEach((post, index) => {
      result.push({ type: 'post', data: post, key: `post-${post.id}-${index}` });

      // 4개마다 광고 삽입
      if ((index + 1) % 4 === 0 && ads.length > 0) {
        const ad = ads[adCounter % ads.length];
        if (ad && ad.id) {
          result.push({
            type: 'ad',
            data: ad,
            key: `ad-${ad.id}-${adCounter}`
          });
          adCounter++;
        }
      }
    });

    // 게시글이 4개 미만이고 광고가 하나도 삽입되지 않았다면 마지막에 광고 추가
    if (posts.length > 0 && posts.length < 4 && ads.length > 0 && adCounter === 0) {
      const ad = ads[0];
      if (ad && ad.id) {
        result.push({
          type: 'ad',
          data: ad,
          key: `ad-${ad.id}-last`
        });
      }
    }

    return result;
  }, [posts, adsData]);

  // 순차적 렌더링: 데이터 로드 후 아이템을 위에서부터 순서대로 표시
  useEffect(() => {
    // 로딩 중이거나 데이터가 없으면 스킵
    if (isLoading || !postsWithAds.length) {
      setRenderedCount(0);
      return;
    }

    // 뒤로가기(POP)일 때는 즉시 모두 표시
    if (navigationType === 'POP') {
      setRenderedCount(postsWithAds.length);
      return;
    }

    // 이미 모두 렌더링 완료된 경우
    if (renderedCount >= postsWithAds.length) {
      return;
    }

    // 기존 인터벌 정리
    if (renderIntervalRef.current) {
      clearInterval(renderIntervalRef.current);
    }

    // 첫 번째 아이템 즉시 표시
    if (renderedCount === 0) {
      setRenderedCount(1);
    }

    // 나머지 아이템 순차적 표시 (50ms 간격)
    renderIntervalRef.current = setInterval(() => {
      setRenderedCount(prev => {
        if (prev >= postsWithAds.length) {
          clearInterval(renderIntervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 50);

    return () => {
      if (renderIntervalRef.current) {
        clearInterval(renderIntervalRef.current);
      }
    };
  }, [isLoading, postsWithAds.length, navigationType]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <ShoppingBagIcon className="mx-auto text-6xl text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">사고팔고</h2>
          <p className="text-gray-500">로그인이 필요한 서비스입니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${isMobile ? 'pb-20' : ''}`}>
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 py-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center">
                <ShoppingBagIcon className="text-2xl text-orange-500 mr-2" />
                <h1 className="text-xl font-bold text-gray-900">사고팔고</h1>
              </div>

              {/* 검색바 */}
              <input
                type="text"
                placeholder="검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-4 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
              />
            </div>
          </div>
        </div>

        {/* 게시물 목록 - 그리드 레이아웃 */}
        <div className="px-4 py-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="loading loading-spinner loading-lg text-orange-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <ShoppingBagIcon className="mx-auto text-6xl text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">오류가 발생했습니다</h3>
              <p className="text-gray-500">잠시 후 다시 시도해주세요.</p>
            </div>
          ) : postsWithAds && postsWithAds.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {postsWithAds.slice(0, renderedCount).map((item, index) => {
                if (item.type === 'ad') {
                  return (
                    <div
                      key={item.key}
                      className="col-span-2 md:col-span-3 lg:col-span-4"
                      style={{
                        animation: navigationType !== 'POP' ? 'fadeInUp 0.3s ease-out forwards' : 'none',
                        animationDelay: navigationType !== 'POP' ? `${index * 30}ms` : '0ms',
                        opacity: navigationType !== 'POP' ? 0 : 1
                      }}
                    >
                      <MobileAdDisplay ad={item.data} />
                    </div>
                  );
                }
                return (
                  <div
                    key={item.key}
                    style={{
                      animation: navigationType !== 'POP' ? 'fadeInUp 0.3s ease-out forwards' : 'none',
                      animationDelay: navigationType !== 'POP' ? `${index * 30}ms` : '0ms',
                      opacity: navigationType !== 'POP' ? 0 : 1
                    }}
                  >
                    <SecondHandCard post={item.data} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <ShoppingBagIcon className="mx-auto text-6xl text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">등록된 상품이 없습니다</h3>
              <p className="text-gray-500 mb-4">첫 번째 상품을 등록해보세요!</p>
              <button
                onClick={() => navigate('/secondhand/new')}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                상품 등록하기
              </button>
            </div>
          )}
        </div>

        {/* 글쓰기 버튼 (모바일) */}
        {isMobile && (
          <button
            onClick={() => {
              if (isWriteButtonSpinning) return;
              setIsWriteButtonSpinning(true);
              setTimeout(() => {
                navigate('/secondhand/new');
              }, 300);
            }}
            className="fixed bottom-20 right-4 w-14 h-14 text-white rounded-full transition-all duration-200 hover:scale-110 z-10 flex items-center justify-center border-2 border-white"
            style={{
              background: 'linear-gradient(135deg, #f97316 0%, #06b6d4 100%)',
              boxShadow: '0 4px 15px rgba(249, 115, 22, 0.4), 0 8px 25px rgba(6, 182, 212, 0.3)'
            }}
          >
            <svg
              className="w-6 h-6 transition-transform duration-300"
              style={{ transform: isWriteButtonSpinning ? 'rotate(180deg)' : 'rotate(0deg)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default SecondHand;