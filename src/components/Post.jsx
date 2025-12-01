/* eslint-disable react/prop-types */
import React, { useContext, useRef, useEffect, useState } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHeart,
  faComment,
  faShare,
  faEllipsisH,
  faPlay,
  faPause,
  faVolumeUp,
  faVolumeMute,
  faBookmark,
  faFlag
} from "@fortawesome/free-solid-svg-icons";
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PushPinIcon from '@mui/icons-material/PushPin';
import LockIcon from '@mui/icons-material/Lock';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { useFeaturePermissions } from '../hooks/usePermissions';
import moment from 'moment';
import ImageSlider from './ImageSlider';
import DeleteConfirmModal from "./DeleteConfirmModal";
import YouTubeEmbed from './YouTubeEmbed';
import ReportModal from './ReportModal';
import ReportDetailsModal from './ReportDetailsModal';
import LocationDisplay from './LocationDisplay';
import CommentsSection from './CommentsSection';
import { isVideoFile, normalizeMediaUrl, getMediaType } from '../utils/mediaUtils';
import { postService, badgeService } from '../services';
import BadgeDisplay from './BadgeDisplay';

const Post = ({ post, isVisible = true, onVideoPlay, onVideoPause }) => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const featurePermissions = useFeaturePermissions();
  const videoRef = useRef(null);
  const postRef = useRef(null);
  
  // 관리자/운영자 권한 확인 (currentUser 정보에서 직접 확인)
  const isAdminOrModerator = currentUser && (
    currentUser.role === 'admin' || 
    currentUser.role === 'moderator' || 
    currentUser.is_admin === 1 ||
    currentUser.isAdminOrModerator
  );
  
  // 동영상 상태 관리
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);

  // UI 상태 관리
  const [showComments, setShowComments] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportDetailsModal, setShowReportDetailsModal] = useState(false);

  // 더블탭 좋아요를 위한 상태
  const [lastTap, setLastTap] = useState(0);

  // 미디어 타입 감지
  const mediaFiles = post.images && post.images.length > 0 ? post.images : (post.img ? [post.img] : []);
  const hasMedia = mediaFiles.length > 0;
  
  const normalizedMediaFiles = mediaFiles.map(file => normalizeMediaUrl(file));
  const firstMediaType = hasMedia ? getMediaType(mediaFiles[0]) : { isVideo: false, isImage: false };
  const isVideo = firstMediaType.isVideo;

  // 권한 확인
  const canDelete = post.userId === currentUser.id || featurePermissions.canDeleteAnyPost;
  const canEdit = post.userId === currentUser.id;

  // 좋아요 조회
  const { isPending, data: likesData } = useQuery({
    queryKey: ["likes", post.id],
    queryFn: () => postService.getLikes(post.id),
  });

  const queryClient = useQueryClient();

  // 좋아요 토글
  const likeMutation = useMutation({
    mutationFn: async (liked) => {
      if (liked) {
        await postService.unlikePost(post.id);
      } else {
        await postService.likePost(post.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["likes"] });
    },
    onError: (error) => {
      if (error.message?.includes('자신의 게시물')) {
        const toast = document.createElement('div');
        toast.className = 'toast toast-top toast-center z-50';
        toast.innerHTML = `
          <div class="alert alert-warning">
            <span>⚠️ 자신의 게시물에는 좋아요를 누를 수 없습니다.</span>
          </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => document.body.removeChild(toast), 3000);
      }
    },
  });

  // 사용자 뱃지 조회 (프로필 모달용)
  const { data: userBadges } = useQuery({
    queryKey: ["userBadges", post.userId],
    queryFn: () => badgeService.getUserBadges(post.userId),
    enabled: showProfileModal, // 모달이 열릴 때만 조회
  });

  // 게시물 삭제
  const deleteMutation = useMutation({
    mutationFn: (postId) => postService.deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setIsDeleteModalOpen(false);
    },
    onError: (error) => {
      console.error('게시물 삭제 실패:', error);
    }
  });

  // 동영상 자동재생 관리
  useEffect(() => {
    if (!videoRef.current || !isVideo) return;

    const video = videoRef.current;

    if (isVisible) {
      const playTimeout = setTimeout(() => {
        video.play().then(() => {
          setIsPlaying(true);
          onVideoPlay && onVideoPlay(post.id);
        }).catch((error) => {
          console.log('Auto-play failed:', error);
        });
      }, 100);

      return () => clearTimeout(playTimeout);
    } else {
      video.pause();
      setIsPlaying(false);
      onVideoPause && onVideoPause(post.id);
    }
  }, [isVisible, isVideo, post.id, onVideoPlay, onVideoPause]);

  // 동영상 진행률 업데이트
  useEffect(() => {
    if (!videoRef.current || !isVideo) return;

    const video = videoRef.current;
    
    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleBuffering = () => setIsBuffering(true);
    const handleBufferingEnd = () => setIsBuffering(false);

    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('waiting', handleBuffering);
    video.addEventListener('canplay', handleBufferingEnd);
    video.addEventListener('playing', handleBufferingEnd);

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('waiting', handleBuffering);
      video.removeEventListener('canplay', handleBufferingEnd);
      video.removeEventListener('playing', handleBufferingEnd);
    };
  }, [isVideo]);

  // 핸들러 함수들
  const handleLike = (animate = false) => {
    if (animate) {
      setIsLikeAnimating(true);
      setTimeout(() => setIsLikeAnimating(false), 1000);
    }
    likeMutation.mutate(likesData?.includes(currentUser.id));
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    deleteMutation.mutate(post.id);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
  };

  const handleEdit = () => {
    navigate(`/post/edit/${post.id}`);
  };


  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: '게시글 공유',
        text: postContent,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href)
        .then(() => alert('링크가 클립보드에 복사되었습니다!'))
        .catch(() => alert('공유에 실패했습니다.'));
    }
  };

  const handleTagClick = (tagName) => {
    navigate(`/community?tag=${tagName}`);
  };

  const handleVideoClick = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleMuteToggle = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;

    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  // 더블탭 좋아요 처리
  const handleMediaDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap < DOUBLE_TAP_DELAY) {
      handleLike(true);
    }
    setLastTap(now);
  };

  const formatTime = (dateString) => {
    return moment(dateString).fromNow();
  };

  const isLiked = likesData?.includes(currentUser.id);
  const likeCount = likesData?.length || 0;

  // 설명 텍스트 길이 제한
  const MAX_DESC_LENGTH = 100;
  const postContent = post.Desc || post.desc || '';
  
  // 디버깅용 로그
  if (post.link_type === 'youtube') {
    console.log('YouTube 게시물 데이터:', {
      id: post.id,
      Desc: post.Desc,
      desc: post.desc, 
      postContent,
      link_url: post.link_url,
      link_type: post.link_type
    });
  }
  
  const shouldShowMore = postContent && postContent.length > MAX_DESC_LENGTH;
  const displayDescription = shouldShowMore && !showFullDescription 
    ? postContent.slice(0, MAX_DESC_LENGTH) + '...'
    : postContent;

  if (isPending) {
    return (
      <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-lg mb-6 animate-pulse"
           style={{ boxShadow: '-2px 0 10px rgba(255, 165, 0, 0.2), 0 2px 10px rgba(0, 0, 0, 0.1)' }}>
        <div className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-300 rounded w-24"></div>
              <div className="h-3 bg-gray-300 rounded w-16 mt-1"></div>
            </div>
          </div>
        </div>
        <div className="w-full h-80 bg-gray-300 rounded-lg mx-4"></div>
        <div className="p-4">
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          <div className="h-3 bg-gray-300 rounded w-1/2 mt-2"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <article 
        ref={postRef}
        className="w-full max-w-md mx-auto rounded-xl shadow-lg mb-6 overflow-hidden relative"
        style={{
          backgroundColor: post.primaryTag?.color ? post.primaryTag.color + '03' : 'white',
          boxShadow: post.primaryTag?.color 
            ? `-3px 0 15px ${post.primaryTag.color}15, 0 3px 15px rgba(0, 0, 0, 0.08)`
            : '-3px 0 15px rgba(255, 165, 0, 0.25), 0 3px 15px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* 좋아요 애니메이션 하트 */}
        {isLikeAnimating && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <div className="animate-ping">
              <FontAwesomeIcon 
                icon={faHeart} 
                className="w-20 h-20 text-red-500 opacity-80"
              />
            </div>
          </div>
        )}

        {/* 헤더 - QnA 질문글일 때 강조 표시 */}
        <header className={`flex items-center justify-between py-3 px-4 border-b ${
          post.post_type === 'question' ? 'border-amber-200 bg-amber-50' : 'border-gray-100'
        }`}>
          <div className="flex items-center space-x-3 flex-1">
            {/* QnA 질문 표시 */}
            {post.post_type === 'question' && (
              <div className="flex items-center space-x-2 bg-amber-100 px-3 py-1 rounded-full">
                <span className="text-amber-600 font-medium text-sm">❓ 질문</span>
              </div>
            )}
            
            {/* 프로필 사진 - 클릭 시 모달 열기 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowProfileModal(true);
              }}
              className="relative flex-shrink-0"
            >
              <div className={`rounded-full ring-2 ring-offset-2 overflow-hidden ${
                post.post_type === 'question' ? 'w-12 h-12 ring-amber-400' : 'w-10 h-10 ring-orange-400'
              }`}>
                <img
                  src={post.profilePic
                    ? `/uploads/profiles/${post.profilePic}`
                    : "/default/default_profile.png"
                  }
                  alt={`${post.username} 프로필`}
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </button>
            
            {/* 사용자 정보 - QnA일 때 더 크게 표시 */}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-gray-900 truncate ${
                post.post_type === 'question' ? 'text-lg' : 'text-base'
              }`}>
                {post.name || post.username}
              </p>
              {post.post_type === 'question' && (
                <p className="text-sm text-amber-600 font-medium">질문 작성자</p>
              )}
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <span>{formatTime(post.createdAt)}</span>
                {post.related_market && (
                  <>
                    <span>•</span>
                    <span>📍 {post.related_market}</span>
                  </>
                )}
              </div>
              {/* 고유번호 표시 - 관리자/운영자만 */}
              {post.title && isAdminOrModerator && (
                <div className="text-xs text-gray-400 mt-0.5 font-mono">
                  {post.title}
                </div>
              )}
            </div>
          </div>

          {/* 고정 표시 */}
          {post.is_pinned && (
            <div className="mr-2">
              <PushPinIcon className="w-4 h-4 text-blue-500" />
            </div>
          )}

          {/* 비밀글 표시 */}
          {post.isPrivate && (
            <div className="mr-2">
              <LockIcon className="w-4 h-4 text-gray-500" />
            </div>
          )}

          {/* 조회수 표시 */}
          {post.views_count > 0 && (
            <div className="mr-2 flex items-center text-gray-500">
              <span className="text-sm font-medium">
                {post.views_count}
              </span>
            </div>
          )}

          {/* 더보기 메뉴 */}
          <div className="dropdown dropdown-end">
            <button 
              tabIndex={0} 
              className="btn btn-ghost btn-circle btn-sm hover:bg-gray-100"
            >
              <FontAwesomeIcon icon={faEllipsisH} className="w-4 h-4 text-gray-600" />
            </button>
            <ul className="dropdown-content z-50 menu p-2 shadow-lg bg-white rounded-xl w-48 text-sm border border-gray-200">
              {/* 본인 게시글 메뉴 */}
              {canEdit && (
                <>
                  <li>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEdit();
                      }}
                      className="flex items-center w-full text-left p-3 hover:bg-gray-50 rounded-lg"
                    >
                      ✏️ 수정
                    </button>
                  </li>
                  <div className="divider my-1"></div>
                </>
              )}
              
              {canDelete && (
                <>
                  <li>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete();
                      }}
                      disabled={deleteMutation.isPending}
                      className={`flex items-center w-full text-left p-3 rounded-lg ${
                        deleteMutation.isPending 
                          ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
                          : 'text-red-500 hover:bg-red-50'
                      }`}
                    >
                      {deleteMutation.isPending ? (
                        <>
                          <span className="loading loading-spinner loading-xs mr-2"></span>
                          삭제 중...
                        </>
                      ) : (
                        '🗑️ 삭제'
                      )}
                    </button>
                  </li>
                  <div className="divider my-1"></div>
                </>
              )}
              
              {/* 공통 기능 */}
              <li>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsSaved(!isSaved);
                  }}
                  className="flex items-center w-full text-left p-3 hover:bg-gray-50 rounded-lg"
                >
                  💾 {isSaved ? '저장 취소' : '저장'}
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleShare();
                  }}
                  className="flex items-center w-full text-left p-3 hover:bg-gray-50 rounded-lg"
                >
                  📤 공유
                </button>
              </li>
              
              {/* 신고 버튼 - 본인 게시글이 아닌 경우에만 표시 */}
              {post.userId !== currentUser.id && (
                <>
                  <div className="divider my-1"></div>
                  <li>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowReportModal(true);
                      }}
                      className="flex items-center w-full text-left p-3 hover:bg-red-50 rounded-lg text-red-500"
                    >
                      🚨 신고하기
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>
        </header>

        {/* 미디어 컨텐츠 */}
        {hasMedia && (
          <div 
            className="relative w-full bg-gray-100 select-none"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
            onDoubleClick={handleMediaDoubleTap}
          >
            {mediaFiles.length === 1 ? (
              // 단일 미디어
              isVideo ? (
                <>
                  <video
                    ref={videoRef}
                    className="w-full h-auto object-contain cursor-pointer"
                    onClick={handleVideoClick}
                    loop
                    muted={isMuted}
                    playsInline
                    preload="metadata"
                  >
                    <source src={normalizedMediaFiles[0]} />
                    <track kind="captions" />
                  </video>

                  {/* 버퍼링 인디케이터 */}
                  {isBuffering && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}

                  {/* 동영상 컨트롤 오버레이 */}
                  <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                    showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
                  }`}>
                    {!isPlaying && !isBuffering && (
                      <button
                        onClick={handleVideoClick}
                        className="w-16 h-16 bg-black bg-opacity-60 rounded-full flex items-center justify-center text-white hover:bg-opacity-80 transition-all transform hover:scale-110"
                      >
                        <FontAwesomeIcon icon={faPlay} className="ml-1 w-6 h-6" />
                      </button>
                    )}
                  </div>

                  {/* 음소거 버튼 */}
                  <button
                    onClick={handleMuteToggle}
                    className={`absolute top-4 right-4 w-10 h-10 bg-black bg-opacity-60 rounded-full flex items-center justify-center text-white transition-all duration-200 ${
                      showControls ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                    }`}
                  >
                    <FontAwesomeIcon 
                      icon={isMuted ? faVolumeMute : faVolumeUp} 
                      className="w-4 h-4" 
                    />
                  </button>

                  {/* 진행률 바 */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black bg-opacity-20">
                    <div 
                      className="h-full bg-white transition-all duration-100 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </>
              ) : (
                <img
                  src={normalizedMediaFiles[0]}
                  alt="게시물 이미지"
                  className="w-full h-auto object-contain cursor-pointer hover:scale-105 transition-transform duration-300"
                  onClick={handleMediaDoubleTap}
                />
              )
            ) : (
              // 다중 미디어
              <ImageSlider 
                images={normalizedMediaFiles}
                baseUrl=""
              />
            )}
          </div>
        )}

        {/* YouTube 링크 표시 */}
        {post.link_type === 'youtube' && post.link_url && (
          <div className="px-4 pb-3">
            <YouTubeEmbed url={post.link_url} className="rounded-lg" />
          </div>
        )}

        {/* 액션 버튼들 */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => handleLike(false)}
                className={`transition-all duration-200 transform ${isLiked ? 'scale-110' : 'hover:scale-110'}`}
              >
                <FontAwesomeIcon 
                  icon={faHeart} 
                  className={`w-6 h-6 ${isLiked ? 'text-red-500' : 'text-gray-700 hover:text-red-500'}`}
                />
              </button>
              
              <button 
                onClick={() => setShowComments(!showComments)}
                className="text-gray-700 hover:text-blue-500 transition-all duration-200 hover:scale-110"
              >
                <FontAwesomeIcon icon={faComment} className="w-6 h-6" />
              </button>
              
              <button 
                onClick={handleShare}
                className="text-gray-700 hover:text-green-500 transition-all duration-200 hover:scale-110"
              >
                <FontAwesomeIcon icon={faShare} className="w-6 h-6" />
              </button>

              {/* 신고 아이콘 (신고가 있을 때만 표시) */}
              {(post.report_count > 0) && (
                <button 
                  onClick={() => setShowReportDetailsModal(true)}
                  className="flex items-center text-red-500 hover:text-red-700 transition-all duration-200 hover:scale-110"
                  title={`신고 ${post.report_count}건`}
                >
                  <FontAwesomeIcon icon={faFlag} className="w-5 h-5" />
                  <span className="text-xs ml-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                    {post.report_count}
                  </span>
                </button>
              )}
            </div>

            {/* 저장 버튼 */}
            <button 
              onClick={() => setIsSaved(!isSaved)}
              className={`transition-all duration-200 hover:scale-110 ${isSaved ? 'text-blue-500' : 'text-gray-700 hover:text-blue-500'}`}
            >
              <FontAwesomeIcon icon={faBookmark} className="w-6 h-6" />
            </button>
          </div>

          {/* 좋아요 수 */}
          {likeCount > 0 && (
            <p className="font-semibold text-sm text-gray-900 mb-3">
              좋아요 {likeCount.toLocaleString()}개
            </p>
          )}
          

          {/* 게시물 내용 */}
          {(post.Desc || post.desc) && (
            <div className={`mb-3 ${post.post_type === 'question' ? 'text-base' : 'text-sm'} text-gray-900`}>
              {/* QnA 질문일 때만 제목 표시 */}
              {post.post_type === 'question' && post.title && (
                <h3 className="font-bold text-lg text-gray-900 mb-2 leading-tight">
                  {post.title}
                </h3>
              )}
              
              {/* 일반 게시글일 때는 사용자명과 함께, QnA일 때는 내용만 */}
              <div className="whitespace-pre-wrap break-words">
                {post.post_type === 'question' ? (
                  <span>{displayDescription}</span>
                ) : (
                  <>
                    <span className="font-semibold mr-2">{post.name || post.username}</span>
                    <span>{displayDescription}</span>
                  </>
                )}
              </div>
              
              {shouldShowMore && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="text-gray-500 ml-2 hover:text-gray-700 mt-1"
                >
                  {showFullDescription ? '간략히' : '더보기'}
                </button>
              )}
            </div>
          )}

          {/* 태그 */}
          {(post.primaryTag || (post.tags && post.tags.length > 0)) && (
            <div className="flex flex-wrap gap-1 mb-2">
              {post.primaryTag && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  style={{ 
                    backgroundColor: post.primaryTag.color + '10', 
                    color: post.primaryTag.color
                  }}
                >
                  {post.primaryTag.display_name}
                </span>
              )}
              
              {post.tags && post.tags
                .filter(tag => tag.id !== post.primaryTag?.id)
                .slice(0, 2)
                .map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                    style={{ 
                      backgroundColor: tag.color + '08', 
                      color: tag.color
                    }}
                  >
                    #{tag.display_name}
                  </span>
                ))
              }
            </div>
          )}

          {/* 위치 정보 표시 */}
          <LocationDisplay post={post} showMap={false} compact={true} />

          {/* 댓글 보기 버튼 */}
          <button 
            onClick={() => setShowComments(!showComments)}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors font-medium"
          >
            {showComments ? '댓글 숨기기' : '댓글 보기'}
          </button>
        </div>

        {/* 댓글 섹션 */}
        {showComments && (
          <CommentsSection 
            postId={post.id} 
            postTag={post.primaryTag?.name} 
            post={post}
          />
        )}
      </article>

      {/* 삭제 확인 모달 */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        loading={deleteMutation.isPending}
      />

      {/* 프로필 모달 */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full max-h-[80vh] overflow-y-auto">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">프로필</h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 프로필 내용 */}
            <div className="p-6">
              {/* 프로필 사진 */}
              <div className="flex justify-center mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-gradient-to-r from-orange-400 to-pink-500 p-1">
                  <div className="w-full h-full rounded-full overflow-hidden bg-white">
                    <img
                      src={post.profilePic
                        ? `/uploads/posts/${post.profilePic}`
                        : "/default/default_profile.png"
                      }
                      alt={`${post.username} 프로필`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {/* 사용자 정보 */}
              <div className="text-center space-y-2">
                <h4 className="text-xl font-semibold text-gray-900">
                  {post.name || post.username}
                </h4>
                <p className="text-gray-500">@{post.username}</p>

                {/* 뱃지 표시 */}
                {userBadges && userBadges.length > 0 && (
                  <div className="flex items-center justify-center gap-1 flex-wrap mt-2">
                    {userBadges.map((badge, index) => (
                      <BadgeDisplay
                        key={badge.id || index}
                        badge={badge}
                        size="sm"
                      />
                    ))}
                  </div>
                )}

                {post.related_market && (
                  <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
                    <span>📍</span>
                    <span>{post.related_market}</span>
                  </div>
                )}
              </div>

              {/* 액션 버튼들 */}
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    navigate(`/profile/${post.userId}`);
                  }}
                  className="w-full bg-blue-500 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                >
                  프로필 보기
                </button>
                
                {post.userId !== currentUser.id && (
                  <button
                    onClick={() => {
                      setShowProfileModal(false);
                      // 메시지 기능이 있다면 여기에 추가
                      console.log('메시지 보내기 기능 예정');
                    }}
                    className="w-full border border-gray-300 text-gray-700 py-2.5 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    메시지 보내기
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 신고 모달 */}
      <ReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        postId={post.id}
        postAuthor={post.name || post.username}
      />

      {/* 신고 내역 모달 */}
      <ReportDetailsModal
        postId={post.id}
        isOpen={showReportDetailsModal}
        onClose={() => setShowReportDetailsModal(false)}
      />
    </>
  );
};

export default Post;