import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postService, storageService } from "../services";
import { useContext, useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faPaperPlane, faTimes, faEdit } from "@fortawesome/free-solid-svg-icons";
import { AuthContext } from "../context/AuthContext";
import { compressImage, validateVideoSize } from '../utils/imageCompression';
import { getMediaType, validateUploadFile, getAcceptedFileTypes } from '../utils/mediaUtils';
import { v4 as uuidv4 } from 'uuid';
import { API_BASE_URL } from '../config/api';

const EditPostModal = ({ post, isOpen, onClose }) => {
  const { currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();

  // 상태 관리
  const [file, setFile] = useState(null);
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState(null);

  // 기존 게시글 데이터로 폼 초기화
  useEffect(() => {
    if (post && isOpen) {
      setDesc(post.Desc || post.desc || "");
      // 이미지 URL 처리
      if (post.img) {
        // 이미 완전한 URL인 경우
        if (post.img.startsWith('http://') || post.img.startsWith('https://')) {
          setPreviewImage(post.img);
        }
        // 레거시 백엔드 경로인 경우
        else if (post.img.startsWith('/uploads/')) {
          setPreviewImage(`${API_BASE_URL}${post.img}`);
        }
        // Supabase Storage 경로인 경우
        else {
          setPreviewImage(storageService.getPublicUrl('posts', post.img));
        }
      } else {
        setPreviewImage(null);
      }
    }
  }, [post, isOpen]);


  // 게시물 수정 뮤테이션 (Supabase Storage 사용)
  const mutation = useMutation({
    mutationFn: async (postData) => {
      let imgUrl = post.img; // 기존 이미지 유지

      // 새 파일이 있으면 Supabase에 업로드
      if (file) {
        const mediaType = getMediaType(file);
        let processedFile = file;

        // 이미지인 경우 압축
        if (mediaType.isImage) {
          processedFile = await compressImage(file);
        }
        // 동영상인 경우 크기 검증
        else if (mediaType.isVideo) {
          const validation = validateVideoSize(file);
          if (!validation.valid) {
            throw new Error(validation.message);
          }
        }

        // Supabase Storage에 업로드
        const postId = post.id || uuidv4();
        const uploadResult = await storageService.uploadPostImage(postId, processedFile);
        imgUrl = uploadResult.url;
      }


      return postService.updatePost(post.id, {
        content: postData.desc,
        img: imgUrl
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      onClose();
      
      // 폼 초기화
      setFile(null);
      setError("");
    },
    onError: (error) => {
      console.error('게시물 수정 실패:', error);
      
      let errorMessage = '게시물 수정에 실패했습니다.';
      
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    }
  });


  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // 간단한 유효성 검사
    if (!desc.trim() && !previewImage && !file) {
      setError('내용을 입력하거나 이미지를 선택해주세요.');
      return;
    }

    setLoading(true);
    mutation.mutate({
      desc: desc.trim(),
      related_market: post.related_market || ''
    });
    setLoading(false);
  };

  // 파일 선택 시 미리보기 업데이트
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // 브라우저 호환 파일 검증
    const validation = validateUploadFile(selectedFile);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    setFile(selectedFile);
    setPreviewImage(URL.createObjectURL(selectedFile));
    setError('');
  };

  // 이미지 제거
  const removeImage = () => {
    setFile(null);
    setPreviewImage(null);
  };

  if (!isOpen || !post) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
           style={{ boxShadow: '-5px 0 20px rgba(255, 165, 0, 0.3), 0 5px 20px rgba(0, 0, 0, 0.15)' }}>
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
          <h2 className="text-xl font-bold flex items-center text-gray-800">
            <FontAwesomeIcon icon={faEdit} className="mr-3 text-orange-500" />
            게시물 수정
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all duration-200 hover:scale-110"
          >
            <FontAwesomeIcon icon={faTimes} className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* 사용자 정보 */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-gradient-to-r from-orange-400 to-pink-500 p-0.5">
            <div className="w-full h-full rounded-full overflow-hidden bg-white">
              <img
                src={currentUser.profilePic
                  ? `/uploads/posts/${currentUser.profilePic}`
                  : "/default/default_profile.png"
                }
                alt="프로필"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div>
            <p className="font-semibold text-gray-800">{currentUser.name || currentUser.username}</p>
            <p className="text-sm text-gray-500">게시물 수정</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 내용 입력 */}
          <div className="mb-6">
            <textarea
              placeholder="게시물 내용을 입력하세요"
              className="w-full h-32 p-4 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>

          {/* 미디어 업로드 */}
          <div className="mb-6">
            <label htmlFor="editImageInput" className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer transition-all duration-200 hover:scale-105">
              <FontAwesomeIcon icon={faImage} className="mr-2 text-orange-500" />
              미디어 변경
            </label>
            <input
              id="editImageInput"
              type="file"
              accept={getAcceptedFileTypes()}
              className="hidden"
              onChange={handleFileChange}
            />

            {previewImage && (
              <div className="mt-4 relative rounded-xl overflow-hidden shadow-lg">
                <img
                  src={previewImage}
                  alt="미리보기"
                  className="max-w-full h-48 object-cover w-full"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-3 right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 hover:scale-110"
                >
                  <FontAwesomeIcon icon={faTimes} className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center text-red-700">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 hover:scale-105"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || (!desc.trim() && !previewImage)}
              className={`px-6 py-2 bg-orange-500 text-white rounded-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                loading ? 'animate-pulse' : 'hover:bg-orange-600'
              }`}
            >
              {!loading && <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />}
              {loading ? '수정 중...' : '수정 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPostModal;