import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useNavigationType, useNavigate } from 'react-router-dom';
import { postService, adService } from '../services';
import SecondHandCard from '../components/SecondHandCard';
import MobileAdDisplay from '../components/MobileAdDisplay';
import PostDetail from './PostDetail';
import { AuthContext } from '../context/AuthContext';
import { isMobileDevice } from '../utils/deviceDetector';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import CloseIcon from '@mui/icons-material/Close';
import { useScrollRestore } from '../hooks/useScrollRestore';

const SecondHand = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile] = useState(() => isMobileDevice());

  // 상세보기 모달 상태
  const [selectedPostId, setSelectedPostId] = useState(null);
  const modalRef = useRef(null);

  // 모달 열릴 때 배경 스크롤 막기 및 최상단 이동
  useEffect(() => {
    if (selectedPostId) {
      // 모달이 열리면 body 스크롤 막기
      document.body.style.overflow = 'hidden';
      // 모달 최상단으로 스크롤
      if (modalRef.current) {
        modalRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
    } else {
      // 모달이 닫히면 body 스크롤 복원
      document.body.style.overflow = 'unset';
    }

    // 컴포넌트 언마운트 시 정리
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedPostId]);

  // 순차적 렌더링을 위한 상태
  const [renderedCount, setRenderedCount] = useState(0);
  const renderIntervalRef = useRef(null);

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
    <div className="secondhand-page min-h-screen bg-gray-50 pt-14">
      <div className="max-w-2xl mx-auto pt-2">
        {/* 게시물 목록 - 그리드 레이아웃 */}
        <div className="px-4 py-4">
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
                    <SecondHandCard
                      post={item.data}
                      onCardClick={(postId) => setSelectedPostId(postId)}
                    />
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
      </div>

      {/* 상세보기 모달 - Portal로 body에 직접 렌더링 */}
      {selectedPostId && createPortal(
        <div ref={modalRef} className="fixed inset-0 z-[9999] bg-white overflow-y-auto">
          {/* 헤더 - 닫기 버튼 */}
          <div className="sticky top-0 z-[10000] bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">상세보기</h2>
            <button
              onClick={() => setSelectedPostId(null)}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              title="닫기"
            >
              <CloseIcon className="text-gray-600" />
            </button>
          </div>

          {/* 콘텐츠 */}
          <PostDetail
            postId={selectedPostId}
            isModal={true}
            onClose={() => setSelectedPostId(null)}
          />

          {/* 하단 닫기 버튼 - 콘텐츠 바로 아래 */}
          <div className="px-4 pb-4 pt-2">
            <button
              onClick={() => setSelectedPostId(null)}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <CloseIcon fontSize="small" />
              닫기
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SecondHand;