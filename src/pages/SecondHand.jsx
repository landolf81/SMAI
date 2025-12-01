import React, { useState, useMemo, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { postService, adService } from '../services';
import SecondHandCard from '../components/SecondHandCard';
import MobileAdDisplay from '../components/MobileAdDisplay';
import { AuthContext } from '../context/AuthContext';
import { isMobileDevice } from '../utils/deviceDetector';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import SearchIcon from '@mui/icons-material/Search';
import { useScrollRestore } from '../hooks/useScrollRestore';
import { useNavigate } from 'react-router-dom';

const SecondHand = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobile] = useState(() => isMobileDevice());

  // 중고거래 페이지 스크롤 위치 복원 (검색어 고려)
  const { resetScrollPosition, scrollToTop } = useScrollRestore(
    'secondhand',
    null,
    searchTerm || null
  );

  // post_type = 'secondhand'로 필터링된 게시물 조회
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['secondHandPosts', searchTerm],
    queryFn: () => postService.getPosts({ postType: 'secondhand', search: searchTerm }),
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
          <div className="px-4 py-4">
            <div className="flex items-center mb-4">
              <ShoppingBagIcon className="text-2xl text-orange-500 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">사고팔고</h1>
                <p className="text-sm text-gray-600">농업용품 중고거래 마켓</p>
              </div>
            </div>

            {/* 검색바 */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <input
                type="text"
                placeholder=""
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
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
              {postsWithAds.map((item) => {
                if (item.type === 'ad') {
                  return (
                    <div key={item.key} className="col-span-2 md:col-span-3 lg:col-span-4">
                      <MobileAdDisplay ad={item.data} />
                    </div>
                  );
                }
                return (
                  <SecondHandCard
                    key={item.key}
                    post={item.data}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <ShoppingBagIcon className="mx-auto text-6xl text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">등록된 상품이 없습니다</h3>
              <p className="text-gray-500 mb-4">첫 번째 상품을 등록해보세요!</p>
              <button
                onClick={() => navigate('/post/new?type=secondhand')}
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
            onClick={() => navigate('/post/new?type=secondhand')}
            className="fixed bottom-20 right-4 w-14 h-14 bg-orange-500 text-white rounded-full shadow-lg hover:bg-orange-600 transition-all duration-200 hover:scale-110 z-10 flex items-center justify-center"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default SecondHand;