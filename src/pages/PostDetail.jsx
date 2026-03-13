import React, { useState, useContext, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postService, commentService, adService } from '../services';
import { AuthContext } from '../context/AuthContext';
import moment from 'moment';
import 'moment/locale/ko';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

// 컴포넌트
import MobileAdDisplay from '../components/MobileAdDisplay';
import ProfileModal from '../components/ProfileModal';
import LoadingSpinner from '../components/LoadingSpinner';

// 아이콘
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import LockIcon from '@mui/icons-material/Lock';
import CloseIcon from '@mui/icons-material/Close';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faStop } from '@fortawesome/free-solid-svg-icons';
import AIBadge from '../components/AIBadge';
import { isAIUser } from '../config/aiUser';

moment.locale('ko');

const PostDetail = ({ postId: propPostId, isModal = false, onClose }) => {
  const { postId: paramPostId } = useParams();
  const postId = propPostId || paramPostId;
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();

  // 뒤로가기 핸들러 - 모달 모드 또는 일반 모드
  const handleBack = () => {
    if (isModal && onClose) {
      onClose();
      return;
    }

    const fromTab = location.state?.fromTab;
    const fromPath = location.state?.fromPath;

    if (fromTab && fromPath) {
      // 허브에서 온 경우: 탭 정보와 함께 복원
      navigate(fromPath, {
        replace: false,
        state: { fromDetail: true, activeTab: fromTab }
      });
    } else {
      // 일반 뒤로가기
      navigate(-1);
    }
  };

  const [commentContent, setCommentContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isSecretComment, setIsSecretComment] = useState(false);

  // 음성 인식 상태
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  // 페이지 진입 시 스크롤 최상단으로 이동 (모달이 아닌 경우에만)
  useEffect(() => {
    if (!isModal) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [postId, isModal]);

  // 음성 인식 초기화
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }
        if (finalTranscript) {
          setCommentContent(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      recognition.onerror = (event) => {
        console.error('음성 인식 오류:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // 음성 인식 토글
  const toggleSpeechRecognition = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // 게시물 조회
  const { data: post, isLoading, error } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const response = await postService.getPost(postId);
      return response;
    },
    enabled: !!postId,
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
    refetchOnWindowFocus: false, // 윈도우 포커스 시 refetch 방지
    refetchOnReconnect: false // 재연결 시 refetch 방지
  });

  // 댓글 조회
  const { data: comments = [], isLoading: commentsLoading, error: commentsError } = useQuery({
    queryKey: ['post-comments', postId],
    queryFn: async () => {
      console.log('📝 댓글 조회 시작 - postId:', postId);
      const response = await commentService.getComments(postId);
      console.log('📝 댓글 조회 결과:', response);
      return response || [];
    },
    enabled: !!postId
  });

  // 광고 조회 (모바일 전용)
  const { data: ads = [] } = useQuery({
    queryKey: ['detail-page-ads'],
    queryFn: async () => {
      try {
        const response = await adService.getActiveAds();
        return response || [];
      } catch (error) {
        console.error('광고 로드 실패:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
  });

  // 댓글 작성 뮤테이션
  const createCommentMutation = useMutation({
    mutationFn: (commentData) => commentService.createComment(commentData),
    onSuccess: () => {
      queryClient.invalidateQueries(['post-comments', postId]);
      // 댓글 작성 시 게시물 refetch 제거 (조회수 증가 방지)
      setCommentContent('');
      setIsSubmitting(false);
      setIsSecretComment(false);
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

  // 게시물 삭제 뮤테이션
  const deleteMutation = useMutation({
    mutationFn: () => postService.deletePost(postId),
    onSuccess: () => {
      alert('게시물이 삭제되었습니다.');
      handleBack();
    }
  });

  // 거래 상태 변경 뮤테이션 (중고거래)
  const tradeStatusMutation = useMutation({
    mutationFn: (status) => postService.updateTradeStatus(postId, status),
    onSuccess: () => {
      queryClient.invalidateQueries(['post', postId]);
      queryClient.invalidateQueries(['secondHandPosts']);
      alert('거래 상태가 변경되었습니다.');
    },
    onError: (error) => {
      alert(error.message || '거래 상태 변경에 실패했습니다.');
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
      navigate('/login');
      return;
    }

    setIsSubmitting(true);
    createCommentMutation.mutate({
      postId: postId,
      content: commentContent.trim(),
      isSecret: isSecretComment
    });
  };

  const handleLike = () => {
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }
    likeMutation.mutate();
  };

  const handleEdit = () => {
    // 사고팔고 게시글은 SecondHandEditor로 이동
    if (post?.post_type === 'secondhand') {
      navigate(`/secondhand/edit/${postId}`);
    } else {
      navigate(`/post/edit/${postId}`);
    }
  };

  const handleDelete = () => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-center">
          <ShoppingBagIcon className="text-6xl text-base-content/40 mb-4" />
          <h2 className="text-xl font-semibold text-base-content/70 mb-2">게시물을 찾을 수 없습니다</h2>
          <p className="text-base-content/50 mb-4">삭제되었거나 존재하지 않는 게시물입니다.</p>
          <button
            onClick={handleBack}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const price = post.post_type === 'secondhand' ? extractPrice(post.title || post.name, post.description || post.desc) : null;
  const postLocation = post.post_type === 'secondhand' ? extractLocation(post.description || post.desc) : null;
  const isSecondHand = post.post_type === 'secondhand';
  const isOwner = currentUser && currentUser.id === post.user_id;
  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin');
  const canChangeTradeStatus = isSecondHand && (isOwner || isAdmin);
  const tradeStatus = post.tradeInfo?.status || 'available';

  // 비밀 댓글 볼 수 있는 권한 체크
  const canViewSecretComment = (comment) => {
    if (!comment.is_secret) return true;
    if (!currentUser) return false;
    // 댓글 작성자 본인이거나 게시물 작성자면 볼 수 있음
    return comment.user_id === currentUser.id || post.user_id === currentUser.id || isAdmin;
  };

  // 다중 이미지 파싱
  const getImageUrls = () => {
    const imgData = post.img || post.photo;
    if (!imgData) return [];

    try {
      const parsed = JSON.parse(imgData);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // JSON이 아니면 단일 URL로 처리
      return [imgData];
    }
    return [];
  };

  const imageUrls = getImageUrls();

  return (
    <div className={`min-h-screen bg-base-200 ${isModal ? 'pb-0' : 'pb-20'}`}>
      <div className="max-w-4xl mx-auto">
        {/* 게시물 내용 */}
        <div className="bg-base-100 border-b border-base-300">
          {/* 작성자 정보 */}
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {post.profile_pic ? (
                <img
                  src={post.profile_pic}
                  alt={post.username}
                  onClick={() => {
                    setSelectedUser({
                      user_id: post.user_id,
                      userId: post.user_id,
                      id: post.user_id,
                      username: post.username,
                      user_name: post.user_name,
                      name: post.user_name || post.username,
                      profile_pic: post.profile_pic
                    });
                    setShowProfileModal(true);
                  }}
                  className="w-12 h-12 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                />
              ) : (
                <div
                  onClick={() => {
                    setSelectedUser({
                      user_id: post.user_id,
                      userId: post.user_id,
                      id: post.user_id,
                      username: post.username,
                      user_name: post.user_name,
                      name: post.user_name || post.username,
                      profile_pic: post.profile_pic
                    });
                    setShowProfileModal(true);
                  }}
                  className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center cursor-pointer hover:bg-base-content/20 transition-colors"
                >
                  <PersonIcon className="text-base-content/50" />
                </div>
              )}
              <div>
                <div
                  onClick={() => {
                    setSelectedUser({
                      user_id: post.user_id,
                      userId: post.user_id,
                      id: post.user_id,
                      username: post.username,
                      user_name: post.user_name,
                      name: post.user_name || post.username,
                      profile_pic: post.profile_pic
                    });
                    setShowProfileModal(true);
                  }}
                  className="font-semibold text-base-content cursor-pointer hover:underline"
                >
                  {post.user_name || post.username}
                </div>
                <div className="text-sm text-base-content/50">{moment(post.created_at || post.createdAt).fromNow()}</div>
              </div>
            </div>

            {/* 오른쪽 영역: 판매완료 버튼 + 수정/삭제 버튼 */}
            <div className="flex items-center gap-2">
              {/* 거래 상태 변경 버튼 (작성자/관리자만) */}
              {canChangeTradeStatus && (
                <>
                  {tradeStatus !== 'sold' ? (
                    <button
                      onClick={() => {
                        if (window.confirm('판매완료로 변경하시겠습니까?')) {
                          tradeStatusMutation.mutate('sold');
                        }
                      }}
                      disabled={tradeStatusMutation.isPending}
                      className="py-1.5 px-3 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors"
                    >
                      {tradeStatusMutation.isPending ? '처리중...' : '판매완료'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (window.confirm('다시 판매중으로 변경하시겠습니까?')) {
                          tradeStatusMutation.mutate('available');
                        }
                      }}
                      disabled={tradeStatusMutation.isPending}
                      className="py-1.5 px-3 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                    >
                      {tradeStatusMutation.isPending ? '처리중...' : '다시 판매'}
                    </button>
                  )}
                </>
              )}

              {/* 수정/삭제 버튼 */}
              {isOwner && (
                <div className="flex gap-1">
                  <button
                    onClick={handleEdit}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <EditIcon fontSize="small" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <DeleteIcon fontSize="small" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 제목 (중고거래) */}
          {isSecondHand && post.title && (
            <div className="px-4 pb-3">
              {/* 판매 상태 배지 */}
              <div className="flex items-center gap-2 mb-2">
                {tradeStatus === 'sold' ? (
                  <span className="px-3 py-1 bg-gray-800 text-white text-sm font-bold rounded-full">
                    판매완료
                  </span>
                ) : tradeStatus === 'reserved' ? (
                  <span className="px-3 py-1 bg-yellow-500 text-white text-sm font-bold rounded-full">
                    예약중
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-orange-500 text-white text-sm font-bold rounded-full">
                    판매중
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-base-content">{post.title}</h2>
              {price && (
                <div className="text-2xl font-bold text-orange-600 mt-2">{price}</div>
              )}
              {postLocation && (
                <div className="flex items-center gap-1 text-base-content/60 mt-2">
                  <LocationOnIcon fontSize="small" />
                  <span>{location}</span>
                </div>
              )}
            </div>
          )}

          {/* 이미지 슬라이더 */}
          {imageUrls.length > 0 && (
            <div className="w-full bg-base-200">
              {imageUrls.length === 1 ? (
                // 단일 이미지
                <img
                  src={imageUrls[0]}
                  alt={post.title || post.name || '게시물 이미지'}
                  className="w-full h-auto max-h-[600px] object-contain"
                  onClick={() => window.open(imageUrls[0], '_blank')}
                />
              ) : (
                // 다중 이미지 슬라이더
                <Swiper
                  modules={[Navigation, Pagination]}
                  navigation
                  pagination={{ clickable: true }}
                  className="w-full"
                  style={{ '--swiper-navigation-color': '#f97316', '--swiper-pagination-color': '#f97316' }}
                >
                  {imageUrls.map((url, index) => (
                    <SwiperSlide key={index}>
                      <img
                        src={url}
                        alt={`${post.title || post.name || '게시물 이미지'} ${index + 1}`}
                        className="w-full h-auto max-h-[600px] object-contain bg-base-200"
                        onClick={() => window.open(url, '_blank')}
                      />
                    </SwiperSlide>
                  ))}
                </Swiper>
              )}
            </div>
          )}

          {/* 내용 */}
          <div className="px-4 py-4">
            <p className="text-base-content/70 whitespace-pre-wrap">
              {post.content || post.description || post.desc}
            </p>
          </div>

          {/* 통계 정보 */}
          <div className="px-4 py-3 border-t border-base-200 flex items-center gap-4 text-sm text-base-content/50">
            <span className="flex items-center gap-1">
              <VisibilityIcon fontSize="small" />
              {post.views_count || post.views || 0}
            </span>
            {/* 중고거래가 아닌 경우에만 좋아요 표시 */}
            {!isSecondHand && (
              <span className="flex items-center gap-1">
                <ThumbUpIcon fontSize="small" />
                {post.likes_count || post.likes || 0}
              </span>
            )}
            <span className="flex items-center gap-1">
              <ChatBubbleOutlineIcon fontSize="small" />
              {comments.length}
            </span>
          </div>

          {/* 좋아요 버튼 (중고거래가 아닌 경우에만) */}
          {!isSecondHand && (
            <div className="px-4 py-3 border-t border-base-200 flex gap-2">
              <button
                onClick={handleLike}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-base-200 transition-colors"
              >
                {post.user_liked ? (
                  <ThumbUpIcon className="text-blue-600" fontSize="small" />
                ) : (
                  <ThumbUpOutlinedIcon fontSize="small" />
                )}
                <span className={post.user_liked ? 'text-blue-600 font-medium' : 'text-base-content/70'}>
                  좋아요
                </span>
              </button>
            </div>
          )}
        </div>

        {/* 댓글 섹션 */}
        <div className="bg-base-100 mt-2">
          {/* 댓글 로딩 상태 */}
          {commentsLoading && (
            <div className="px-4 py-8 flex flex-col items-center">
              <LoadingSpinner size="md" />
              <p className="text-base-content/50 mt-2">댓글을 불러오는 중...</p>
            </div>
          )}

          {/* 댓글 에러 */}
          {commentsError && (
            <div className="px-4 py-8 text-center text-red-500">
              댓글을 불러오는데 실패했습니다.
              <button
                onClick={() => window.location.reload()}
                className="ml-2 text-blue-500 underline"
              >
                새로고침
              </button>
            </div>
          )}

          {/* 댓글 목록 */}
          {!commentsLoading && !commentsError && (
            <div className="divide-y divide-base-200">
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
                      className="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-base-content/20 transition-colors"
                    >
                      <PersonIcon className="text-base-content/50" sx={{ fontSize: 18 }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        onClick={() => {
                          setSelectedUser(comment);
                          setShowProfileModal(true);
                        }}
                        className="font-medium text-sm text-base-content cursor-pointer hover:underline"
                      >
                        {comment.user_name || comment.username}
                      </span>
                      {isAIUser(comment) && <AIBadge />}
                      {comment.is_secret && (
                        <span className="inline-flex items-center gap-0.5 text-xs bg-base-200 text-base-content/60 px-1.5 py-0.5 rounded">
                          <LockIcon sx={{ fontSize: 12 }} />
                          비밀
                        </span>
                      )}
                      <span className="text-xs text-base-content/50">{moment(comment.created_at || comment.createdAt).fromNow()}</span>
                    </div>
                    {canViewSecretComment(comment) ? (
                      <p className="text-sm text-base-content/70 whitespace-pre-wrap mt-0.5">{comment.description || comment.desc}</p>
                    ) : (
                      <p className="text-sm text-base-content/40 italic mt-0.5">비밀 댓글입니다.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

              {comments.length === 0 && (
                <div className="px-4 py-8 text-center text-base-content/50">
                  첫 번째 댓글을 작성해보세요!
                </div>
              )}
            </div>
          )}

          {/* 댓글 입력 */}
          {currentUser && (
            <div className="border-t border-base-300 bg-base-100">
              <form onSubmit={handleCommentSubmit} className="p-3">
                {/* 중고거래일 때만 비밀댓글 옵션 표시 */}
                {isSecondHand && (
                  <div className="mb-2">
                    <label className="flex items-center gap-2 text-sm text-base-content/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSecretComment}
                        onChange={(e) => setIsSecretComment(e.target.checked)}
                        className="rounded border-base-300 text-orange-500 focus:ring-orange-400"
                      />
                      <LockIcon sx={{ fontSize: 16 }} />
                      <span>비밀 댓글</span>
                      <span className="text-xs text-base-content/40">(판매자와 본인만 볼 수 있음)</span>
                    </label>
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  {/* 음성 입력 버튼 */}
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={toggleSpeechRecognition}
                      className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full transition-all ${
                        isListening
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'bg-base-200 text-base-content/60 hover:bg-base-200'
                      }`}
                      disabled={isSubmitting}
                      title={isListening ? '음성 입력 중지' : '음성 입력'}
                    >
                      <FontAwesomeIcon icon={isListening ? faStop : faMicrophone} className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <input
                    id="comment-input"
                    type="text"
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    placeholder={isSecretComment ? "비밀 댓글을 입력하세요..." : "댓글을 입력하세요..."}
                    className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent ${
                      isSecretComment ? 'border-orange-300 bg-orange-50' : 'border-base-300'
                    }`}
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !commentContent.trim()}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-base-content/20 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-sm flex-shrink-0"
                  >
                    {isSecretComment && <LockIcon sx={{ fontSize: 14 }} />}
                    <SendIcon sx={{ fontSize: 18 }} />
                    <span>작성</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 광고 영역 */}
          {ads.length > 0 && (
            <div className="border-t border-base-300 py-4">
              <MobileAdDisplay ad={ads[0]} />
            </div>
          )}
        </div>
      </div>

      {/* 플로팅 닫기 버튼 (왼쪽 하단) - 모달 모드가 아닐 때만 표시 */}
      {!isModal && (
        <button
          onClick={handleBack}
          className="fixed bottom-20 left-4 w-14 h-14 text-white rounded-full z-10 flex items-center justify-center border-2 border-white shadow-lg transition-all duration-200 hover:scale-110"
          style={{
            background: 'linear-gradient(135deg, #6B7280 0%, #374151 100%)',
            boxShadow: '0 4px 15px rgba(107, 114, 128, 0.4), 0 8px 25px rgba(55, 65, 81, 0.3)'
          }}
          title="닫기"
        >
          <CloseIcon />
        </button>
      )}

      {/* 프로필 모달 */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => {
          setShowProfileModal(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />
    </div>
  );
};

export default PostDetail;
