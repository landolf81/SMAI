// 이미지 최적화 및 처리 유틸리티

/**
 * 이미지를 Canvas로 압축하는 함수
 * @param {File|Blob} file - 압축할 이미지 파일
 * @param {number} maxWidth - 최대 너비
 * @param {number} maxHeight - 최대 높이  
 * @param {number} quality - 압축 품질 (0-1)
 * @param {string} format - 출력 포맷 ('image/webp', 'image/jpeg')
 * @returns {Promise<Blob>} - 압축된 이미지 Blob
 */
export const compressImage = (file, maxWidth = 800, maxHeight = 600, quality = 0.8, format = 'image/webp') => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // 원본 크기
      let { width, height } = img;
      
      // 비율 유지하며 크기 조정
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // 이미지 그리기
      ctx.drawImage(img, 0, 0, width, height);
      
      // Blob으로 변환
      canvas.toBlob(resolve, format, quality);
    };
    
    img.src = URL.createObjectURL(file);
  });
};

/**
 * 프로필 사진용 최적화 (정사각형, 여러 해상도)
 * @param {File|Blob} file - 원본 이미지 파일
 * @returns {Promise<Object>} - 다양한 크기의 이미지들
 */
export const optimizeProfileImage = async (file) => {
  const sizes = [
    { name: 'thumbnail', size: 64, quality: 0.9 },
    { name: 'small', size: 128, quality: 0.85 },
    { name: 'medium', size: 256, quality: 0.8 },
    { name: 'large', size: 512, quality: 0.75 }
  ];
  
  const optimizedImages = {};
  
  for (const config of sizes) {
    const compressed = await compressImage(
      file, 
      config.size, 
      config.size, 
      config.quality, 
      'image/webp'
    );
    optimizedImages[config.name] = compressed;
  }
  
  return optimizedImages;
};

/**
 * 커버 사진용 최적화 (2:1 비율)
 * @param {File|Blob} file - 원본 이미지 파일
 * @returns {Promise<Object>} - 다양한 크기의 이미지들
 */
export const optimizeCoverImage = async (file) => {
  const sizes = [
    { name: 'small', width: 640, height: 320, quality: 0.8 },
    { name: 'medium', width: 1024, height: 512, quality: 0.75 },
    { name: 'large', width: 1920, height: 960, quality: 0.7 }
  ];
  
  const optimizedImages = {};
  
  for (const config of sizes) {
    const compressed = await compressImage(
      file, 
      config.width, 
      config.height, 
      config.quality, 
      'image/webp'
    );
    optimizedImages[config.name] = compressed;
  }
  
  return optimizedImages;
};

/**
 * WebP 지원 확인
 * @returns {boolean} - WebP 지원 여부
 */
export const supportsWebP = () => {
  const canvas = document.createElement('canvas');
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
};

/**
 * 파일 크기를 읽기 쉬운 형태로 변환
 * @param {number} bytes - 바이트 크기
 * @returns {string} - 포맷된 크기 문자열
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 이미지 업로드 진행률을 추적하는 함수
 * @param {File} file - 업로드할 파일
 * @param {Function} onProgress - 진행률 콜백 (0-100)
 * @param {Function} uploadFunc - 실제 업로드 함수
 * @returns {Promise} - 업로드 결과
 */
export const uploadWithProgress = (file, onProgress, uploadFunc) => {
  return new Promise((resolve, reject) => {
    // 업로드 시뮬레이션 (실제로는 XMLHttpRequest를 사용해야 함)
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 95) {
        clearInterval(interval);
        // 실제 업로드 실행
        uploadFunc(file)
          .then((result) => {
            onProgress(100);
            setTimeout(() => resolve(result), 200);
          })
          .catch(reject);
      } else {
        onProgress(Math.min(progress, 95));
      }
    }, 100);
  });
};

/**
 * 이미지 메타데이터 추출
 * @param {File} file - 이미지 파일
 * @returns {Promise<Object>} - 메타데이터
 */
export const getImageMetadata = (file) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: img.naturalWidth / img.naturalHeight,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
    };
    img.src = URL.createObjectURL(file);
  });
};

/**
 * 이미지 품질 분석
 * @param {File} file - 이미지 파일
 * @returns {Promise<Object>} - 품질 분석 결과
 */
export const analyzeImageQuality = async (file) => {
  const metadata = await getImageMetadata(file);
  const webpSupported = supportsWebP();
  
  return {
    metadata,
    recommendations: {
      shouldCompress: file.size > 1024 * 1024, // 1MB 이상
      shouldConvertToWebP: webpSupported && file.type !== 'image/webp',
      shouldResize: metadata.width > 1920 || metadata.height > 1080,
      estimatedSavings: calculateEstimatedSavings(file.size, file.type, webpSupported)
    }
  };
};

/**
 * 예상 용량 절약 계산
 * @param {number} originalSize - 원본 크기
 * @param {string} originalType - 원본 타입
 * @param {boolean} webpSupported - WebP 지원 여부
 * @returns {Object} - 절약 예상치
 */
const calculateEstimatedSavings = (originalSize, originalType, webpSupported) => {
  let compressionRatio = 0.7; // 기본 압축률
  
  if (webpSupported && originalType === 'image/png') {
    compressionRatio = 0.5; // PNG -> WebP는 더 높은 압축률
  } else if (webpSupported && originalType === 'image/jpeg') {
    compressionRatio = 0.8; // JPEG -> WebP는 중간 압축률
  }
  
  const estimatedSize = originalSize * compressionRatio;
  const savings = originalSize - estimatedSize;
  const savingsPercentage = (savings / originalSize) * 100;
  
  return {
    originalSize: formatFileSize(originalSize),
    estimatedSize: formatFileSize(estimatedSize),
    savings: formatFileSize(savings),
    savingsPercentage: Math.round(savingsPercentage)
  };
};