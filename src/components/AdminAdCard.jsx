import React, { useEffect, useState, useRef } from 'react';
import { getImageUrl, DEFAULT_AD_IMAGE } from '../config/api';
import { adService } from '../services';
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import MouseIcon from "@mui/icons-material/Mouse";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

const AdminAdCard = ({ ad, onEdit, onDelete, onToggleStatus }) => {
  const [adMedia, setAdMedia] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [modalMediaIndex, setModalMediaIndex] = useState(0);
  const [isAutoCycling, setIsAutoCycling] = useState(true); // 자동 순환 상태
  const videoRef = useRef(null);
  const autoPlayIntervalRef = useRef(null);

  // 추가 미디어 불러오기
  useEffect(() => {
    const fetchAdMedia = async () => {
      if (ad && ad.id) {
        try {
          const mediaData = await adService.getAdMedia(ad.id);
          if (Array.isArray(mediaData) && mediaData.length > 0) {
            setAdMedia(mediaData);
          }
        } catch (error) {
          console.error('미디어 로드 실패:', error);
        }
      }
    };

    fetchAdMedia();
  }, [ad]);

  // 파일 확장자로 미디어 타입 판단
  const getMediaTypeFromPath = (path) => {
    if (!path) return 'image';
    const extension = path.toLowerCase().split('.').pop();
    const videoExtensions = ['mp4', 'mov', 'webm', 'avi', 'mkv'];
    return videoExtensions.includes(extension) ? 'video' : 'image';
  };

  // 현재 미디어 가져오기
  const getCurrentMedia = () => {
    const allMedia = [];

    // 메인 이미지가 있으면 추가 (Supabase는 image_url 사용)
    if (ad?.image_url) {
      allMedia.push({
        path: ad.image_url,
        type: getMediaTypeFromPath(ad.image_url),
        alt: ad.image_alt || ad.title
      });
    }

    // 추가 미디어 추가 (display_order 순서로 정렬되어 옴)
    if (adMedia && adMedia.length > 0) {
      allMedia.push(...adMedia.map(media => ({
        path: media.media_url,
        type: media.media_type || getMediaTypeFromPath(media.media_url),
        alt: media.caption || ad.title
      })));
    }

    return allMedia[currentMediaIndex] || null;
  };

  const getTotalMediaCount = () => {
    let count = 0;
    if (ad?.image_url) count++;
    if (adMedia && adMedia.length > 0) count += adMedia.length;
    return count;
  };

  // 모든 미디어 가져오기
  const getAllMedia = () => {
    const allMedia = [];
    if (ad?.image_url) {
      allMedia.push({
        path: ad.image_url,
        type: getMediaTypeFromPath(ad.image_url),
        alt: ad.image_alt || ad.title
      });
    }
    // 추가 미디어 추가 (display_order 순서로 정렬되어 옴)
    if (adMedia && adMedia.length > 0) {
      allMedia.push(...adMedia.map(media => ({
        path: media.media_url,
        type: media.media_type || getMediaTypeFromPath(media.media_url),
        alt: media.caption || ad.title
      })));
    }
    return allMedia;
  };

  // 모달용 미디어 가져오기
  const getModalMedia = (index) => {
    const allMedia = getAllMedia();
    return allMedia[index] || null;
  };

  // 동영상 종료 시 다음 미디어로 이동
  const handleVideoEnded = () => {
    const allMedia = getAllMedia();
    if (allMedia.length > 1) {
      setModalMediaIndex(prev => (prev + 1) % allMedia.length);
    }
  };

  // 모달에서 자동 이미지 순환 (동영상이 아닐 때만)
  useEffect(() => {
    if (showDetailModal && isAutoCycling) {
      const allMedia = getAllMedia();
      const currentMedia = allMedia[modalMediaIndex];

      // 현재 미디어가 동영상이면 자동 순환 안 함 (동영상은 onEnded로 처리)
      if (currentMedia?.type?.startsWith('video')) {
        return;
      }

      // 이미지일 때만 3초 후 다음으로
      if (allMedia.length > 1) {
        autoPlayIntervalRef.current = setTimeout(() => {
          setModalMediaIndex(prev => (prev + 1) % allMedia.length);
        }, 3000);

        return () => {
          if (autoPlayIntervalRef.current) {
            clearTimeout(autoPlayIntervalRef.current);
          }
        };
      }
    }
  }, [showDetailModal, modalMediaIndex, isAutoCycling, adMedia]);

  // 썸네일 클릭 시 자동 순환 일시 정지
  const handleThumbnailClick = (index) => {
    setIsAutoCycling(false);
    setModalMediaIndex(index);

    // 5초 후 자동 순환 재개
    setTimeout(() => {
      setIsAutoCycling(true);
    }, 5000);
  };

  // 모달 열기
  const openDetailModal = () => {
    setModalMediaIndex(0);
    setIsAutoCycling(true);
    setShowDetailModal(true);
    document.body.style.overflow = 'hidden';
  };

  // 모달 닫기
  const closeDetailModal = () => {
    setShowDetailModal(false);
    setIsAutoCycling(true);
    if (autoPlayIntervalRef.current) {
      clearTimeout(autoPlayIntervalRef.current);
    }
    document.body.style.overflow = 'auto';
  };

  // 날짜 포맷
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };


  if (!ad) return null;

  return (
    <div className="w-full max-w-md mx-auto mb-6">
      {/* 관리자 정보 섹션 */}
      <div className="bg-white rounded-t-xl p-4 border-x border-t border-gray-200">
        {/* 상태 및 ID */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">ID: {ad.id}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleStatus(ad.id)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title={ad.is_active ? '비활성화' : '활성화'}
            >
              {ad.is_active ? (
                <VisibilityIcon className="text-green-600 text-sm" />
              ) : (
                <VisibilityOffIcon className="text-gray-400 text-sm" />
              )}
            </button>
            <button
              onClick={() => onEdit(ad)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="수정"
            >
              <EditIcon className="text-blue-600 text-sm" />
            </button>
            <button
              onClick={() => onDelete(ad.id)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="삭제"
            >
              <DeleteIcon className="text-red-600 text-sm" />
            </button>
          </div>
        </div>

        {/* 날짜 정보 */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1">
            <CalendarTodayIcon className="text-gray-400" style={{ fontSize: '14px' }} />
            <span className="text-gray-500">생성일:</span>
            <span className="font-medium">{formatDate(ad.created_at)}</span>
          </div>
          <div className="flex items-center gap-1">
            <AccessTimeIcon className="text-green-500" style={{ fontSize: '14px' }} />
            <span className="text-gray-500">시작일:</span>
            <span className="font-medium">{formatDate(ad.start_date)}</span>
          </div>
          <div className="flex items-center gap-1">
            <AccessTimeIcon className="text-red-500" style={{ fontSize: '14px' }} />
            <span className="text-gray-500">종료일:</span>
            <span className="font-medium">{formatDate(ad.end_date)}</span>
          </div>
        </div>

        {/* 통계 정보 */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <VisibilityIcon className="text-blue-500" style={{ fontSize: '16px' }} />
            <span className="text-sm font-semibold">{ad.view_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <MouseIcon className="text-green-500" style={{ fontSize: '16px' }} />
            <span className="text-sm font-semibold">{ad.click_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm">
              <span className="font-semibold text-purple-600">
                {ad.view_count > 0 ? ((ad.click_count / ad.view_count) * 100).toFixed(2) : 0}%
              </span>
              <span className="text-gray-500 ml-1">CTR</span>
            </span>
          </div>
        </div>

        {/* 우선순위 부스팅 정보 */}
        {ad.priority_boost > 0 && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span className="text-sm">
                <span className="font-semibold text-orange-600">+{ad.priority_boost}</span>
                <span className="text-gray-500 ml-1">우선순위 부스팅</span>
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {ad.priority_boost >= 71 ? '최우선' : ad.priority_boost >= 31 ? '우선' : '기본'}
            </div>
          </div>
        )}
      </div>

      {/* 모바일 광고 프리뷰 (인스타그램 스타일) */}
      <div className="bg-white rounded-b-xl overflow-hidden shadow-lg border-x border-b border-gray-200">
        {/* 광고 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">AD</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">스폰서</span>
          </div>
          <span className="text-xs text-gray-500">광고 미리보기</span>
        </div>

        {/* 메인 미디어 */}
        <div className="relative bg-gray-100 overflow-hidden aspect-square">
          {getCurrentMedia() ? (
            <div className="absolute inset-0">
              {getCurrentMedia().type?.startsWith('video') ? (
                <video 
                  src={getImageUrl(getCurrentMedia().path)}
                  className="absolute inset-0 w-full h-full object-contain"
                  controls
                  muted
                />
              ) : (
                <img 
                  src={getImageUrl(getCurrentMedia().path)}
                  alt={getCurrentMedia().alt || ad.title}
                  className="absolute inset-0 w-full h-full object-contain"
                  onError={(e) => {
                    e.target.src = DEFAULT_AD_IMAGE;
                  }}
                />
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <div className="text-center">
                <div className="text-4xl mb-2">📷</div>
                <div className="text-gray-500 text-sm">이미지 없음</div>
              </div>
            </div>
          )}
        </div>

        {/* 콘텐츠 영역 */}
        <div className="p-4">
          <h3 className="text-base font-bold text-gray-900 mb-2 leading-tight">
            {ad.title}
          </h3>
          
          {ad.content && (
            <p className="text-sm text-gray-700 mb-3 leading-relaxed line-clamp-3">
              {ad.content.replace(/<[^>]*>/g, '')}
            </p>
          )}
          
          {/* 랜딩 정보 */}
          <div className="text-xs text-gray-500 mb-3">
            <div className="flex items-center gap-2">
              <span>랜딩 타입:</span>
              <span className="font-medium">
                {ad.link_url ? '외부 링크' : '내부 콘텐츠'}
              </span>
            </div>
            {ad.link_url && (
              <div className="flex items-center gap-2 mt-1">
                <span>URL:</span>
                <span className="font-medium text-blue-600 truncate">{ad.link_url}</span>
              </div>
            )}
          </div>
          
          {/* 액션 버튼 */}
          <button
            onClick={openDetailModal}
            className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold py-3 px-4 rounded-lg hover:from-orange-600 hover:to-pink-600 transition-all duration-200"
          >
            자세히 보기
          </button>
        </div>
      </div>

      {/* 상세보기 모달 */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
          <div className="bg-white w-full h-full flex flex-col overflow-hidden sm:rounded-lg sm:max-w-lg sm:h-auto sm:max-h-[calc(100vh-4rem)] sm:mx-4">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-gradient-to-r from-orange-400 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">AD</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{ad.title}</h3>
              </div>
              <button
                onClick={closeDetailModal}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* 모달 콘텐츠 */}
            <div className="p-4 overflow-y-auto flex-1">
              {/* 미디어 표시 */}
              {getModalMedia(modalMediaIndex) && (
                <div className="mb-4 relative">
                  {getModalMedia(modalMediaIndex).type?.startsWith('video') ? (
                    <video
                      ref={videoRef}
                      src={getImageUrl(getModalMedia(modalMediaIndex).path)}
                      className="w-full h-auto object-contain rounded-lg"
                      controls
                      autoPlay
                      onEnded={handleVideoEnded}
                    />
                  ) : (
                    <img
                      src={getImageUrl(getModalMedia(modalMediaIndex).path)}
                      alt={getModalMedia(modalMediaIndex).alt || ad.title}
                      className="w-full h-auto object-contain rounded-lg"
                      onError={(e) => {
                        e.target.src = DEFAULT_AD_IMAGE;
                      }}
                    />
                  )}

                  {/* 미디어 네비게이션 버튼 */}
                  {getAllMedia().length > 1 && (
                    <>
                      <button
                        className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
                        onClick={() => {
                          setIsAutoCycling(false);
                          setModalMediaIndex(prev =>
                            prev === 0 ? getAllMedia().length - 1 : prev - 1
                          );
                          setTimeout(() => setIsAutoCycling(true), 5000);
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70"
                        onClick={() => {
                          setIsAutoCycling(false);
                          setModalMediaIndex(prev =>
                            (prev + 1) % getAllMedia().length
                          );
                          setTimeout(() => setIsAutoCycling(true), 5000);
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* 썸네일 선택기 */}
              {getAllMedia().length > 1 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {/* 자동순환 상태 표시 */}
                    <div className={`flex-shrink-0 text-xs px-2 py-1 rounded ${isAutoCycling ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {isAutoCycling ? '▶ 자동' : '⏸ 일시정지'}
                    </div>
                    {getAllMedia().map((media, index) => (
                      <button
                        key={index}
                        onClick={() => handleThumbnailClick(index)}
                        className={`flex-shrink-0 relative ${
                          index === modalMediaIndex ? 'ring-2 ring-orange-500' : ''
                        }`}
                      >
                        {media.type?.startsWith('video') ? (
                          <div className="w-14 h-14 bg-gray-200 rounded flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        ) : (
                          <img
                            src={getImageUrl(media.path)}
                            alt={`썸네일 ${index + 1}`}
                            className="w-14 h-14 object-cover rounded"
                            onError={(e) => {
                              e.target.src = DEFAULT_AD_IMAGE;
                            }}
                          />
                        )}
                        {index === modalMediaIndex && (
                          <div className="absolute inset-0 bg-orange-500/20 rounded"></div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 광고 내용 */}
              {ad.content && (
                <div className="mb-4">
                  <h4 className="text-md font-semibold text-gray-900 mb-2">광고 내용</h4>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {ad.content.replace(/<[^>]*>/g, '')}
                  </p>
                </div>
              )}

              {/* 외부 링크 섹션 */}
              {ad.link_url && (
                <div className="mb-4">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800 mb-2 break-all">{ad.link_url}</p>
                    <button
                      onClick={() => window.open(ad.link_url, '_blank')}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold py-2 px-4 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
                    >
                      외부 링크 열기
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 모달 액션 */}
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={closeDetailModal}
                className="w-full bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-600 transition-all duration-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAdCard;