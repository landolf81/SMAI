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
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

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

  // QnA 질문 작성 뮤테이션 (qnaService 사용)
  const createPostMutation = useMutation({
    mutationFn: async (postData) => {
      // 1. Generate unique question ID for image upload
      const questionId = uuidv4();

      // 2. Upload images to Supabase Storage if files exist
      let imageUrls = [];
      if (files.length > 0) {
        const uploadResults = await storageService.uploadQnAImages(questionId, files);
        imageUrls = uploadResults.map(result => result.url);
      }

      // 3. Create QnA question with qnaService
      const newQuestion = await qnaService.createQuestion({
        title: postData.title,
        content: postData.content,
        images: imageUrls
      });

      return newQuestion;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['qna-questions'] });
      queryClient.invalidateQueries({ queryKey: ['qna-trending'] });
      navigate('/qna');
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
              onClick={() => navigate('/qna')}
              className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Q&A로
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

    // 파일 검증 (커뮤니티 피드와 동일한 제한 적용)
    const validFiles = [];
    const errorMessages = [];
    let videoCount = 0;

    selectedFiles.forEach(file => {
      // 파일 크기 제한 (50MB)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        errorMessages.push(`파일 크기가 너무 큽니다: ${file.name} (최대 50MB)`);
        return;
      }

      // 동영상 개수 제한 (1개만 허용)
      const mediaType = getMediaType(file);
      if (mediaType.isVideo) {
        videoCount++;
        if (videoCount > 1) {
          errorMessages.push('동영상은 1개만 업로드할 수 있습니다.');
          return;
        }
      }

      // 브라우저 호환 검증
      const validation = validateUploadFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        errorMessages.push(validation.message);
      }
    });

    // 기존 파일과 합쳐서 동영상 개수 재확인
    const existingVideoCount = files.filter(f => getMediaType(f).isVideo).length;
    const newVideoCount = validFiles.filter(f => getMediaType(f).isVideo).length;
    if (existingVideoCount + newVideoCount > 1) {
      errorMessages.push('동영상은 1개만 업로드할 수 있습니다.');
      // 기존에 동영상이 있으면 새 동영상 제외
      const filteredFiles = validFiles.filter(f => !getMediaType(f).isVideo);
      validFiles.length = 0;
      validFiles.push(...filteredFiles);
    }

    if (errorMessages.length > 0) {
      setError(errorMessages.join('\n'));
    } else {
      setError('');
    }

    // 기존 파일에 추가 (최대 10개)
    const newFiles = [...files, ...validFiles].slice(0, 10);
    setFiles(newFiles);
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

    // 이미지는 선택사항 - 파일 개수 제한만 확인
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
      {/* 질문 작성 폼 */}
      <div className="bg-white rounded-lg border shadow-sm">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 최상단: 프로필 + 새 질문 작성 */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100">
              <img
                src={(() => {
                  const pic = currentUser.profilePic || currentUser.profile_pic;
                  if (!pic) return "/default/default_profile.png";
                  return pic.startsWith('http') ? pic : `/uploads/profiles/${pic}`;
                })()}
                alt="프로필"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = '/default/default_profile.png';
                }}
              />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">새 질문 작성</h1>
          </div>

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
              placeholder="예: 참외 물주기 방법 문의"
              maxLength={20}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-market-500 focus:border-transparent"
              disabled={isSubmitting}
              required
            />
            <div className="text-sm text-gray-500 mt-1">
              {formData.title.length}/20자
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

          {/* 이미지/동영상 업로드 (선택) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FontAwesomeIcon icon={faImage} className="mr-2 text-market-500" />
              이미지 또는 동영상 <span className="text-gray-400">(선택)</span>
            </label>

            <label
              htmlFor="imageInput"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-market-400 hover:bg-market-50 transition-all"
            >
              <FontAwesomeIcon icon={faImage} className="w-8 h-8 mb-2 text-gray-400" />
              <p className="text-sm text-gray-500"><span className="font-semibold">클릭하여 파일 업로드</span></p>
              <p className="text-xs text-gray-500">PNG, JPG, HEIC, MP4, MOV (최대 50MB, 동영상 3분, 1개)</p>
            </label>

            <input
              id="imageInput"
              type="file"
              accept={`${getAcceptedFileTypes()},.heic,.heif,image/heic,image/heif,video/*`}
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={isSubmitting}
            />

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

          {/* 제출 버튼 */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => navigate('/qna')}
              className="px-6 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!formData.title.trim() || !formData.content.trim() || formData.content.length < 20 || isSubmitting}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-market-600 text-white rounded-lg hover:bg-market-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-1"
            >
              <FontAwesomeIcon icon={faPaperPlane} />
              {isSubmitting ? '질문 등록 중...' : '질문 등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QnAForm;
