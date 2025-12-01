/* eslint-disable react/prop-types */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigationType } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { postService, adService } from '../services';
import EnhancedInstagramPost from './EnhancedInstagramPost';
import MobileAdDisplay from './MobileAdDisplay';
import { shouldShowAds } from '../utils/deviceDetector';

const EnhancedInstagramFeed = ({ tag, search, userId, highlightPostId, enableSnapScroll = false }) => {
  const navigationType = useNavigationType();
  const [visiblePosts, setVisiblePosts] = useState(new Set());
  const [currentPlayingVideo, setCurrentPlayingVideo] = useState(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);
  // 순차적 렌더링을 위한 상태 (표시된 아이템 수)
  const [renderedCount, setRenderedCount] = useState(0);
  const renderIntervalRef = useRef(null);
  const observerRef = useRef(null);
  const postsContainerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  // Pull-to-refresh 상태
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);
  const pullToRefreshRef = useRef(null);

  // 무한 스크롤 데이터 fetch
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: ['enhanced-instagram-posts', tag, search, userId],
    queryFn: async ({ pageParam = 0 }) => {
      const posts = await postService.getPosts({
        tagId: tag,
        search: search,
        userId: userId,
        postType: userId ? undefined : 'general', // 사용자 프로필에서는 모든 타입, 커뮤니티에서는 general만
        limit: 10,
        offset: pageParam * 10,
        sortBy: userId ? 'latest' : 'algorithm' // 프로필: 최신순, 커뮤니티: 알고리즘
      });

      // YouTube 게시물 디버깅
      const youtubePost = posts.find(post => post.link_type === 'youtube');
      if (youtubePost) {
        console.log('Supabase에서 받은 YouTube 게시물 데이터:', {
          id: youtubePost.id,
          content: youtubePost.content,
          link_url: youtubePost.link_url
        });
      }

      return posts;
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.length === 10 ? pages.length : undefined;
    },
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // 광고 노출 기록 관리 (로컬 스토리지)
  const [adViewCounts, setAdViewCounts] = useState(() => {
    try {
      const stored = localStorage.getItem('adViewCounts');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // 광고 데이터 가져오기 (모바일에서만)
  const { data: adsData } = useQuery({
    queryKey: ['ads', 'active'],
    queryFn: async () => {
      if (!shouldShowAds()) return [];
      const ads = await adService.getActiveAds();
      return ads || [];
    },
    staleTime: 10 * 60 * 1000,
    enabled: shouldShowAds(),
  });

  // 광고 우선순위 알고리즘
  // 1. 마감 임박 광고 우선 (3일 이내)
  // 2. priority + priority_boost 반영
  // 3. CTR(클릭률) 낮은 광고 우선 (노출 대비 클릭 적은 광고에 기회)
  // 4. 로컬 노출 빈도 반영 + 랜덤 요소
  const shuffledAds = useMemo(() => {
    if (!adsData || adsData.length === 0) return [];

    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const adsWithScore = adsData.map(ad => {
      let score = 0;

      // 1. 기본 우선순위 (priority + priority_boost)
      const basePriority = (ad.priority || 0) + (ad.priority_boost || 0);
      score += basePriority * 10; // 가중치 10

      // 2. 마감 임박 보너스 (3일 이내 마감 광고)
      if (ad.end_date) {
        const endDate = new Date(ad.end_date);
        if (endDate <= threeDaysLater && endDate >= now) {
          // 마감일이 가까울수록 높은 점수 (최대 500점)
          const daysLeft = (endDate - now) / (24 * 60 * 60 * 1000);
          const urgencyBonus = Math.max(0, 500 - (daysLeft * 150));
          score += urgencyBonus;
        }
      }

      // 3. CTR 기반 점수 (낮은 CTR = 더 많은 노출 기회)
      const impressions = ad.impressions || 0;
      const clicks = ad.clicks || 0;
      const ctr = impressions > 0 ? clicks / impressions : 0;
      // CTR이 낮을수록 높은 점수 (최대 100점)
      const ctrBonus = Math.max(0, 100 - (ctr * 1000));
      score += ctrBonus;

      // 4. 로컬 세션 노출 빈도 (적게 본 광고 우선)
      const localViewCount = adViewCounts[`ad_${ad.id}`] || 0;
      const localViewPenalty = localViewCount * 50; // 볼수록 점수 감소
      score -= localViewPenalty;

      // 5. 랜덤 요소 (0~50점, 같은 점수일 때 변동성)
      const randomBonus = Math.random() * 50;
      score += randomBonus;

      return { ...ad, _score: score };
    });

    // 점수 높은 순 정렬
    return adsWithScore
      .sort((a, b) => b._score - a._score)
      .map(({ _score, ...ad }) => ad);
  }, [adsData, adViewCounts]);

  // 모든 페이지의 게시물을 하나의 배열로 합치기
  const allPosts = useMemo(() => {
    return data?.pages?.flatMap(page => page) || [];
  }, [data]);

  // 게시물과 광고를 합친 목록 생성 (3개마다 광고 삽입, 또는 게시물 끝에 항상 표시)
  const postsWithAds = useMemo(() => {
    const result = [];
    const ads = shuffledAds || [];

    if (ads.length === 0) {
      // 광고가 없으면 게시물만 반환
      return allPosts.map((post, index) => ({ type: 'post', data: post, key: `post-${post.id}-${index}` }));
    }

    let adIndex = 0; // 현재 광고 인덱스

    allPosts.forEach((post, index) => {
      // 게시물 추가
      result.push({ type: 'post', data: post, key: `post-${post.id}-${index}` });

      // 3개마다 광고 삽입 (인덱스가 2, 5, 8, ... 일 때)
      if ((index + 1) % 3 === 0 && ads.length > 0) {
        const ad = ads[adIndex % ads.length]; // 셔플된 광고 순서대로 선택

        // 광고 데이터 유효성 검증
        if (ad && ad.id) {
          result.push({
            type: 'ad',
            data: ad,
            key: `ad-${ad.id}-pos${index}-${Date.now()}` // 고유 키로 리렌더링 보장
          });
          adIndex++;
        }
      }
    });

    // 게시물이 3개 미만이고 광고가 아직 표시되지 않았다면, 마지막에 광고 추가
    if (allPosts.length > 0 && allPosts.length < 3 && ads.length > 0 && adIndex === 0) {
      const ad = ads[0];
      if (ad && ad.id) {
        result.push({
          type: 'ad',
          data: ad,
          key: `ad-${ad.id}-last-${Date.now()}`
        });
      }
    }

    return result;
  }, [allPosts, shuffledAds]);

  // 광고 노출 추적 함수
  const trackAdView = useCallback((adId) => {
    setAdViewCounts(prev => {
      const key = `ad_${adId}`;
      const newCounts = { ...prev, [key]: (prev[key] || 0) + 1 };

      // 로컬 스토리지에 저장
      try {
        localStorage.setItem('adViewCounts', JSON.stringify(newCounts));
      } catch (error) {
        console.warn('광고 노출 기록 저장 실패:', error);
      }

      return newCounts;
    });
  }, []);

  // 향상된 Intersection Observer 설정
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: enableSnapScroll ? '0px' : '-10% 0px -10% 0px',
      threshold: enableSnapScroll ? [0.5, 0.75, 1.0] : [0.6]
    };

    observerRef.current = new IntersectionObserver((entries) => {
      // setVisiblePosts를 함수형 업데이트로 변경하여 stale closure 문제 해결
      setVisiblePosts(prevVisiblePosts => {
        const newVisiblePosts = new Set(prevVisiblePosts);

        entries.forEach((entry) => {
          const postId = entry.target.dataset.postId;
          const adId = entry.target.dataset.adId;

          if (entry.isIntersecting) {
            // 스냅 스크롤 모드에서는 더 엄격한 가시성 기준
            if (enableSnapScroll && entry.intersectionRatio < 0.75) {
              return;
            }

            // 광고 노출 추적
            if (adId && !newVisiblePosts.has(postId)) {
              trackAdView(adId);
            }

            newVisiblePosts.add(postId);
          } else {
            newVisiblePosts.delete(postId);
          }
        });

        return newVisiblePosts;
      });
    }, observerOptions);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [enableSnapScroll, trackAdView]); // visiblePosts 제거 - 함수형 업데이트 사용

  // 게시글 요소들을 Observer에 등록 (renderedCount 변경 시마다 재등록)
  useEffect(() => {
    if (!observerRef.current || !postsContainerRef.current) return;

    const postElements = postsContainerRef.current.querySelectorAll('[data-post-id]');

    postElements.forEach((element) => {
      observerRef.current.observe(element);
    });

    return () => {
      if (observerRef.current) {
        postElements.forEach((element) => {
          observerRef.current.unobserve(element);
        });
      }
    };
  }, [data, renderedCount]); // renderedCount 추가 - 순차 렌더링된 새 요소도 Observer에 등록

  // 첫 로딩 완료 후 최상단으로 스크롤 (뒤로가기가 아닌 경우)
  useEffect(() => {
    // 이미 스크롤했거나, 로딩 중이거나, 데이터가 없으면 스킵
    if (hasInitialScrolled || isLoading || !data?.pages?.length) return;

    // highlightPostId가 있으면 해당 위치로 스크롤하므로 여기서는 스킵
    if (highlightPostId) return;

    // 뒤로가기(POP)일 때는 useScrollRestore가 처리하므로 스킵
    if (navigationType === 'POP') {
      setHasInitialScrolled(true);
      return;
    }

    // 첫 페이지 로딩 완료 시 최상단으로 스크롤
    window.scrollTo({ top: 0, behavior: 'instant' });
    setHasInitialScrolled(true);
    console.log('📍 피드 로딩 완료 - 최상단으로 스크롤');
  }, [isLoading, data, hasInitialScrolled, highlightPostId, navigationType]);

  // 순차적 렌더링: 데이터 로드 후 게시글을 위에서부터 순서대로 표시
  useEffect(() => {
    // 로딩 중이거나 데이터가 없으면 스킵
    if (isLoading || !postsWithAds.length) {
      setRenderedCount(0);
      return;
    }

    // 뒤로가기(POP)일 때는 즉시 모두 표시 (스크롤 위치 복원을 위해)
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

  // 무한 스크롤로 추가 데이터 로드 시 새 아이템 즉시 렌더링
  useEffect(() => {
    if (postsWithAds.length > renderedCount && renderedCount > 0) {
      // 새로운 페이지 로드 시 바로 모두 표시
      setRenderedCount(postsWithAds.length);
    }
  }, [postsWithAds.length]);

  // highlightPostId가 있을 때 해당 게시물로 스크롤
  useEffect(() => {
    if (highlightPostId && data?.pages) {
      // 약간의 지연을 주어 DOM이 완전히 렌더링되도록 함
      setTimeout(() => {
        const targetElement = document.querySelector(`[data-post-id="${highlightPostId}"]`);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 강조 효과 추가
          targetElement.style.border = '3px solid #007bff';
          targetElement.style.borderRadius = '8px';
          setTimeout(() => {
            targetElement.style.border = '';
            targetElement.style.borderRadius = '';
          }, 3000);
        }
      }, 500);
    }
  }, [highlightPostId, data]);

  // 스크롤 상태 관리
  useEffect(() => {
    const handleScrollStart = () => {
      setIsScrolling(true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };

    const handleScrollEnd = () => {
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    if (enableSnapScroll) {
      window.addEventListener('scroll', handleScrollStart);
      window.addEventListener('scroll', handleScrollEnd);
    }

    return () => {
      if (enableSnapScroll) {
        window.removeEventListener('scroll', handleScrollStart);
        window.removeEventListener('scroll', handleScrollEnd);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [enableSnapScroll]);

  // 무한 스크롤 처리 (개선된 버전)
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.innerHeight + document.documentElement.scrollTop;
      const totalHeight = document.documentElement.offsetHeight;
      const threshold = totalHeight - 1500; // 더 일찍 로드

      if (scrollPosition >= threshold) {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }
    };

    // 스크롤 이벤트 쓰로틀링
    let timeoutId;
    const throttledHandleScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        handleScroll();
        timeoutId = null;
      }, 100);
    };

    window.addEventListener('scroll', throttledHandleScroll);
    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 동영상 재생 관리 (개선된 버전)
  const handleVideoPlay = useCallback((postId) => {
    if (currentPlayingVideo && currentPlayingVideo !== postId) {
      // 이전 비디오 정지는 자연스럽게 Intersection Observer가 처리
    }
    setCurrentPlayingVideo(postId);
  }, [currentPlayingVideo]);

  const handleVideoPause = useCallback((postId) => {
    if (currentPlayingVideo === postId) {
      setCurrentPlayingVideo(null);
    }
  }, [currentPlayingVideo]);

  // Pull-to-refresh 핸들러
  const handleTouchStart = useCallback((e) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (window.scrollY === 0 && startY > 0) {
      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - startY);

      if (distance > 10) {
        e.preventDefault();
        setIsPulling(true);
        setPullDistance(Math.min(distance, 120));
      }
    }
  }, [startY]);

  const handleTouchEnd = useCallback(async () => {
    if (isPulling && pullDistance > 80) {
      try {
        await refetch();
      } catch (error) {
        console.error('새로고침 실패:', error);
      }
    }

    setIsPulling(false);
    setPullDistance(0);
    setStartY(0);
  }, [isPulling, pullDistance, refetch]);

  // Native event listeners로 passive: false 설정 (preventDefault 가능)
  useEffect(() => {
    const element = pullToRefreshRef.current;
    if (!element) return;

    // Non-passive touch event listeners 등록
    element.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      element.removeEventListener('touchmove', handleTouchMove);
    };
  }, [handleTouchMove]);

  // 기존 새로고침 핸들러 (필요시 유지)
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // 로딩 스켈레톤 컴포넌트
  const LoadingSkeleton = () => (
    <div className="w-full max-w-md mx-auto">
      {[...Array(3)].map((_, index) => (
        <div key={index} className="w-full bg-white border-b border-gray-200 animate-pulse">
          <div className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 rounded w-24 mb-1"></div>
                <div className="h-3 bg-gray-300 rounded w-16"></div>
              </div>
            </div>
          </div>
          <div className="w-full h-80 bg-gray-300"></div>
          <div className="p-4">
            <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-300 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  );

  // 에러 컴포넌트
  const ErrorComponent = () => (
    <div className="w-full max-w-md mx-auto p-8 text-center">
      <div className="text-red-500 mb-4">
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">게시글을 불러올 수 없습니다</h3>
      <p className="text-gray-600 mb-4">{error.message}</p>
      <div className="flex flex-col space-y-2">
        <button 
          onClick={handleRefresh}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          다시 시도
        </button>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
        >
          페이지 새로고침
        </button>
      </div>
    </div>
  );

  // 빈 상태 컴포넌트
  const EmptyComponent = () => (
    <div className="w-full max-w-md mx-auto p-8 text-center">
      <div className="text-gray-400 mb-6">
        <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
        </svg>
      </div>
      <h3 className="text-xl font-medium text-gray-900 mb-3">게시글이 없습니다</h3>
      <p className="text-gray-600 mb-6">
        {tag ? `'${tag}' 태그의 게시글이 없습니다.` : 
         search ? `'${search}' 검색 결과가 없습니다.` :
         '아직 작성된 게시글이 없습니다.'}
      </p>
      {(tag || search) && (
        <button
          onClick={() => window.location.href = '/community'}
          className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
        >
          전체 게시글 보기
        </button>
      )}
    </div>
  );

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorComponent />;
  if (postsWithAds.length === 0) return <EmptyComponent />;

  return (
    <div
      ref={pullToRefreshRef}
      className={`w-full max-w-md mx-auto min-h-screen bg-gray-50 ${
        enableSnapScroll ? 'snap-y snap-mandatory overflow-y-scroll' : ''
      }`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh 인디케이터 */}
      {isPulling && (
        <div 
          className="fixed top-0 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-200"
          style={{ transform: `translateX(-50%) translateY(${pullDistance - 50}px)` }}
        >
          <div className="bg-white rounded-full p-3 shadow-lg border">
            <div className={`w-6 h-6 border-2 border-blue-500 rounded-full animate-spin ${
              pullDistance > 80 ? 'border-t-transparent' : 'border-r-transparent'
            }`}></div>
          </div>
        </div>
      )}
      
      <div className="relative">
        <div ref={postsContainerRef} className="space-y-4 p-4">
          {postsWithAds.slice(0, renderedCount).map((item, index) => (
            <div
              key={item.key}
              data-post-id={item.data.id}
              data-ad-id={item.type === 'ad' ? item.data.id : undefined}
              className={`relative ${enableSnapScroll ? 'snap-start' : ''} ${
                isScrolling && enableSnapScroll ? 'transition-opacity duration-200' : ''
              }`}
              style={{
                animation: navigationType !== 'POP' ? 'fadeInUp 0.3s ease-out forwards' : 'none',
                animationDelay: navigationType !== 'POP' ? `${index * 30}ms` : '0ms',
                opacity: navigationType !== 'POP' ? 0 : 1
              }}
            >
              {item.type === 'post' ? (
                <EnhancedInstagramPost
                  post={item.data}
                  isVisible={visiblePosts.has(item.data.id.toString())}
                  onVideoPlay={handleVideoPlay}
                  onVideoPause={handleVideoPause}
                />
              ) : (
                <MobileAdDisplay ad={item.data} />
              )}
            </div>
          ))}

          {/* 로딩 인디케이터 */}
          {isFetchingNextPage && (
            <div className="w-full py-12 flex justify-center bg-white">
              <div className="flex flex-col items-center space-y-3 text-gray-500">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <span className="text-sm font-medium">새로운 게시글을 불러오는 중...</span>
              </div>
            </div>
          )}

          {/* 끝 메시지 */}
          {!hasNextPage && allPosts.length > 0 && (
            <div className="w-full py-12 text-center text-gray-500 bg-white">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">모든 게시글을 확인했습니다</p>
                  <p className="text-xs text-gray-400 mt-1">
                    총 {allPosts.length}개의 게시글
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 플로팅 글쓰기 버튼 (모바일용) */}
      <button
        onClick={() => window.location.href = '/post/new'}
        className="fixed bottom-20 right-4 w-14 h-14 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-all duration-200 hover:scale-110 z-10 flex items-center justify-center"
        style={{ transform: isScrolling ? 'scale(0)' : 'scale(1)' }}
        title="글쓰기"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
        </svg>
      </button>
    </div>
  );
};

export default EnhancedInstagramFeed;