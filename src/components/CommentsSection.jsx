/* eslint-disable react/prop-types */
import React, { useState, useContext, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentService, reportService } from '../services';
import { AuthContext } from '../context/AuthContext';
import moment from 'moment';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faReply, faEllipsisV, faTrash, faEdit, faFlag, faHeart as faHeartSolid, faMicrophone, faStop } from '@fortawesome/free-solid-svg-icons';
import { faHeart as faHeartRegular } from '@fortawesome/free-regular-svg-icons';
import ReportModal from './ReportModal';

const CommentsSection = ({ postId, postTag, post }) => {
  const { currentUser, isBanned } = useContext(AuthContext);
  const queryClient = useQueryClient();
  
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
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 음성 인식 상태
  const [isListening, setIsListening] = useState(false);
  const [isReplyListening, setIsReplyListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);
  const replyRecognitionRef = useRef(null);

  // 댓글용 음성 인식 초기화
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

  // 게시물 작성자 ID (비공개 댓글 권한 체크용)
  const postOwnerId = post?.userId || post?.user_id;

  // 댓글 조회
  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['comments', postId, showAllComments, postOwnerId],
    queryFn: () => {
      const limit = showAllComments ? 100 : 5;
      return commentService.getComments(postId, {
        limit,
        offset: 0,
        postOwnerId // 비공개 댓글 권한 체크를 위해 게시물 작성자 ID 전달
      });
    },
    enabled: !!postId
  });

  // 댓글 추가
  const addCommentMutation = useMutation({
    mutationFn: (commentData) => commentService.createComment({
      postId: commentData.postId,
      content: commentData.desc,
      parentId: commentData.parentId,
      isSecret: commentData.isSecret
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      setNewComment('');
      setReplyTo(null);
      setReplyText('');
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
    mutationFn: ({ commentId, desc }) => commentService.updateComment(commentId, desc),
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

  // 댓글 좋아요 토글
  const likeCommentMutation = useMutation({
    mutationFn: (commentId) => commentService.toggleCommentLike(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    },
    onError: (error) => {
      console.error('댓글 좋아요 실패:', error);
      if (error.message?.includes('인증')) {
        alert('로그인이 필요합니다.');
      }
    }
  });

  // 댓글 좋아요 핸들러
  const handleLikeComment = (commentId) => {
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }
    likeCommentMutation.mutate(commentId);
  };

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    addCommentMutation.mutate({
      desc: newComment,
      postId: postId,
      isSecret: isSecretComment
    });
    setIsSecretComment(false); // 리셋
  };

  const handleSubmitReply = (e, parentId) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    addCommentMutation.mutate({
      desc: replyText,
      postId: postId,
      parentId: parentId,
      isSecret: isSecretReply
    });
    setIsSecretReply(false); // 리셋
  };

  const handleEditComment = (comment) => {
    setEditingComment(comment.id);
    setEditText(comment.content);
  };

  const handleUpdateComment = (e, commentId) => {
    e.preventDefault();
    if (!editText.trim()) return;

    updateCommentMutation.mutate({
      commentId: commentId,
      desc: editText
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
      <div className="border-t border-gray-100 animate-fadeIn bg-gray-50">
        <div className="p-4 text-center">
          <div className="loading loading-spinner loading-sm"></div>
          <span className="ml-2 text-gray-500">댓글을 불러오는 중...</span>
        </div>
      </div>
    );
  }

  const comments = commentsData || [];
  const total = comments.length;
  const hasMore = showAllComments ? false : (total >= 5);

  return (
    <div className="border-t border-gray-100 animate-fadeIn bg-gray-50">
      {/* 댓글 작성 폼 - 로그인 시에만 표시, 차단 사용자는 제외 */}
      {currentUser && !isBanned ? (
        <form onSubmit={handleSubmitComment} className="p-4 border-b border-gray-200">
          <div className="flex items-start space-x-3">
            <img
              src={currentUser?.avatar || '/default-avatar.png'}
              alt={currentUser?.name}
              className="w-8 h-8 rounded-full object-cover"
            />
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="댓글을 입력하세요..."
                className="w-full p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                rows="2"
              />
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {/* 음성 입력 버튼 - 아이콘만 */}
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                      isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={isListening ? '음성 입력 중지' : '음성 입력'}
                  >
                    <FontAwesomeIcon icon={isListening ? faStop : faMicrophone} className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* 중고거래 게시물에서만 비밀 댓글 옵션 표시 */}
                {isSecondHand && (
                  <label className="flex items-center space-x-1.5 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={isSecretComment}
                      onChange={(e) => setIsSecretComment(e.target.checked)}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                    />
                    <span>🔒 비밀</span>
                  </label>
                )}
                {/* 댓글 작성 버튼 - 오른쪽 정렬 */}
                <button
                  type="submit"
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  className="ml-auto px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {addCommentMutation.isPending ? (
                    <span className="loading loading-spinner loading-xs mr-1"></span>
                  ) : null}
                  작성
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : isBanned ? (
        <div className="p-4 border-b border-gray-200 text-center bg-red-50">
          <p className="text-red-600 text-sm">계정이 정지되어 댓글을 작성할 수 없습니다.</p>
        </div>
      ) : (
        <div className="p-4 border-b border-gray-200 text-center">
          <p className="text-gray-500 text-sm mb-2">댓글을 작성하려면 로그인이 필요합니다.</p>
          <a href="/login" className="text-orange-500 hover:text-orange-600 text-sm font-medium">
            로그인하기 →
          </a>
        </div>
      )}

      {/* 댓글 목록 */}
      <div className="divide-y divide-gray-200">
        {comments.map((comment) => (
          <div key={comment.id} className="p-4">
            {/* 부모 댓글 */}
            <div className="flex items-start space-x-3">
              <img
                src={comment.profilePic || '/default-avatar.png'}
                alt={comment.name}
                className="w-8 h-8 rounded-full object-cover"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-semibold text-sm text-gray-800">
                    {comment.name || comment.username}
                  </span>
                  {comment.is_secret && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      🔒 비밀
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {moment(comment.created_at).fromNow()}
                  </span>
                  <div className="dropdown dropdown-end">
                    <div tabIndex={0} role="button" className="text-gray-400 hover:text-gray-600 cursor-pointer">
                      <FontAwesomeIcon icon={faEllipsisV} className="w-3 h-3" />
                    </div>
                    <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-white rounded-box w-36">
                      {comment.userId === currentUser?.id && (
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
                      )}
                      {comment.userId !== currentUser?.id && !isBanned && (
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
                </div>
                
                {editingComment === comment.id ? (
                  <form onSubmit={(e) => handleUpdateComment(e, comment.id)} className="mt-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
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
                        className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                      >
                        취소
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {comment.isMasked ? (
                        <span className="text-gray-500 italic">{comment.desc}</span>
                      ) : (
                        comment.desc || comment.description || comment.content
                      )}
                    </p>
                    <div className="flex items-center space-x-4 mt-2">
                      {/* 좋아요 버튼 */}
                      <button
                        onClick={() => handleLikeComment(comment.id)}
                        disabled={likeCommentMutation.isPending}
                        className={`text-xs flex items-center space-x-1 transition-colors ${
                          comment.user_liked
                            ? 'text-red-500 hover:text-red-600'
                            : 'text-gray-500 hover:text-red-500'
                        }`}
                      >
                        <FontAwesomeIcon
                          icon={comment.user_liked ? faHeartSolid : faHeartRegular}
                          className="w-3.5 h-3.5"
                        />
                        {(comment.likes_count || 0) > 0 && (
                          <span>{comment.likes_count}</span>
                        )}
                      </button>
                      {/* 답글 버튼 - 차단 사용자에게는 숨김 */}
                      {!isBanned && (
                        <button
                          onClick={() => {
                            if (!currentUser) {
                              setShowLoginModal(true);
                              return;
                            }
                            setReplyTo(replyTo === comment.id ? null : comment.id);
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                        >
                          <FontAwesomeIcon icon={faReply} className="w-3 h-3" />
                          <span>답글</span>
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* 답글 작성 폼 */}
                {replyTo === comment.id && (
                  <form onSubmit={(e) => handleSubmitReply(e, comment.id)} className="mt-3">
                    <div className="flex items-start space-x-3">
                      <img
                        src={currentUser?.avatar || '/default-avatar.png'}
                        alt={currentUser?.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="답글을 입력하세요..."
                          className="w-full p-2 border border-gray-200 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                          rows="2"
                        />
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mt-2">
                          <div className="flex items-center gap-2">
                            {/* 대댓글 음성 입력 버튼 */}
                            {speechSupported && (
                              <button
                                type="button"
                                onClick={toggleReplySpeechRecognition}
                                className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                                  isReplyListening
                                    ? 'bg-red-500 text-white animate-pulse'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                                title={isReplyListening ? '음성 입력 중지' : '음성 입력'}
                              >
                                <FontAwesomeIcon icon={isReplyListening ? faStop : faMicrophone} className="w-3 h-3" />
                              </button>
                            )}
                            {/* 중고거래 게시물에서만 비밀 댓글 옵션 표시 */}
                            {isSecondHand && (
                              <label className="flex items-center space-x-2 text-xs text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={isSecretReply}
                                  onChange={(e) => setIsSecretReply(e.target.checked)}
                                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                                />
                                <span>🔒 비밀 답글</span>
                              </label>
                            )}
                          </div>
                          <div className="flex space-x-2">
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
                                setIsSecretReply(false);
                                if (isReplyListening) {
                                  replyRecognitionRef.current?.stop();
                                  setIsReplyListening(false);
                                }
                              }}
                              className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* 답글 목록 */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="ml-11 mt-3 space-y-3">
                {comment.replies.map((reply) => (
                  <div key={reply.id} className="flex items-start space-x-3">
                    <img
                      src={reply.profilePic || '/default-avatar.png'}
                      alt={reply.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-semibold text-xs text-gray-800">
                          {reply.name || reply.username}
                        </span>
                        {reply.is_secret && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            🔒 비밀
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {moment(reply.created_at).fromNow()}
                        </span>
                        <div className="dropdown dropdown-end">
                          <div tabIndex={0} role="button" className="text-gray-400 hover:text-gray-600 cursor-pointer">
                            <FontAwesomeIcon icon={faEllipsisV} className="w-3 h-3" />
                          </div>
                          <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-white rounded-box w-32">
                            {reply.userId === currentUser?.id && (
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
                            )}
                            {reply.userId !== currentUser?.id && !isBanned && (
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
                      </div>
                      
                      {editingComment === reply.id ? (
                        <form onSubmit={(e) => handleUpdateComment(e, reply.id)} className="mt-1">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full p-2 border border-gray-200 rounded text-xs resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                            rows="2"
                          />
                          <div className="flex space-x-2 mt-2">
                            <button
                              type="submit"
                              disabled={!editText.trim()}
                              className="px-2 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 disabled:opacity-50"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingComment(null);
                                setEditText('');
                              }}
                              className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                            >
                              취소
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap">
                            {reply.isMasked ? (
                              <span className="text-gray-500 italic">{reply.desc}</span>
                            ) : (
                              reply.desc || reply.description || reply.content
                            )}
                          </p>
                          {/* 답글 좋아요 버튼 */}
                          <button
                            onClick={() => handleLikeComment(reply.id)}
                            disabled={likeCommentMutation.isPending}
                            className={`text-xs flex items-center space-x-1 mt-1 transition-colors ${
                              reply.user_liked
                                ? 'text-red-500 hover:text-red-600'
                                : 'text-gray-500 hover:text-red-500'
                            }`}
                          >
                            <FontAwesomeIcon
                              icon={reply.user_liked ? faHeartSolid : faHeartRegular}
                              className="w-3 h-3"
                            />
                            {(reply.likes_count || 0) > 0 && (
                              <span>{reply.likes_count}</span>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 더 보기 버튼 */}
      {!showAllComments && hasMore && (
        <div className="p-4 text-center border-t border-gray-200">
          <button
            onClick={() => setShowAllComments(true)}
            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            댓글 더보기 ({total - comments.length}개 더 있음)
          </button>
        </div>
      )}

      {comments.length === 0 && (
        <div className="p-4 text-center text-gray-500 text-sm">
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

      {/* 로그인 필요 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowLoginModal(false)}>
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-4xl mb-4">🔐</div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">로그인이 필요합니다</h3>
              <p className="text-gray-600 text-sm mb-6">
                댓글을 작성하려면 로그인이 필요합니다.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <a
                  href="/login"
                  className="flex-1 py-2.5 px-4 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors text-center"
                >
                  로그인
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentsSection;