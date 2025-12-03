import { useState, useContext, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faPaperPlane, faTimes, faArrowLeft, faLink } from '@fortawesome/free-solid-svg-icons';
import { getFirstLinkInfo } from '../utils/linkDetector';
import { YouTubePreviewCard } from '../components/YouTubeEmbed';
import { postService, storageService } from '../services';
import { compressImage, validateVideoSize } from '../utils/imageCompression';
import { compressVideo, checkVideoNeedsCompression, isVideoCompressionSupported } from '../utils/videoCompressor';
import { getMediaType, validateUploadFile, getAcceptedFileTypes } from '../utils/mediaUtils';
import { convertImageToPng, isImageFile, isHeicFile, formatFileSize } from '../utils/imageConverter';
import { v4 as uuidv4 } from 'uuid';

const PostEditor = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const { id } = useParams(); // 수정 모드일 때 게시글 ID
  const location = useLocation();
  const queryClient = useQueryClient();

  const isEditMode = !!id;

  // URL 파라미터에서 post_type 추출
  const urlParams = new URLSearchParams(location.search);
  const postTypeParam = urlParams.get('type'); // 'qna', 'secondhand', 'general'
  const [postType, setPostType] = useState(postTypeParam || 'general');

  // 상태 관리
  const [files, setFiles] = useState([]);
  const [desc, setDesc] = useState('');
  const [title, setTitle] = useState(''); // QnA용 제목
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewImages, setPreviewImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [gpsData, setGpsData] = useState(null); // GPS 정보 상태
  const [imageConvertProgress, setImageConvertProgress] = useState(null); // 이미지 변환 진행 상태
  const [videoCompressProgress, setVideoCompressProgress] = useState(null); // 동영상 압축 진행 상태

  // 링크 미리보기 상태
  const [linkPreview, setLinkPreview] = useState(null);
  const [showLinkPreview, setShowLinkPreview] = useState(true);

  // 수정 모드일 때 기존 게시글 데이터 불러오기 (Supabase)
  const { data: postData } = useQuery({
    queryKey: ['post', id],
    queryFn: () => postService.getPost(id),
    enabled: isEditMode
  });

  // 게시글 데이터로 폼 초기화
  useEffect(() => {
    if (postData && isEditMode) {
      setDesc(postData.Desc || postData.desc || '');

      // 기존 이미지 설정
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

    // 디바운스를 위한 타이머
    const timer = setTimeout(() => {
      const linkInfo = getFirstLinkInfo(desc);
      if (linkInfo) {
        console.log('링크 감지:', linkInfo);
        setLinkPreview(linkInfo);
      } else if (linkInfo) {
        console.log('일반 링크 감지:', linkInfo);
        // 나중에 일반 링크 처리 추가
        setLinkPreview(null);
      } else {
        setLinkPreview(null);
      }
    }, 500); // 500ms 디바운스

    return () => clearTimeout(timer);
  }, [desc, showLinkPreview]);


  // 게시물 생성 mutation (Supabase)
  const createMutation = useMutation({
    mutationFn: async (newPost) => {
      console.log('=== 게시물 작성 시작 ===');
      console.log('입력된 데이터:', newPost);
      console.log('선택된 파일들:', files);

      // 1. Generate unique post ID
      const postId = uuidv4();

      // 2. Compress images and validate videos before upload
      let processedFiles = [];
      if (files.length > 0) {
        console.log('파일 처리 시작...');
        for (const file of files) {
          const mediaType = getMediaType(file);

          if (mediaType.isImage) {
            // 이미지 압축 (1080px, 80% quality)
            const compressedImage = await compressImage(file);
            processedFiles.push(compressedImage);
            console.log(`이미지 압축: ${file.name} (${file.size} → ${compressedImage.size})`);
          } else if (mediaType.isVideo) {
            // 동영상 크기 검증 (50MB 제한)
            const validation = validateVideoSize(file);
            if (!validation.valid) {
              throw new Error(validation.message);
            }
            processedFiles.push(file);
            console.log(`동영상 검증 통과: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
          } else {
            processedFiles.push(file);
          }
        }
      }

      // 3. Upload processed files to Supabase Storage
      let imageUrls = [];
      if (processedFiles.length > 0) {
        console.log('파일 업로드 시작...');
        const uploadResults = await storageService.uploadPostImages(postId, processedFiles);
        imageUrls = uploadResults.map(result => result.url);
        console.log('업로드된 파일들:', imageUrls);
      }

      // 4. Create post data
      let finalContent = newPost.desc;
      let finalTitle = newPost.title;

      // 사고팔고 게시글: 첫 줄을 제목으로 자동 분리
      if (postType === 'secondhand' && newPost.desc) {
        const lines = newPost.desc.split('\n');
        finalTitle = lines[0].trim(); // 첫 줄을 제목으로
        finalContent = lines.slice(1).join('\n').trim(); // 나머지를 내용으로
        console.log('사고팔고 제목 자동 분리:', finalTitle);
      }

      const postData = {
        content: finalContent,  // postService expects 'content'
        // 다중 이미지를 JSON 배열로 저장
        img: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        images: imageUrls,
        post_type: postType,  // 'general', 'qna', 'secondhand'
        // 링크 정보 추가
        link_url: linkPreview?.url || null,
        link_type: linkPreview?.type || null
      };

      console.log('📤 게시물 데이터 전송:', {
        link_url: postData.link_url,
        link_type: postData.link_type,
        linkPreview: linkPreview
      });

      // QnA 또는 사고팔고 타입일 경우 제목 추가
      if (postType === 'qna' && newPost.title) {
        postData.title = newPost.title;
        // 내용을 [Q&A] 형식으로 포맷팅
        postData.content = `[Q&A] ${newPost.title}\n\n${newPost.desc}`;
        console.log('QnA 제목 추가됨:', newPost.title);
      } else if (postType === 'secondhand' && finalTitle) {
        postData.title = finalTitle;
        console.log('사고팔고 제목 저장:', finalTitle);
      }

      // GPS 정보 추가
      if (gpsData) {
        postData.latitude = gpsData.latitude;
        postData.longitude = gpsData.longitude;
        postData.location_accuracy = gpsData.accuracy;
        postData.location_timestamp = gpsData.timestamp;
        postData.location_source = gpsData.source;
        console.log('GPS 정보 게시물에 추가됨:', gpsData);
      }

      // 링크 미리보기 정보 추가
      if (linkPreview) {
        postData.link_url = linkPreview.url;
        postData.link_type = linkPreview.type;
        if (linkPreview.type === 'youtube' && linkPreview.videoId) {
          postData.link_video_id = linkPreview.videoId;
          postData.link_thumbnail = linkPreview.thumbnailUrl;
        }
        console.log('링크 정보 추가됨:', linkPreview);
      }

      console.log('최종 전송 데이터:', postData);
      console.log('API 요청 시작...');

      // 4. Create post with Supabase (tags are handled in createPost)
      const createdPost = await postService.createPost(postData);

      console.log('게시물 작성 완료:', createdPost);
      return createdPost;
    },
    onSuccess: async (response) => {
      console.log('✅ 게시물 작성 성공:', response);

      // 모든 관련 쿼리 무효화
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      await queryClient.invalidateQueries({ queryKey: ['enhanced-instagram-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['user-posts'] });

      console.log('모든 게시물 관련 쿼리 무효화 완료, 페이지 이동 시작...');

      // post_type에 따라 적절한 페이지로 이동
      let redirectPath = '/community'; // 기본값

      if (postType === 'qna') {
        redirectPath = '/qna';
      } else if (postType === 'secondhand') {
        redirectPath = '/secondhand';
      }

      // 약간의 지연 후 이동 (캐시 무효화 처리 시간 확보)
      setTimeout(() => {
        navigate(redirectPath);
      }, 100);
    },
    onError: (error) => {
      console.error('❌ 게시물 작성 실패:', error);
      console.error('에러 메시지:', error.message);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.response?.data || error.message || '게시물 작성에 실패했습니다.';
      setError(errorMessage);
    }
  });

  // 게시물 수정 mutation
  const updateMutation = useMutation({
    mutationFn: async (updatedPost) => {
      const uploadedImages = files.length > 0 ? await uploadFiles(files) : [];
      const allImages = [...existingImages, ...uploadedImages];
      
      const postData = {
        content: updatedPost.desc,  // postService expects 'content'
        img: allImages[0] || '',
        images: allImages
      };
      
      // GPS 정보 추가 (수정 시에도)
      if (gpsData) {
        postData.latitude = gpsData.latitude;
        postData.longitude = gpsData.longitude;
        postData.location_accuracy = gpsData.accuracy;
        postData.location_timestamp = gpsData.timestamp;
        postData.location_source = gpsData.source;
        console.log('GPS 정보 수정 게시물에 추가됨:', gpsData);
      }
      
      
      // 링크 미리보기 정보 추가
      if (linkPreview) {
        postData.link_url = linkPreview.url;
        postData.link_type = linkPreview.type;
        if (linkPreview.type === 'youtube' && linkPreview.videoId) {
          postData.link_video_id = linkPreview.videoId;
          postData.link_thumbnail = linkPreview.thumbnailUrl;
        }
      }
      
      return makeRequest.put(`/posts/${id}`, postData);
    },
    onSuccess: () => {
      // 모든 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-instagram-posts'] });
      queryClient.invalidateQueries({ queryKey: ['user-posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      navigate('/community');
    },
    onError: (error) => {
      setError('게시물 수정에 실패했습니다.');
      console.error('게시물 수정 실패:', error);
    }
  });

  // 태그 선택/해제
  const toggleTag = (tagId) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  // 카테고리 선택 처리
  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    setSelectedTags([categoryId]);
    
    // 중고거래 태그 선택 시 거래 정보 입력창 표시
    const selectedTag = availableTags.find(tag => tag.id === categoryId);
    if (selectedTag && selectedTag.name === '중고거래') {
      setShowTradeInfo(true);
    } else {
      setShowTradeInfo(false);
      // 중고거래가 아니면 거래 정보 초기화
      setTradeInfo({
        itemName: '',
        quantity: '1',
        price: '',
        isNegotiable: false
      });
    }
  };

  // 파일 선택 시 미리보기 업데이트 (HEIC 지원 + 1024px PNG 변환)
  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    console.log('선택된 파일들:', selectedFiles.map(f => ({ name: f.name, type: f.type, size: f.size })));

    // 파일 분류: 이미지 vs 동영상
    const imageFiles = [];
    const videoFiles = [];
    const invalidFiles = [];

    for (const file of selectedFiles) {
      // HEIC/HEIF 파일도 이미지로 처리
      if (isImageFile(file) || isHeicFile(file)) {
        imageFiles.push(file);
      } else {
        const validation = validateUploadFile(file);
        if (validation.valid) {
          videoFiles.push(file);
        } else {
          invalidFiles.push(validation.message);
        }
      }
    }

    // 유효하지 않은 파일이 있으면 에러 표시
    if (invalidFiles.length > 0) {
      setError(invalidFiles.join('\n'));
      if (imageFiles.length === 0 && videoFiles.length === 0) return;
    }

    // GPS 정보 추출 (첫 번째 이미지에서, 변환 전에)
    if (imageFiles.length > 0) {
      try {
        // GPS 추출 모듈 동적 import
        const { extractGPSFromImage } = await import('../utils/gpsExtractor');
        const gpsData = await extractGPSFromImage(imageFiles[0]);

        if (gpsData) {
          console.log('📍 GPS 정보 추출됨:', gpsData);
          setGpsData(gpsData);
        } else {
          console.log('📍 GPS 정보 없음');
          setGpsData(null);
        }
      } catch (error) {
        console.error('GPS 추출 실패:', error);
        setGpsData(null);
      }
    }

    // 이미지 파일들을 1024px PNG로 변환
    const convertedImages = [];
    if (imageFiles.length > 0) {
      setImageConvertProgress({ current: 0, total: imageFiles.length, status: '이미지 변환 준비 중...' });

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        try {
          setImageConvertProgress({
            current: i + 1,
            total: imageFiles.length,
            status: `${file.name} 변환 중... (${i + 1}/${imageFiles.length})`
          });

          console.log(`🖼️ 이미지 변환 시작: ${file.name} (${formatFileSize(file.size)})`);

          const convertedFile = await convertImageToPng(file, {
            maxWidth: 1024,
            onProgress: (progress, status) => {
              console.log(`  └ ${status} (${progress}%)`);
            }
          });

          console.log(`✅ 이미지 변환 완료: ${convertedFile.name} (${formatFileSize(convertedFile.size)})`);
          convertedImages.push(convertedFile);
        } catch (error) {
          console.error(`❌ 이미지 변환 실패: ${file.name}`, error);
          // HEIC 파일이 아닌 경우 원본 사용
          if (!isHeicFile(file)) {
            console.log(`⚠️ 원본 파일 사용: ${file.name}`);
            convertedImages.push(file);
          } else {
            setError(`${file.name} 변환에 실패했습니다. 다른 이미지를 사용해주세요.`);
          }
        }
      }

      setImageConvertProgress(null);
    }

    // 동영상 파일 720p 압축
    const compressedVideos = [];
    if (videoFiles.length > 0 && isVideoCompressionSupported()) {
      for (let i = 0; i < videoFiles.length; i++) {
        const file = videoFiles[i];
        try {
          const videoInfo = await checkVideoNeedsCompression(file);

          if (videoInfo.needsCompression) {
            const heightInfo = videoInfo.height ? `${videoInfo.height}p` : '알 수 없음';
            const sizeInfo = videoInfo.sizeMB ? `${videoInfo.sizeMB.toFixed(1)}MB` : `${(file.size / 1024 / 1024).toFixed(1)}MB`;
            console.log(`🎬 동영상 압축 시작: ${file.name} (${heightInfo}, ${sizeInfo}) - ${videoInfo.reason || ''}`);
            setVideoCompressProgress({
              progress: 0,
              status: `동영상 변환 준비 중...`,
              fileName: file.name
            });

            const compressedVideo = await compressVideo(file, {
              maxHeight: 720,
              onProgress: (progress) => {
                setVideoCompressProgress({
                  progress,
                  status: `동영상 변환 중... ${progress}%`,
                  fileName: file.name
                });
              }
            });

            compressedVideos.push(compressedVideo);
            const originalMB = (file.size / 1024 / 1024).toFixed(2);
            const compressedMB = (compressedVideo.size / 1024 / 1024).toFixed(2);
            console.log(`✅ 동영상 변환 완료: ${originalMB}MB → ${compressedMB}MB`);
          } else {
            compressedVideos.push(file);
            const heightInfo = videoInfo.height ? `${videoInfo.height}p` : '알 수 없음';
            const sizeInfo = videoInfo.sizeMB ? `${videoInfo.sizeMB.toFixed(1)}MB` : `${(file.size / 1024 / 1024).toFixed(1)}MB`;
            console.log(`동영상 변환 불필요: ${file.name} (${heightInfo}, ${sizeInfo})`);
          }
        } catch (error) {
          console.error(`❌ 동영상 압축 실패: ${file.name}`, error);
          compressedVideos.push(file); // 압축 실패 시 원본 사용
        }
      }
      setVideoCompressProgress(null);
    } else {
      // 압축 미지원 시 원본 사용
      compressedVideos.push(...videoFiles);
    }

    // 변환된 이미지와 압축된 동영상 파일 합치기
    const allProcessedFiles = [...convertedImages, ...compressedVideos];

    setFiles(prev => [...prev, ...allProcessedFiles]);

    // 미리보기 생성 (파일 타입 정보 포함)
    const newPreviews = allProcessedFiles.map(file => ({
      url: URL.createObjectURL(file),
      type: file.type,
      name: file.name
    }));
    setPreviewImages(prev => [...prev, ...newPreviews]);
  };

  // 링크 미리보기 제거
  const removeLinkPreview = () => {
    setLinkPreview(null);
    setShowLinkPreview(false);
  };

  // 이미지 제거
  const removeImage = (index) => {
    if (index < existingImages.length) {
      // 기존 이미지 제거
      setExistingImages(prev => prev.filter((_, i) => i !== index));
      setPreviewImages(prev => prev.filter((_, i) => i !== index));
    } else {
      // 새로 추가한 이미지 제거
      const newFileIndex = index - existingImages.length;
      setFiles(prev => prev.filter((_, i) => i !== newFileIndex));
      setPreviewImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('=== 폼 제출 시작 ===');
    console.log('Post Type:', postType);
    setError('');

    // QnA 타입일 경우 제목 필수 검사
    if (postType === 'qna' && !title.trim()) {
      setError('질문 제목을 입력해주세요.');
      return;
    }

    // 내용 필수 검사
    if (!desc.trim()) {
      setError('내용을 입력해주세요.');
      return;
    }

    // QnA는 최소 20자 이상
    if (postType === 'qna' && desc.trim().length < 20) {
      setError('질문 내용을 최소 20자 이상 작성해주세요.');
      return;
    }

    // 일반/중고거래는 이미지나 YouTube 링크 중 하나는 있어야 함
    // QnA는 이미지 선택사항
    if (postType !== 'qna' && previewImages.length === 0 && !linkPreview) {
      setError('이미지, 동영상 또는 링크를 추가해주세요.');
      return;
    }

    console.log('✅ 유효성 검사 통과');
    setLoading(true);

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({ desc: desc.trim(), title: title.trim() });
      } else {
        await createMutation.mutateAsync({ desc: desc.trim(), title: title.trim() });
      }
    } catch (err) {
      console.error('Mutation 에러:', err);
      // 에러는 mutation의 onError에서 처리됨
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">
            {isEditMode
              ? '게시물 수정'
              : postType === 'qna'
                ? '새 질문 작성'
                : postType === 'secondhand'
                  ? '중고거래 글쓰기'
                  : '새 게시물'}
          </h1>
          <div className="w-5 h-5" /> {/* 균형을 위한 빈 공간 */}
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="max-w-2xl mx-auto p-4">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6">
          {/* 사용자 정보 */}
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-orange-400 p-0.5">
              <img
                src={currentUser.profilePic
                  ? `/uploads/posts/${currentUser.profilePic}`
                  : "/default/default_profile.png"
                }
                alt="프로필"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{currentUser.name}</p>
              <p className="text-sm text-gray-500">
                {isEditMode ? '게시물 수정 중' : '게시물 작성 중'}
              </p>
            </div>
          </div>

          {/* 카테고리 선택 제거됨 - 태그 시스템 비활성화 */}

          {/* QnA 전용: 질문 제목 */}
          {postType === 'qna' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                질문 제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="예: 참외 재배 시 물 주기는 어떻게 해야 하나요?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
              <div className="text-sm text-gray-500 mt-1">
                {title.length}/200자
              </div>
            </div>
          )}

          {/* 이미지/동영상 업로드 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <FontAwesomeIcon icon={faImage} className="mr-2 text-orange-500" />
              이미지 또는 동영상
              {postType === 'qna' ? (
                <span className="text-gray-500 ml-1">(선택사항)</span>
              ) : !linkPreview ? (
                <span className="text-red-500 ml-1">*</span>
              ) : (
                <span className="text-gray-500 ml-1">(선택사항)</span>
              )}
            </label>
            {linkPreview && (
              <p className="text-xs text-blue-600 mb-3">
                💡 YouTube 링크가 있어서 이미지 없이도 게시할 수 있습니다
              </p>
            )}
            
            {/* 업로드 버튼 */}
            <label
              htmlFor="imageInput"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-all"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <FontAwesomeIcon icon={faImage} className="w-8 h-8 mb-2 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">클릭하여 파일 업로드</span>
                </p>
                <p className="text-xs text-gray-500">PNG, JPG, HEIC, MP4, MOV 등 (최대 50MB)</p>
                <p className="text-xs text-green-600 mt-1">아이폰 사진(HEIC) 자동 변환 + 동영상 720p 자동 압축</p>
              </div>
            </label>
            <input
              id="imageInput"
              type="file"
              accept={`${getAcceptedFileTypes()},.heic,.heif,image/heic,image/heif`}
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {/* 이미지 변환 진행 상태 표시 */}
            {imageConvertProgress && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="loading loading-spinner loading-sm text-blue-500"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-700">
                      이미지 변환 중... ({imageConvertProgress.current}/{imageConvertProgress.total})
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {imageConvertProgress.status}
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(imageConvertProgress.current / imageConvertProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 동영상 압축 진행 상태 표시 */}
            {videoCompressProgress && (
              <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="loading loading-spinner loading-sm text-purple-500"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-purple-700">
                      동영상 720p 압축 중...
                    </div>
                    <div className="text-xs text-purple-600 mt-1">
                      {videoCompressProgress.fileName && `${videoCompressProgress.fileName} - `}{videoCompressProgress.status}
                    </div>
                    <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${videoCompressProgress.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 이미지/동영상 프리뷰 */}
            {previewImages.length > 0 && (
              <div className="mt-4">
                <div className="grid grid-cols-3 gap-2">
                  {previewImages.map((preview, index) => {
                    const isVideo = typeof preview === 'object' && preview.type && preview.type.startsWith('video/');
                    const isExisting = typeof preview === 'string';
                    const previewUrl = isExisting ? preview : preview.url;
                    const isVideoFile = isExisting ? previewUrl.toLowerCase().includes('.mp4') : isVideo;
                    
                    return (
                      <div key={index} className="relative">
                        {isVideoFile ? (
                          <video
                            src={previewUrl}
                            className="w-full h-auto object-contain rounded-lg"
                            controls
                            muted
                          >
                            동영상을 지원하지 않는 브라우저입니다.
                          </video>
                        ) : (
                          <img
                            src={previewUrl}
                            alt={`미리보기 ${index + 1}`}
                            className="w-full h-auto object-contain rounded-lg"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 w-7 h-7 bg-black bg-opacity-60 text-white rounded-full flex items-center justify-center hover:bg-opacity-80 transition-all"
                        >
                          <FontAwesomeIcon icon={faTimes} className="w-3 h-3" />
                        </button>
                        {isVideoFile && (
                          <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs">
                            동영상
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 내용 입력 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {postType === 'qna' ? '질문 내용' : '내용'} <span className="text-red-500">*</span>
            </label>
            <textarea
              placeholder={
                postType === 'qna'
                  ? '질문에 대해 자세히 설명해주세요. 상황, 문제점, 궁금한 점 등을 구체적으로 작성하시면 더 정확한 답변을 받을 수 있습니다.'
                  : postType === 'secondhand'
                    ? '중고 물품에 대해 자세히 설명해주세요. 상태, 사용 기간, 거래 방법 등을 작성해주세요.'
                    : '무슨 생각을 하고 계신가요?'
              }
              className="w-full min-h-[200px] p-4 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            {postType === 'qna' && (
              <div className="text-sm text-gray-500 mt-1">
                최소 20자 이상 작성해주세요. 현재: {desc.length}자
              </div>
            )}
            
            {/* GPS 정보 표시 */}
            {gpsData && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center text-sm text-blue-700">
                  <span className="mr-2">📍</span>
                  <span>위치 정보가 포함됩니다: {gpsData.latitude.toFixed(6)}, {gpsData.longitude.toFixed(6)}</span>
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  출처: {gpsData.source === 'exif' ? '사진 EXIF 데이터' : '브라우저 위치 정보'}
                  {gpsData.accuracy && ` (정확도: ±${Math.round(gpsData.accuracy)}m)`}
                </div>
              </div>
            )}
          </div>

          {/* 링크 미리보기 */}
          {linkPreview && linkPreview.type === 'youtube' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <FontAwesomeIcon icon={faLink} className="mr-2 text-blue-500" />
                링크 미리보기
              </label>
              <YouTubePreviewCard
                url={linkPreview.url}
                onRemove={removeLinkPreview}
                className="max-w-md"
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 게시물에 YouTube 동영상이 포함됩니다
              </p>
            </div>
          )}

          {/* 사고팔고 작성 안내 */}
          {postType === 'secondhand' && (
            <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl border-l-4 border-orange-400">
              <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center">
                💡 사고팔고 작성 팁
              </h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 제목에 물품명과 가격을 함께 적어주세요 (예: 트랙터 500만원)</li>
                <li>• 내용에 상세 설명, 상태, 지역 정보를 포함해주세요</li>
                <li>• 📍 지역 정보를 넣으면 자동으로 위치가 표시됩니다</li>
              </ul>
            </div>
          )}


          {/* 에러 메시지 */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            onClick={(e) => {
              console.log('제출 버튼 클릭됨');
              console.log('버튼 disabled 상태:', e.target.disabled);
              console.log('현재 상태들:', {
                loading,
                previewImagesCount: previewImages.length,
                descLength: desc.trim().length,
                selectedCategory
              });
            }}
            disabled={
              loading ||
              imageConvertProgress ||
              videoCompressProgress ||
              !desc.trim() ||
              (postType === 'qna' && !title.trim()) ||
              (postType === 'qna' && desc.trim().length < 20) ||
              (postType === 'secondhand' && previewImages.length === 0)
            }
            className={`w-full py-3 bg-orange-500 text-white rounded-xl font-medium transition-all ${
              loading ||
              imageConvertProgress ||
              videoCompressProgress ||
              !desc.trim() ||
              (postType === 'qna' && !title.trim()) ||
              (postType === 'qna' && desc.trim().length < 20) ||
              (postType === 'secondhand' && previewImages.length === 0)
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-orange-600'
            }`}
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm mr-2"></span>
            ) : (
              <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
            )}
            {isEditMode ? '수정 완료' : '게시하기'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PostEditor;