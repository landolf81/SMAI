import { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faPaperPlane, faTimes, faLink, faMicrophone, faStop } from '@fortawesome/free-solid-svg-icons';
import { getFirstLinkInfo } from '../utils/linkDetector';
import { YouTubePreviewCard } from '../components/YouTubeEmbed';
import { postService, storageService } from '../services';
import { getMediaType, getAcceptedFileTypes } from '../utils/mediaUtils';
import { uploadVideo, validateVideo } from '../services/videoUploadService';
import { convertImageToPng, isImageFile, isHeicFile } from '../utils/imageConverter';
import { v4 as uuidv4 } from 'uuid';

const PostEditor = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();

  const isEditMode = !!id;

  const urlParams = new URLSearchParams(location.search);
  const postTypeParam = urlParams.get('type');
  // QnA는 QnAForm 사용, 여기서는 general/secondhand만 지원
  const [postType, setPostType] = useState(postTypeParam === 'secondhand' ? 'secondhand' : 'general');

  // 상태 관리
  const [files, setFiles] = useState([]);
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewImages, setPreviewImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [gpsData, setGpsData] = useState(null);
  const [imageConvertProgress, setImageConvertProgress] = useState(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState(null);
  const [uploadedVideos, setUploadedVideos] = useState([]); // Cloudflare Stream 동영상 정보

  // 음성 인식 상태
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  // 음성 인식 초기화
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setDesc(prev => prev + (prev ? ' ' : '') + finalTranscript);
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
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // 음성 인식 토글
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

  // 링크 미리보기 상태
  const [linkPreview, setLinkPreview] = useState(null);
  const [showLinkPreview, setShowLinkPreview] = useState(true);

  // 수정 모드일 때 기존 게시글 데이터 불러오기
  const { data: postData } = useQuery({
    queryKey: ['post', id],
    queryFn: () => postService.getPost(id),
    enabled: isEditMode
  });

  // 게시글 데이터로 폼 초기화
  useEffect(() => {
    if (postData && isEditMode) {
      setDesc(postData.Desc || postData.desc || '');
      const images = postData.images || (postData.img ? [postData.img] : []);
      setExistingImages(images);
      setPreviewImages(images.map(img => img.startsWith('/uploads/posts/') ? img : `/uploads/posts/${img}`));
    }
  }, [postData, isEditMode]);

  // 텍스트 입력 시 링크 감지
  useEffect(() => {
    if (!desc || !showLinkPreview) {
      setLinkPreview(null);
      return;
    }

    const timer = setTimeout(() => {
      const linkInfo = getFirstLinkInfo(desc);
      if (linkInfo) {
        setLinkPreview(linkInfo);
      } else {
        setLinkPreview(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [desc, showLinkPreview]);

  // 게시물 생성 mutation
  const createMutation = useMutation({
    mutationFn: async (newPost) => {
      console.log('=== 게시물 작성 시작 ===');
      console.log('파일 개수:', files.length);
      const postId = uuidv4();

      // 이미지 PNG 변환 + 압축 (업로드 시점에 처리)
      let processedFiles = [];
      if (files.length > 0) {
        console.log('이미지 처리 시작...');
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          console.log(`파일 ${i + 1}/${files.length}: ${file.name}, 타입: ${file.type}`);
          const mediaType = getMediaType(file);
          if (mediaType.isImage) {
            try {
              // convertImageToPng에서 PNG 변환 + 리사이징 처리
              console.log(`이미지 변환 시작: ${file.name}`);
              const processedImage = await convertImageToPng(file, {
                maxWidth: 1024
              });
              console.log(`이미지 변환 완료: ${processedImage.name}, 크기: ${processedImage.size}`);
              processedFiles.push(processedImage);
            } catch (convertError) {
              console.error(`이미지 변환 실패: ${file.name}`, convertError);
              throw convertError;
            }
          }
          // 동영상은 이미 uploadedVideos에 있으므로 건너뜀
        }
        console.log(`이미지 처리 완료: ${processedFiles.length}개`);
      }

      // 이미지를 Supabase Storage에 업로드
      let imageUrls = [];
      if (processedFiles.length > 0) {
        console.log('이미지 업로드 시작...');
        try {
          const uploadResults = await storageService.uploadPostImages(postId, processedFiles);
          console.log('업로드 결과:', uploadResults);
          imageUrls = uploadResults.map(result => result.url);
          console.log('이미지 URL:', imageUrls);
        } catch (uploadError) {
          console.error('이미지 업로드 실패:', uploadError);
          throw uploadError;
        }
      }

      // 동영상 URL 추가 (R2 또는 Stream)
      const videoUrls = uploadedVideos.map(v => v.type === 'r2' ? v.url : v.iframeUrl);
      const allMediaUrls = [...imageUrls, ...videoUrls];

      let finalContent = newPost.desc;
      let finalTitle = '';

      // 중고거래: 첫 줄을 제목으로 사용
      if (postType === 'secondhand' && newPost.desc) {
        const lines = newPost.desc.split('\n');
        finalTitle = lines[0].trim();
        finalContent = lines.slice(1).join('\n').trim();
      }

      const postDataObj = {
        content: finalContent,
        img: allMediaUrls.length > 0 ? JSON.stringify(allMediaUrls) : null,
        images: allMediaUrls,
        post_type: postType,
        link_url: linkPreview?.url || null,
        link_type: linkPreview?.type || null,
        // Cloudflare Stream 동영상 정보 저장
        video_uid: uploadedVideos.length > 0 ? uploadedVideos[0].uid : null,
      };

      if (postType === 'secondhand' && finalTitle) {
        postDataObj.title = finalTitle;
      }

      if (gpsData) {
        postDataObj.latitude = gpsData.latitude;
        postDataObj.longitude = gpsData.longitude;
        postDataObj.location_accuracy = gpsData.accuracy;
        postDataObj.location_timestamp = gpsData.timestamp;
        postDataObj.location_source = gpsData.source;
      }

      if (linkPreview) {
        postDataObj.link_url = linkPreview.url;
        postDataObj.link_type = linkPreview.type;
        if (linkPreview.type === 'youtube' && linkPreview.videoId) {
          postDataObj.link_video_id = linkPreview.videoId;
          postDataObj.link_thumbnail = linkPreview.thumbnailUrl;
        }
      }

      const createdPost = await postService.createPost(postDataObj);
      return createdPost;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      await queryClient.invalidateQueries({ queryKey: ['enhanced-instagram-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['user-posts'] });

      const redirectPath = postType === 'secondhand' ? '/secondhand' : '/community';
      setTimeout(() => navigate(redirectPath), 100);
    },
    onError: (error) => {
      console.error('게시물 작성 실패:', error);
      setError(error.message || '게시물 작성에 실패했습니다.');
    }
  });

  // 파일 선택 처리
  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    setError('');

    const imageFiles = [];
    const videoFiles = [];

    for (const file of selectedFiles) {
      if (isImageFile(file) || isHeicFile(file)) {
        imageFiles.push(file);
      } else {
        const mediaType = getMediaType(file);
        if (mediaType.isVideo) {
          videoFiles.push(file);
        }
      }
    }

    // GPS 정보 추출
    if (imageFiles.length > 0) {
      try {
        const { extractGPSFromImage } = await import('../utils/gpsExtractor');
        const gps = await extractGPSFromImage(imageFiles[0]);
        if (gps) setGpsData(gps);
      } catch (err) {
        console.error('GPS 추출 실패:', err);
      }
    }

    // HEIC 파일만 미리보기용으로 변환 (브라우저에서 표시 불가하므로)
    // 일반 이미지는 원본 유지, 업로드 시점에 PNG 변환 + 압축 처리
    const processedImages = [];
    if (imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        try {
          if (isHeicFile(file)) {
            // HEIC는 미리보기를 위해 변환 필요
            setImageConvertProgress({
              current: i + 1,
              total: imageFiles.length,
              status: `${file.name} 변환 중...`
            });
            const convertedFile = await convertImageToPng(file, { maxWidth: 1024 });
            processedImages.push(convertedFile);
          } else {
            // 일반 이미지는 원본 유지 (업로드 시 처리)
            processedImages.push(file);
          }
        } catch (err) {
          console.error(`이미지 처리 실패: ${file.name}`, err);
          if (!isHeicFile(file)) {
            processedImages.push(file);
          } else {
            setError(`${file.name} 변환에 실패했습니다.`);
          }
        }
      }
      setImageConvertProgress(null);
    }

    // 동영상 업로드 (1개만 허용)
    // 이미 동영상이 있으면 새 동영상 추가 불가
    if (videoFiles.length > 0 && uploadedVideos.length > 0) {
      setError('동영상은 1개만 업로드할 수 있습니다. 기존 동영상을 삭제 후 다시 시도해주세요.');
      setVideoUploadProgress(null);
      return;
    }

    // 여러 동영상 선택 시 첫 번째만 사용
    if (videoFiles.length > 1) {
      setError('동영상은 1개만 업로드할 수 있습니다. 첫 번째 동영상만 업로드됩니다.');
      videoFiles.splice(1); // 첫 번째만 유지
    }

    for (const videoFile of videoFiles) {
      try {
        // 검증
        const validation = await validateVideo(videoFile);
        if (!validation.valid) {
          setError(validation.message);
          continue;
        }

        setVideoUploadProgress({ progress: 0, fileName: videoFile.name });

        // 통합 업로드 함수 사용 (MP4/WebM → R2, 그 외 → Stream)
        const result = await uploadVideo(videoFile, (progress) => {
          setVideoUploadProgress({ progress, fileName: videoFile.name });
        });

        setUploadedVideos(prev => [...prev, result]);

        // 미리보기 추가 (모든 동영상은 Stream)
        setPreviewImages(prev => [...prev, {
          url: result.thumbnailUrl,
          type: 'video/stream',
          name: videoFile.name,
          streamUid: result.uid,
          iframeUrl: result.iframeUrl,
        }]);

      } catch (err) {
        console.error('동영상 업로드 실패:', err);
        setError(err.message || '동영상 업로드에 실패했습니다.');
      }
    }
    setVideoUploadProgress(null);

    // 이미지 파일 추가
    setFiles(prev => [...prev, ...processedImages]);
    const newPreviews = processedImages.map(file => ({
      url: URL.createObjectURL(file),
      type: file.type,
      name: file.name
    }));
    setPreviewImages(prev => [...prev, ...newPreviews]);
  };

  const removeLinkPreview = () => {
    setLinkPreview(null);
    setShowLinkPreview(false);
  };

  const removeImage = (index) => {
    const preview = previewImages[index];

    // Cloudflare Stream 동영상인 경우
    if (preview?.streamUid) {
      setUploadedVideos(prev => prev.filter(v => v.uid !== preview.streamUid));
    } else if (index >= existingImages.length) {
      // 새로 추가한 이미지 파일
      const newFileIndex = index - existingImages.length;
      setFiles(prev => prev.filter((_, i) => i !== newFileIndex));
    } else {
      // 기존 이미지
      setExistingImages(prev => prev.filter((_, i) => i !== index));
    }

    setPreviewImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!desc.trim()) {
      setError('내용을 입력해주세요.');
      return;
    }

    if (previewImages.length === 0 && uploadedVideos.length === 0 && !linkPreview) {
      setError('이미지, 동영상 또는 링크를 추가해주세요.');
      return;
    }

    setLoading(true);
    try {
      await createMutation.mutateAsync({ desc: desc.trim() });
    } catch (err) {
      console.error('Mutation 에러:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 메인 컨텐츠 */}
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-24">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6">
          {/* 사용자 정보 */}
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-orange-400 p-0.5">
              <img
                src={(() => {
                  const pic = currentUser.profilePic || currentUser.profile_pic;
                  if (!pic) return "/default/default_profile.png";
                  return pic.startsWith('http') ? pic : `/uploads/profiles/${pic}`;
                })()}
                alt="프로필"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{currentUser.name}</p>
              <p className="text-sm text-gray-500">{isEditMode ? '게시물 수정 중' : '게시물 작성 중'}</p>
            </div>
          </div>

          {/* 파일 업로드 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <FontAwesomeIcon icon={faImage} className="mr-2 text-orange-500" />
              이미지 또는 동영상
              {!linkPreview && <span className="text-red-500 ml-1">*</span>}
            </label>

            <label
              htmlFor="imageInput"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-all"
            >
              <FontAwesomeIcon icon={faImage} className="w-8 h-8 mb-2 text-gray-400" />
              <p className="text-sm text-gray-500"><span className="font-semibold">클릭하여 파일 업로드</span></p>
              <p className="text-xs text-gray-500">PNG, JPG, HEIC, MP4, MOV (최대 50MB, 동영상 3분, 1개)</p>
              <p className="text-xs text-green-600 mt-1">MP4/WebM은 빠른 업로드, 그 외는 자동 변환</p>
            </label>
            <input
              id="imageInput"
              type="file"
              accept={`${getAcceptedFileTypes()},.heic,.heif,image/heic,image/heif,video/*`}
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {/* 이미지 변환 진행률 */}
            {imageConvertProgress && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="loading loading-spinner w-2 h-2 text-blue-500"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-700">
                      이미지 변환 중... ({imageConvertProgress.current}/{imageConvertProgress.total})
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(imageConvertProgress.current / imageConvertProgress.total) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 동영상 업로드 진행률 */}
            {videoUploadProgress && (
              <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="loading loading-spinner w-2 h-2 text-purple-500"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-purple-700">
                      동영상 업로드 중 {videoUploadProgress.progress}%
                    </div>
                    <div className="text-xs text-purple-600">{videoUploadProgress.fileName}</div>
                    <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${videoUploadProgress.progress}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 미리보기 */}
            {previewImages.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {previewImages.map((preview, index) => {
                  const isStream = preview?.type === 'video/stream';
                  const previewUrl = typeof preview === 'string' ? preview : preview.url;

                  return (
                    <div key={index} className="relative">
                      {isStream ? (
                        <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden">
                          <img
                            src={previewUrl}
                            alt="동영상 썸네일"
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
                            <div className="bg-purple-600 rounded-full p-3 mb-2">
                              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                              </svg>
                            </div>
                            <span className="text-white text-xs text-center px-2">인코딩 중...</span>
                          </div>
                          <div className="absolute bottom-2 left-2 bg-purple-600 bg-opacity-80 text-white px-2 py-1 rounded text-xs">
                            동영상
                          </div>
                        </div>
                      ) : (
                        <img src={previewUrl} alt={`미리보기 ${index + 1}`} className="w-full h-auto rounded-lg" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 w-7 h-7 bg-black bg-opacity-60 text-white rounded-full flex items-center justify-center hover:bg-opacity-80"
                      >
                        <FontAwesomeIcon icon={faTimes} className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 내용 입력 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                내용 <span className="text-red-500">*</span>
              </label>
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
                  <FontAwesomeIcon icon={isListening ? faStop : faMicrophone} className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="relative">
              <textarea
                placeholder={postType === 'secondhand' ? '중고 물품에 대해 설명해주세요.' : '무슨 생각을 하고 계신가요?'}
                className={`w-full min-h-[200px] p-4 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                  isListening ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
              {isListening && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 text-red-500 text-sm">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                  음성 인식 중...
                </div>
              )}
            </div>

            {gpsData && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center text-sm text-blue-700">
                  <span className="mr-2">📍</span>
                  <span>위치 정보 포함: {gpsData.latitude.toFixed(6)}, {gpsData.longitude.toFixed(6)}</span>
                </div>
              </div>
            )}
          </div>

          {/* YouTube 링크 미리보기 */}
          {linkPreview?.type === 'youtube' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <FontAwesomeIcon icon={faLink} className="mr-2 text-blue-500" />링크 미리보기
              </label>
              <YouTubePreviewCard url={linkPreview.url} onRemove={removeLinkPreview} className="max-w-md" />
            </div>
          )}

          {/* 에러 */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 버튼 영역 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium transition-all hover:bg-gray-300"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || imageConvertProgress || videoUploadProgress || !desc.trim()}
              className={`flex-1 py-3 bg-orange-500 text-white rounded-xl font-medium transition-all ${
                loading || imageConvertProgress || videoUploadProgress || !desc.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-600'
              }`}
            >
              {loading ? <span className="loading loading-spinner w-2 h-2 mr-2"></span> : <FontAwesomeIcon icon={faPaperPlane} className="mr-2 text-sm" />}
              {isEditMode ? '수정 완료' : '게시하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostEditor;
