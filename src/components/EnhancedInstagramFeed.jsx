/* eslint-disable react/prop-types */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { postService, adService, youtubeService } from '../services';
import { fetchNews } from '../services/newsService';
import EnhancedInstagramPost from './EnhancedInstagramPost';
import MobileAdDisplay from './MobileAdDisplay';
import NewsCard from './NewsCard';
import YouTubeVideoCard from './YouTubeVideoCard';
import LoadingSpinner from './LoadingSpinner';
import { shouldShowAds } from '../utils/deviceDetector';
import { hasEncodingVideo } from '../utils/mediaUtils';

const EnhancedInstagramFeed = ({ tag, search, userId, highlightPostId, enableSnapScroll = false }) => {
  const queryClient = useQueryClient();
  const [currentPlayingVideo, setCurrentPlayingVideo] = useState(null);
  // 각 게시물의 가시성 상태 추적 (Set<postId>)
  const [visiblePosts, setVisiblePosts] = useState(new Set());
  const observerRef = useRef(null);
  const postsContainerRef = useRef(null);

  // Pull-to-refresh 상태 (useRef로 최적화 - re-render 방지)
  const isPullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const startYRef = useRef(0);
  const pullToRefreshRef = useRef(null);
  const pullIndicatorRef = useRef(null);

  // 무한 스크롤용 sentinel ref
  const sentinelRef = useRef(null);

  // 무한 스크롤 시 스크롤 위치 보존용 (마지막 게시물 기준)
  const lastPostBeforeFetchRef = useRef(null);
  const isInitialLoadRef = useRef(true); // 초기 로딩 여부 추적

  // 초기 광고 노출 횟수 스냅샷 (광고 순서 안정화용)
  const initialAdViewCountsRef = useRef(null);

  // 글쓰기 버튼 회전 애니메이션 상태
  // 글쓰기 버튼 관련 상태는 App.jsx로 이동됨

  // 페이지당 로드 개수 (일관성 유지)
  const PAGE_SIZE = 10;

  // 무한 스크롤 데이터 fetch
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt
  } = useInfiniteQuery({
    queryKey: ['enhanced-instagram-posts', tag, search, userId],
    queryFn: async ({ pageParam = 0 }) => {
      const posts = await postService.getPosts({
        tagId: tag,
        search: search,
        userId: userId,
        postType: userId ? undefined : 'general', // 사용자 프로필에서는 모든 타입, 커뮤니티에서는 general만
        limit: PAGE_SIZE,
        offset: pageParam * PAGE_SIZE,
        sortBy: userId ? 'latest' : 'algorithm' // 프로필: 최신순, 커뮤니티: 알고리즘
      });

      return posts;
    },
    getNextPageParam: (lastPage, pages) => {
      // 페이지 크기만큼 받았으면 다음 페이지 있음
      // 필터링은 클라이언트에서 하므로 원본 데이터 기준으로 판단
      return lastPage.length === PAGE_SIZE ? pages.length : undefined;
    },
    staleTime: 5 * 60 * 1000,  // 5분 캐시
    gcTime: 10 * 60 * 1000,   // 10분 가비지 컬렉션
    refetchOnMount: 'always',  // 마운트 시 항상 재조회 (개인화 피드 반영)
    refetchOnWindowFocus: false,  // 윈도우 포커스 시 재조회 비활성화
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

  // 뉴스 데이터 가져오기 (커뮤니티 피드에서만)
  const { data: newsData } = useQuery({
    queryKey: ['news', 'feed'],
    queryFn: fetchNews,
    staleTime: 60 * 60 * 1000, // 1시간 캐시
    gcTime: 2 * 60 * 60 * 1000, // 2시간 가비지 컬렉션
    enabled: !userId, // 프로필 페이지에서는 비활성화
  });

  // YouTube 영상 데이터 가져오기 (커뮤니티 피드에서만)
  const { data: youtubeData } = useQuery({
    queryKey: ['youtube', 'approved', 'feed'],
    queryFn: async () => {
      const result = await youtubeService.getApprovedVideos(10, 0);
      return result.videos || [];
    },
    staleTime: 30 * 60 * 1000, // 30분 캐시
    gcTime: 60 * 60 * 1000, // 1시간 가비지 컬렉션
    enabled: !userId, // 프로필 페이지에서는 비활성화
  });

  // 광고 우선순위 알고리즘
  // 1. 마감 임박 광고 우선 (3일 이내)
  // 2. priority + priority_boost 반영
  // 3. CTR(클릭률) 낮은 광고 우선 (노출 대비 클릭 적은 광고에 기회)
  // 4. 로컬 노출 빈도 반영 + 랜덤 요소
  const shuffledAds = useMemo(() => {
    if (!adsData || adsData.length === 0) return [];

    // 초기 로딩 시점의 viewCounts 스냅샷 저장 (한 번만)
    // 이후 광고 노출로 adViewCounts가 변경되어도 순서가 바뀌지 않음
    if (initialAdViewCountsRef.current === null) {
      initialAdViewCountsRef.current = { ...adViewCounts };
    }
    const viewCountsSnapshot = initialAdViewCountsRef.current;

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

      // 4. 로컬 세션 노출 빈도 (적게 본 광고 우선) - 초기 스냅샷 사용
      const localViewCount = viewCountsSnapshot[`ad_${ad.id}`] || 0;
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
  }, [adsData]); // adViewCounts 의존성 제거 - 초기 스냅샷만 사용

  // 모든 페이지의 게시물을 하나의 배열로 합치기
  // 커뮤니티 피드(userId가 없을 때)에서는 인코딩 중인 동영상 게시물 숨김
  const allPosts = useMemo(() => {
    const posts = data?.pages?.flatMap(page => page) || [];

    // 프로필 피드(userId가 있을 때)에서는 모든 게시물 표시
    if (userId) return posts;

    // 커뮤니티 피드에서는 인코딩 중인 동영상 게시물 필터링
    return posts.filter(post => !hasEncodingVideo(post));
  }, [data, userId]);

  // 게시물, 광고, 뉴스, YouTube 영상을 합친 목록 생성
  // - 광고: 3개마다 삽입
  // - 뉴스: 7개마다 삽입 (광고보다 낮은 빈도)
  // - YouTube: 5개마다 삽입 (첫 번째 영상은 4번째 위치에)
  const postsWithAds = useMemo(() => {
    const result = [];
    const ads = shuffledAds || [];
    const news = newsData || [];
    const youtubeVideos = youtubeData || [];

    if (ads.length === 0 && news.length === 0 && youtubeVideos.length === 0) {
      // 광고, 뉴스, YouTube가 없으면 게시물만 반환
      return allPosts.map((post, index) => ({ type: 'post', data: post, key: `post-${post.id}-${index}` }));
    }

    let adIndex = 0; // 현재 광고 인덱스
    let newsIndex = 0; // 현재 뉴스 인덱스
    let youtubeIndex = 0; // 현재 YouTube 인덱스

    allPosts.forEach((post, index) => {
      // 게시물 추가
      result.push({ type: 'post', data: post, key: `post-${post.id}-${index}` });

      // 3개마다 광고 삽입 (인덱스가 2, 5, 8, ... 일 때)
      if ((index + 1) % 3 === 0 && ads.length > 0) {
        const ad = ads[adIndex % ads.length];
        if (ad && ad.id) {
          result.push({
            type: 'ad',
            data: ad,
            key: `ad-${ad.id}-pos${index}`
          });
          adIndex++;
        }
      }

      // 5개마다 YouTube 영상 삽입 (인덱스가 4, 9, 14, ... 일 때)
      if ((index + 1) % 5 === 4 && youtubeVideos.length > 0 && youtubeIndex < youtubeVideos.length) {
        const video = youtubeVideos[youtubeIndex];
        if (video && video.video_id) {
          result.push({
            type: 'youtube',
            data: video,
            key: `youtube-${video.id}-pos${index}`
          });
          youtubeIndex++;
        }
      }

      // 7개마다 뉴스 삽입 (인덱스가 6, 13, 20, ... 일 때)
      // 광고와 겹치지 않게 조정 (3의 배수 피함)
      if ((index + 1) % 7 === 0 && news.length > 0) {
        const newsItem = news[newsIndex % news.length];
        if (newsItem && newsItem.title) {
          result.push({
            type: 'news',
            data: newsItem,
            key: `news-${newsIndex}-pos${index}`
          });
          newsIndex++;
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
          key: `ad-${ad.id}-last`
        });
      }
    }

    // 게시물이 4개 미만이고 YouTube가 있으면 마지막에 YouTube 1개 추가
    if (allPosts.length >= 2 && allPosts.length < 4 && youtubeVideos.length > 0 && youtubeIndex === 0) {
      const video = youtubeVideos[0];
      if (video && video.video_id) {
        result.push({
          type: 'youtube',
          data: video,
          key: `youtube-${video.id}-last`
        });
      }
    }

    // 게시물이 7개 미만이고 뉴스가 있으면 마지막에 뉴스 1개 추가
    if (allPosts.length >= 3 && allPosts.length < 7 && news.length > 0 && newsIndex === 0) {
      const newsItem = news[0];
      if (newsItem && newsItem.title) {
        result.push({
          type: 'news',
          data: newsItem,
          key: `news-0-last`
        });
      }
    }

    return result;
  }, [allPosts, shuffledAds, newsData, youtubeData]);

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

  // 향상된 Intersection Observer 설정 (광고 추적 + 게시물 가시성 감지)
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '100px 0px',  // 화면 상하 100px 여유 (빠른 스크롤 대응)
      threshold: [0, 0.2, 0.5]  // 0% (진입/퇴출), 20% (동영상 재생 기준), 50% (중앙)
    };

    // 이미 추적된 광고 ID를 ref로 관리 (리렌더링 방지)
    const trackedAds = new Set();

    // requestAnimationFrame으로 가시성 업데이트 배칭
    let pendingUpdates = { add: new Set(), remove: new Set() };
    let rafId = null;

    const flushVisibilityUpdates = () => {
      if (pendingUpdates.add.size > 0 || pendingUpdates.remove.size > 0) {
        setVisiblePosts((prevVisible) => {
          const updatedVisiblePosts = new Set(prevVisible);
          let hasChanges = false;

          pendingUpdates.add.forEach(postId => {
            if (!updatedVisiblePosts.has(postId)) {
              updatedVisiblePosts.add(postId);
              hasChanges = true;
            }
          });

          pendingUpdates.remove.forEach(postId => {
            if (updatedVisiblePosts.has(postId)) {
              updatedVisiblePosts.delete(postId);
              hasChanges = true;
            }
          });

          return hasChanges ? updatedVisiblePosts : prevVisible;
        });

        // Reset pending updates
        pendingUpdates = { add: new Set(), remove: new Set() };
      }
      rafId = null;
    };

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const postId = entry.target.dataset.postId;
        const adId = entry.target.dataset.adId;

        // 광고 노출 추적 (기존 로직 유지)
        if (adId && entry.isIntersecting && !trackedAds.has(adId)) {
          trackedAds.add(adId);
          trackAdView(adId);
        }

        // 게시물 가시성 추적 (requestAnimationFrame 배칭)
        if (postId) {
          // 20% 이상 보일 때 "visible"로 간주 (4:5 비율 게시물 대응)
          const isNowVisible = entry.isIntersecting && entry.intersectionRatio >= 0.2;

          if (isNowVisible) {
            pendingUpdates.add.add(postId);
            pendingUpdates.remove.delete(postId);
          } else {
            pendingUpdates.remove.add(postId);
            pendingUpdates.add.delete(postId);
          }
        }
      });

      // Schedule flush with requestAnimationFrame (배칭)
      if (!rafId) {
        rafId = requestAnimationFrame(flushVisibilityUpdates);
      }
    }, observerOptions);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [trackAdView]);

  // 게시글 요소들을 Observer에 등록 (data 변경 시에만)
  useEffect(() => {
    if (!observerRef.current || !postsContainerRef.current) return;

    const postElements = postsContainerRef.current.querySelectorAll('[data-post-id]');

    postElements.forEach((element) => {
      observerRef.current.observe(element);
    });

    // 초기 로딩 시에만 첫 번째 게시물 자동 활성화
    // 무한 스크롤 중에는 실행하지 않음 (isInitialLoadRef로 체크)
    if (isInitialLoadRef.current && postElements.length > 0 && visiblePosts.size === 0) {
      const firstPost = postElements[0];
      const postId = firstPost.dataset.postId;
      if (postId) {
        // 약간의 지연 후 첫 게시물 가시성 설정 (Observer가 아직 트리거 안 된 경우 대비)
        requestAnimationFrame(() => {
          setVisiblePosts(prev => {
            if (prev.size === 0) {
              return new Set([postId]);
            }
            return prev;
          });
        });
      }
    }

    return () => {
      if (observerRef.current) {
        postElements.forEach((element) => {
          observerRef.current.unobserve(element);
        });
      }
    };
  }, [data]); // data 변경 시에만 재등록 (성능 최적화)

  // 가시성 변경 디버그 로깅 (프로덕션에서는 제거)
  // useEffect(() => {
  //   if (visiblePosts.size > 0) {
  //     console.log('📹 가시성 변경:', {
  //       visiblePostsCount: visiblePosts.size,
  //       visibleIds: Array.from(visiblePosts)
  //     });
  //   }
  // }, [visiblePosts]);


  // highlightPostId가 있을 때 해당 게시물로 스크롤
  useEffect(() => {
    if (highlightPostId && data?.pages) {
      // 약간의 지연을 주어 DOM이 완전히 렌더링되도록 함
      setTimeout(() => {
        const targetElement = document.querySelector(`[data-post-id="${highlightPostId}"]`);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // CSS 클래스로 강조 효과 추가 (Reflow 방지)
          targetElement.classList.add('highlight-post');
          setTimeout(() => {
            targetElement.classList.remove('highlight-post');
          }, 3000);
        }
      }, 500);
    }
  }, [highlightPostId, data]);

  // 초기 로딩 완료 감지
  useEffect(() => {
    if (!isLoading && data?.pages?.length > 0) {
      // 초기 로딩 완료 후 약간의 지연을 두어 초기 로딩 플래그 해제
      const timer = setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, data]);

  // 무한 스크롤 처리 (IntersectionObserver 사용 - scroll 이벤트 제거)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // 초기 로딩 중에는 무한 스크롤 트리거 안함
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && !isInitialLoadRef.current) {
          // 현재 화면에 보이는 게시물의 ID 저장 (레이아웃 시프트 방지)
          const container = postsContainerRef.current;
          if (container) {
            // 광고가 아닌 실제 게시물만 선택 (광고는 위치가 동적으로 변할 수 있음)
            const posts = container.querySelectorAll('[data-post-id]:not([data-ad-id])');

            // 뷰포트 상단에 가장 가까운 게시물 찾기
            let closestPost = null;
            let closestDistance = Infinity;

            posts.forEach(post => {
              const rect = post.getBoundingClientRect();
              const postTop = window.scrollY + rect.top;
              const distance = Math.abs(postTop - window.scrollY);

              if (distance < closestDistance) {
                closestDistance = distance;
                closestPost = post;
              }
            });

            if (closestPost) {
              const postId = closestPost.dataset.postId;
              const rect = closestPost.getBoundingClientRect();
              lastPostBeforeFetchRef.current = {
                postId,
                offsetFromTop: rect.top // 뷰포트 상단으로부터의 거리
              };
            }
          }
          fetchNextPage();
        }
      },
      {
        rootMargin: '1200px', // 하단 1200px 전에 트리거
        threshold: 0
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, data?.pages?.length]);

  // 무한스크롤 로딩 완료 후 스크롤 위치 보존 (DOM 기준 복원)
  useEffect(() => {
    // 초기 로딩 중이거나 저장된 위치 정보가 없으면 스킵
    if (isInitialLoadRef.current || !lastPostBeforeFetchRef.current) return;

    // fetch 완료 후에만 복원
    if (!isFetchingNextPage) {
      const { postId, offsetFromTop } = lastPostBeforeFetchRef.current;

      // 스크롤 복원 시작 이벤트 발생 (헤더/메뉴바 깜빡임 방지)
      window.dispatchEvent(new Event('scroll-restore-start'));

      // DOM 업데이트 후 실행
      requestAnimationFrame(() => {
        const targetPost = document.querySelector(`[data-post-id="${postId}"]`);
        if (targetPost) {
          const rect = targetPost.getBoundingClientRect();
          const currentOffset = rect.top;
          const diff = currentOffset - offsetFromTop;

          // 위치가 변경되었다면 보정
          if (Math.abs(diff) > 5) {
            window.scrollBy({ top: diff, behavior: 'instant' });
          }
        }
        // 복원 완료 후 즉시 초기화 (다음 fetch를 위해)
        lastPostBeforeFetchRef.current = null;

        // 스크롤 복원 완료 이벤트 발생 (다음 프레임에서)
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event('scroll-restore-end'));
        });
      });
    }
  }, [isFetchingNextPage]);

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

  // Pull-to-refresh 핸들러 (useRef 최적화 - re-render 없음)
  const handleTouchStart = useCallback((e) => {
    if (window.scrollY === 0) {
      startYRef.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (window.scrollY === 0 && startYRef.current > 0) {
      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - startYRef.current);

      if (distance > 10) {
        e.preventDefault();
        isPullingRef.current = true;
        pullDistanceRef.current = Math.min(distance, 120);

        // CSS transform으로 UI 업데이트 (reflow 없음)
        if (pullIndicatorRef.current) {
          pullIndicatorRef.current.style.display = 'block';
          pullIndicatorRef.current.style.transform = `translateX(-50%) translateY(${pullDistanceRef.current - 50}px)`;

          // 스피너 스타일 업데이트
          const spinner = pullIndicatorRef.current.querySelector('.spinner');
          if (spinner) {
            spinner.className = `spinner w-6 h-6 border-2 border-blue-500 rounded-full animate-spin ${
              pullDistanceRef.current > 80 ? 'border-t-transparent' : 'border-r-transparent'
            }`;
          }
        }
      }
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (isPullingRef.current && pullDistanceRef.current > 80) {
      try {
        // 캐시 무효화 후 새로고침
        await queryClient.invalidateQueries({
          queryKey: ['enhanced-instagram-posts', tag, search, userId]
        });
        await refetch();
      } catch (error) {
        console.error('새로고침 실패:', error);
      }
    }

    // Reset refs
    isPullingRef.current = false;
    pullDistanceRef.current = 0;
    startYRef.current = 0;

    // Hide indicator
    if (pullIndicatorRef.current) {
      pullIndicatorRef.current.style.display = 'none';
    }
  }, [queryClient, refetch, tag, search, userId]);

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
  // 데이터가 없고 fetch 중일 때는 로딩 표시 (캐시 만료 후 재검증 중)
  if (postsWithAds.length === 0 && isFetching) return <LoadingSkeleton />;
  if (postsWithAds.length === 0) return <EmptyComponent />;

  return (
    <div
      ref={pullToRefreshRef}
      className={`w-full max-w-md mx-auto bg-gray-50 ${
        enableSnapScroll ? 'snap-y snap-mandatory overflow-y-scroll' : ''
      }`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh 인디케이터 (useRef로 최적화) */}
      <div
        ref={pullIndicatorRef}
        className="fixed top-0 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-200"
        style={{ display: 'none' }}
      >
        <div className="bg-white rounded-full p-3 shadow-lg border">
          <div className="spinner w-6 h-6 border-2 border-blue-500 rounded-full animate-spin border-r-transparent"></div>
        </div>
      </div>

      <div className="relative">
        <div ref={postsContainerRef} className="space-y-4 pt-4 px-4 pb-24">
          {postsWithAds.map((item, index) => {
            const isAd = item.type === 'ad';
            const isNews = item.type === 'news';
            const isYouTube = item.type === 'youtube';
            const itemId = isAd
              ? `ad-${item.data.id}`
              : isNews
                ? `news-${item.key}`
                : isYouTube
                  ? `youtube-${item.data.id}`
                  : item.data.id.toString();

            return (
            <div
              key={item.key}
              data-post-id={itemId}
              data-ad-id={isAd ? item.data.id : undefined}
              className="relative"
            >
              {item.type === 'post' ? (
                <EnhancedInstagramPost
                  post={item.data}
                  onVideoPlay={handleVideoPlay}
                  onVideoPause={handleVideoPause}
                  isVisible={visiblePosts.has(itemId)}
                  disableAutoplay={!!userId} // 프로필 화면에서는 자동재생 비활성화
                  priority={index === 0} // 첫 번째 게시물은 LCP 우선순위 높임
                />
              ) : item.type === 'ad' ? (
                <MobileAdDisplay ad={item.data} />
              ) : item.type === 'youtube' ? (
                <YouTubeVideoCard video={item.data} isVisible={visiblePosts.has(itemId)} />
              ) : (
                <NewsCard news={item.data} />
              )}
            </div>
            );
          })}

          {/* 무한 스크롤 감지용 sentinel 요소 */}
          <div ref={sentinelRef} className="h-1" aria-hidden="true" />

          {/* 로딩 인디케이터 */}
          {isFetchingNextPage && (
            <div className="w-full py-12 flex justify-center bg-white">
              <div className="flex flex-col items-center space-y-3 text-gray-500">
                <LoadingSpinner size="md" />
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

      {/* 글쓰기 버튼은 App.jsx로 이동됨 */}
    </div>
  );
};

export default EnhancedInstagramFeed;