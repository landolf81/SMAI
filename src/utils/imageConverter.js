/**
 * 이미지 변환 유틸리티
 * - HEIC/HEIF (아이폰 기본 사진 형식) 지원
 * - 모든 이미지를 가로 2048px PNG로 변환 (핑거줌 고품질)
 * - WebP, BMP, TIFF 등 다양한 형식 지원
 */

import heic2any from 'heic2any';

/**
 * 지원되는 이미지 MIME 타입
 */
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
];

/**
 * HEIC/HEIF 파일인지 확인
 * @param {File} file - 파일 객체
 * @returns {boolean}
 */
export const isHeicFile = (file) => {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
};

/**
 * HEIC/HEIF 파일을 JPEG Blob으로 변환
 * @param {File} file - HEIC/HEIF 파일
 * @returns {Promise<Blob>}
 */
const convertHeicToBlob = async (file) => {
  try {
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });

    // heic2any가 배열을 반환할 수 있음 (multi-image HEIC의 경우)
    return Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
  } catch (error) {
    console.error('HEIC 변환 실패:', error);
    throw new Error('HEIC 이미지 변환에 실패했습니다.');
  }
};

/**
 * 이미지를 Canvas에 그리고 리사이즈
 * @param {HTMLImageElement} img - 이미지 엘리먼트
 * @param {number} maxWidth - 최대 가로 크기
 * @returns {HTMLCanvasElement}
 */
const resizeImageToCanvas = (img, maxWidth = 1024) => {
  let width = img.width;
  let height = img.height;

  // 가로 크기가 maxWidth보다 큰 경우에만 리사이즈
  if (width > maxWidth) {
    const ratio = maxWidth / width;
    width = maxWidth;
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');

  // 이미지 품질 향상을 위한 설정
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(img, 0, 0, width, height);

  return canvas;
};

/**
 * Blob을 Image 객체로 로드
 * @param {Blob} blob - 이미지 Blob
 * @returns {Promise<HTMLImageElement>}
 */
const loadImageFromBlob = (blob) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지 로드에 실패했습니다.'));
    };

    img.src = url;
  });
};

/**
 * Canvas를 JPEG Blob으로 변환
 * @param {HTMLCanvasElement} canvas - Canvas 엘리먼트
 * @param {number} quality - JPEG 품질 (0-1, 기본: 0.85)
 * @returns {Promise<Blob>}
 */
const canvasToBlob = (canvas, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('이미지 변환에 실패했습니다.'));
        }
      },
      'image/jpeg',
      quality
    );
  });
};

/**
 * 파일을 가로 1024px JPEG로 변환 (용량 최적화)
 * @param {File} file - 원본 이미지 파일
 * @param {Object} options - 옵션
 * @param {number} options.maxWidth - 최대 가로 크기 (기본: 1024)
 * @param {number} options.quality - JPEG 품질 (기본: 0.85)
 * @param {Function} options.onProgress - 진행률 콜백
 * @returns {Promise<File>} 변환된 JPEG 파일
 */
export const convertImageToPng = async (file, options = {}) => {
  const { maxWidth = 1024, quality = 0.85, onProgress } = options;

  try {
    onProgress?.(10, 'Processing...');

    let blob = file;

    // 1. HEIC/HEIF 파일 처리
    if (isHeicFile(file)) {
      onProgress?.(20, 'HEIC 변환 중...');
      blob = await convertHeicToBlob(file);
    }

    onProgress?.(40, '이미지 로드 중...');

    // 2. 이미지 로드
    const img = await loadImageFromBlob(blob);

    onProgress?.(60, '리사이즈 중...');

    // 3. 리사이즈
    const canvas = resizeImageToCanvas(img, maxWidth);

    onProgress?.(80, 'JPEG 변환 중...');

    // 4. JPEG로 변환 (용량 최적화)
    const jpegBlob = await canvasToBlob(canvas, quality);

    // 5. File 객체로 변환 (원본 파일명 유지하되 확장자만 .jpg로)
    const originalName = file.name.replace(/\.[^.]+$/, '');
    const newFileName = `${originalName}.jpg`;

    const convertedFile = new File([jpegBlob], newFileName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    onProgress?.(100, '완료');

    return convertedFile;
  } catch (error) {
    console.error('이미지 변환 오류:', error);
    throw error;
  }
};

/**
 * 여러 이미지 파일을 일괄 변환
 * @param {File[]} files - 원본 이미지 파일 배열
 * @param {Object} options - 옵션
 * @param {number} options.maxWidth - 최대 가로 크기 (기본: 1024)
 * @param {Function} options.onProgress - 진행률 콜백 (currentIndex, total, file)
 * @returns {Promise<File[]>} 변환된 PNG 파일 배열
 */
export const convertImagesToPng = async (files, options = {}) => {
  const { maxWidth = 1024, onProgress } = options;
  const convertedFiles = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    try {
      onProgress?.(i, files.length, file.name, 'processing');

      const convertedFile = await convertImageToPng(file, { maxWidth });
      convertedFiles.push(convertedFile);

      onProgress?.(i, files.length, file.name, 'completed');
    } catch (error) {
      console.error(`파일 변환 실패: ${file.name}`, error);
      onProgress?.(i, files.length, file.name, 'error');
      // 변환 실패 시 원본 파일 사용 (HEIC 제외)
      if (!isHeicFile(file)) {
        convertedFiles.push(file);
      }
    }
  }

  return convertedFiles;
};

/**
 * 파일이 이미지인지 확인
 * @param {File} file - 파일 객체
 * @returns {boolean}
 */
export const isImageFile = (file) => {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  // MIME 타입 확인
  if (SUPPORTED_IMAGE_TYPES.includes(type)) {
    return true;
  }

  // 확장자로 확인 (MIME 타입이 없는 경우)
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.heic', '.heif'];
  return imageExtensions.some(ext => name.endsWith(ext));
};

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 * @param {number} bytes - 바이트
 * @returns {string}
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default {
  convertImageToPng,
  convertImagesToPng,
  isImageFile,
  isHeicFile,
  formatFileSize,
};
