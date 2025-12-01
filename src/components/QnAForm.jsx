import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { qnaService, postService, storageService } from '../services';
import { AuthContext } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faPaperPlane, faTimes } from '@fortawesome/free-solid-svg-icons';
import { getMediaType, getMediaIcon, validateUploadFile, getAcceptedFileTypes } from '../utils/mediaUtils';

// 아이콘
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import InfoIcon from '@mui/icons-material/Info';

const QnAForm = () => {
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });
  const [files, setFiles] = useState([]); // 이미지 파일들
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 게시물 작성 뮤테이션 (Supabase 사용)
  const createPostMutation = useMutation({
    mutationFn: async (postData) => {
      // 1. Generate unique post ID
      const questionId = uuidv4();

      // 2. Upload images to Supabase Storage if files exist
      let imageUrls = [];
      if (files.length > 0) {
        const uploadResults = await storageService.uploadQnAImages(questionId, files);
        imageUrls = uploadResults.map(result => result.url);
      }

      // 3. Create post with Supabase
      const fullContent = `[Q&A] ${postData.title}\n\n${postData.content}`;

      const newPost = await postService.createPost({
        desc: fullContent,
        img: imageUrls.length > 0 ? imageUrls[0] : null, // 첫 번째 이미지를 메인 이미지로
        images: imageUrls, // 모든 이미지 배열
        related_market: ''
      });

      return newPost;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      navigate('/community');
    },
    onError: (error) => {
      console.error('질문 작성 실패:', error);

      let errorMessage = '질문 작성에 실패했습니다.';
      if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      setIsSubmitting(false);
    }
  });

  // 로그인 확인
  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white rounded-lg p-8 border shadow-sm text-center">
          <HelpOutlineIcon className="mx-auto text-gray-300 mb-4" style={{ fontSize: '3rem' }} />
          <h2 className="text-xl font-semibold text-gray-900 mb-4">로그인이 필요합니다</h2>
          <p className="text-gray-600 mb-6">질문을 작성하려면 먼저 로그인해주세요.</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 bg-market-600 text-white rounded-lg hover:bg-market-700 transition-colors"
            >
              로그인하기
            </button>
            <button
              onClick={() => navigate('/community')}
              className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              커뮤니티로
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);

    // 파일 검증 (브라우저 호환 동영상만 허용)
    const validFiles = [];
    const errorMessages = [];

    selectedFiles.forEach(file => {
      // 파일 크기 제한 (50MB)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        errorMessages.push(`파일 크기가 너무 큽니다: ${file.name} (최대 50MB)`);
        return;
      }

      // 브라우저 호환 검증
      const validation = validateUploadFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        errorMessages.push(validation.message);
      }
    });

    if (errorMessages.length > 0) {
      setError(errorMessages.join('\n'));
    } else {
      setError('');
    }

    setFiles(validFiles);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('질문 제목을 입력해주세요.');
      return;
    }
    
    if (!formData.content.trim()) {
      setError('질문 내용을 입력해주세요.');
      return;
    }
    
    if (files.length === 0) {
      setError('최소 1개 이상의 이미지를 첨부해주세요.');
      return;
    }
    
    if (files.length > 10) {
      setError('최대 10개의 파일까지 업로드할 수 있습니다.');
      return;
    }
    
    setError('');
    setIsSubmitting(true);
    createPostMutation.mutate({
      title: formData.title.trim(),
      content: formData.content.trim()
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* 헤더 */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/community')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowBackIcon fontSize="small" />
          커뮤니티로 돌아가기
        </button>
        <h1 className="text-2xl font-bold text-gray-900">새 질문 작성</h1>
      </div>

      {/* 도움말 카드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <InfoIcon className="text-blue-600 flex-shrink-0 mt-0.5" fontSize="small" />
          <div className="text-sm text-blue-800">
            <h3 className="font-medium mb-2">좋은 질문 작성 가이드</h3>
            <ul className="space-y-1 text-blue-700">
              <li>• 구체적이고 명확한 제목을 작성해주세요</li>
              <li>• 문제 상황을 자세히 설명해주세요</li>
              <li>• 관련 사진을 반드시 1개 이상 첨부해주세요</li>
              <li>• 시도해본 방법이 있다면 함께 알려주세요</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 질문 작성 폼 */}
      <div className="bg-white rounded-lg border shadow-sm">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 질문 제목 */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              질문 제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="예: 참외 재배 시 물 주기는 어떻게 해야 하나요?"
              maxLength={200}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-market-500 focus:border-transparent"
              disabled={isSubmitting}
              required
            />
            <div className="text-sm text-gray-500 mt-1">
              {formData.title.length}/200자
            </div>
          </div>

          {/* 질문 내용 */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
              질문 내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              placeholder="질문에 대해 자세히 설명해주세요. 상황, 문제점, 궁금한 점 등을 구체적으로 작성하시면 더 정확한 답변을 받을 수 있습니다."
              rows="10"
              className="w-full p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-market-500 focus:border-transparent"
              disabled={isSubmitting}
              required
            />
            <div className="text-sm text-gray-500 mt-1">
              최소 20자 이상 작성해주세요. 현재: {formData.content.length}자
            </div>
          </div>

          {/* 이미지 업로드 (필수) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              관련 이미지 <span className="text-red-500">* (필수: 최소 1개)</span>
            </label>
            
            <label htmlFor="imageInput" className="btn btn-outline btn-sm cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <FontAwesomeIcon icon={faImage} className="mr-2" />
              이미지 선택
            </label>
            
            <input
              id="imageInput"
              type="file"
              accept={getAcceptedFileTypes()}
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={isSubmitting}
            />
            
            <p className="text-sm text-gray-500 mt-2">
              문제 상황이나 질문과 관련된 사진을 첨부해주세요. (최대 10개)
            </p>

            {files.length > 0 && (
              <div className="mt-4">
                <div className="text-sm text-gray-600 mb-2">
                  선택된 파일: {files.length}개 
                  ({files.filter(f => getMediaType(f).isImage).length}개 이미지, {files.filter(f => getMediaType(f).isVideo).length}개 동영상)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {files.map((file, index) => {
                    const mediaType = getMediaType(file);
                    const mediaIcon = getMediaIcon(file.name);
                    
                    return (
                      <div key={index} className="relative">
                        {mediaType.isVideo ? (
                          <div className="w-full h-24 bg-gray-800 rounded-lg flex items-center justify-center text-white relative">
                            <span className="text-2xl">{mediaIcon}</span>
                            <span className="absolute bottom-1 left-1 text-xs bg-black bg-opacity-70 px-1 rounded">
                              동영상
                            </span>
                          </div>
                        ) : (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`미리보기 ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setFiles(files.filter((_, i) => i !== index))}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                          disabled={isSubmitting}
                        >
                          <FontAwesomeIcon icon={faTimes} className="text-xs" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* 작성자 정보 미리보기 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">작성자 정보</div>
            <div className="flex items-center gap-3">
              {currentUser.profilePic ? (
                <img 
                  src={`/uploads/profiles/${currentUser.profilePic}`}
                  alt="프로필"
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-gray-500 font-medium">
                    {currentUser.name ? currentUser.name[0] : currentUser.username[0]}
                  </span>
                </div>
              )}
              <div>
                <div className="font-medium text-gray-900">
                  {currentUser.name || currentUser.username}
                </div>
                <div className="text-sm text-gray-500">
                  @{currentUser.username}
                </div>
              </div>
            </div>
          </div>

          {/* 제출 버튼 */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => navigate('/community')}
              className="px-6 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!formData.title.trim() || !formData.content.trim() || formData.content.length < 20 || files.length === 0 || isSubmitting}
              className="flex items-center gap-2 px-8 py-3 bg-market-600 text-white rounded-lg hover:bg-market-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-1"
            >
              <FontAwesomeIcon icon={faPaperPlane} />
              {isSubmitting ? '질문 등록 중...' : '질문 등록하기'}
            </button>
          </div>
        </form>
      </div>

      {/* 참고 정보 */}
      <div className="mt-6 text-sm text-gray-500 text-center">
        <p>질문은 커뮤니티 게시판에 게시되며, 모든 사용자가 답변할 수 있습니다.</p>
        <p className="mt-1">부적절한 내용은 관리자에 의해 삭제될 수 있습니다.</p>
      </div>
    </div>
  );
};

export default QnAForm;