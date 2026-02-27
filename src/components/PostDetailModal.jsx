import React, { useState, useContext, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postService, commentService } from '../services';
import { AuthContext } from '../context/AuthContext';
import moment from 'moment';
import 'moment/locale/ko';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

// 컴포넌트
import ProfileModal from './ProfileModal';

// 아이콘
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PersonIcon from '@mui/icons-material/Person';
import SendIcon from '@mui/icons-material/Send';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CloseIcon from '@mui/icons-material/Close';
import AIBadge from './AIBadge';
import { isAIUser } from '../config/aiUser';

moment.locale('ko');

const PostDetailModal = ({ isOpen, onClose, postId }) => {
  const { currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();

  const [commentContent, setCommentContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // 모달 열릴 때 배경 스크롤 막기
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // 컴포넌트 언마운트 시 정리
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // 게시물 조회
  const { data: post, isLoading, error } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const response = await postService.getPost(postId);
      return response;
    },
    enabled: isOpen && !!postId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  // 댓글 조회
  const { data: comments = [], isLoading: commentsLoading, error: commentsError } = useQuery({
    queryKey: ['post-comments', postId],
    queryFn: async () => {
      const response = await commentService.getComments(postId);
      return response || [];
    },
    enabled: isOpen && !!postId
  });

  // 댓글 작성 뮤테이션
  const createCommentMutation = useMutation({
    mutationFn: (commentData) => commentService.createComment(commentData),
    onSuccess: () => {
      queryClient.invalidateQueries(['post-comments', postId]);
      setCommentContent('');
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error('댓글 작성 실패:', error);
      alert('댓글 작성에 실패했습니다.');
      setIsSubmitting(false);
    }
  });

  // 좋아요 토글 뮤테이션
  const likeMutation = useMutation({
    mutationFn: () => postService.toggleLike(postId),
    onSuccess: () => {
      queryClient.invalidateQueries(['post', postId]);
    }
  });

  // 가격 추출 함수
  const extractPrice = (title, desc) => {
    const text = title + ' ' + (desc || '');
    const pricePatterns = [
      /(\d{1,3}(?:,\d{3})*)\s*만원/,
      /(\d{1,3}(?:,\d{3})*)\s*만/,
      /(\d{1,3}(?:,\d{3})*)\s*원/,
    ];
    for (const pattern of pricePatterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return null;
  };

  // 지역 추출 함수
  const extractLocation = (desc) => {
    if (!desc) return null;
    const locationPatterns = [
      /📍\s*([가-힣]+(?:시|군|구)?\s*[가-힣]*)/,
      /위치[:\s]*([가-힣]+(?:시|군|구)?\s*[가-힣]*)/,
      /지역[:\s]*([가-힣]+(?:시|군|구)?\s*[가-힣]*)/,
      /(성주|고령|칠곡|구미|대구|김천|상주)(?:시|군)?/,
    ];
    for (const pattern of locationPatterns) {
      const match = desc.match(pattern);
      if (match) return match[1] || match[0];
    }
    return null;
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentContent.trim()) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      onClose();
      return;
    }

    setIsSubmitting(true);
    createCommentMutation.mutate({
      postId: postId,
      content: commentContent.trim()
    });
  };

  const handleLike = () => {
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      onClose();
      return;
    }
    likeMutation.mutate();
  };

  // 다중 이미지 파싱
  const getImageUrls = () => {
    if (!post) return [];
    const imgData = post.img || post.photo;
    if (!imgData) return [];

    try {
      // JSON 배열인 경우
      const parsed = JSON.parse(imgData);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      // JSON이지만 배열이 아닌 경우 (단일 문자열)
      return [parsed];
    } catch {
      // JSON이 아닌 경우 (단일 URL 문자열)
      return [imgData];
    }
  };

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 10000 }}>
        <div className="bg-white rounded-2xl p-8">
          <div className="loading loading-spinner loading-lg text-orange-500"></div>
          <p className="mt-4 text-gray-600">게시물을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 10000 }} onClick={onClose}>
        <div className="bg-white rounded-2xl p-8 max-w-sm" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">게시물을 찾을 수 없습니다</h2>
          <p className="text-gray-500 mb-4">삭제되었거나 존재하지 않는 게시물입니다.</p>
          <button
            onClick={onClose}
            className="w-full px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  const price = post.post_type === 'secondhand' ? extractPrice(post.title || post.name, post.description || post.desc) : null;
  const location = post.post_type === 'secondhand' ? extractLocation(post.description || post.desc) : null;
  const isSecondHand = post.post_type === 'secondhand';
  const imageUrls = getImageUrls();

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 pb-20 md:pb-4"
        style={{ zIndex: 10000 }}
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] md:max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 - 고정 */}
          <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
            <h2 className="text-lg font-bold text-gray-900">
              {isSecondHand ? '사고팔고 상세' : '게시물 상세'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <CloseIcon />
            </button>
          </div>

          {/* 스크롤 가능한 콘텐츠 영역 */}
          <div className="flex-1 overflow-y-auto">
            {/* 작성자 정보 */}
            <div className="px-4 py-4 flex items-center gap-3">
              {post.profile_pic ? (
                <img
                  src={post.profile_pic}
                  alt={post.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <PersonIcon className="text-gray-500" />
                </div>
              )}
              <div>
                <div className="font-semibold text-gray-900">{post.user_name || post.username}</div>
                <div className="text-sm text-gray-500">{moment(post.created_at || post.createdAt).fromNow()}</div>
              </div>
            </div>

            {/* 제목 (중고거래) */}
            {isSecondHand && post.title && (
              <div className="px-4 pb-3">
                <h3 className="text-xl font-bold text-gray-900">{post.title}</h3>
                {price && (
                  <div className="text-2xl font-bold text-orange-600 mt-2">{price}</div>
                )}
                {location && (
                  <div className="flex items-center gap-1 text-gray-600 mt-2">
                    <LocationOnIcon fontSize="small" />
                    <span>{location}</span>
                  </div>
                )}
              </div>
            )}

            {/* 미디어 슬라이더 (이미지/비디오) */}
            {imageUrls.length > 0 && (
              <div className="w-full bg-gray-100">
                {imageUrls.length === 1 ? (
                  // 단일 미디어
                  imageUrls[0].endsWith('.mp4') || imageUrls[0].endsWith('.mov') || imageUrls[0].endsWith('.webm') ? (
                    <video
                      src={imageUrls[0]}
                      controls
                      className="w-full h-auto max-h-[400px] object-contain"
                      playsInline
                      onLoadedData={(e) => {
                        // iOS에서 미디어 볼륨 사용하도록 초기 볼륨 설정
                        e.target.volume = 1;
                      }}
                    />
                  ) : (
                    <img
                      src={imageUrls[0]}
                      alt={post.title || post.name || '게시물 이미지'}
                      className="w-full h-auto max-h-[400px] object-contain"
                      onClick={() => window.open(imageUrls[0], '_blank')}
                    />
                  )
                ) : (
                  // 다중 미디어 슬라이더
                  <Swiper
                    modules={[Navigation, Pagination]}
                    navigation
                    pagination={{ clickable: true }}
                    className="w-full"
                    style={{ '--swiper-navigation-color': '#f97316', '--swiper-pagination-color': '#f97316' }}
                  >
                    {imageUrls.map((url, index) => (
                      <SwiperSlide key={index}>
                        {url.endsWith('.mp4') || url.endsWith('.mov') || url.endsWith('.webm') ? (
                          <video
                            src={url}
                            controls
                            className="w-full h-auto max-h-[400px] object-contain bg-gray-100"
                            playsInline
                            onLoadedData={(e) => {
                              // iOS에서 미디어 볼륨 사용하도록 초기 볼륨 설정
                              e.target.volume = 1;
                            }}
                          />
                        ) : (
                          <img
                            src={url}
                            alt={`${post.title || post.name || '게시물 이미지'} ${index + 1}`}
                            className="w-full h-auto max-h-[400px] object-contain bg-gray-100"
                            onClick={() => window.open(url, '_blank')}
                          />
                        )}
                      </SwiperSlide>
                    ))}
                  </Swiper>
                )}
              </div>
            )}

            {/* 내용 */}
            <div className="px-4 py-4">
              <p className="text-gray-700 whitespace-pre-wrap">
                {post.description || post.desc || post.content}
              </p>
            </div>

            {/* 통계 정보 */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <VisibilityIcon fontSize="small" />
                {post.views_count || post.views || 0}
              </span>
              <span className="flex items-center gap-1">
                <ThumbUpIcon fontSize="small" />
                {post.likes_count || post.likes || 0}
              </span>
              <span className="flex items-center gap-1">
                <ChatBubbleOutlineIcon fontSize="small" />
                {comments.length}
              </span>
            </div>

            {/* 좋아요/댓글 버튼 */}
            <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
              <button
                onClick={handleLike}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {post.user_liked ? (
                  <ThumbUpIcon className="text-blue-600" fontSize="small" />
                ) : (
                  <ThumbUpOutlinedIcon fontSize="small" />
                )}
                <span className={post.user_liked ? 'text-blue-600 font-medium' : 'text-gray-700'}>
                  좋아요
                </span>
              </button>
              <button
                onClick={() => document.getElementById('modal-comment-input')?.focus()}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ChatBubbleOutlineIcon fontSize="small" />
                <span className="text-gray-700">댓글</span>
              </button>
            </div>

            {/* 댓글 섹션 */}
            <div className="border-t border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">
                  댓글 {comments.length}
                </h3>
              </div>

              {/* 댓글 로딩 */}
              {commentsLoading && (
                <div className="px-4 py-8 text-center">
                  <div className="loading loading-spinner loading-md text-orange-500"></div>
                  <p className="text-gray-500 mt-2">댓글을 불러오는 중...</p>
                </div>
              )}

              {/* 댓글 에러 */}
              {commentsError && (
                <div className="px-4 py-8 text-center text-red-500">
                  댓글을 불러오는데 실패했습니다.
                </div>
              )}

              {/* 댓글 목록 */}
              {!commentsLoading && !commentsError && (
                <div className="divide-y divide-gray-100">
                  {comments.map((comment) => (
                    <div key={comment.id} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {comment.profile_pic ? (
                          <img
                            src={comment.profile_pic}
                            alt={comment.username}
                            onClick={() => {
                              setSelectedUser(comment);
                              setShowProfileModal(true);
                            }}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                          />
                        ) : (
                          <div
                            onClick={() => {
                              setSelectedUser(comment);
                              setShowProfileModal(true);
                            }}
                            className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-gray-300 transition-colors"
                          >
                            <PersonIcon className="text-gray-500" sx={{ fontSize: 18 }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span
                              onClick={() => {
                                setSelectedUser(comment);
                                setShowProfileModal(true);
                              }}
                              className="font-medium text-sm text-gray-900 cursor-pointer hover:underline"
                            >
                              {comment.user_name || comment.username}
                            </span>
                            {isAIUser(comment) && <AIBadge />}
                            <span className="text-xs text-gray-500">{moment(comment.created_at || comment.createdAt).fromNow()}</span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap mt-0.5">{comment.description || comment.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {comments.length === 0 && (
                    <div className="px-4 py-8 text-center text-gray-500">
                      첫 번째 댓글을 작성해보세요!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 댓글 입력 - 하단 고정 */}
          {currentUser && (
            <div className="flex-shrink-0 border-t border-gray-200 bg-white">
              <form onSubmit={handleCommentSubmit} className="p-3">
                <div className="flex gap-2">
                  <input
                    id="modal-comment-input"
                    type="text"
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    placeholder="댓글을 입력하세요..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !commentContent.trim()}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-sm flex-shrink-0"
                  >
                    <SendIcon sx={{ fontSize: 18 }} />
                    <span>작성</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* 프로필 모달 */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => {
          setShowProfileModal(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />
    </>
  );
};

export default PostDetailModal;
