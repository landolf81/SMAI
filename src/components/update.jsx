// import React  from 'react'
import PropTypes from 'prop-types';
import ImageCropper from './ImageCropper';
import {
  compressImage,
  optimizeProfileImage,
  optimizeCoverImage,
  analyzeImageQuality,
  formatFileSize,
  uploadWithProgress
} from '../utils/imageOptimization';
import { convertImageToPng, isHeicFile, formatFileSize as formatSize } from '../utils/imageConverter';

import {  useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userService, storageService, verificationService } from '../services';
import { useQuery } from "@tanstack/react-query";
import VerificationRequestModal from './VerificationRequestModal';
import VerificationCodeModal from './VerificationCodeModal';

const Update = ({setOpenUpdate, user, onUpdateComplete, isUpdating, setIsUpdating}) => {

  const [profile, setProfile] = useState(null);
  const [showVerificationRequestModal, setShowVerificationRequestModal] = useState(false);
  const [showVerificationCodeModal, setShowVerificationCodeModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawConfirmText, setWithdrawConfirmText] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // 현재 사용자의 verified 상태 조회 (실시간)
  const { data: currentUserData } = useQuery({
    queryKey: ['currentUserVerified', user?.id],
    queryFn: () => userService.getUser(user?.id),
    enabled: !!user?.id
  });

  // 인증 상태 (DB에서 가져온 최신 값 우선, true만 인정)
  const isVerified = currentUserData?.verified === true || user?.verified === true;

  // 인증 요청 상태 조회
  const { data: verificationRequest } = useQuery({
    queryKey: ['myVerificationRequest'],
    queryFn: () => verificationService.getMyRequest(),
    enabled: !isVerified
  });
  const [cover, setCover] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [showProfileCropper, setShowProfileCropper] = useState(false);
  const [showCoverCropper, setShowCoverCropper] = useState(false);
  const [originalProfileImage, setOriginalProfileImage] = useState(null);
  const [originalCoverImage, setOriginalCoverImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // 업로드 진행률 및 최적화 관련 상태
  const [uploadProgress, setUploadProgress] = useState({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationInfo, setOptimizationInfo] = useState({});
  const [showOptimizationDetails, setShowOptimizationDetails] = useState(false);
  

  const [info,setinfo] = useState({
    username:"",
    name:"",
    email:"",
    bio:"",
  });

  // 사용자 데이터로 폼 초기화 및 상태 초기화
  useEffect(() => {
    if (user) {
      setinfo({
        username: user.username || "",
        name: user.name || "",
        email: user.email || "",
        bio: user.bio || "",
      });
      // 모달이 열릴 때 상태 초기화
      setSuccessMessage('');
      setErrors({});
      setIsLoading(false);
      setProfile(null);
      setCover(null);
      setProfilePreview(null);
      setCoverPreview(null);
    }
  }, [user]);

  const handleChange =(e)=>{
    setinfo({...info,[e.target.name]: e.target.value});
    // 입력 시 해당 필드의 에러 제거
    if (errors[e.target.name]) {
      setErrors({...errors, [e.target.name]: null});
    }
  }

  // 폼 유효성 검증 함수
  const validateForm = () => {
    const newErrors = {};
    
    if (!info.name || info.name.trim().length < 2) {
      newErrors.name = '별명/닉네임은 2글자 이상 입력해주세요';
    }
    
    if (info.bio && info.bio.length > 200) {
      newErrors.bio = '소개는 200자 이하로 입력해주세요';
    }
    
    return newErrors;
  };

  // 파일 검증 함수 (개선된 버전 - HEIC 지원 추가)
  const validateFile = async (file) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    const maxSize = 20 * 1024 * 1024; // 20MB (HEIC 파일은 더 클 수 있음)

    // HEIC/HEIF 파일 확장자로도 검사
    const isHeic = isHeicFile(file);
    const isAllowedType = allowedTypes.includes(file.type.toLowerCase()) || isHeic;

    if (!isAllowedType) {
      return '지원되는 이미지 형식: JPEG, PNG, GIF, WebP, HEIC';
    }

    if (file.size > maxSize) {
      return '파일 크기는 20MB 이하여야 합니다';
    }

    return null;
  };

  // 이미지 최적화 및 분석
  const optimizeAndAnalyzeImage = async (file, type = 'profile') => {
    setIsOptimizing(true);
    
    try {
      // 이미지 품질 분석
      const analysis = await analyzeImageQuality(file);
      
      // 최적화 실행
      let optimizedFile;
      if (type === 'profile') {
        const optimized = await optimizeProfileImage(file);
        optimizedFile = optimized.medium; // 중간 크기 사용
      } else {
        const optimized = await optimizeCoverImage(file);
        optimizedFile = optimized.medium; // 중간 크기 사용
      }
      
      // 최적화 정보 저장
      setOptimizationInfo(prev => ({
        ...prev,
        [type]: {
          original: {
            size: formatFileSize(file.size),
            dimensions: `${analysis.metadata.width}x${analysis.metadata.height}`
          },
          optimized: {
            size: formatFileSize(optimizedFile.size),
            savings: analysis.recommendations.estimatedSavings
          },
          recommendations: analysis.recommendations
        }
      }));
      
      return optimizedFile;
    } catch (error) {
      console.error('이미지 최적화 실패:', error);
      return file; // 최적화 실패 시 원본 반환
    } finally {
      setIsOptimizing(false);
    }
  };

  // 프로필 사진 처리 (HEIC 변환 + 1024px PNG 변환 + 최적화 포함)
  const handleProfileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      setProfile(null);
      setProfilePreview(null);
      setOriginalProfileImage(null);
      setErrors({...errors, profile: null});
      setOptimizationInfo(prev => ({ ...prev, profile: null }));
      return;
    }

    const error = await validateFile(file);
    if (error) {
      setErrors({...errors, profile: error});
      setProfile(null);
      setProfilePreview(null);
      setOriginalProfileImage(null);
      return;
    }

    setErrors({...errors, profile: null});
    setIsOptimizing(true);

    try {
      // 1단계: HEIC 파일이면 PNG로 변환, 아니면 1024px PNG로 변환
      let processedFile = file;
      if (isHeicFile(file)) {
        console.log(`📱 HEIC 프로필 이미지 변환 시작: ${file.name} (${formatSize(file.size)})`);
      } else {
        console.log(`🖼️ 프로필 이미지 변환 시작: ${file.name} (${formatSize(file.size)})`);
      }

      processedFile = await convertImageToPng(file, {
        maxWidth: 1024,
        onProgress: (progress, status) => {
          console.log(`  └ ${status} (${progress}%)`);
        }
      });

      console.log(`✅ 프로필 이미지 변환 완료: ${processedFile.name} (${formatSize(processedFile.size)})`);

      // 2단계: 미리보기 생성
      const reader = new FileReader();
      reader.onload = (e) => {
        setOriginalProfileImage(e.target.result);
        setProfilePreview(e.target.result);
      };
      reader.readAsDataURL(processedFile);

      // 3단계: 추가 최적화 (프로필 이미지 전용)
      const optimizedFile = await optimizeAndAnalyzeImage(processedFile, 'profile');
      setProfile(optimizedFile);
    } catch (error) {
      console.error('이미지 처리 중 오류:', error);
      if (isHeicFile(file)) {
        setErrors({...errors, profile: 'HEIC 이미지 변환에 실패했습니다. 다른 형식의 이미지를 사용해주세요.'});
      } else {
        // HEIC가 아닌 경우 원본 사용 시도
        const reader = new FileReader();
        reader.onload = (e) => {
          setOriginalProfileImage(e.target.result);
          setProfilePreview(e.target.result);
        };
        reader.readAsDataURL(file);
        setProfile(file);
      }
    } finally {
      setIsOptimizing(false);
    }
  };

  // 커버 사진 처리 (HEIC 변환 + 1024px PNG 변환 + 최적화 포함)
  const handleCoverChange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      setCover(null);
      setCoverPreview(null);
      setOriginalCoverImage(null);
      setErrors({...errors, cover: null});
      setOptimizationInfo(prev => ({ ...prev, cover: null }));
      return;
    }

    const error = await validateFile(file);
    if (error) {
      setErrors({...errors, cover: error});
      setCover(null);
      setCoverPreview(null);
      setOriginalCoverImage(null);
      return;
    }

    setErrors({...errors, cover: null});
    setIsOptimizing(true);

    try {
      // 1단계: HEIC 파일이면 PNG로 변환, 아니면 1024px PNG로 변환
      let processedFile = file;
      if (isHeicFile(file)) {
        console.log(`📱 HEIC 커버 이미지 변환 시작: ${file.name} (${formatSize(file.size)})`);
      } else {
        console.log(`🖼️ 커버 이미지 변환 시작: ${file.name} (${formatSize(file.size)})`);
      }

      processedFile = await convertImageToPng(file, {
        maxWidth: 1024,
        onProgress: (progress, status) => {
          console.log(`  └ ${status} (${progress}%)`);
        }
      });

      console.log(`✅ 커버 이미지 변환 완료: ${processedFile.name} (${formatSize(processedFile.size)})`);

      // 2단계: 미리보기 생성
      const reader = new FileReader();
      reader.onload = (e) => {
        setOriginalCoverImage(e.target.result);
        setCoverPreview(e.target.result);
      };
      reader.readAsDataURL(processedFile);

      // 3단계: 추가 최적화 (커버 이미지 전용)
      const optimizedFile = await optimizeAndAnalyzeImage(processedFile, 'cover');
      setCover(optimizedFile);
    } catch (error) {
      console.error('이미지 처리 중 오류:', error);
      if (isHeicFile(file)) {
        setErrors({...errors, cover: 'HEIC 이미지 변환에 실패했습니다. 다른 형식의 이미지를 사용해주세요.'});
      } else {
        // HEIC가 아닌 경우 원본 사용 시도
        const reader = new FileReader();
        reader.onload = (e) => {
          setOriginalCoverImage(e.target.result);
          setCoverPreview(e.target.result);
        };
        reader.readAsDataURL(file);
        setCover(file);
      }
    } finally {
      setIsOptimizing(false);
    }
  };

  // 프로필 크롭 완료 처리
  const handleProfileCropComplete = (croppedBlob) => {
    setProfile(croppedBlob);
    
    // 크롭된 이미지의 미리보기 생성
    const reader = new FileReader();
    reader.onload = (e) => {
      setProfilePreview(e.target.result);
    };
    reader.readAsDataURL(croppedBlob);
    
    setShowProfileCropper(false);
  };

  // 커버 크롭 완료 처리
  const handleCoverCropComplete = (croppedBlob) => {
    setCover(croppedBlob);
    
    // 크롭된 이미지의 미리보기 생성
    const reader = new FileReader();
    reader.onload = (e) => {
      setCoverPreview(e.target.result);
    };
    reader.readAsDataURL(croppedBlob);
    
    setShowCoverCropper(false);
  };

  // Supabase Storage를 사용한 아바타 업로드
  const uploadAvatar = async(file, type = 'profile')=>{
    try {
      // Blob을 File 객체로 변환 (name 속성 추가)
      let fileToUpload = file;
      if (file instanceof Blob && !(file instanceof File)) {
        const extension = file.type.split('/')[1] || 'webp';
        fileToUpload = new File([file], `${type}.${extension}`, { type: file.type });
      }

      console.log(`${type} 이미지 업로드 시작:`, fileToUpload.name, fileToUpload.size);
      const uploadResult = await storageService.uploadAvatar(fileToUpload, type);
      console.log(`${type} 이미지 업로드 완료:`, uploadResult.url);
      return uploadResult.url;
    } catch (err) {
      console.error(`${type} 이미지 업로드 실패:`, err);
      throw err;
    }
  }


  
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (userData) => {
      console.log('사용자 데이터 업데이트 요청:', userData);

      try {
        const response = await userService.updateProfile(userData);
        console.log('업데이트 성공 응답:', response);
        return response;
      } catch (error) {
        console.error('업데이트 실패:', error);
        console.error('에러 응답:', error.response?.data);
        console.error('에러 상태:', error.response?.status);
        throw error;
      }
    },
    onMutate: async (updatedUserData) => {
      // Optimistic update를 위해 기존 쿼리를 취소
      await queryClient.cancelQueries({ queryKey: ['user', user.id] });
      
      // 이전 데이터 백업
      const previousUserData = queryClient.getQueryData(['user', user.id]);
      
      // Optimistic update 적용
      queryClient.setQueryData(['user', user.id], (old) => {
        return { ...old, ...updatedUserData };
      });
      
      console.log('Optimistic update 적용:', updatedUserData);
      
      // 백업 데이터 반환 (롤백용)
      return { previousUserData };
    },
    onSuccess: (response, variables, context) => {
      console.log('✅ 프로필 업데이트 성공!');
      console.log('성공 응답:', response);
      console.log('업데이트된 변수:', variables);

      setIsLoading(false);
      setSuccessMessage('프로필이 성공적으로 업데이트되었습니다!');

      // 관련된 모든 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['user', user.id] });
      queryClient.invalidateQueries({ queryKey: ['user'] }); // 모든 사용자 관련 쿼리
      queryClient.invalidateQueries({ queryKey: ['posts'] }); // 게시글 쿼리 (프로필 사진 반영)
      queryClient.invalidateQueries({ queryKey: ['enhanced-instagram-posts'] }); // Instagram 스타일 게시글

      console.log('쿼리 무효화 완료, onUpdateComplete 콜백 확인:', !!onUpdateComplete);

      // 부모 컴포넌트에 업데이트 완료 알림
      if (onUpdateComplete) {
        console.log('onUpdateComplete 콜백 실행 예약 (1.5초 후)');
        setTimeout(() => {
          console.log('onUpdateComplete 콜백 실행 중...');
          onUpdateComplete();
        }, 1500);
      } else {
        console.log('onUpdateComplete 콜백이 없어서 기본 동작 실행');
        // 기본 동작 (onUpdateComplete가 없는 경우)
        setTimeout(() => {
          setSuccessMessage('');
          setOpenUpdate(false);
        }, 2000);
      }
    },
    onError: (error, variables, context) => {
      console.error('프로필 업데이트 실패:', error);
      setIsLoading(false);

      // Optimistic update 롤백
      if (context?.previousUserData) {
        queryClient.setQueryData(['user', user.id], context.previousUserData);
        console.log('Optimistic update 롤백 완료');
      }

      let errorMessage = '프로필 업데이트 중 오류가 발생했습니다.';

      // Supabase 에러 처리
      if (error.message?.includes('JWT') || error.message?.includes('auth')) {
        console.log('인증 오류 감지');
        errorMessage = '인증이 만료되었습니다. 페이지를 새로고침해주세요.';
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else if (error.message) {
        errorMessage = error.message;
      }

      setErrors({...errors, submit: errorMessage});
    },
    onSettled: () => {
      // 최종적으로 모든 관련 쿼리를 다시 fetch
      console.log('mutation settled, 로딩 상태 종료');
      setIsLoading(false); // 확실하게 로딩 종료
      queryClient.invalidateQueries({ queryKey: ['user', user.id] });
    },
  });
  

  const  handleSubmit = async (e) => {
    e.preventDefault();

    console.log('프로필 업데이트 시작');
    console.log('현재 입력 데이터:', info);
    console.log('프로필 이미지:', profile);
    console.log('배경 이미지:', cover);
    console.log('현재 사용자:', user);
    console.log('입력된 정보:', info);
    console.log('프로필 파일:', profile);
    console.log('커버 파일:', cover);

    // 폼 유효성 검증
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors({...errors, ...formErrors});
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      let coverUrl = user.coverPic || user.cover_pic;
      let profileUrl = user.profilePic || user.profile_pic;

      // 커버 사진 업로드 (Supabase Storage)
      if (cover) {
        console.log('커버 사진 업로드 중...');
        coverUrl = await uploadAvatar(cover, 'cover');
        console.log('커버 사진 업로드 완료:', coverUrl);
      }

      // 프로필 사진 업로드 (Supabase Storage)
      if (profile) {
        console.log('프로필 사진 업로드 중...');
        profileUrl = await uploadAvatar(profile, 'profile');
        console.log('프로필 사진 업로드 완료:', profileUrl);
      }

      const updateData = {
        name: info.name,
        bio: info.bio,
        coverPic: coverUrl,
        profilePic: profileUrl
      };

      console.log('최종 업데이트 데이터:', updateData);

      // mutation을 기다리지 않고 바로 호출
      // 로딩 상태는 mutation 콜백에서 처리
      console.log('mutation.mutate 호출 전, 로딩 상태:', isLoading);
      mutation.mutate(updateData);
      console.log('mutation.mutate 호출 후');
    } catch (error) {
      console.error('파일 업로드 중 오류:', error);
      setIsLoading(false);

      let errorMessage = '파일 업로드 중 오류가 발생했습니다.';
      if (error.message?.includes('JWT')) {
        errorMessage = '인증이 만료되었습니다. 페이지를 새로고침 후 다시 로그인해주세요.';
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else if (error.message) {
        errorMessage = error.message;
      }

      setErrors({...errors, submit: errorMessage});
    }
  };




  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 - 진한 녹색 그라데이션 */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-600 text-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold">프로필 설정</h1>
                <p className="text-emerald-100 text-sm">내 정보를 수정해보세요</p>
              </div>
            </div>
            <button
              onClick={() => {
                setOpenUpdate(false);
                setIsUpdating(false);
              }}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* 컨텐츠 - 스크롤 가능 */}
        <div className="flex-1 overflow-y-auto p-6">
      
          {/* 성공 메시지 */}
          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">
              <span>{successMessage}</span>
            </div>
          )}
          
          {/* 전체 에러 메시지 */}
          {errors.submit && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
              <span>{errors.submit}</span>
            </div>
          )}

          <form className="space-y-6">
            {/* 사용자명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                사용자명
                <span className="text-xs text-gray-400 ml-2">(변경 불가)</span>
              </label>
              <input
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 cursor-not-allowed text-gray-500"
                type="text"
                placeholder="사용자명"
                name="username"
                value={info.username}
                onChange={handleChange}
                disabled
              />
            </div>

            {/* 별명/닉네임 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                별명/닉네임 <span className="text-red-500">*</span>
                {!isVerified && (
                  <span className="text-xs text-gray-500 ml-2">(인증 후 변경 가능)</span>
                )}
              </label>
              <input
                className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 ${
                  !isVerified
                    ? 'bg-gray-100 cursor-not-allowed border-gray-200'
                    : errors.name
                      ? 'border-red-400 focus:ring-2 focus:ring-red-500/20 focus:border-red-500'
                      : 'border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                }`}
                type="text"
                placeholder={isVerified ? "사용할 별명이나 닉네임을 입력하세요" : "인증 후 변경 가능합니다"}
                name="name"
                value={info.name}
                onChange={handleChange}
                disabled={!isVerified}
                required
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
              {/* 인증 안내 */}
              {!isVerified && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  {!verificationRequest && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-yellow-700">별명을 수정하려면 인증이 필요합니다.</span>
                      <button
                        type="button"
                        onClick={() => setShowVerificationRequestModal(true)}
                        className="text-xs font-medium text-yellow-700 underline hover:text-yellow-800"
                      >
                        인증 요청
                      </button>
                    </div>
                  )}
                  {verificationRequest?.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      <span className="text-xs text-blue-700">인증 요청 검토 중입니다...</span>
                    </div>
                  )}
                  {verificationRequest?.status === 'code_sent' && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-green-700">인증 코드가 발송되었습니다.</span>
                      <button
                        type="button"
                        onClick={() => setShowVerificationCodeModal(true)}
                        className="text-xs font-medium text-green-700 underline hover:text-green-800"
                      >
                        코드 입력
                      </button>
                    </div>
                  )}
                  {verificationRequest?.status === 'rejected' && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-red-700">
                        인증 거부됨{verificationRequest.rejection_reason ? `: ${verificationRequest.rejection_reason}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowVerificationRequestModal(true)}
                        className="text-xs font-medium text-red-700 underline hover:text-red-800"
                      >
                        다시 요청
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이메일
                <span className="text-xs text-gray-400 ml-2">(변경 불가)</span>
              </label>
              <input
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 cursor-not-allowed text-gray-500"
                type="email"
                placeholder="admin@test.com"
                name="email"
                value={info.email}
                onChange={handleChange}
                disabled
              />
            </div>

            {/* 소개 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                소개
              </label>
              <textarea
                className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 resize-none ${
                  errors.bio ? 'border-red-400' : 'border-gray-200'
                }`}
                name="bio"
                placeholder="자기소개를 입력하세요
(최대 200자)"
                value={info.bio}
                onChange={handleChange}
                maxLength="200"
                rows="3"
              />
              <div className="flex justify-between items-center mt-1">
                {errors.bio && (
                  <p className="text-red-500 text-xs">{errors.bio}</p>
                )}
                <p className="text-xs text-gray-500 ml-auto">{info.bio ? info.bio.length : 0}/200자</p>
              </div>
            </div>

            {/* 프로필 사진 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                프로필 사진
              </label>
              <div className="flex items-start space-x-4">
                {profilePreview && (
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-300">
                      <img 
                        src={profilePreview} 
                        alt="프로필 미리보기" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowProfileCropper(true)}
                      className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-md border border-gray-200 hover:bg-gray-50"
                      disabled={!originalProfileImage}
                      title="이미지 자르기"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
                <div className="flex-1">
                  <label className="cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white px-5 py-2.5 rounded-xl inline-flex items-center transition-all duration-200 shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    사진 선택
                    <input
                      className="hidden"
                      type="file"
                      accept="image/*,.heic,.heif"
                      onChange={handleProfileChange}
                    />
                  </label>
                  {!profilePreview && (
                    <p className="text-xs text-gray-400 mt-2">프로필 사진을 선택해주세요</p>
                  )}
                </div>
              </div>
              {errors.profile && (
                <p className="text-red-500 text-xs mt-2">{errors.profile}</p>
              )}
            </div>

            {/* 배경 사진 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                배경 사진
              </label>
              <div className="space-y-3">
                {coverPreview && (
                  <div className="relative">
                    <div className="w-full h-32 rounded-lg overflow-hidden border-2 border-gray-300">
                      <img 
                        src={coverPreview} 
                        alt="배경 미리보기" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCoverCropper(true)}
                      className="absolute top-2 right-2 bg-white rounded-lg p-1.5 shadow-md border border-gray-200 hover:bg-gray-50"
                      disabled={!originalCoverImage}
                      title="이미지 자르기"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )}
                <label className="cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white px-5 py-2.5 rounded-xl inline-flex items-center transition-all duration-200 shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  사진 선택
                  <input
                    className="hidden"
                    type="file"
                    accept="image/*,.heic,.heif"
                    onChange={handleCoverChange}
                  />
                </label>
                {!coverPreview && (
                  <p className="text-xs text-gray-400">배경 사진을 선택해주세요</p>
                )}
              </div>
              {errors.cover && (
                <p className="text-red-500 text-xs mt-2">{errors.cover}</p>
              )}
            </div>

          </form>
        </div>

        {/* 하단 버튼 - 모바일 네비게이션 메뉴와 겹치지 않도록 padding 추가 */}
        <div className="border-t border-gray-200 p-6 pb-20 bg-gradient-to-b from-gray-50 to-white">
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              className={`flex-1 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-blue-600 hover:shadow-blue-600/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ${
                isLoading ? 'animate-pulse' : ''
              }`}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  업데이트 중...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  수정 완료
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setOpenUpdate(false);
                setIsUpdating(false);
              }}
              className="px-6 py-3.5 bg-white text-gray-600 border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
              disabled={isLoading}
            >
              취소
            </button>
          </div>

          {/* 회원탈퇴 버튼 - 붉은색 강조 */}
          <div className="mt-6 pt-5 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowWithdrawModal(true)}
              className="w-full py-3 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              회원탈퇴
            </button>
          </div>
        </div>
      </div>

      {/* 프로필 이미지 크롭 모달 */}
      {showProfileCropper && originalProfileImage && (
        <ImageCropper
          imageSrc={originalProfileImage}
          onCropComplete={handleProfileCropComplete}
          onCancel={() => setShowProfileCropper(false)}
          aspectRatio={1} // 정사각형
        />
      )}

      {/* 커버 이미지 크롭 모달 */}
      {showCoverCropper && originalCoverImage && (
        <ImageCropper
          imageSrc={originalCoverImage}
          onCropComplete={handleCoverCropComplete}
          onCancel={() => setShowCoverCropper(false)}
          aspectRatio={2} // 2:1 비율
        />
      )}

      {/* 인증 요청 모달 */}
      <VerificationRequestModal
        isOpen={showVerificationRequestModal}
        onClose={() => setShowVerificationRequestModal(false)}
      />

      {/* 인증 코드 입력 모달 */}
      <VerificationCodeModal
        isOpen={showVerificationCodeModal}
        onClose={() => setShowVerificationCodeModal(false)}
        onSuccess={() => {
          setShowVerificationCodeModal(false);
          // 인증 완료 후 모달 닫기 및 페이지 새로고침
          setOpenUpdate(false);
          window.location.reload();
        }}
      />

      {/* 회원탈퇴 확인 모달 */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-4">
              <h2 className="text-xl font-bold">회원탈퇴</h2>
            </div>

            <div className="p-6">
              {/* 경고 메시지 */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⚠️</div>
                  <div>
                    <h4 className="font-medium text-red-800 mb-1">탈퇴 시 주의사항</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      <li>• 작성한 게시글과 댓글은 <strong>삭제되지 않습니다</strong></li>
                      <li>• 작성자 정보는 "탈퇴한 사용자"로 표시됩니다</li>
                      <li>• 개인정보(이름, 연락처 등)는 즉시 삭제됩니다</li>
                      <li>• 탈퇴 후 동일 계정으로 재가입이 불가합니다</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 확인 입력 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  탈퇴를 진행하려면 <span className="text-red-600 font-bold">"탈퇴합니다"</span>를 입력하세요
                </label>
                <input
                  type="text"
                  value={withdrawConfirmText}
                  onChange={(e) => setWithdrawConfirmText(e.target.value)}
                  placeholder="탈퇴합니다"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              {/* 버튼 */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setWithdrawConfirmText('');
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  disabled={isWithdrawing}
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    if (withdrawConfirmText !== '탈퇴합니다') {
                      alert('"탈퇴합니다"를 정확히 입력해주세요.');
                      return;
                    }
                    setIsWithdrawing(true);
                    try {
                      await userService.withdrawAccount();
                      alert('회원탈퇴가 완료되었습니다. 이용해주셔서 감사합니다.');
                      window.location.href = '/';
                    } catch (error) {
                      alert(error.message || '탈퇴 처리 중 오류가 발생했습니다.');
                      setIsWithdrawing(false);
                    }
                  }}
                  disabled={withdrawConfirmText !== '탈퇴합니다' || isWithdrawing}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isWithdrawing ? '처리 중...' : '탈퇴하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

Update.propTypes = {
  setOpenUpdate: PropTypes.func.isRequired, // Define prop type for setOpenUpdate
  user: PropTypes.object.isRequired,
  onUpdateComplete: PropTypes.func, // Optional callback for update completion
  isUpdating: PropTypes.bool, // External updating state
  setIsUpdating: PropTypes.func, // External updating state setter
};

export default Update
