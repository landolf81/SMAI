import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faPaperPlane, faTimes } from "@fortawesome/free-solid-svg-icons";
import { AuthContext } from "../context/AuthContext";
import { getMediaType, getMediaIcon, validateUploadFile, getAcceptedFileTypes } from '../utils/mediaUtils';
import { compressImage, validateVideoSize } from '../utils/imageCompression';
import { postService, storageService } from '../services';
import { v4 as uuidv4 } from 'uuid';

const Share = ({ onPostCreated }) => {
  const { currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();

  // 상태 관리
  const [files, setFiles] = useState([]); // 다중 파일 상태
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 중고거래 전용 필드
  const [tradeInfo, setTradeInfo] = useState({
    itemName: '',
    price: '',
    quantity: '',
    condition: 'good' // 'new', 'good', 'fair'
  });

  // 게시물 작성 뮤테이션 (Supabase)
  const mutation = useMutation({
    mutationFn: async (postData) => {
      // 1. Generate unique post ID
      const postId = uuidv4();

      // 2. Compress images and validate videos before upload
      let processedFiles = [];
      if (files.length > 0) {
        for (const file of files) {
          const mediaType = getMediaType(file);

          if (mediaType.isImage) {
            // 이미지 압축 (1080px, 80% quality)
            const compressedImage = await compressImage(file);
            processedFiles.push(compressedImage);
          } else if (mediaType.isVideo) {
            // 동영상 크기 검증 (50MB 제한)
            const validation = validateVideoSize(file);
            if (!validation.valid) {
              throw new Error(validation.message);
            }
            processedFiles.push(file);
          } else {
            processedFiles.push(file);
          }
        }
      }

      // 3. Upload processed files to Supabase Storage
      let imageUrls = [];
      if (processedFiles.length > 0) {
        const uploadResults = await storageService.uploadPostImages(postId, processedFiles);
        imageUrls = uploadResults.map(result => result.url);
      }

      // 4. Create post data
      const newPostData = {
        desc: postData.desc,
        img: imageUrls.length > 0 ? imageUrls[0] : null, // 첫 번째 이미지를 메인 이미지로
        images: imageUrls, // 모든 이미지 배열
        related_market: postData.related_market || ''
      };

      // 중고거래 데이터 추가 (현재는 비활성화)
      // if (isSecondHandTrade) {
      //   newPostData.trade_item_name = tradeInfo.itemName;
      //   newPostData.trade_price = tradeInfo.price;
      //   newPostData.trade_quantity = tradeInfo.quantity || '1';
      //   newPostData.trade_condition = tradeInfo.condition;
      //   newPostData.trade_status = 'available';
      // }

      // 5. Create post with Supabase
      const newPost = await postService.createPost(newPostData);

      return newPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-instagram-posts'] });
      if (onPostCreated) onPostCreated();

      // 폼 초기화
      setFiles([]);
      setDesc('');
      setTradeInfo({
        itemName: '',
        price: '',
        quantity: '',
        condition: 'good'
      });
      setError("");
    },
    onError: (error) => {
      console.error('게시물 작성 실패:', error);

      let errorMessage = '게시물 작성에 실패했습니다.';
      if (error.message) {
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
    if (!desc.trim() && files.length === 0) {
      setError('내용을 입력하거나 미디어를 선택해주세요.');
      return;
    }

    // 파일 타입 최종 검증
    const invalidFiles = files.filter(file => {
      const mediaType = getMediaType(file);
      return !mediaType.isImage && !mediaType.isVideo;
    });

    if (invalidFiles.length > 0) {
      setError('지원하지 않는 파일이 포함되어 있습니다.');
      return;
    }

    // 파일 개수 제한 (최대 10개)
    if (files.length > 10) {
      setError('최대 10개의 파일까지 업로드할 수 있습니다.');
      return;
    }

    setLoading(true);
    mutation.mutate({
      desc: desc.trim(),
      related_market: '' // 기본값
    });
    setLoading(false);
  };

  // 로그인 확인
  if (!currentUser) {
    return (
      <div className="bg-base-100 rounded-lg shadow-xl p-6 text-center">
        <p className="text-gray-600">게시물을 작성하려면 로그인해주세요.</p>
      </div>
    );
  }

  return (
    <div className="bg-base-100 rounded-lg shadow-xl p-6">
      {/* 사용자 정보 */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="avatar">
          <div className="w-12 rounded-full">
            <img
              src={currentUser.profilePic
                ? `/uploads/posts/${currentUser.profilePic}`
                : "/default/default_profile.png"
              }
              alt="프로필"
            />
          </div>
        </div>
        <div>
          <p className="font-semibold text-gray-800">{currentUser.name || currentUser.username}</p>
          <p className="text-sm text-gray-600">게시물 작성</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* 내용 입력 */}
        <div className="form-control mb-4">
          <textarea
            placeholder={`무엇을 공유하고 싶나요, ${currentUser.name || currentUser.username}님?`}
            className="textarea textarea-bordered h-32 resize-none"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>


        {/* 이미지 업로드 */}
        <div className="mb-4">
          <label htmlFor="imageInput" className="btn btn-outline btn-sm">
            <FontAwesomeIcon icon={faImage} className="mr-2" />
            미디어 추가
          </label>
          <input
            id="imageInput"
            type="file"
            accept={getAcceptedFileTypes()}
            multiple // 다중 파일 선택 허용
            className="hidden"
            onChange={(e) => {
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
            }}
          />

          {files.length > 0 && (
            <div className="mt-2">
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
                        className="btn btn-circle btn-xs btn-error absolute top-1 right-1"
                      >
                        <FontAwesomeIcon icon={faTimes} />
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
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        {/* 작성 버튼 */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || (!desc.trim() && files.length === 0)}
            className={`btn btn-primary ${loading ? 'loading' : ''}`}
          >
            {!loading && <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />}
            {loading ? '작성 중...' : '게시물 작성'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Share;