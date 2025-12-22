import React, { useState, useRef } from 'react';
import { storageService } from '../services';
import { v4 as uuidv4 } from 'uuid';
import LoadingSpinner from './LoadingSpinner';

const ImageUploader = ({
    onImageUploaded,
    currentImage = null,
    className = '',
    uploadType = 'generic', // 'generic', 'avatar', 'post', 'ad', 'badge', 'qna'
    resourceId = null // 선택적 리소스 ID (없으면 자동 생성)
}) => {
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(currentImage);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);

    // 파일 유효성 검사
    const validateFile = (file) => {
        const maxSize = 50 * 1024 * 1024; // 50MB
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

        if (!allowedTypes.includes(file.type)) {
            throw new Error('JPG, PNG, GIF, WebP 파일만 업로드 가능합니다.');
        }

        if (file.size > maxSize) {
            throw new Error('파일 크기는 50MB 이하여야 합니다.');
        }

        return true;
    };

    // 업로드 타입에 따른 적절한 storageService 메서드 선택
    const getUploadMethod = () => {
        switch (uploadType) {
            case 'avatar':
                return storageService.uploadAvatar;
            case 'post':
                return storageService.uploadPostImages;
            case 'ad':
                return storageService.uploadAdImage;
            case 'badge':
                return storageService.uploadBadgeIcon;
            case 'qna':
                return storageService.uploadQnAImages;
            default:
                return storageService.uploadAvatar; // 기본값
        }
    };

    // 파일 업로드 처리
    const handleFileUpload = async (file) => {
        try {
            validateFile(file);
            setUploading(true);
            setUploadProgress(30); // 시작

            // 미리보기 생성
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewUrl(e.target.result);
            };
            reader.readAsDataURL(file);

            // 리소스 ID 준비 (없으면 새로 생성)
            const id = resourceId || uuidv4();

            setUploadProgress(50); // 준비 완료

            // Supabase Storage에 업로드
            const uploadMethod = getUploadMethod();

            let result;
            if (uploadType === 'post' || uploadType === 'qna') {
                // 배열을 받는 메서드들
                const results = await uploadMethod(id, [file]);
                result = results[0];
            } else {
                // 단일 파일을 받는 메서드들
                result = await uploadMethod(id, file);
            }

            const imageUrl = result.url;

            setPreviewUrl(imageUrl);
            setUploadProgress(100);

            if (onImageUploaded) {
                onImageUploaded(imageUrl);
            }

        } catch (error) {
            console.error('❌ 이미지 업로드 실패:', error);
            alert(error.message || '이미지 업로드에 실패했습니다.');
            setPreviewUrl(currentImage); // 원래 이미지로 복원
        } finally {
            setUploading(false);
            setTimeout(() => setUploadProgress(0), 500);
        }
    };

    // 파일 선택 처리
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileUpload(file);
        }
    };

    // 드래그 앤 드롭 처리
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = e.dataTransfer.files;
        if (files && files[0]) {
            handleFileUpload(files[0]);
        }
    };

    // 파일 선택 버튼 클릭
    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    // 이미지 제거
    const handleRemoveImage = () => {
        setPreviewUrl(null);
        if (onImageUploaded) {
            onImageUploaded(null);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className={`image-uploader ${className}`}>
            {/* 숨김 파일 입력 */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            {previewUrl ? (
                // 이미지 미리보기
                <div className="relative">
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                        <img
                            src={previewUrl}
                            alt="업로드된 이미지"
                            className="w-full h-48 object-cover"
                        />
                        
                        {/* 업로드 진행률 */}
                        {uploading && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                <div className="text-center text-white">
                                    <LoadingSpinner size="lg" className="mx-auto mb-2" />
                                    <p className="text-sm">업로드 중... {uploadProgress}%</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 이미지 제어 버튼 */}
                    {!uploading && (
                        <div className="absolute top-2 right-2 flex space-x-2">
                            <button
                                onClick={handleButtonClick}
                                className="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 transition-colors"
                                title="이미지 변경"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>
                            <button
                                onClick={handleRemoveImage}
                                className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                                title="이미지 제거"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                // 드래그 앤 드롭 영역
                <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        dragActive 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <div className="text-gray-600">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        
                        <p className="text-lg font-medium mb-2">
                            이미지를 드래그하거나 클릭하여 업로드
                        </p>
                        
                        <p className="text-sm text-gray-500 mb-4">
                            JPG, PNG, GIF, WebP 파일 (최대 5MB)
                        </p>
                        
                        <button
                            onClick={handleButtonClick}
                            disabled={uploading}
                            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                                uploading
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                        >
                            {uploading ? '업로드 중...' : '파일 선택'}
                        </button>
                    </div>
                </div>
            )}

            {/* 업로드 가이드 */}
            <div className="mt-2 text-xs text-gray-500">
                <p>💡 팁: 광고 효과를 높이려면 고화질 이미지를 사용하세요</p>
                <p>📱 모바일 사용자가 많으니 세로형 이미지를 권장합니다</p>
            </div>
        </div>
    );
};

export default ImageUploader;