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
import { useContext as useReactContext } from "react";
import { postService } from "../services";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { useFeaturePermissions } from '../hooks/usePermissions';
import moment from 'moment';
import ImageSlider from './ImageSlider';
import CommentsPreview from './CommentsPreview';
import DeleteConfirmModal from './DeleteConfirmModal';
import ReportModal from './ReportModal';
import ReportDetailsModal from './ReportDetailsModal';
import { isVideoFile, normalizeMediaUrl, getMediaType, isCloudflareStreamUrl, isR2VideoUrl } from '../utils/mediaUtils';
import CloudflareStreamPlayer from './CloudflareStreamPlayer';
import YouTubeEmbed from './YouTubeEmbed';
import LinkPreview from './LinkPreview';
import BadgeDisplay from './BadgeDisplay';
import { badgeService } from '../services';
import ProfileModal from './ProfileModal';
import MediaModal from './MediaModal';
import { getDisplayName, getProfilePic, isProfileClickable, getAvatarClassName } from '../utils/userHelper';

const EnhancedInstagramPost = ({ post, isVisible = true, onVideoPlay, onVideoPause }) => {
  const { currentUser, isBanned } = useContext(AuthContext);
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
  const isMutedRef = useRef(true);  // setTimeout에서 최신 값 참조용
  const [showControls, setShowControls] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isWaitingToReplay, setIsWaitingToReplay] = useState(false);
  const replayTimeoutRef = useRef(null);
  const isLoadingRef = useRef(false);  // 동영상 로드 진행 중 여부
  const hasLoadedRef = useRef(false);  // 동영상이 한번이라도 로드 완료되었는지

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (replayTimeoutRef.current) {
        clearTimeout(replayTimeoutRef.current);
      }
    };
  }, []);

  // UI 상태 관리
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [mediaLoadError, setMediaLoadError] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  // sessionStorage에서 이미 조회한 게시물인지 확인 (컴포넌트 재마운트 시에도 유지)
  const [viewCountIncreased, setViewCountIncreased] = useState(() => {
    const viewedKey = `post_viewed_${post.id}`;
    return sessionStorage.getItem(viewedKey) === 'true';
  });
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportDetailsModal, setShowReportDetailsModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaModalIndex, setMediaModalIndex] = useState(0);
  const [mediaModalTime, setMediaModalTime] = useState(0);  // 동영상 시작 시간
  const [showLoginModal, setShowLoginModal] = useState(false); // 로그인 필요 모달

  // 더블탭 좋아요를 위한 상태
  const [lastTap, setLastTap] = useState(0);

  // 미디어 타입 감지 - 다중 이미지 지원 (개선된 버전)
  const getMediaFiles = () => {
    // 1. post.images가 배열이면 그대로 사용
    if (post.images && Array.isArray(post.images) && post.images.length > 0) {
      return post.images;
    }

    // 2. post.img가 있으면 파싱 시도
    if (post.img) {
      try {
        const parsed = JSON.parse(post.img);
        if (Array.isArray(parsed)) {
          return parsed;
        }
        // JSON이 아니면 단일 URL로 처리
        return [post.img];
      } catch {
        // JSON 파싱 실패 시 단일 URL로 처리
        return [post.img];
      }
    }

    return [];
  };

  const mediaFiles = getMediaFiles();
  const hasMedia = mediaFiles.length > 0;

  // 정규화된 미디어 파일 배열 생성
  const normalizedMediaFiles = mediaFiles.map(file => normalizeMediaUrl(file));

  // 첫 번째 미디어의 타입 정보 (하위 호환성)
  const firstMediaType = hasMedia ? getMediaType(mediaFiles[0]) : { isVideo: false, isImage: false };
  const isVideo = firstMediaType.isVideo;
  const isCloudflareStream = hasMedia && isCloudflareStreamUrl(mediaFiles[0]);
  const isR2Video = hasMedia && isR2VideoUrl(mediaFiles[0]);

  // 미디어 타입 감지 로그 제거됨

  // 삭제 권한 확인 (로그인 안 된 상태에서는 false)
  const canDelete = currentUser && (post.userId === currentUser.id || featurePermissions.canDeleteAnyPost);

  // 거래 완료 관리 권한 확인 (작성자 또는 관리자, 로그인 필요)
  const canManageTrade = currentUser && (post.userId === currentUser.id || featurePermissions.canDeleteAnyPost);

  // 작성자 정보 (탈퇴 사용자 대응)
  const postUser = post.user || { name: post.name, username: post.username, profile_pic: post.profilePic, deleted_at: post.user_deleted_at };
  const authorName = getDisplayName(postUser);
  const authorProfilePic = getProfilePic(postUser);
  const canClickProfile = isProfileClickable(postUser);
  const avatarClassName = getAvatarClassName(postUser);

  // 디버깅 로그 제거 (성능 향상)
  // console.log 제거됨
  // console.log('🔍 Instagram Post 미디어 정보:', {
  //   isVideo: isVideo
  // });

  // 권한 체크 로그 제거 (성능 향상)

  // 좋아요 조회
  const { isPending, data: likesData } = useQuery({
    queryKey: ["likes", post.id],
    queryFn: () => postService.getLikes(post.id),
  });

  // 사용자 뱃지 조회 (프로필 모달용)
  const { data: userBadges } = useQuery({
    queryKey: ["userBadges", post.userId],
    queryFn: () => badgeService.getUserBadges(post.userId),
    enabled: showProfileModal, // 모달이 열릴 때만 조회
  });

  const queryClient = useQueryClient();

  // 좋아요 토글
  const likeMutation = useMutation({
    mutationFn: async () => {
      try {
        await postService.toggleLike(post.id);
      } catch (error) {
        // 개발 모드에서만 상세 로그 출력
        if (process.env.NODE_ENV === 'development') {
          console.error('좋아요 요청 실패:', error);
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["likes"] });
    },
    onError: (error) => {
      // 개발 모드에서만 에러 로그 출력
      if (process.env.NODE_ENV === 'development') {
        console.error('좋아요 처리 실패:', error);
      }
      
      // 실패시 UI 롤백
      setLocalIsLiked(isLiked);
      setLocalLikeCount(likeCount);
      
      if (error.response?.status === 403) {
        // 토스트 메시지로 재로그인 필요 알림
        const toast = document.createElement('div');
        toast.className = 'toast toast-top toast-center z-50';
        toast.innerHTML = `
          <div class="alert alert-warning">
            <div class="flex-col">
              <span>🔒 인증이 만료되었습니다. 새로고침 후 다시 로그인해주세요.</span>
              <button onclick="window.location.reload()" class="btn btn-sm btn-primary mt-2">새로고침</button>
            </div>
          </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 6000);
        
        // 토큰 제거
        localStorage.removeItem('token');
      } else if (error.response?.status === 400) {
        const toast = document.createElement('div');
        toast.className = 'toast toast-top toast-center z-50';
        const errorMsg = error.response.data;
        toast.innerHTML = `
          <div class="alert alert-warning">
            <span>⚠️ ${errorMsg.includes('already liked') ? '이미 좋아요를 누른 게시글입니다.' : errorMsg}</span>
          </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 3000);
      } else if (error.message?.includes('자신의 게시물')) {
        const toast = document.createElement('div');
        toast.className = 'toast toast-top toast-center z-50';
        toast.innerHTML = `
          <div class="alert alert-warning">
            <span>⚠️ 자신의 게시물에는 좋아요를 누를 수 없습니다.</span>
          </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => document.body.removeChild(toast), 3000);
      } else {
        const toast = document.createElement('div');
        toast.className = 'toast toast-top toast-center z-50';
        toast.innerHTML = `
          <div class="alert alert-error">
            <span>❌ 좋아요 처리 중 오류가 발생했습니다.</span>
          </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => document.body.removeChild(toast), 3000);
      }
    }
  });

  // 게시물 삭제
  const deleteMutation = useMutation({
    mutationFn: (postId) => postService.deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["enhanced-instagram-posts"] });
      setIsDeleteModalOpen(false);
      
      // 성공 메시지를 더 부드럽게 표시
      const successToast = document.createElement('div');
      successToast.className = 'toast toast-top toast-center z-50';
      successToast.innerHTML = `
        <div class="alert alert-success">
          <span>✅ 게시글이 삭제되었습니다.</span>
        </div>
      `;
      document.body.appendChild(successToast);
      setTimeout(() => document.body.removeChild(successToast), 3000);
    },
    onError: (error) => {
      console.error('❌ 게시글 삭제 실패:', error);
      
      let errorMessage = '게시글 삭제에 실패했습니다.';
      let shouldRefresh = false;
      
      if (error.response?.status === 404) {
        errorMessage = '이미 삭제된 게시글이거나 존재하지 않는 게시글입니다.';
        shouldRefresh = true;
        // 404 오류 캐시 무효화 로그 제거
      } else if (error.response?.status === 403) {
        errorMessage = '게시글을 삭제할 권한이 없습니다.';
      } else if (error.response?.status === 401) {
        errorMessage = '로그인이 필요합니다.';
      } else if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      }
      
      // 404 에러인 경우 캐시를 무효화하여 UI를 자동 업데이트
      if (shouldRefresh) {
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        queryClient.invalidateQueries({ queryKey: ["enhanced-instagram-posts"] });
      }
      
      // 사용자 친화적인 토스트 메시지로 표시
      const errorToast = document.createElement('div');
      errorToast.className = 'toast toast-top toast-center z-50';
      errorToast.innerHTML = `
        <div class="alert alert-error">
          <span>❌ ${errorMessage}</span>
        </div>
      `;
      document.body.appendChild(errorToast);
      setTimeout(() => {
        if (document.body.contains(errorToast)) {
          document.body.removeChild(errorToast);
        }
      }, 5000);
    }
  });

  // 거래 상태 업데이트
  const tradeStatusMutation = useMutation({
    mutationFn: ({ postId, status }) =>
      postService.updateTradeStatus(postId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["enhanced-instagram-posts"] });
      
      const successToast = document.createElement('div');
      successToast.className = 'toast toast-top toast-center z-50';
      successToast.innerHTML = `
        <div class="alert alert-success">
          <span>✅ 거래 상태가 업데이트되었습니다.</span>
        </div>
      `;
      document.body.appendChild(successToast);
      setTimeout(() => document.body.removeChild(successToast), 3000);
    },
    onError: (error) => {
      console.error('❌ 거래 상태 업데이트 실패:', error);
      
      const errorToast = document.createElement('div');
      errorToast.className = 'toast toast-top toast-center z-50';
      errorToast.innerHTML = `
        <div class="alert alert-error">
          <span>❌ 거래 상태 업데이트에 실패했습니다.</span>
        </div>
      `;
      document.body.appendChild(errorToast);
      setTimeout(() => document.body.removeChild(errorToast), 5000);
    }
  });

  // 동영상 자동재생 관리 (개선된 버전)
  // Cloudflare Stream은 CloudflareStreamPlayer가 자체 관리하므로 제외
  const playTimeoutRef = useRef(null);  // 재생 debounce용
  const pauseTimeoutRef = useRef(null);  // 정지 debounce용
  const lastVisibleRef = useRef(isVisible);  // 이전 isVisible 상태

  useEffect(() => {
    // Cloudflare Stream은 자체 컴포넌트에서 관리
    if (isCloudflareStream) return;
    // 일반 동영상 또는 R2 동영상만 처리
    if (!videoRef.current || (!isVideo && !isR2Video)) return;

    const video = videoRef.current;
    const wasVisible = lastVisibleRef.current;
    lastVisibleRef.current = isVisible;

    // 이전 타이머들 취소
    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }

    if (isVisible) {
      // 동영상이 재생 가능한 상태인지 확인 후 재생
      const attemptPlay = () => {
        // 이미 재생 중이면 스킵
        if (!video.paused) return;

        // muted 상태 확인 (자동재생 정책)
        video.muted = true;
        video.volume = 0;

        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
            onVideoPlay && onVideoPlay(post.id);
          }).catch(() => {
            setIsPlaying(false);
          });
        }
      };

      // 동영상이 이미 로드되어 있거나, 이전에 로드 완료된 적 있으면 바로 재생
      if (video.readyState >= 2 || hasLoadedRef.current) {
        // 이미 로드됨 - 약간의 지연 후 재생 (빠른 상태 변경 방지)
        // 한번 로드된 후에는 더 긴 debounce 적용
        const delay = hasLoadedRef.current ? 150 : 50;
        playTimeoutRef.current = setTimeout(() => {
          attemptPlay();
        }, delay);
      } else if (!isLoadingRef.current) {
        // 최초 로드 필요 - 로드 시작
        isLoadingRef.current = true;

        const handleCanPlay = () => {
          isLoadingRef.current = false;
          hasLoadedRef.current = true;  // 로드 완료 표시
          attemptPlay();
          video.removeEventListener('canplay', handleCanPlay);
        };
        video.addEventListener('canplay', handleCanPlay);

        // 로드 시작 (최초 1회만)
        video.load();

        return () => {
          video.removeEventListener('canplay', handleCanPlay);
        };
      }
      // isLoadingRef.current === true인 경우: 이미 로드 중이므로 아무것도 안 함
    } else {
      // 화면에서 벗어남 - 정지 전에 debounce 적용 (빠른 상태 변경 무시)
      pauseTimeoutRef.current = setTimeout(() => {
        // 다시 보이는 상태가 되었으면 정지하지 않음
        if (lastVisibleRef.current) return;

        video.pause();
        video.muted = true;
        video.volume = 0;

        setIsPlaying(false);
        onVideoPause && onVideoPause(post.id);

        // replay 타이머 클리어
        if (replayTimeoutRef.current) {
          clearTimeout(replayTimeoutRef.current);
          replayTimeoutRef.current = null;
        }
        setIsWaitingToReplay(false);
      }, 100);  // 100ms 대기 후 정지 (빠른 상태 변경 무시)
    }

    return () => {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
      }
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, [isVisible, isVideo, isR2Video, isCloudflareStream, post.id, onVideoPlay, onVideoPause]);

  // 미디어 모달이 열릴 때 피드 동영상 일시정지
  useEffect(() => {
    if (!videoRef.current || (!isVideo && !isR2Video)) return;

    const video = videoRef.current;

    if (showMediaModal) {
      // 모달 열림: 피드 동영상 일시정지 및 음소거
      video.pause();
      video.muted = true;
      setIsPlaying(false);
    } else {
      // 모달 닫힘: 피드 동영상 재개 (화면에 보이는 경우에만)
      if (isVisible) {
        video.muted = true;  // 자동재생은 음소거 상태로
        video.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  }, [showMediaModal, isVideo, isR2Video, isVisible]);

  // 동영상 진행률 및 버퍼링 상태 업데이트
  useEffect(() => {
    // Cloudflare Stream은 자체 컴포넌트에서 관리
    if (isCloudflareStream) return;
    if (!videoRef.current || (!isVideo && !isR2Video)) return;

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
  }, [isVideo, isR2Video, isCloudflareStream]);

  // 핸들러 함수들
  const handleLike = (animate = false) => {
    if (!currentUser?.id) {
      // 비로그인 사용자는 로그인 필요 모달 표시
      setShowLoginModal(true);
      return;
    }

    // 현재 로컬 상태를 기준으로 토글
    const currentLikedState = localIsLiked;
    const newLikedState = !currentLikedState;
    
    // 좋아요 토글 로그 제거

    // 즉시 UI 업데이트 (Optimistic Update)
    setLocalIsLiked(newLikedState);
    setLocalLikeCount(prev => newLikedState ? prev + 1 : prev - 1);
    
    // 좋아요 애니메이션 트리거
    if (animate || newLikedState) {
      setIsLikeAnimating(true);
      setTimeout(() => setIsLikeAnimating(false), 1000);
    }

    // 서버 요청 (toggleLike가 DB에서 상태 확인 후 처리)
    likeMutation.mutate();
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


  // 고정하기 mutation
  const pinMutation = useMutation({
    mutationFn: () => postService.togglePin(post.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-instagram-posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      
      // 현재 게시물의 고정 상태 업데이트
      queryClient.setQueryData(['post', post.id], (oldData) => ({
        ...oldData,
        is_pinned: data.is_pinned
      }));
      
      // 고정 상태 변경 성공 로그 제거
    },
    onError: (error) => {
      // 개발 모드에서만 에러 로그 출력
      if (process.env.NODE_ENV === 'development') {
        console.error('고정 상태 변경 실패:', error);
      }
      
      // 401/403 에러는 권한 문제이므로 별도 처리
      if (error.response?.status === 401) {
        alert('로그인이 필요합니다.');
        return;
      }
      
      if (error.response?.status === 403) {
        alert('게시물 고정 권한이 없습니다. 관리자만 가능합니다.');
        return;
      }
      
      alert(error.response?.data || '고정 상태 변경에 실패했습니다.');
    }
  });

  const handlePin = () => {
    if (pinMutation.isPending) return;
    pinMutation.mutate();
  };

  const handleReport = () => {
    // console.log('🚨 신고 버튼 클릭됨 (Instagram)'); // 디버깅용 로그 비활성화
    alert('신고 기능은 개발 중입니다.');
  };

  const handleTradeStatusToggle = () => {
    if (!post.tradeInfo || !canManageTrade) return;
    
    const newStatus = post.tradeInfo.status === 'completed' ? 'available' : 'completed';
    tradeStatusMutation.mutate({ 
      postId: post.id, 
      status: newStatus 
    });
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/post/${post.id}`;
    const shareText = `${authorName}님의 게시글: ${postContent.slice(0, 100)}${postContent.length > 100 ? '...' : ''}`;
    
    if (navigator.share) {
      navigator.share({
        title: '게시글 공유',
        text: shareText,
        url: shareUrl
      }).then(() => {
        // 공유 성공 로그 제거
      }).catch((error) => {
        // 공유 실패 로그 제거
        // 공유 실패 시 클립보드 복사로 fallback
        fallbackShare(shareUrl);
      });
    } else {
      fallbackShare(shareUrl);
    }
  };

  const fallbackShare = (url) => {
    navigator.clipboard.writeText(url)
      .then(() => {
        // 성공 토스트 메시지
        const toast = document.createElement('div');
        toast.className = 'toast toast-top toast-center z-50';
        toast.innerHTML = `
          <div class="alert alert-success">
            <span>📋 링크가 클립보드에 복사되었습니다!</span>
          </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => document.body.removeChild(toast), 3000);
      })
      .catch(() => {
        alert('공유에 실패했습니다.');
      });
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

    const newMuted = !videoRef.current.muted;
    videoRef.current.muted = newMuted;
    // iOS에서 볼륨 제어: 음소거 시 volume=0, 해제 시 volume=1
    videoRef.current.volume = newMuted ? 0 : 1;
    setIsMuted(newMuted);
    isMutedRef.current = newMuted;  // ref도 동기화
  };

  const handleVideoError = () => {
    // 동영상 로딩 실패 로그 제거
    setMediaLoadError(true);
    setIsBuffering(false);
  };

  // 동영상 재생 완료 시 1초 후 다시 재생
  const handleVideoEnded = () => {
    // 화면 밖이면 재생하지 않음
    if (!isVisible) {
      setIsPlaying(false);
      setIsWaitingToReplay(false);
      return;
    }

    setIsPlaying(false);
    setIsWaitingToReplay(true);

    // 기존 타이머 클리어
    if (replayTimeoutRef.current) {
      clearTimeout(replayTimeoutRef.current);
    }

    // 1초 후 처음부터 재생
    replayTimeoutRef.current = setTimeout(() => {
      // 타이머 실행 시점에도 isVisible 재확인
      if (videoRef.current && isVisible) {
        videoRef.current.muted = isMutedRef.current;  // ref로 최신 음소거 상태 유지
        videoRef.current.volume = isMutedRef.current ? 0 : 1;  // iOS 볼륨도 동기화
        videoRef.current.currentTime = 0;
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setIsPlaying(false);
        });
      }
      setIsWaitingToReplay(false);
    }, 1000);
  };

  const handleImageError = () => {
    // 이미지 로딩 실패 로그 제거
    setImageLoadError(true);
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

  const isLiked = currentUser ? likesData?.includes(currentUser.id) : false;
  const likeCount = likesData?.length || 0;
  
  // 좋아요 상태에 따른 로컬 상태 관리 (Optimistic UI를 위한)
  const [localIsLiked, setLocalIsLiked] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(0);
  
  // 서버 데이터가 로드되면 로컬 상태 업데이트
  useEffect(() => {
    if (likesData !== undefined) {
      const newIsLiked = isLiked;
      const newLikeCount = likeCount;
      
      // 서버 데이터 동기화 로그 제거
      
      setLocalIsLiked(newIsLiked);
      setLocalLikeCount(newLikeCount);
    }
  }, [isLiked, likeCount, likesData, currentUser?.id, post.id]);

  // 조회수 증가 및 열람 기록 저장 (게시물이 보일 때 한 번만, 세션 내 중복 방지)
  useEffect(() => {
    if (isVisible && !viewCountIncreased) {
      const viewedKey = `post_viewed_${post.id}`;

      // 이미 이 세션에서 조회한 게시물이면 스킵
      if (sessionStorage.getItem(viewedKey) === 'true') {
        setViewCountIncreased(true);
        return;
      }

      const increaseViewCount = async () => {
        try {
          // 조회수 증가 (로그인/비로그인 모두)
          const result = await postService.incrementViewCount(post.id);

          // 피드 알고리즘용 열람 기록 저장 (로그인 사용자만)
          if (currentUser?.id) {
            await postService.recordPostView(post.id);
          }

          // sessionStorage에 저장하여 컴포넌트 재마운트 시에도 중복 방지
          sessionStorage.setItem(viewedKey, 'true');
          setViewCountIncreased(true);
        } catch (error) {
          console.error('조회수 증가 실패:', error);
        }
      };

      // 게시물이 1초 이상 보이면 조회수 증가
      const timer = setTimeout(increaseViewCount, 1000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, viewCountIncreased, post.id, currentUser?.id]);

  // 설명 텍스트 길이 제한
  const MAX_DESC_LENGTH = 100;
  const postContent = post.Desc || post.desc || '';
  const shouldShowMore = postContent && postContent.length > MAX_DESC_LENGTH;
  const displayDescription = shouldShowMore && !showFullDescription 
    ? postContent.slice(0, MAX_DESC_LENGTH) + '...'
    : postContent;

  if (isPending) {
    return (
      <div className="w-full max-w-md mx-auto bg-white border-b border-gray-200 animate-pulse">
        <div className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-300 rounded w-24"></div>
              <div className="h-3 bg-gray-300 rounded w-16 mt-1"></div>
            </div>
          </div>
        </div>
        <div className="w-full h-80 bg-gray-300"></div>
        <div className="p-4">
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          <div className="h-3 bg-gray-300 rounded w-1/2 mt-2"></div>
        </div>
      </div>
    );
  }

  // 배경색 계산
  const getPostBackgroundColor = () => {
    return {
      backgroundColor: 'white',
      boxShadow: '-3px 0 15px rgba(255, 165, 0, 0.25), 0 3px 15px rgba(0, 0, 0, 0.1)'
    };
  };

  return (
    <>
    <article 
      ref={postRef}
      className="w-full max-w-md mx-auto rounded-xl shadow-lg mb-6 overflow-hidden relative"
      style={getPostBackgroundColor()}
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

      {/* 숨김 처리 알림 배너 (본인 게시물에만) */}
      {post.is_hidden && currentUser?.id === post.userId && (
        <div className="bg-red-500 text-white text-center py-2 px-4">
          <span className="text-sm font-medium">⚠️ 이 게시물은 신고로 인해 숨김 처리되었습니다. 본인만 볼 수 있습니다.</span>
        </div>
      )}

      {/* 헤더 */}
      <header className="flex items-center justify-between py-1.5 px-3 border-b border-gray-100">
        <div className="flex items-center space-x-2 flex-1">
          {/* 프로필 사진 - 클릭 시 모달 열기 (탈퇴 사용자는 클릭 불가) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (canClickProfile) {
                setShowProfileModal(true);
              }
            }}
            className={`relative flex-shrink-0 ${!canClickProfile ? 'cursor-default' : ''}`}
            disabled={!canClickProfile}
          >
            <div className={`w-10 h-10 rounded-full overflow-hidden ring-2 ring-orange-400 ring-offset-1 ${canClickProfile ? 'hover:ring-pink-500' : ''} transition-all duration-200 ${avatarClassName}`}>
              <img
                src={authorProfilePic}
                alt={`${authorName} 프로필`}
                className="w-full h-full object-cover object-center"
                loading="lazy"
                onError={(e) => {
                  e.target.src = "/default/default_profile.png";
                }}
              />
            </div>
          </button>

          {/* 사용자 정보 - 클릭 불가 */}
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm truncate leading-tight ${!canClickProfile ? 'text-gray-500' : 'text-gray-900'}`}>
              {authorName}
            </p>
            <div className="flex items-center space-x-1 text-[10px] text-gray-500">
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
              <div className="text-[10px] text-gray-400 font-mono">
                {post.title}
              </div>
            )}
          </div>
        </div>

        {/* 고정 표시 - is_pinned가 1이거나 true일 때만 표시 */}
        {(post.is_pinned === 1 || post.is_pinned === true) && (
          <div className="mr-2 pin-indicator flex items-center" style={{ content: 'none' }}>
            <PushPinIcon className="w-4 h-4 text-blue-500" />
          </div>
        )}
        
        {/* 비밀글 표시 */}
        {post.isPrivate && (
          <div className="mr-2">
            <LockIcon className="w-4 h-4 text-gray-500" />
          </div>
        )}

        {/* 조회수 표시 - 0보다 클 때만 표시 */}
        {post.views_count && post.views_count > 0 && (
          <div className="mr-2 flex items-center text-gray-500 view-count" style={{ content: 'none' }}>
            <span className="text-sm font-medium">
              {post.views_count}
            </span>
          </div>
        )}

        {/* 더보기 메뉴 - 로그인 시에만 표시, 차단 사용자는 본인 글/관리자만 */}
        {currentUser && (!isBanned || post.userId === currentUser.id || featurePermissions.canPinPosts) && (
        <div className="dropdown dropdown-end">
          <button
            tabIndex={0}
            className="btn btn-ghost btn-circle btn-sm hover:bg-gray-100"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <FontAwesomeIcon icon={faEllipsisH} className="w-4 h-4 text-gray-600" />
          </button>
          <ul className="dropdown-content z-50 menu p-2 shadow-lg bg-white rounded-xl w-48 text-sm border border-gray-200">
            {/* 수정 - 작성자만 */}
            {post.userId === currentUser.id && (
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
            )}
            
            {/* 숨김 - 작성자와 관리자 */}
            {(post.userId === currentUser.id || featurePermissions.canPinPosts) && (
              <li>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    alert('숨김 기능은 개발 중입니다.');
                  }}
                  className="flex items-center w-full text-left p-3 hover:bg-gray-50 rounded-lg"
                >
                  👁️‍🗨️ 숨김
                </button>
              </li>
            )}
            
            {/* 삭제 - 작성자 또는 관리자 */}
            {canDelete && (
              <li>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete();
                  }}
                  disabled={deleteMutation.isPending}
                  className={`flex items-center w-full text-left p-3 rounded-lg ${
                    deleteMutation.isPending
                      ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                      : 'text-red-500 hover:bg-red-50 active:bg-red-100'
                  }`}
                >
                  {deleteMutation.isPending ? (
                    <>
                      <span className="loading loading-spinner loading-xs mr-2"></span>
                      삭제 중...
                    </>
                  ) : (
                    '🗑️ 삭제하기'
                  )}
                </button>
              </li>
            )}
            
            {/* 신고 - 본인 게시글이 아니고, 차단되지 않은 경우에만 */}
            {post.userId !== currentUser.id && !isBanned && (
              <li>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowReportModal(true);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowReportModal(true);
                  }}
                  className="flex items-center w-full text-left p-3 hover:bg-red-50 rounded-lg text-red-500 active:bg-red-100"
                >
                  🚨 신고하기
                </button>
              </li>
            )}
            
            {/* 고정 - 관리자만 */}
            {featurePermissions.canPinPosts && (
              <li>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePin();
                  }}
                  disabled={pinMutation.isPending}
                  className={`flex items-center w-full text-left p-3 rounded-lg ${
                    pinMutation.isPending 
                      ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {pinMutation.isPending ? (
                    <>
                      <span className="loading loading-spinner loading-xs mr-2"></span>
                      처리 중...
                    </>
                  ) : (
                    post.is_pinned ? '📌 고정 해제' : '📌 고정'
                  )}
                </button>
              </li>
            )}
          </ul>
        </div>
        )}
      </header>

      {/* 링크 프리뷰 섹션 */}
      {post.link_url && (
        <div className="w-full mb-4">
          {post.link_type === 'youtube' ? (
            <YouTubeEmbed
              url={post.link_url}
              className="rounded-lg"
              autoplay={false}  // 썸네일 표시, 클릭 시 자동 재생
              showThumbnail={true}
              onPlay={() => {}}
            />
          ) : (
            <LinkPreview
              url={post.link_url}
              className="mx-4"
            />
          )}
        </div>
      )}

      {/* 미디어 컨텐츠 - 링크가 없을 때만 표시 */}
      {!post.link_url && hasMedia && (
        <div
          className="relative w-full bg-gray-100 select-none"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
          onDoubleClick={handleMediaDoubleTap}
        >
          {/* 4:5 비율 컨테이너 (인스타그램 피드 스타일) */}
          <div className="relative w-full aspect-[4/5] overflow-hidden">
            {/* 숨김 처리된 게시물 오버레이 (본인에게만 표시) */}
            {post.is_hidden && currentUser?.id === post.userId && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                <div className="bg-red-500/80 text-white px-6 py-3 rounded-lg transform -rotate-12 shadow-lg border-4 border-red-600">
                  <div className="text-2xl font-bold tracking-wider">숨김 처리됨</div>
                  <div className="text-xs text-center mt-1 opacity-90">커뮤니티 가이드라인 위반</div>
                </div>
              </div>
            )}
            {mediaFiles.length === 1 ? (
              // 단일 미디어
              isCloudflareStream ? (
                // Cloudflare Stream 동영상
                <CloudflareStreamPlayer
                  url={mediaFiles[0]}
                  autoplay={isVisible}
                  muted={true}
                  loop={true}
                  controls={false}
                  showMuteToggle={true}
                  aspectRatio="4-5"
                  className="w-full h-full"
                  onClick={() => {
                    setMediaModalIndex(0);
                    setShowMediaModal(true);
                  }}
                />
              ) : (isVideo || isR2Video) ? (
                mediaLoadError ? (
                  <div className="w-full h-full bg-gray-200 flex flex-col items-center justify-center text-gray-500">
                    <div className="text-4xl mb-2">🎥</div>
                    <div className="text-sm">동영상을 로드할 수 없습니다</div>
                    <div className="text-xs mt-1 opacity-75">파일이 존재하지 않거나 손상되었습니다</div>
                  </div>
                ) : (
                  <>
                    {/* 피드 동영상: 자동재생, 무음, 재생 완료 후 1초 대기 후 재시작, 클릭시 모달 */}
                    <video
                      ref={videoRef}
                      src={normalizedMediaFiles[0]}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => {
                        // 현재 재생 위치 저장 후 모달 열기
                        const currentTime = videoRef.current?.currentTime || 0;
                        setMediaModalTime(currentTime);
                        setMediaModalIndex(0);
                        setShowMediaModal(true);
                      }}
                      autoPlay
                      muted
                      playsInline
                      preload="auto"
                      onError={handleVideoError}
                      onEnded={handleVideoEnded}
                    />

                    {/* 동영상 아이콘 표시 */}
                    <div className="absolute top-3 left-3 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                      <FontAwesomeIcon icon={faPlay} className="w-3 h-3" />
                      <span>동영상</span>
                    </div>

                    {/* 음소거 토글 버튼 */}
                    <button
                      onClick={handleMuteToggle}
                      className="absolute bottom-3 right-3 bg-black bg-opacity-60 text-white p-2 rounded-full hover:bg-opacity-80 transition-all"
                    >
                      <FontAwesomeIcon
                        icon={isMuted ? faVolumeMute : faVolumeUp}
                        className="w-4 h-4"
                      />
                    </button>
                  </>
                )
              ) : (
                imageLoadError ? (
                  <div className="w-full h-full bg-gray-200 flex flex-col items-center justify-center text-gray-500">
                    <div className="text-4xl mb-2">🖼️</div>
                    <div className="text-sm">이미지를 로드할 수 없습니다</div>
                    <div className="text-xs mt-1 opacity-75">파일이 존재하지 않거나 손상되었습니다</div>
                  </div>
                ) : (
                  <img
                    src={normalizedMediaFiles[0]}
                    alt="게시물 이미지"
                    className="w-full h-full object-cover cursor-pointer"
                    loading="lazy"
                    onClick={() => {
                      setMediaModalIndex(0);
                      setShowMediaModal(true);
                    }}
                    onError={handleImageError}
                  />
                )
              )
            ) : (
              // 다중 미디어 - ImageSlider 컴포넌트 사용
              <ImageSlider
                images={normalizedMediaFiles}
                baseUrl=""
                aspectRatio="4-5"
                onMediaClick={(index, currentTime = 0) => {
                  setMediaModalTime(currentTime);
                  setMediaModalIndex(index);
                  setShowMediaModal(true);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* 미디어 전체화면 모달 */}
      <MediaModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        mediaFiles={normalizedMediaFiles}
        initialIndex={mediaModalIndex}
        initialTime={mediaModalTime}
      />

      {/* 액션 버튼들 */}
      <div className="px-3 pt-1 pb-1">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                // 좋아요 버튼 클릭 로그 제거
                handleLike(false);
              }}
              className={`flex items-center justify-center transition-all duration-200 cursor-pointer p-1.5 rounded-full focus:outline-none focus:ring-0 ${localIsLiked ? 'scale-105' : 'hover:scale-105'}`}
            >
              <FontAwesomeIcon
                icon={faHeart}
                className={`w-5 h-5 transition-colors duration-200 ${localIsLiked ? 'text-red-500' : 'text-gray-700 hover:text-red-500'}`}
              />
              {localLikeCount > 0 && (
                <span className={`ml-0.5 text-xs font-medium ${localIsLiked ? 'text-red-500' : 'text-gray-700'}`}>{localLikeCount}</span>
              )}
            </button>

            <button
              onClick={() => {
                // 댓글 버튼 클릭 로그 제거
                setShowComments(!showComments);
                if (!showComments) setShowCommentForm(false);
              }}
              className={`flex items-center justify-center transition-all duration-200 hover:scale-105 cursor-pointer p-1.5 rounded-full focus:outline-none focus:ring-0 ${
                showComments ? 'text-blue-500' : (post.commentsCount || 0) > 0 ? 'text-blue-600' : 'text-gray-700 hover:text-blue-500'
              }`}
            >
              <FontAwesomeIcon icon={faComment} className="w-5 h-5" />
              {(post.commentsCount || 0) > 0 && (
                <span className="ml-0.5 text-xs font-medium">{post.commentsCount || 0}</span>
              )}
            </button>

            <button
              onClick={() => {
                // 공유 버튼 클릭 로그 제거
                handleShare();
              }}
              className="text-gray-700 hover:text-green-500 transition-all duration-200 hover:scale-105 cursor-pointer p-1.5 rounded-full focus:outline-none focus:ring-0"
            >
              <FontAwesomeIcon icon={faShare} className="w-5 h-5" />
            </button>

            {/* 신고 아이콘 (신고가 있을 때만 표시) */}
            {(post.report_count > 0) && (
              <button
                onClick={() => setShowReportDetailsModal(true)}
                className="flex items-center text-red-500 hover:text-red-700 transition-all duration-200 hover:scale-105 cursor-pointer p-1.5 rounded-full focus:outline-none focus:ring-0"
                title={`신고 ${post.report_count}건`}
              >
                <FontAwesomeIcon icon={faFlag} className="w-4 h-4" />
                <span className="text-xs ml-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {post.report_count}
                </span>
              </button>
            )}
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={() => {
              // 비로그인 시 로그인 필요 모달 표시
              if (!currentUser) {
                setShowLoginModal(true);
                return;
              }
              setIsSaved(!isSaved);
              // 저장 토스트 메시지
              const toast = document.createElement('div');
              toast.className = 'toast toast-top toast-center z-50';
              toast.innerHTML = `
                <div class="alert ${!isSaved ? 'alert-success' : 'alert-info'}">
                  <span>${!isSaved ? '🔖 게시글이 저장되었습니다!' : '📌 게시글 저장이 취소되었습니다.'}</span>
                </div>
              `;
              document.body.appendChild(toast);
              setTimeout(() => document.body.removeChild(toast), 2000);
            }}
            className={`transition-all duration-200 hover:scale-105 cursor-pointer p-1.5 rounded-full focus:outline-none focus:ring-0 ${isSaved ? 'text-blue-500' : 'text-gray-700 hover:text-blue-500'}`}
          >
            <FontAwesomeIcon icon={faBookmark} className="w-5 h-5" />
          </button>
        </div>

        {/* QnA 게시글 제목 */}
        {post.post_type === 'question' && post.title && (
          <div className="text-sm text-gray-900 mb-1">
            <span className={`font-semibold mr-2 ${!canClickProfile ? 'text-gray-500' : ''}`}>{authorName}</span>
            <span className="font-bold text-gray-800 block mb-0.5">[Q&A] {post.title}</span>
          </div>
        )}

        {/* 게시물 내용 */}
        {(post.Desc || post.desc) && (
          <div className="text-sm text-gray-900 mb-1">
            {post.post_type !== 'question' && (
              <span className={`font-semibold mr-2 ${!canClickProfile ? 'text-gray-500' : ''}`}>{authorName}</span>
            )}
            <span className="whitespace-pre-wrap break-words">{displayDescription}</span>
            {shouldShowMore && (
              <button
                onClick={() => setShowFullDescription(!showFullDescription)}
                className="text-gray-500 ml-2 hover:text-gray-700"
              >
                {showFullDescription ? '간략히' : '더보기'}
              </button>
            )}
          </div>
        )}


        {/* 중고거래 정보 */}
        {post.tradeInfo && (
          <div className="mb-3 p-3 bg-orange-50 rounded-xl border border-orange-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* 제목 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    post.tradeInfo.status === 'completed' || post.tradeInfo.status === 'sold'
                      ? 'bg-gray-200 text-gray-600'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {post.tradeInfo.status === 'completed' || post.tradeInfo.status === 'sold' ? '판매완료' : '판매중'}
                  </span>
                  <h4 className="font-semibold text-gray-900">{post.tradeInfo.item_name}</h4>
                </div>

                {/* 본문 */}
                {(post.content || post.Desc || post.desc) && (
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {post.content || post.Desc || post.desc}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 첫 댓글 미리보기 */}
        {post.firstComment && post.firstComment.content && !showComments && (
          <div className="mt-1 text-sm">
            <div className="flex items-start">
              <span className="font-semibold mr-1">{post.firstComment.userName || '사용자'}</span>
              <span className="text-gray-700 flex-1 break-words">{post.firstComment.content}</span>
            </div>
            {(post.commentsCount || 0) > 1 && (
              <button
                onClick={() => {
                  setShowComments(true);
                  setShowCommentForm(false);
                }}
                className="text-gray-500 hover:text-gray-700 text-xs mt-0.5"
              >
                댓글 {(post.commentsCount || 0) - 1}개 더 보기
              </button>
            )}
          </div>
        )}

      </div>

      {/* 댓글 섹션 */}
      {showComments && (
        <div className="border-t border-gray-100">
          <CommentsPreview
            postId={post.id}
            showCommentForm={showCommentForm}
            onToggleCommentForm={() => setShowCommentForm(!showCommentForm)}
          />
        </div>
      )}
      
      {/* 댓글 작성 버튼 (댓글이 보이지 않을 때) */}
      {!showComments && (
        <div className="px-3 py-1.5 border-t border-gray-100">
          <button
            onClick={() => {
              if (!currentUser) {
                setShowLoginModal(true);
                return;
              }
              setShowComments(true);
              setShowCommentForm(true);
            }}
            className="text-gray-500 text-xs hover:text-gray-700 transition-colors"
          >
            💬 댓글 작성하기
          </button>
        </div>
      )}
    </article>

    {/* 삭제 확인 모달 */}
    <DeleteConfirmModal
      isOpen={isDeleteModalOpen}
      onClose={handleCloseDeleteModal}
      onConfirm={handleConfirmDelete}
      loading={deleteMutation.isPending}
    />

    {/* 프로필 모달 - 탈퇴 사용자는 표시하지 않음 */}
    {canClickProfile && (
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={{
          userId: post.userId,
          user_id: post.userId,
          id: post.userId,
          name: authorName,
          username: postUser.username,
          profilePic: authorProfilePic,
          profile_pic: authorProfilePic
        }}
      />
    )}

    {/* 신고 모달 */}
    <ReportModal
      open={showReportModal}
      onClose={() => setShowReportModal(false)}
      postId={post.id}
      postAuthor={authorName}
    />

    {/* 신고 내역 모달 */}
    <ReportDetailsModal
      postId={post.id}
      isOpen={showReportDetailsModal}
      onClose={() => setShowReportDetailsModal(false)}
    />

    {/* 로그인 필요 모달 */}
    {showLoginModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowLoginModal(false)}>
        <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <div className="text-4xl mb-4">🔐</div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">로그인이 필요합니다</h3>
            <p className="text-gray-600 text-sm mb-6">
              이 기능을 사용하려면 로그인이 필요합니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLoginModal(false)}
                className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => navigate('/login')}
                className="flex-1 py-2.5 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                로그인
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default EnhancedInstagramPost;