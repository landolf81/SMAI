/* eslint-disable react/prop-types */
import React, { useState, useContext, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentService, reportService } from '../services';
import { AuthContext } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import moment from 'moment';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faReply, faEllipsisV, faTrash, faEdit, faFlag, faMicrophone, faStop } from '@fortawesome/free-solid-svg-icons';
import ReportModal from './ReportModal';
import ProfileModal from './ProfileModal';
import LoadingSpinner from './LoadingSpinner';
import { getDisplayName, getProfilePic, isProfileClickable, getAvatarClassName } from '../utils/userHelper';
import AIBadge from './AIBadge';
import { isAIUser } from '../config/aiUser';

const CommentsPreview = ({ postId, postTag, showCommentForm = false, onToggleCommentForm, previewMode = false, onShowAllComments, onOpenCommentsModal, filterByUserId = null }) => {
  const { currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [showAllComments, setShowAllComments] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState('');
  const [reportingComment, setReportingComment] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isSecretComment, setIsSecretComment] = useState(false);
  const [isSecretReply, setIsSecretReply] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // 음성 인식 상태
  const [isListening, setIsListening] = useState(false);
  const [isReplyListening, setIsReplyListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);
  const replyRecognitionRef = useRef(null);

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

  // 댓글 조회 (previewMode: 2개, 일반: 3개 또는 전체)
  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['comments', postId, showAllComments, previewMode],
    queryFn: () => {
      // previewMode일 때는 최신 2개만
      if (previewMode) {
        return commentService.getComments(postId, { limit: 2, offset: 0 });
      }
      // 일반 모드: 전체 보기 시 100개, 아니면 3개
      const limit = showAllComments ? 100 : 3;
      return commentService.getComments(postId, { limit, offset: 0 });
    },
    enabled: !!postId
  });

  // 댓글 추가
  const addCommentMutation = useMutation({
    mutationFn: (commentData) => commentService.createComment(commentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-instagram-posts'] });
      setNewComment('');
      setReplyTo(null);
      setReplyText('');
      setIsSecretComment(false);
      setIsSecretReply(false);
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
    setIsSecretComment(false); // 리셋
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
    setIsSecretReply(false); // 리셋
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

  if (isLoading) {
    return (
      <div className="px-4 py-2">
        <div className="flex items-center space-x-2">
          <LoadingSpinner size="sm" />
          <span className="text-base-content/50 text-sm">댓글을 불러오는 중...</span>
        </div>
      </div>
    );
  }

  // commentService.getComments()는 배열을 직접 반환
  let comments = Array.isArray(commentsData) ? commentsData : [];

  // filterByUserId가 있으면 해당 사용자의 댓글만 필터링
  if (filterByUserId) {
    comments = comments.filter(comment => comment.userId === filterByUserId);
  }

  const displayedCount = comments.length;
  // previewMode: 2개 표시, 더 있으면 "댓글 더 보기" 표시
  // 일반 모드: 3개 미리보기 상태에서 정확히 3개가 로드되었다면 더 있을 가능성이 있음
  const hasMore = previewMode
    ? displayedCount === 2  // previewMode에서 2개가 로드되면 더 있을 가능성
    : (!showAllComments && displayedCount === 3);

  // previewMode이고 댓글이 없으면 아무것도 렌더링하지 않음
  if (previewMode && comments.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-base-200 bg-base-200">
      {/* 댓글 목록 미리보기 */}
      {comments.length > 0 && (
        <div className="px-4 py-2 space-y-2">
          {comments.map((comment) => (
            <div key={comment.id}>
              {/* 부모 댓글 */}
              <div className="flex items-start space-x-2">
                <img
                  src={getProfilePic(comment)}
                  alt={getDisplayName(comment)}
                  onClick={() => {
                    if (isProfileClickable(comment) || isAIUser(comment)) {
                      setSelectedUser(comment);
                      setShowProfileModal(true);
                    }
                  }}
                  className={`w-6 h-6 rounded-full object-cover flex-shrink-0 transition-opacity ${(isProfileClickable(comment) || isAIUser(comment)) ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} ${getAvatarClassName(comment)}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start">
                    {isAIUser(comment) && <AIBadge />}
                    {comment.is_secret && (
                      <span className="mr-1 text-xs bg-base-200 text-base-content/60 px-1 py-0.5 rounded">
                        🔒 비밀글
                      </span>
                    )}
                    <span className="text-sm text-base-content/70 flex-1 break-words">
                      {comment.canView === false ? (
                        <span className="text-base-content/50 italic">🔒 비밀 댓글입니다.</span>
                      ) : (
                        comment.desc
                      )}
                    </span>
                    {currentUser && !previewMode && (
                      <div className="dropdown dropdown-end ml-2">
                        <div tabIndex={0} role="button" className="text-base-content/40 hover:text-base-content/60 cursor-pointer">
                          <FontAwesomeIcon icon={faEllipsisV} className="w-3 h-3" />
                        </div>
                        <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-32">
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
                  <div className="flex items-baseline gap-3">
                    {currentUser && !previewMode && (
                      <button
                        onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                        className="text-xs text-base-content/50 hover:text-orange-500 inline-flex items-center gap-0.5"
                      >
                        <FontAwesomeIcon icon={faReply} className="w-2.5 h-2.5" />
                        <span className="leading-none">답글</span>
                      </button>
                    )}
                    <span className="text-xs text-base-content/50 leading-none ml-auto">
                      {moment(comment.created_at).fromNow()}
                    </span>
                  </div>

                  {/* 수정 폼 */}
                  {editingComment === comment.id && (
                    <form onSubmit={(e) => handleUpdateComment(e, comment.id)} className="mt-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full p-2 border border-base-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                        rows="2"
                      />
                      <div className="flex space-x-2 mt-2">
                        <button
                          type="submit"
                          disabled={!editText.trim()}
                          className="px-3 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 disabled:opacity-50"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingComment(null);
                            setEditText('');
                          }}
                          className="px-3 py-1 bg-base-300 text-base-content/70 rounded text-xs hover:bg-base-content/30"
                        >
                          취소
                        </button>
                      </div>
                    </form>
                  )}

                  {/* 답글 작성 폼 */}
                  {replyTo === comment.id && (
                    <form onSubmit={(e) => handleSubmitReply(e, comment.id)} className="mt-3">
                      <div className="flex items-start space-x-3">
                        <img
                          src={(() => {
                            const pic = currentUser?.profilePic || currentUser?.profile_pic;
                            if (!pic) return '/default/default_profile.png';
                            if (pic.startsWith('http')) return pic;
                            return `/uploads/profiles/${pic}`;
                          })()}
                          alt={currentUser?.name}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                        <div className="flex-1">
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="답글을 입력하세요..."
                            className="w-full p-2 border border-base-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                            rows="2"
                          />
                          <div className="flex items-center gap-2 mt-2">
                            {/* 대댓글 음성 입력 버튼 */}
                            {speechSupported && (
                              <button
                                type="button"
                                onClick={toggleReplySpeechRecognition}
                                className={`w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full transition-all ${
                                  isReplyListening
                                    ? 'bg-red-500 text-white animate-pulse'
                                    : 'bg-base-200 text-base-content/60 hover:bg-base-300'
                                }`}
                                title={isReplyListening ? '음성 입력 중지' : '음성 입력'}
                              >
                                <FontAwesomeIcon icon={isReplyListening ? faStop : faMicrophone} className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="submit"
                              disabled={!replyText.trim()}
                              className="px-3 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 disabled:opacity-50"
                            >
                              답글 작성
                            </button>
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
                              className="px-3 py-1 bg-base-300 text-base-content/70 rounded text-xs hover:bg-base-content/30"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* 답글 목록 (간단히 표시) */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-8 mt-1 space-y-2">
                  {comment.replies.slice(0, 2).map((reply) => (
                    <div key={reply.id} className="flex items-start space-x-2">
                      <img
                        src={getProfilePic(reply)}
                        alt={getDisplayName(reply)}
                        onClick={() => {
                          if (isProfileClickable(reply) || isAIUser(reply)) {
                            setSelectedUser(reply);
                            setShowProfileModal(true);
                          }
                        }}
                        className={`w-6 h-6 rounded-full object-cover flex-shrink-0 transition-opacity ${(isProfileClickable(reply) || isAIUser(reply)) ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} ${getAvatarClassName(reply)}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start">
                          {isAIUser(reply) && <AIBadge />}
                          {reply.is_secret && (
                            <span className="mr-1 text-xs bg-base-200 text-base-content/60 px-1 py-0.5 rounded">
                              🔒 비밀글
                            </span>
                          )}
                          <span className="text-sm text-base-content/70 flex-1 break-words">
                            {reply.canView === false ? (
                              <span className="text-base-content/50 italic">🔒 비밀 댓글입니다.</span>
                            ) : (
                              reply.desc
                            )}
                          </span>
                        </div>
                        <span className="text-xs text-base-content/50 leading-none block text-right">
                          {moment(reply.created_at).fromNow()}
                        </span>
                      </div>
                    </div>
                  ))}
                  {comment.replies.length > 2 && (
                    <button className="text-xs text-base-content/50 ml-7">
                      답글 {comment.replies.length - 2}개 더 보기
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* 더 보기 버튼 */}
          {hasMore && (
            <button
              onClick={() => {
                if (onOpenCommentsModal) {
                  // 모달로 전체 댓글 보기
                  onOpenCommentsModal();
                } else if (previewMode && onShowAllComments) {
                  // previewMode에서는 부모 컴포넌트에 알려서 전체 댓글 보기 모드로 전환
                  onShowAllComments();
                } else {
                  setShowAllComments(true);
                }
              }}
              className="text-sm text-base-content/50 hover:text-base-content/70 mt-2 font-medium"
            >
              댓글 더 보기
            </button>
          )}
        </div>
      )}

      {/* 댓글 작성 토글 버튼 - 로그인한 사용자에게만, previewMode가 아닐 때만 표시 */}
      {!previewMode && currentUser && !showCommentForm && onToggleCommentForm && (
        <div className="px-4 py-2 border-t border-base-300">
          <button
            onClick={onToggleCommentForm}
            className="text-base-content/50 text-sm hover:text-base-content/70 transition-colors flex items-center space-x-2"
          >
            <span>✏️</span>
            <span>댓글 작성하기</span>
          </button>
        </div>
      )}

      {/* 비로그인 사용자를 위한 로그인 유도 메시지 */}
      {!currentUser && (
        <div className="px-4 py-2 border-t border-base-300">
          <div className="text-center text-base-content/50 text-sm">
            <span>댓글을 작성하려면 </span>
            <Link to="/login" className="text-orange-600 hover:text-orange-700 font-medium">
              로그인
            </Link>
            <span>이 필요합니다</span>
          </div>
        </div>
      )}

      {/* 댓글 작성 폼 - 로그인한 사용자에게만 표시 */}
      {currentUser && showCommentForm && (
        <form onSubmit={handleSubmitComment} className="px-4 py-3 border-t border-base-300 bg-base-100">
          <div className="flex items-center gap-2">
            {/* 음성 입력 버튼 */}
            {speechSupported && (
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full transition-all ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-base-200 text-base-content/60 hover:bg-base-300'
                }`}
                title={isListening ? '음성 입력 중지' : '음성 입력'}
              >
                <FontAwesomeIcon icon={isListening ? faStop : faMicrophone} className="w-3.5 h-3.5" />
              </button>
            )}
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="댓글을 입력하세요..."
              className="flex-1 min-w-0 px-3 py-2 border border-base-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || addCommentMutation.isPending}
              className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 whitespace-nowrap"
            >
              {addCommentMutation.isPending ? (
                <LoadingSpinner size={16} />
              ) : (
                '게시'
              )}
            </button>
          </div>
          {/* 중고거래 게시물에서만 비밀 댓글 옵션 표시 */}
          {isSecondHand && (
            <div className="mt-2">
              <label className="flex items-center space-x-2 text-xs text-base-content/60">
                <input
                  type="checkbox"
                  checked={isSecretComment}
                  onChange={(e) => setIsSecretComment(e.target.checked)}
                  className="rounded border-base-300 text-orange-500 focus:ring-orange-400"
                />
                <span>🔒 비밀 댓글</span>
                <span className="text-xs text-base-content/50">(판매자와 본인만 볼 수 있음)</span>
              </label>
            </div>
          )}
        </form>
      )}

      {/* 댓글이 없을 때 메시지 - previewMode에서는 표시하지 않음 */}
      {comments.length === 0 && !previewMode && (
        <div className="px-4 py-6 text-center text-base-content/50 text-sm">
          첫 번째 댓글을 작성해보세요!
        </div>
      )}

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

export default CommentsPreview;