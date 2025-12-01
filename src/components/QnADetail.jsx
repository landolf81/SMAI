import React, { useState, useContext, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qnaService, storageService, postService, adService, commentService } from '../services';
import { AuthContext } from '../context/AuthContext';
import moment from 'moment';
import 'moment/locale/ko';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsisH } from "@fortawesome/free-solid-svg-icons";
import { v4 as uuidv4 } from 'uuid';
import MobileAdDisplay from './MobileAdDisplay';
import ProfileModal from './ProfileModal';
import { isMobileDevice } from '../utils/deviceDetector';
import { getAcceptedFileTypes } from '../utils/mediaUtils';

// 아이콘
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';

moment.locale('ko');

const QnADetail = ({ questionId: propQuestionId, onClose, isModal = false }) => {
  const { questionId: paramQuestionId } = useParams();
  const questionId = propQuestionId || paramQuestionId; // Use prop if provided, otherwise URL param
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const [isMobile] = useState(() => isMobileDevice());

  const [answerContent, setAnswerContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 프로필 모달 상태
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // 수정 관련 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editImages, setEditImages] = useState([]);
  const [newImages, setNewImages] = useState([]);

  // 질문과 답변 조회
  const { data, isLoading, error } = useQuery({
    queryKey: ['qna-question', questionId],
    queryFn: () => qnaService.getQuestion(questionId),
    enabled: !!questionId,
    staleTime: 30 * 1000, // 30초 동안 캐시 유지 (재방문 시 빠른 로딩)
    cacheTime: 5 * 60 * 1000 // 5분 동안 캐시 보관
  });

  // 광고 조회 (모바일에서만)
  const { data: adsData } = useQuery({
    queryKey: ['active-ads'],
    queryFn: adService.getActiveAds,
    enabled: isMobile,
    staleTime: 5 * 60 * 1000 // 5분
  });

  // 페이지 로드 시 최상단으로 스크롤 (모달이 아닐 때만)
  useEffect(() => {
    if (!isModal) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [questionId, isModal]);

  // 조회수 증가 및 열람 기록 (페이지 로드 시 1회만, 병렬 처리)
  useEffect(() => {
    if (questionId && currentUser) {
      // 조회수 증가 + 열람 기록을 병렬로 처리
      Promise.all([
        postService.incrementViewCount(questionId),
        postService.recordPostView(questionId)
      ]).catch(error => console.error('조회수/열람 기록 실패:', error));
    }
  }, [questionId, currentUser]);

  // 답변 작성 뮤테이션
  const createAnswerMutation = useMutation({
    mutationFn: (content) => qnaService.addAnswer(questionId, content),
    onSuccess: () => {
      queryClient.invalidateQueries(['qna-question', questionId]);
      setAnswerContent('');
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error('답변 작성 실패:', error);
      alert('답변 작성에 실패했습니다: ' + error.message);
      setIsSubmitting(false);
    }
  });

  // 답변 좋아요 뮤테이션 (comment_likes 테이블 사용)
  const toggleLikeMutation = useMutation({
    mutationFn: (answerId) => commentService.toggleCommentLike(answerId),
    onSuccess: () => {
      queryClient.invalidateQueries(['qna-question', questionId]);
    },
    onError: (error) => {
      console.error('좋아요 실패:', error);
      if (error.message?.includes('인증')) {
        alert('로그인이 필요합니다.');
      }
    }
  });

  // 질문 수정 뮤테이션 - Supabase 사용
  const updateQuestionMutation = useMutation({
    mutationFn: async ({ title, content, existingImages, newImageFiles }) => {
      console.log('=== 질문 수정 시작 ===');
      console.log('제목:', title);
      console.log('내용:', content);
      console.log('기존 이미지:', existingImages);
      console.log('새 이미지 파일:', newImageFiles);

      // 1. 새 이미지 파일 업로드
      let newImageUrls = [];
      if (newImageFiles && newImageFiles.length > 0) {
        console.log('새 이미지 업로드 시작...');
        const uploadResults = await storageService.uploadQnAImages(questionId, newImageFiles);
        newImageUrls = uploadResults.map(result => result.url);
        console.log('업로드 완료:', newImageUrls);
      }

      // 2. 최종 이미지 배열 생성 (기존 + 새 이미지)
      const allImages = [...existingImages, ...newImageUrls];

      // 3. QnA 형식으로 desc 구성
      const fullDesc = `[Q&A] ${title}\n\n${content}`;

      // 4. 질문 업데이트 데이터
      const updateData = {
        desc: fullDesc,
        images: allImages,
        img: allImages.length > 0 ? allImages[0] : null
      };

      console.log('질문 업데이트 데이터:', updateData);

      // 5. qnaService를 통해 질문 수정
      return await qnaService.updateQuestion(questionId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['qna-question', questionId]);
      queryClient.invalidateQueries(['qna-questions']);
      setIsEditModalOpen(false);
      setEditTitle('');
      setEditContent('');
      setEditImages([]);
      setNewImages([]);
      console.log('✅ 질문 수정 완료');
    },
    onError: (error) => {
      console.error('❌ 질문 수정 실패:', error);
      alert('질문 수정에 실패했습니다: ' + error.message);
    }
  });

  // 답변 작성 핸들러
  const handleSubmitAnswer = (e) => {
    e.preventDefault();

    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!answerContent.trim()) {
      alert('답변 내용을 입력해주세요.');
      return;
    }

    // 키보드 내리기 (모바일)
    if (e.target.querySelector('textarea')) {
      e.target.querySelector('textarea').blur();
    }

    setIsSubmitting(true);
    createAnswerMutation.mutate(answerContent.trim());
  };

  // 답변 좋아요 핸들러
  const handleToggleLike = (answerId) => {
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }
    toggleLikeMutation.mutate(answerId);
  };

  // 질문 수정 모달 열기
  const handleOpenEditModal = (question) => {
    // description 또는 desc 필드 사용
    const descriptionText = question.description || question.desc || '';

    // 제목 추출 - [Q&A] 제거하고 첫 줄만
    const lines = descriptionText.split('\n');
    const titleText = lines[0].replace('[Q&A]', '').trim();
    const contentText = lines.slice(1).join('\n').trim();

    setEditTitle(question.title || titleText || '');
    setEditContent(contentText || descriptionText);
    setEditImages(question.images || []);
    setNewImages([]);
    setIsEditModalOpen(true);
  };

  // 질문 수정 제출 (Supabase)
  const handleSubmitEdit = (e) => {
    e.preventDefault();

    if (!editTitle.trim() || !editContent.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    // 객체 형태로 데이터 전달
    updateQuestionMutation.mutate({
      title: editTitle.trim(),
      content: editContent.trim(),
      existingImages: editImages,
      newImageFiles: newImages
    });
  };

  // 이미지 파일 선택 핸들러
  const handleImageChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(file => {
      const isValid = file.type.startsWith('image/') || file.type.startsWith('video/');
      const maxSize = 50 * 1024 * 1024; // 50MB
      return isValid && file.size <= maxSize;
    });
    
    setNewImages(prevFiles => [...prevFiles, ...validFiles]);
  };

  // 기존 이미지 제거
  const handleRemoveExistingImage = (index) => {
    setEditImages(editImages.filter((_, i) => i !== index));
  };

  // 새 이미지 제거
  const handleRemoveNewImage = (index) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  // 프로필 모달 열기
  const handleOpenProfileModal = (user) => {
    setSelectedUser(user);
    setProfileModalOpen(true);
  };

  // 질문 삭제
  const handleDeleteQuestion = async () => {
    if (window.confirm('정말로 이 질문을 삭제하시겠습니까?\n삭제된 질문은 복구할 수 없습니다.')) {
      try {
        await qnaService.deleteQuestion(questionId);
        alert('질문이 삭제되었습니다.');
        navigate('/qna');
      } catch (error) {
        alert('삭제 실패: ' + error.message);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading loading-spinner loading-lg"></div>
        <span className="ml-3">질문을 불러오는 중...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">질문을 불러오는데 실패했습니다.</p>
        <p className="text-gray-500 text-sm mt-2">{error?.message}</p>
        <button
          onClick={() => isModal ? onClose() : navigate('/qna')}
          className="mt-4 px-4 py-2 text-market-600 border border-market-600 rounded-lg hover:bg-market-50 transition-colors"
        >
          {isModal ? '닫기' : '목록으로 돌아가기'}
        </button>
      </div>
    );
  }

  const { question, answers, stats } = data;

  // question이 없으면 에러 표시
  if (!question) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">질문 데이터를 찾을 수 없습니다.</p>
        <button
          onClick={() => isModal ? onClose() : navigate('/qna')}
          className="mt-4 px-4 py-2 text-market-600 border border-market-600 rounded-lg hover:bg-market-50 transition-colors"
        >
          {isModal ? '닫기' : '목록으로 돌아가기'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* 헤더 */}
      <div className="mb-6">
        {isModal ? (
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
          >
            <CloseIcon fontSize="small" />
            닫기
          </button>
        ) : (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowBackIcon fontSize="small" />
            질문 목록으로
          </button>
        )}
      </div>

      {/* 질문 카드 */}
      <div className="bg-white rounded-lg p-6 border shadow-sm mb-6">
        {/* 작성자 정보 헤더 */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => handleOpenProfileModal({
              id: question.user_id,
              user_id: question.user_id,
              userId: question.user_id,
              name: question.user_name || question.username,
              username: question.username,
              profilePic: question.profilePic,
              profile_pic: question.profilePic
            })}
          >
            {question.profilePic ? (
              <img
                src={question.profilePic.startsWith('http') ? question.profilePic : `/uploads/profiles/${question.profilePic}`}
                alt="프로필"
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <PersonIcon className="w-10 h-10 text-gray-400 bg-gray-200 rounded-full p-1" />
            )}
            <div>
              <div className="font-medium text-gray-900">
                {question.user_name || question.username}
              </div>
              <div className="text-sm text-gray-500">
                {moment(question.created_at).fromNow()}
              </div>
            </div>
          </div>
          
          {/* 더보기 메뉴 (수정/삭제) */}
          {currentUser && currentUser.id === question.user_id && (
            <div className="relative group">
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                <FontAwesomeIcon icon={faEllipsisH} />
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border hidden group-hover:block z-10">
                <button 
                  onClick={() => handleOpenEditModal(question)}
                  className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <EditIcon fontSize="small" />
                  수정
                </button>
                <button 
                  onClick={() => handleDeleteQuestion()}
                  className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <DeleteIcon fontSize="small" />
                  삭제
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 질문 제목 */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">
            {question.title || (question.description || question.desc || '').split('\n')[0].replace('[Q&A]', '').trim() || 'Q&A 질문'}
          </h1>
          {question.question_status === 'answered' && (
            <span className="inline-flex items-center gap-1 mt-2 text-sm text-green-600">
              <CheckCircleIcon fontSize="small" />
              해결됨
            </span>
          )}
        </div>

        {/* 질문 내용 */}
        <div className="prose max-w-none mb-6">
          <p className="text-gray-700 whitespace-pre-wrap">
            {(question.description || question.desc || '').split('\n').slice(question.title ? 0 : 1).join('\n').trim()}
          </p>
        </div>

        {/* 질문 이미지 */}
        {(question.photo || question.img) && (
          <div className="mb-6">
            <img
              src={question.photo || question.img}
              alt="질문 이미지"
              className="max-w-full h-auto rounded-lg border hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => window.open(question.photo || question.img, '_blank')}
              onError={(e) => {
                console.error('이미지 로드 실패:', question.photo || question.img);
                e.target.parentElement.innerHTML = `
                  <div class="w-full bg-gray-200 flex flex-col items-center justify-center text-gray-500 rounded-lg border p-8">
                    <div class="text-4xl mb-2">🖼️</div>
                    <div class="text-sm">이미지를 로드할 수 없습니다</div>
                    <div class="text-xs mt-1 opacity-75">파일이 존재하지 않거나 손상되었습니다</div>
                  </div>
                `;
              }}
            />
          </div>
        )}

        {/* 질문 메타 정보 */}
        <div className="flex items-center gap-4 pt-4 border-t text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <ChatBubbleOutlineIcon fontSize="small" />
            {stats?.totalAnswers || 0}개 답변
          </span>
          <span className="flex items-center gap-1">
            <VisibilityIcon fontSize="small" />
            {question.views_count || 0}
          </span>
          {question.tag_display_name && (
            <span 
              className="px-2 py-1 rounded text-xs"
              style={{ backgroundColor: question.tag_color + '20', color: question.tag_color }}
            >
              {question.tag_display_name}
            </span>
          )}
        </div>
      </div>

      {/* 답변 섹션 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          답변 ({stats.totalAnswers}개)
        </h2>

        {/* 답변 목록 */}
        <div className="space-y-4">
          {answers.length > 0 ? (
            answers.map((answer) => (
              <div
                key={answer.id}
                className="bg-white rounded-lg p-6 border shadow-sm"
              >
                {/* 답변 내용 */}
                <div className="prose max-w-none mb-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{answer.content}</p>
                </div>

                {/* 답변 액션 및 메타 정보 */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-4">
                    {/* 좋아요 버튼 */}
                    <button
                      onClick={() => handleToggleLike(answer.id)}
                      disabled={!currentUser}
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                        answer.user_liked
                          ? 'text-blue-600 bg-blue-100 hover:bg-blue-200'
                          : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                      } ${!currentUser ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    >
                      {answer.user_liked ? (
                        <ThumbUpIcon fontSize="small" />
                      ) : (
                        <ThumbUpOutlinedIcon fontSize="small" />
                      )}
                      {answer.likes_count}
                    </button>

                  </div>

                  {/* 답변자 정보 */}
                  <div
                    className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => handleOpenProfileModal({
                      id: answer.user_id,
                      user_id: answer.user_id,
                      userId: answer.user_id,
                      name: answer.user_name || answer.username,
                      username: answer.username,
                      profilePic: answer.profilePic,
                      profile_pic: answer.profilePic
                    })}
                  >
                    {answer.profilePic ? (
                      <img
                        src={answer.profilePic.startsWith('http') ? answer.profilePic : `/uploads/profiles/${answer.profilePic}`}
                        alt="프로필"
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <PersonIcon className="w-6 h-6 text-gray-400 bg-gray-200 rounded-full p-1" />
                    )}
                    <div className="text-right">
                      <div className="font-medium text-gray-900">
                        {answer.user_name || answer.username}
                      </div>
                      <div className="text-gray-500">
                        {moment(answer.created_at).fromNow()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              아직 답변이 없습니다. 첫 번째 답변을 작성해보세요!
            </div>
          )}
        </div>
      </div>

      {/* 답변 작성 폼 */}
      {currentUser && question.question_status !== 'closed' ? (
        <div className="bg-white rounded-lg p-6 border shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">답변 작성</h3>
          <form onSubmit={handleSubmitAnswer}>
            <textarea
              value={answerContent}
              onChange={(e) => setAnswerContent(e.target.value)}
              placeholder="도움이 되는 답변을 작성해주세요..."
              rows="6"
              className="w-full p-4 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-market-500 focus:border-transparent"
              disabled={isSubmitting}
            />
            <div className="flex justify-end mt-4">
              <button
                type="submit"
                disabled={!answerContent.trim() || isSubmitting}
                className="flex items-center gap-2 px-6 py-2 bg-market-600 text-white rounded-lg hover:bg-market-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <SendIcon fontSize="small" />
                {isSubmitting ? '답변 등록 중...' : '답변 등록'}
              </button>
            </div>
          </form>
        </div>
      ) : !currentUser ? (
        <div className="bg-gray-50 rounded-lg p-6 border text-center">
          <p className="text-gray-600 mb-4">답변을 작성하려면 로그인이 필요합니다.</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-market-600 text-white rounded-lg hover:bg-market-700 transition-colors"
          >
            로그인하기
          </button>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-6 border text-center">
          <p className="text-gray-600">이 질문은 마감되어 더 이상 답변할 수 없습니다.</p>
        </div>
      )}

      {/* 최하단 광고 (모바일에서만) */}
      {isMobile && adsData && adsData.length > 0 && (
        <div className="mt-8">
          <MobileAdDisplay ad={adsData[0]} />
        </div>
      )}

      {/* 질문 수정 모달 */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">질문 수정</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  제목
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-market-500 focus:border-transparent"
                  placeholder="질문 제목을 입력하세요"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  내용
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows="8"
                  className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-market-500 focus:border-transparent"
                  placeholder="질문 내용을 자세히 작성해주세요"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이미지
                </label>
                
                {/* 기존 이미지 */}
                {editImages.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">기존 이미지</p>
                    <div className="grid grid-cols-3 gap-2">
                      {editImages.map((imageUrl, index) => (
                        <div key={index} className="relative">
                          <img
                            src={imageUrl}
                            alt={`기존 이미지 ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingImage(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 새 이미지 */}
                {newImages.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">새로 추가할 이미지</p>
                    <div className="grid grid-cols-3 gap-2">
                      {newImages.map((file, index) => (
                        <div key={index} className="relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`새 이미지 ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveNewImage(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 이미지 추가 버튼 */}
                <div>
                  <label htmlFor="editImageInput" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    이미지 추가
                  </label>
                  <input
                    id="editImageInput"
                    type="file"
                    accept={getAcceptedFileTypes()}
                    multiple
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    이미지 또는 동영상 파일 (최대 50MB)
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={updateQuestionMutation.isPending}
                  className="px-6 py-2 bg-market-600 text-white rounded-lg hover:bg-market-700 disabled:opacity-50 transition-colors"
                >
                  {updateQuestionMutation.isPending ? '수정 중...' : '수정완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 프로필 모달 */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={selectedUser}
      />
    </div>
  );
};

export default QnADetail;