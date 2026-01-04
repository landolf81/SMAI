import { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faPaperPlane, faTimes, faLink, faMicrophone, faStop } from '@fortawesome/free-solid-svg-icons';
import { getFirstLinkInfo } from '../utils/linkDetector';
import { YouTubePreviewCard } from '../components/YouTubeEmbed';
import LinkPreviewCard from '../components/LinkPreviewCard';
import { postService, storageService } from '../services';
import { getMediaType, getAcceptedFileTypes } from '../utils/mediaUtils';
import { uploadVideo, validateVideo } from '../services/videoUploadService';
import { v4 as uuidv4 } from 'uuid';
import LoadingSpinner from '../components/LoadingSpinner';

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
  const [videoUploadProgress, setVideoUploadProgress] = useState(null);
  const [uploadedVideos, setUploadedVideos] = useState([]); // Cloudflare Stream 동영상 정보
  const [previewMode, setPreviewMode] = useState('feed'); // 'feed' (4:5) or 'fullscreen' (9:16)
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0); // 현재 미리보기 이미지 인덱스
  const [showErrorModal, setShowErrorModal] = useState(false); // 에러 모달 표시 상태

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

  // 에러 발생 시 모달 자동 표시
  useEffect(() => {
    if (error) {
      setShowErrorModal(true);
    }
  }, [error]);

  // 에러 모달 닫기 핸들러
  const closeErrorModal = () => {
    setShowErrorModal(false);
    setError('');
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

      // 이미지 배열 파싱
      let images = [];
      if (postData.images && Array.isArray(postData.images)) {
        images = postData.images;
      } else if (postData.img) {
        // JSON 문자열인 경우 파싱
        if (typeof postData.img === 'string' && postData.img.startsWith('[')) {
          try {
            images = JSON.parse(postData.img);
          } catch {
            images = [postData.img];
          }
        } else {
          images = [postData.img];
        }
      }

      setExistingImages(images);

      // Cloudflare Stream URL에서 video UID 추출하는 함수
      const extractStreamUid = (url) => {
        if (typeof url !== 'string') return null;
        // iframe URL: https://customer-xxx.cloudflarestream.com/{uid}/iframe
        // watch URL: https://customer-xxx.cloudflarestream.com/{uid}
        const match = url.match(/cloudflarestream\.com\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
      };

      // 이미지와 동영상 분리
      const imageUrls = [];
      let streamVideoUid = postData.video_uid || null;

      images.forEach(img => {
        if (typeof img === 'string') {
          // Cloudflare Stream URL인 경우 UID 추출
          if (img.includes('cloudflarestream.com')) {
            if (!streamVideoUid) {
              streamVideoUid = extractStreamUid(img);
            }
          } else {
            // 일반 이미지
            imageUrls.push(img);
          }
        }
      });

      // 미리보기 URL 생성 (이미지만)
      const previews = imageUrls.map(img => {
        if (typeof img === 'string') {
          // 이미 완전한 URL인 경우
          if (img.startsWith('http://') || img.startsWith('https://')) {
            return { url: img, type: 'image', existing: true };
          }
          // 레거시 경로인 경우
          if (img.startsWith('/uploads/')) {
            return { url: img, type: 'image', existing: true };
          }
          // Supabase Storage 경로인 경우
          return { url: storageService.getPublicUrl('posts', img), type: 'image', existing: true };
        }
        return img;
      });

      // 동영상 UID가 있으면 미리보기 배열에 추가
      if (streamVideoUid) {
        // Cloudflare Stream 썸네일 URL (videodelivery.net 사용 - 더 안정적)
        const thumbnailUrl = `https://videodelivery.net/${streamVideoUid}/thumbnails/thumbnail.jpg?time=1s`;

        setUploadedVideos([{
          uid: streamVideoUid,
          type: 'stream',
          existing: true,
          thumbnailUrl
        }]);

        // 이미지와 동영상을 한 번에 설정
        previews.push({
          url: thumbnailUrl,
          type: 'video/stream',
          streamUid: streamVideoUid,
          existing: true
        });
      }

      // 모든 미리보기를 한 번에 설정
      setPreviewImages(previews);
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

      // 이미지 파일만 필터링 (동영상은 이미 uploadedVideos에 있음)
      const imageFiles = files.filter(file => getMediaType(file).isImage);
      console.log(`이미지 파일: ${imageFiles.length}개`);

      // 이미지를 Cloudflare Images에 업로드 (자동 최적화)
      let imageUrls = [];
      if (imageFiles.length > 0) {
        console.log('이미지 업로드 시작...');
        try {
          const uploadResults = await storageService.uploadPostImages(postId, imageFiles);
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

  // 게시물 수정 mutation
  const updateMutation = useMutation({
    mutationFn: async (updateData) => {
      console.log('=== 게시물 수정 시작 ===');

      // 새로 추가된 이미지 파일만 업로드
      const imageFiles = files.filter(file => getMediaType(file).isImage);
      let newImageUrls = [];

      if (imageFiles.length > 0) {
        console.log('새 이미지 업로드 시작...');
        try {
          const uploadResults = await storageService.uploadPostImages(id, imageFiles);
          newImageUrls = uploadResults.map(result => result.url);
        } catch (uploadError) {
          console.error('이미지 업로드 실패:', uploadError);
          throw uploadError;
        }
      }

      // 기존 이미지 (삭제되지 않은 것들) + 새 이미지
      // previewImages에서 existing이 true인 것들만 남기고, 해당 URL을 추출
      const remainingExistingImages = previewImages
        .filter(p => p?.existing && p?.type === 'image')
        .map(p => p.url);

      // 동영상 URL 추가
      // 1. 새로 업로드한 동영상
      const newVideoUrls = uploadedVideos.filter(v => !v.existing).map(v => v.type === 'r2' ? v.url : v.iframeUrl);
      // 2. 기존 Stream 동영상 (삭제되지 않은 것들)
      const existingStreamVideos = previewImages
        .filter(p => p?.existing && p?.type === 'video/stream' && p?.streamUid)
        .map(p => `https://customer-xi3tfx9anf8ild8c.cloudflarestream.com/${p.streamUid}/iframe`);

      const allMediaUrls = [...remainingExistingImages, ...newImageUrls, ...newVideoUrls, ...existingStreamVideos];

      // video_uid: 새로 업로드한 동영상 > 기존 동영상 > null
      const existingVideoUid = previewImages.find(p => p?.existing && p?.type === 'video/stream')?.streamUid;
      const newVideoUid = uploadedVideos.find(v => !v.existing)?.uid;
      const finalVideoUid = newVideoUid || existingVideoUid || null;

      const postDataObj = {
        content: updateData.desc,
        img: allMediaUrls.length > 0 ? JSON.stringify(allMediaUrls) : null,
        images: allMediaUrls,
        link_url: linkPreview?.url || null,
        link_type: linkPreview?.type || null,
        video_uid: finalVideoUid,
      };

      if (linkPreview?.type === 'youtube' && linkPreview.videoId) {
        postDataObj.link_video_id = linkPreview.videoId;
        postDataObj.link_thumbnail = linkPreview.thumbnailUrl;
      }

      const updatedPost = await postService.updatePost(id, postDataObj);
      return updatedPost;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      await queryClient.invalidateQueries({ queryKey: ['enhanced-instagram-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['user-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['post', id] });

      const redirectPath = postType === 'secondhand' ? '/secondhand' : '/community';
      setTimeout(() => navigate(redirectPath), 100);
    },
    onError: (error) => {
      console.error('게시물 수정 실패:', error);
      setError(error.message || '게시물 수정에 실패했습니다.');
    }
  });

  // 파일 선택 처리
  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    setError('');

    const imageFiles = [];
    const videoFiles = [];

    for (const file of selectedFiles) {
      const mediaType = getMediaType(file);
      if (mediaType.isImage) {
        imageFiles.push(file);
      } else if (mediaType.isVideo) {
        videoFiles.push(file);
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

    // Cloudflare Images가 자동 최적화하므로 원본 그대로 사용
    const processedImages = [...imageFiles];

    // 이미지와 동영상 혼합 업로드 금지
    // 기존에 이미지가 있는데 동영상 추가 시도
    const hasExistingImages = previewImages.some(p => p?.type !== 'video/stream');
    // 기존에 동영상이 있는데 이미지 추가 시도
    const hasExistingVideos = uploadedVideos.length > 0 || previewImages.some(p => p?.type === 'video/stream');

    if (videoFiles.length > 0 && (hasExistingImages || imageFiles.length > 0)) {
      setError('이미지와 동영상은 함께 업로드할 수 없습니다. 이미지 또는 동영상 중 하나만 선택해주세요.');
      return;
    }

    if (imageFiles.length > 0 && hasExistingVideos) {
      setError('이미지와 동영상은 함께 업로드할 수 없습니다. 기존 동영상을 삭제 후 이미지를 업로드해주세요.');
      return;
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
    } else if (preview?.existing) {
      // 기존 이미지 (수정 모드에서 로드된 이미지)
      setExistingImages(prev => prev.filter((_, i) => i !== index));
    } else {
      // 새로 추가한 이미지 파일
      // existingImages 수에서 제외하고 files 인덱스 계산
      const existingCount = previewImages.filter(p => p?.existing).length;
      const newFileIndex = index - existingCount;
      if (newFileIndex >= 0) {
        setFiles(prev => prev.filter((_, i) => i !== newFileIndex));
      }
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
      if (isEditMode) {
        await updateMutation.mutateAsync({ desc: desc.trim() });
      } else {
        await createMutation.mutateAsync({ desc: desc.trim() });
      }
    } catch (err) {
      console.error('Mutation 에러:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 에러 모달 */}
      {showErrorModal && error && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center">
              {/* 에러 아이콘 */}
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              {/* 에러 메시지 */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">알림</h3>
              <p className="text-gray-600 mb-6">{error}</p>
              {/* 확인 버튼 */}
              <button
                type="button"
                onClick={closeErrorModal}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-24">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6">
          {/* 사용자 정보 */}
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white p-0.5">
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
              className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-all"
            >
              <FontAwesomeIcon icon={faImage} className="w-8 h-8 mb-2 text-gray-400" />
              <p className="text-sm text-gray-500"><span className="font-semibold">클릭하여 파일 업로드</span></p>
              <p className="text-xs text-gray-500">PNG, JPG, HEIC, MP4, MOV (최대 50MB, 동영상 3분, 1개)</p>
            </label>

            {/* 개인정보 노출 경고 */}
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-700 flex items-start">
                <span className="mr-1.5 mt-0.5">⚠️</span>
                <span>사진에 개인정보(차량번호, 주민번호 등)가 포함되지 않도록 주의해주세요.</span>
              </p>
            </div>
            <input
              id="imageInput"
              type="file"
              accept={`${getAcceptedFileTypes()},.heic,.heif,image/heic,image/heif,video/*`}
              multiple
              className="hidden"
              onChange={handleFileChange}
            />


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
              <div className="mt-4 space-y-3">
                {/* 미리보기 모드 토글 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">미리보기</span>
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('feed')}
                      className={`px-3 py-1 text-xs rounded-md transition-all ${
                        previewMode === 'feed'
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      피드 (4:5)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('fullscreen')}
                      className={`px-3 py-1 text-xs rounded-md transition-all ${
                        previewMode === 'fullscreen'
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      전체보기 (9:16)
                    </button>
                  </div>
                </div>

                {/* 메인 미리보기 */}
                {(() => {
                  const safeIndex = Math.min(currentPreviewIndex, previewImages.length - 1);
                  const preview = previewImages[safeIndex];
                  const isStream = preview?.type === 'video/stream';
                  const previewUrl = typeof preview === 'string' ? preview : preview?.url;
                  const aspectClass = previewMode === 'feed' ? 'aspect-[4/5] bg-gray-100' : 'aspect-[9/16] bg-black';

                  return (
                    <div className={`relative w-full ${aspectClass} rounded-xl overflow-hidden`}>
                      {isStream ? (
                        <div className="relative w-full h-full bg-gray-900">
                          <img
                            src={previewUrl}
                            alt="동영상 썸네일"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-40">
                            <div className="bg-purple-600 rounded-full p-4 mb-2">
                              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                              </svg>
                            </div>
                            <span className="text-white text-sm">동영상</span>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={previewUrl}
                          alt="미리보기"
                          className="w-full h-full object-cover"
                        />
                      )}
                      {/* 이미지 카운터 */}
                      {previewImages.length > 1 && (
                        <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full">
                          {safeIndex + 1} / {previewImages.length}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 삭제 가능한 썸네일 목록 (하단) - 클릭으로 전환 */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {previewImages.map((preview, index) => {
                    const isStream = preview?.type === 'video/stream';
                    const previewUrl = typeof preview === 'string' ? preview : preview?.url;
                    const isSelected = index === Math.min(currentPreviewIndex, previewImages.length - 1);

                    return (
                      <div
                        key={index}
                        className={`relative flex-shrink-0 w-16 h-20 group cursor-pointer transition-all ${
                          isSelected ? 'ring-2 ring-orange-500 ring-offset-1' : 'opacity-70 hover:opacity-100'
                        }`}
                        onClick={() => setCurrentPreviewIndex(index)}
                      >
                        {isStream ? (
                          <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                          </div>
                        ) : (
                          <img
                            src={previewUrl}
                            alt={`썸네일 ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(index);
                            // 삭제 후 인덱스 조정
                            if (currentPreviewIndex >= previewImages.length - 1) {
                              setCurrentPreviewIndex(Math.max(0, previewImages.length - 2));
                            }
                          }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-80 hover:opacity-100 shadow-md"
                        >
                          <FontAwesomeIcon icon={faTimes} className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
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
                className={`w-full h-[180px] p-4 pb-6 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                  isListening ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
                value={desc}
                onChange={(e) => {
                  // 200자 제한 (한글 기준)
                  if (e.target.value.length <= 200) {
                    setDesc(e.target.value);
                  }
                }}
                maxLength={200}
              />
              {isListening && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 text-red-500 text-sm">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                  음성 인식 중...
                </div>
              )}
              {/* 글자 수 표시 */}
              <div className="absolute bottom-2 right-3 text-xs text-gray-400">
                {desc.length}/200
              </div>
            </div>

          </div>

          {/* 링크 미리보기 */}
          {linkPreview && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <FontAwesomeIcon icon={faLink} className="mr-2 text-blue-500" />링크 미리보기
              </label>
              {linkPreview.type === 'youtube' ? (
                <YouTubePreviewCard url={linkPreview.url} onRemove={removeLinkPreview} className="max-w-md" />
              ) : (
                <LinkPreviewCard url={linkPreview.url} onRemove={removeLinkPreview} className="max-w-md" />
              )}
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
              disabled={loading || videoUploadProgress || !desc.trim()}
              className={`flex-1 py-3 bg-gradient-to-r from-[#f97316] to-[#ec4899] text-white rounded-xl font-medium transition-all ${
                loading || videoUploadProgress || !desc.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
              }`}
            >
              {loading ? (
                <span className="inline-flex items-center">
                  <LoadingSpinner size={16} className="mr-2" />
                </span>
              ) : (
                <FontAwesomeIcon icon={faPaperPlane} className="mr-2 text-sm" />
              )}
              {isEditMode ? '수정 완료' : '게시하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostEditor;
