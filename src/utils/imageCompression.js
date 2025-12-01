/**
 * 이미지 압축 유틸리티
 * Instagram 규정에 맞춰 이미지를 자동으로 리사이징하고 압축합니다.
 */

/**
 * 이미지 파일을 로드하여 Image 객체로 변환
 * @param {File} file - 이미지 파일
 * @returns {Promise<HTMLImageElement>}
 */
const loadImage = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지 로드 실패'));
    };

    img.src = url;
  });
};

/**
 * 이미지 압축 및 리사이징
 * Instagram 규정에 맞춰 최대 1080px로 리사이징하고 품질 80%로 압축
 *
 * @param {File} file - 원본 이미지 파일
 * @param {Object} options - 압축 옵션
 * @param {number} options.maxWidth - 최대 가로 크기 (기본: 1080px)
 * @param {number} options.maxHeight - 최대 세로 크기 (기본: 1350px, 4:5 비율)
 * @param {number} options.quality - 압축 품질 0-1 (기본: 0.8)
 * @param {string} options.outputFormat - 출력 포맷 (기본: image/jpeg)
 * @returns {Promise<File>} 압축된 이미지 파일
 */
export const compressImage = async (file, options = {}) => {
  const {
    maxWidth = 1080,
    maxHeight = 1350,
    quality = 0.8,
    outputFormat = 'image/jpeg'
  } = options;

  try {
    // 이미지가 아니면 원본 반환
    if (!file.type.startsWith('image/')) {
      return file;
    }

    // 이미지 로드
    const img = await loadImage(file);

    // 원본 크기
    let width = img.width;
    let height = img.height;

    // 리사이징이 필요한지 확인
    const needsResize = width > maxWidth || height > maxHeight;

    if (!needsResize && file.size < 1024 * 1024) {
      // 1MB 이하이고 크기가 적절하면 원본 반환
      console.log('이미지 압축 불필요:', file.name);
      return file;
    }

    // 비율 유지하면서 리사이징
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    // Canvas에 그리기
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');

    // 이미지 품질 향상을 위한 설정
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 이미지 그리기
    ctx.drawImage(img, 0, 0, width, height);

    // Blob으로 변환
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, outputFormat, quality);
    });

    // File 객체로 변환
    const compressedFile = new File(
      [blob],
      file.name.replace(/\.[^/.]+$/, outputFormat === 'image/jpeg' ? '.jpg' : '.png'),
      {
        type: outputFormat,
        lastModified: Date.now()
      }
    );

    const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);
    const compressedSizeMB = (compressedFile.size / 1024 / 1024).toFixed(2);
    const reduction = ((1 - compressedFile.size / file.size) * 100).toFixed(1);

    console.log(`이미지 압축 완료:
      원본: ${img.width}x${img.height} (${originalSizeMB}MB)
      압축: ${width}x${height} (${compressedSizeMB}MB)
      감소율: ${reduction}%`);

    return compressedFile;

  } catch (error) {
    console.error('이미지 압축 실패:', error);
    // 압축 실패 시 원본 반환
    return file;
  }
};

/**
 * 여러 이미지를 일괄 압축
 * @param {File[]} files - 이미지 파일 배열
 * @param {Object} options - 압축 옵션
 * @returns {Promise<File[]>} 압축된 이미지 파일 배열
 */
export const compressImages = async (files, options = {}) => {
  const compressionPromises = files.map(file => compressImage(file, options));
  return Promise.all(compressionPromises);
};

/**
 * 파일 크기 검증
 * @param {File} file - 검증할 파일
 * @param {number} maxSizeMB - 최대 파일 크기 (MB)
 * @returns {boolean} 크기 제한 통과 여부
 */
export const validateFileSize = (file, maxSizeMB = 50) => {
  const fileSizeMB = file.size / 1024 / 1024;
  return fileSizeMB <= maxSizeMB;
};

/**
 * 동영상 파일 크기 검증
 * @param {File} file - 동영상 파일
 * @returns {Object} { valid: boolean, size: number, message: string }
 */
export const validateVideoSize = (file) => {
  const maxSizeMB = 50; // Instagram 피드 기준 50MB
  const fileSizeMB = file.size / 1024 / 1024;

  return {
    valid: fileSizeMB <= maxSizeMB,
    size: fileSizeMB,
    message: fileSizeMB > maxSizeMB
      ? `동영상 크기가 너무 큽니다. (${fileSizeMB.toFixed(1)}MB / 최대 ${maxSizeMB}MB)`
      : '동영상 크기 적절'
  };
};

export default {
  compressImage,
  compressImages,
  validateFileSize,
  validateVideoSize
};
