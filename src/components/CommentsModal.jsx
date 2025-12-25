/* eslint-disable react/prop-types */
import React, { useState, useContext, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentService, reportService } from '../services';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import moment from 'moment';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faReply, faEllipsisV, faTrash, faEdit, faFlag, faMicrophone, faStop, faTimes, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import ReportModal from './ReportModal';
import ProfileModal from './ProfileModal';
import LoadingSpinner from './LoadingSpinner';
import { getDisplayName, getProfilePic, isProfileClickable, getAvatarClassName } from '../utils/userHelper';

const CommentsModal = ({ isOpen, onClose, postId, postTag }) => {
  const { currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();

  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState('');
  const [reportingComment, setReportingComment] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isSecretComment, setIsSecretComment] = useState(false);
  const [isSecretReply, setIsSecretReply] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState({});

  // 음성 인식 상태
  const [isListening, setIsListening] = useState(false);
  const [isReplyListening, setIsReplyListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);
  const replyRecognitionRef = useRef(null);
  const commentsContainerRef = useRef(null);
  const scrollYRef = useRef(0);
  const wasOpenRef = useRef(false);

  // 모달이 열리면 배경 스크롤 막기 (터치 포함)
  useEffect(() => {
    if (isOpen) {
      // 현재 스크롤 위치 저장
      scrollYRef.current = window.scrollY;
      wasOpenRef.current = true;
      // 스크롤 막기
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollYRef.current}px`;
    } else if (wasOpenRef.current) {
      // 모달이 열렸다가 닫힐 때만 스크롤 복원
      wasOpenRef.current = false;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      // 저장된 위치로 복원
      window.scrollTo(0, scrollYRef.current);
    }
    return () => {
      if (wasOpenRef.current) {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
        window.scrollTo(0, scrollYRef.current);
        wasOpenRef.current = false;
      }
    };
  }, [isOpen]);

  // 음성 인식 초기화
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);

      // 댓글용 음성 인식
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
          setNewComment(prev => prev + (prev ? ' ' : '') + finalTranscript);
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

      // 대댓글용 음성 인식
      const replyRecognition = new SpeechRecognition();
      replyRecognition.lang = 'ko-KR';
      replyRecognition.continuous = true;
      replyRecognition.interimResults = true;

      replyRecognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }
        if (finalTranscript) {
          setReplyText(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      replyRecognition.onerror = (event) => {
        console.error('대댓글 음성 인식 오류:', event.error);
        setIsReplyListening(false);
      };

      replyRecognition.onend = () => {
        setIsReplyListening(false);
      };

      replyRecognitionRef.current = replyRecognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (replyRecognitionRef.current) {
        replyRecognitionRef.current.stop();
      }
    };
  }, []);

  // 댓글 음성 인식 토글
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

  // 대댓글 음성 인식 토글
  const toggleReplySpeechRecognition = () => {
    if (!replyRecognitionRef.current) return;

    if (isReplyListening) {
      replyRecognitionRef.current.stop();
      setIsReplyListening(false);
    } else {
      replyRecognitionRef.current.start();
      setIsReplyListening(true);
    }
  };

  // 중고거래 게시물인지 확인
  const isSecondHand = postTag === 'secondhand' || postTag === '중고거래';

  // 전체 댓글 조회
  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['comments-modal', postId],
    queryFn: () => commentService.getComments(postId, { limit: 100, offset: 0 }),
    enabled: !!postId && isOpen
  });

  // 댓글 추가
  const addCommentMutation = useMutation({
    mutationFn: (commentData) => commentService.createComment(commentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments-modal', postId] });
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-instagram-posts'] });
      setNewComment('');
      setReplyTo(null);
      setReplyText('');
      setIsSecretComment(false);
      setIsSecretReply(false);
      // 스크롤을 맨 아래로
      setTimeout(() => {
        if (commentsContainerRef.current) {
          commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
        }
      }, 100);
    },
    onError: (error) => {
      console.error('댓글 추가 실패:', error);
      alert('댓글 추가에 실패했습니다.');
    }
  });

  // 댓글 삭제
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => commentService.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments-modal', postId] });
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    },
    onError: (error) => {
      console.error('댓글 삭제 실패:', error);
      alert('댓글 삭제에 실패했습니다.');
    }
  });

  // 댓글 수정
  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, content }) => commentService.updateComment(commentId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments-modal', postId] });
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      setEditingComment(null);
      setEditText('');
    },
    onError: (error) => {
      console.error('댓글 수정 실패:', error);
      alert('댓글 수정에 실패했습니다.');
    }
  });

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    addCommentMutation.mutate({
      content: newComment,
      postId: postId,
      isSecret: isSecretComment
    });
    setIsSecretComment(false);
  };

  const handleSubmitReply = (e, parentId) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    addCommentMutation.mutate({
      content: replyText,
      postId: postId,
      parentId: parentId,
      isSecret: isSecretReply
    });
    setIsSecretReply(false);
  };

  const handleEditComment = (comment) => {
    setEditingComment(comment.id);
    setEditText(comment.desc);
  };

  const handleUpdateComment = (e, commentId) => {
    e.preventDefault();
    if (!editText.trim()) return;

    updateCommentMutation.mutate({
      commentId: commentId,
      content: editText
    });
  };

  const handleDeleteComment = (commentId) => {
    if (window.confirm('댓글을 삭제하시겠습니까?')) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  const handleReportComment = (comment) => {
    setReportingComment(comment);
    setShowReportModal(true);
  };

  const handleReportSubmit = async (categoryId, customReason) => {
    try {
      await reportService.createReport({
        commentId: reportingComment.id,
        categoryId,
        reason: customReason
      });
      alert('신고가 접수되었습니다.');
      setShowReportModal(false);
      setReportingComment(null);
    } catch (error) {
      console.error('댓글 신고 실패:', error);
      if (error.message?.includes('이미')) {
        alert('이미 신고한 댓글입니다.');
      } else {
        alert('신고 접수에 실패했습니다.');
      }
    }
  };

  const toggleRepliesExpanded = (commentId) => {
    setExpandedReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  if (!isOpen) return null;

  const comments = Array.isArray(commentsData) ? commentsData : [];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* 모달 컨테이너 - 화면 하단에 고정 */}
      <div className="relative mt-auto bg-white/95 backdrop-blur-md w-full sm:w-[480px] sm:max-w-lg sm:mx-auto sm:mb-4 sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/50 bg-white/90 backdrop-blur-sm rounded-t-2xl">
          <h3 className="text-lg font-bold text-gray-800">댓글</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* 댓글 목록 (스크롤 영역) */}
        <div
          ref={commentsContainerRef}
          className="flex-1 overflow-y-auto px-4 py-3"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <span className="text-4xl mb-2">💬</span>
              <p className="text-sm">첫 번째 댓글을 작성해보세요!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="space-y-2">
                  {/* 부모 댓글 */}
                  <div className="flex items-start space-x-3">
                    <img
                      src={getProfilePic(comment)}
                      alt={getDisplayName(comment)}
                      onClick={() => {
                        if (isProfileClickable(comment)) {
                          setSelectedUser(comment);
                          setShowProfileModal(true);
                        }
                      }}
                      className={`w-8 h-8 rounded-full object-cover flex-shrink-0 transition-opacity ${isProfileClickable(comment) ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} ${getAvatarClassName(comment)}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <span
                            onClick={() => {
                              if (isProfileClickable(comment)) {
                                setSelectedUser(comment);
                                setShowProfileModal(true);
                              }
                            }}
                            className={`font-semibold text-sm ${isProfileClickable(comment) ? 'text-gray-800 cursor-pointer hover:underline' : 'text-gray-500 cursor-default'}`}
                          >
                            {getDisplayName(comment)}
                          </span>
                          {comment.is_secret && (
                            <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              🔒 비밀글
                            </span>
                          )}
                          <p className="text-sm text-gray-700 mt-0.5 break-words">
                            {comment.canView === false ? (
                              <span className="text-gray-500 italic">🔒 비밀 댓글입니다.</span>
                            ) : (
                              comment.desc
                            )}
                          </p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-gray-500">
                              {moment(comment.created_at).fromNow()}
                            </span>
                            {currentUser && (
                              <button
                                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                                className="text-xs text-gray-500 hover:text-orange-500 flex items-center space-x-1"
                              >
                                <FontAwesomeIcon icon={faReply} className="w-3 h-3" />
                                <span>답글</span>
                              </button>
                            )}
                          </div>
                        </div>
                        {currentUser && (
                          <div className="dropdown dropdown-end">
                            <div tabIndex={0} role="button" className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                              <FontAwesomeIcon icon={faEllipsisV} className="w-3 h-3" />
                            </div>
                            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-white rounded-box w-32">
                              {comment.userId === currentUser?.id ? (
                                <>
                                  <li>
                                    <button
                                      onClick={() => handleEditComment(comment)}
                                      className="text-xs"
                                    >
                                      <FontAwesomeIcon icon={faEdit} className="w-3 h-3" />
                                      수정
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      onClick={() => handleDeleteComment(comment.id)}
                                      className="text-xs text-red-600 hover:text-red-700"
                                    >
                                      <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                                      삭제
                                    </button>
                                  </li>
                                </>
                              ) : (
                                <li>
                                  <button
                                    onClick={() => handleReportComment(comment)}
                                    className="text-xs text-orange-600 hover:text-orange-700"
                                  >
                                    <FontAwesomeIcon icon={faFlag} className="w-3 h-3" />
                                    신고
                                  </button>
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* 수정 폼 */}
                      {editingComment === comment.id && (
                        <form onSubmit={(e) => handleUpdateComment(e, comment.id)} className="mt-2">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                            rows="2"
                          />
                          <div className="flex space-x-2 mt-2">
                            <button
                              type="submit"
                              disabled={!editText.trim()}
                              className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs hover:bg-orange-600 disabled:opacity-50"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingComment(null);
                                setEditText('');
                              }}
                              className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-300"
                            >
                              취소
                            </button>
                          </div>
                        </form>
                      )}

                      {/* 답글 작성 폼 */}
                      {replyTo === comment.id && (
                        <form onSubmit={(e) => handleSubmitReply(e, comment.id)} className="mt-3 bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-start space-x-2">
                            <img
                              src={(() => {
                                const pic = currentUser?.profilePic || currentUser?.profile_pic;
                                if (!pic) return '/default/default_profile.png';
                                if (pic.startsWith('http')) return pic;
                                return `/uploads/profiles/${pic}`;
                              })()}
                              alt={currentUser?.name}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                            <div className="flex-1">
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="답글을 입력하세요..."
                                className="w-full p-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                                rows="2"
                              />
                              <div className="flex items-center gap-2 mt-2">
                                {speechSupported && (
                                  <button
                                    type="button"
                                    onClick={toggleReplySpeechRecognition}
                                    className={`w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full transition-all ${
                                      isReplyListening
                                        ? 'bg-red-500 text-white animate-pulse'
                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                    }`}
                                    title={isReplyListening ? '음성 입력 중지' : '음성 입력'}
                                  >
                                    <FontAwesomeIcon icon={isReplyListening ? faStop : faMicrophone} className="w-3 h-3" />
                                  </button>
                                )}
                                {/* 비밀 답글 옵션 */}
                                {isSecondHand && (
                                  <label className="flex items-center space-x-1 text-xs text-gray-600">
                                    <input
                                      type="checkbox"
                                      checked={isSecretReply}
                                      onChange={(e) => setIsSecretReply(e.target.checked)}
                                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-400 w-3 h-3"
                                    />
                                    <span>🔒</span>
                                  </label>
                                )}
                                <div className="flex-1" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyTo(null);
                                    setReplyText('');
                                    if (isReplyListening) {
                                      replyRecognitionRef.current?.stop();
                                      setIsReplyListening(false);
                                    }
                                  }}
                                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-300"
                                >
                                  취소
                                </button>
                                <button
                                  type="submit"
                                  disabled={!replyText.trim()}
                                  className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs hover:bg-orange-600 disabled:opacity-50"
                                >
                                  답글
                                </button>
                              </div>
                            </div>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* 답글 목록 */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-11 space-y-3">
                      {(expandedReplies[comment.id] ? comment.replies : comment.replies.slice(0, 2)).map((reply) => (
                        <div key={reply.id} className="flex items-start space-x-2">
                          <img
                            src={getProfilePic(reply)}
                            alt={getDisplayName(reply)}
                            onClick={() => {
                              if (isProfileClickable(reply)) {
                                setSelectedUser(reply);
                                setShowProfileModal(true);
                              }
                            }}
                            className={`w-6 h-6 rounded-full object-cover flex-shrink-0 transition-opacity ${isProfileClickable(reply) ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} ${getAvatarClassName(reply)}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <span
                                  onClick={() => {
                                    if (isProfileClickable(reply)) {
                                      setSelectedUser(reply);
                                      setShowProfileModal(true);
                                    }
                                  }}
                                  className={`font-semibold text-xs ${isProfileClickable(reply) ? 'text-gray-800 cursor-pointer hover:underline' : 'text-gray-500 cursor-default'}`}
                                >
                                  {getDisplayName(reply)}
                                </span>
                                {reply.is_secret && (
                                  <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1 py-0.5 rounded">
                                    🔒
                                  </span>
                                )}
                                <p className="text-xs text-gray-700 mt-0.5 break-words">
                                  {reply.canView === false ? (
                                    <span className="text-gray-500 italic">🔒 비밀 댓글입니다.</span>
                                  ) : (
                                    reply.desc
                                  )}
                                </p>
                                <span className="text-xs text-gray-500">
                                  {moment(reply.created_at).fromNow()}
                                </span>
                              </div>
                              {currentUser && (
                                <div className="dropdown dropdown-end">
                                  <div tabIndex={0} role="button" className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                                    <FontAwesomeIcon icon={faEllipsisV} className="w-3 h-3" />
                                  </div>
                                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-white rounded-box w-32">
                                    {reply.userId === currentUser?.id ? (
                                      <>
                                        <li>
                                          <button
                                            onClick={() => handleEditComment(reply)}
                                            className="text-xs"
                                          >
                                            <FontAwesomeIcon icon={faEdit} className="w-3 h-3" />
                                            수정
                                          </button>
                                        </li>
                                        <li>
                                          <button
                                            onClick={() => handleDeleteComment(reply.id)}
                                            className="text-xs text-red-600 hover:text-red-700"
                                          >
                                            <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                                            삭제
                                          </button>
                                        </li>
                                      </>
                                    ) : (
                                      <li>
                                        <button
                                          onClick={() => handleReportComment(reply)}
                                          className="text-xs text-orange-600 hover:text-orange-700"
                                        >
                                          <FontAwesomeIcon icon={faFlag} className="w-3 h-3" />
                                          신고
                                        </button>
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              )}
                            </div>

                            {/* 답글 수정 폼 */}
                            {editingComment === reply.id && (
                              <form onSubmit={(e) => handleUpdateComment(e, reply.id)} className="mt-2">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="w-full p-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                                  rows="2"
                                />
                                <div className="flex space-x-2 mt-2">
                                  <button
                                    type="submit"
                                    disabled={!editText.trim()}
                                    className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs hover:bg-orange-600 disabled:opacity-50"
                                  >
                                    수정
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingComment(null);
                                      setEditText('');
                                    }}
                                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-300"
                                  >
                                    취소
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        </div>
                      ))}
                      {comment.replies.length > 2 && (
                        <button
                          onClick={() => toggleRepliesExpanded(comment.id)}
                          className="text-xs text-gray-500 hover:text-orange-500 flex items-center space-x-1"
                        >
                          <FontAwesomeIcon
                            icon={expandedReplies[comment.id] ? faChevronUp : faChevronDown}
                            className="w-3 h-3"
                          />
                          <span>
                            {expandedReplies[comment.id]
                              ? '답글 접기'
                              : `답글 ${comment.replies.length - 2}개 더 보기`}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 댓글 입력 폼 (하단 고정) */}
        <div className="border-t border-gray-200/50 bg-white/80 backdrop-blur-sm px-4 py-3 rounded-b-2xl">
          {currentUser ? (
            <form onSubmit={handleSubmitComment}>
              <div className="flex items-center gap-2">
                {/* 음성 입력 버튼 */}
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full transition-all ${
                      isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={isListening ? '음성 입력 중지' : '음성 입력'}
                  >
                    <FontAwesomeIcon icon={isListening ? faStop : faMicrophone} className="w-4 h-4" />
                  </button>
                )}
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="댓글을 입력하세요..."
                  className="flex-1 min-w-0 px-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-orange-500 text-white rounded-full hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {addCommentMutation.isPending ? (
                    <LoadingSpinner size={16} />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
              {/* 중고거래 게시물에서만 비밀 댓글 옵션 표시 */}
              {isSecondHand && (
                <div className="mt-2 ml-11">
                  <label className="flex items-center space-x-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={isSecretComment}
                      onChange={(e) => setIsSecretComment(e.target.checked)}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                    />
                    <span>🔒 비밀 댓글</span>
                    <span className="text-gray-400">(판매자와 본인만 볼 수 있음)</span>
                  </label>
                </div>
              )}
            </form>
          ) : (
            <div className="text-center text-gray-500 text-sm py-2">
              <span>댓글을 작성하려면 </span>
              <Link to="/login" className="text-orange-500 hover:text-orange-600 font-medium">
                로그인
              </Link>
              <span>이 필요합니다</span>
            </div>
          )}
        </div>
      </div>

      {/* 신고 모달 */}
      {showReportModal && reportingComment && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setReportingComment(null);
          }}
          onSubmit={handleReportSubmit}
          targetType="comment"
          targetId={reportingComment.id}
        />
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

export default CommentsModal;
