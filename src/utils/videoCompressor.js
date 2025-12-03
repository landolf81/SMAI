/**
 * 동영상 720p 압축 유틸리티
 * FFmpeg.wasm을 사용하여 브라우저 내에서 동영상을 720p로 압축합니다.
 * 호환 포맷(MP4, WebM)은 압축하지 않고 원본 사용
 *
 * SharedArrayBuffer 미지원 환경에서는 싱글 스레드 버전 사용
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;
let ffmpegLoaded = false;
let ffmpegLoading = false;
let currentProgressCallback = null;

/**
 * FFmpeg 인스턴스 로드
 * SharedArrayBuffer 지원 여부에 따라 멀티/싱글 스레드 버전 선택
 */
const loadFFmpeg = async (onProgress) => {
  if (ffmpegLoaded && ffmpeg) {
    currentProgressCallback = onProgress;
    return ffmpeg;
  }
  if (ffmpegLoading) {
    // 이미 로딩 중이면 완료될 때까지 대기
    while (ffmpegLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    currentProgressCallback = onProgress;
    return ffmpeg;
  }

  ffmpegLoading = true;
  currentProgressCallback = onProgress;

  try {
    ffmpeg = new FFmpeg();

    // 진행률 콜백
    ffmpeg.on('progress', ({ progress }) => {
      if (currentProgressCallback) {
        currentProgressCallback(Math.round(progress * 100));
      }
    });

    // SharedArrayBuffer 지원 여부 확인
    const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';

    if (hasSharedArrayBuffer) {
      // 멀티 스레드 버전 (더 빠름)
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    } else {
      // 싱글 스레드 버전 (SharedArrayBuffer 불필요)
      const baseURL = 'https://unpkg.com/@ffmpeg/core-st@0.12.6/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    }

    ffmpegLoaded = true;
    return ffmpeg;
  } catch (error) {
    console.error('FFmpeg 로드 실패:', error);
    throw error;
  } finally {
    ffmpegLoading = false;
  }
};

/**
 * 동영상을 720p로 압축 (FFmpeg 사용)
 * @param {File} videoFile - 원본 동영상 파일
 * @param {Object} options - 압축 옵션
 * @param {number} options.maxHeight - 최대 세로 해상도 (기본: 720)
 * @param {Function} options.onProgress - 진행률 콜백 (0-100)
 * @returns {Promise<File>} 압축된 동영상 파일
 */
export const compressVideo = async (videoFile, options = {}) => {
  const {
    maxHeight = 720,
    onProgress = () => {}
  } = options;

  // 동영상이 아니면 원본 반환
  if (!videoFile.type.startsWith('video/')) {
    return videoFile;
  }

  try {
    onProgress(0);

    // FFmpeg 로드
    const ffmpegInstance = await loadFFmpeg(onProgress);

    // 입력 파일명
    const inputName = 'input' + getExtension(videoFile.name);
    const outputName = 'output.mp4';

    // 파일을 FFmpeg 파일시스템에 쓰기
    await ffmpegInstance.writeFile(inputName, await fetchFile(videoFile));

    // FFmpeg 명령 실행 (720p로 리사이즈, 원본 프레임레이트/비트레이트 유지)
    // -vf scale=-2:720 : 높이 720px, 너비는 비율 유지 (짝수로)
    // -c:v libx264 : H.264 코덱
    // -preset fast : 빠른 인코딩
    // -crf 23 : 품질 (낮을수록 고품질, 18-28 권장)
    // -c:a aac : 오디오 AAC 코덱
    // -movflags +faststart : 웹 스트리밍 최적화
    await ffmpegInstance.exec([
      '-i', inputName,
      '-vf', `scale=-2:${maxHeight}`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputName
    ]);

    // 출력 파일 읽기
    const data = await ffmpegInstance.readFile(outputName);

    // 임시 파일 정리
    await ffmpegInstance.deleteFile(inputName);
    await ffmpegInstance.deleteFile(outputName);

    // File 객체로 변환
    const compressedFile = new File(
      [data.buffer],
      videoFile.name.replace(/\.[^/.]+$/, '.mp4'),
      { type: 'video/mp4', lastModified: Date.now() }
    );

    onProgress(100);
    return compressedFile;

  } catch (error) {
    console.error('동영상 압축 실패:', error);
    throw error;
  }
};

/**
 * 파일 확장자 추출
 */
const getExtension = (filename) => {
  const match = filename.match(/\.[^/.]+$/);
  return match ? match[0].toLowerCase() : '.mp4';
};

// 브라우저 호환 포맷 (압축 불필요)
const COMPATIBLE_FORMATS = [
  'video/mp4',
  'video/webm',
];

// 브라우저 호환 확장자
const COMPATIBLE_EXTENSIONS = ['.mp4', '.webm'];

// 브라우저 비호환 포맷 (압축 필요)
const INCOMPATIBLE_FORMATS = [
  'video/quicktime',      // .mov (iOS/macOS)
  'video/x-msvideo',      // .avi
  'video/x-matroska',     // .mkv
  'video/x-ms-wmv',       // .wmv
  'video/x-flv',          // .flv
  'video/3gpp',           // .3gp
  'video/3gpp2',          // .3g2
];

const INCOMPATIBLE_EXTENSIONS = ['.mov', '.avi', '.mkv', '.wmv', '.flv', '.3gp', '.3g2', '.f4v', '.m4v'];

/**
 * 브라우저 호환 포맷인지 확인
 */
const isCompatibleFormat = (videoFile) => {
  // MIME 타입으로 확인
  if (COMPATIBLE_FORMATS.includes(videoFile.type)) {
    return true;
  }
  // 확장자로 확인
  const fileName = videoFile.name.toLowerCase();
  return COMPATIBLE_EXTENSIONS.some(ext => fileName.endsWith(ext));
};

/**
 * 브라우저 비호환 포맷인지 확인
 */
const isIncompatibleFormat = (videoFile) => {
  if (INCOMPATIBLE_FORMATS.includes(videoFile.type)) {
    return true;
  }
  const fileName = videoFile.name.toLowerCase();
  return INCOMPATIBLE_EXTENSIONS.some(ext => fileName.endsWith(ext));
};

/**
 * 동영상 압축이 필요한지 확인
 * - 호환 포맷(MP4, WebM) + 720p 이하: 압축 불필요
 * - 비호환 포맷(MOV 등): 압축 필요
 * - 720p 초과: 압축 필요
 */
export const checkVideoNeedsCompression = async (videoFile) => {
  return new Promise((resolve) => {
    // 동영상 파일인지 확인
    if (!videoFile.type.startsWith('video/') &&
        !videoFile.name.match(/\.(mov|avi|mkv|wmv|flv|mp4|webm|3gp|m4v|f4v)$/i)) {
      resolve({ needsCompression: false, reason: '동영상 파일이 아님' });
      return;
    }

    const compatible = isCompatibleFormat(videoFile);
    const incompatible = isIncompatibleFormat(videoFile);

    const video = document.createElement('video');
    video.muted = true;
    const url = URL.createObjectURL(videoFile);
    video.src = url;

    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const duration = video.duration;
      const sizeMB = videoFile.size / 1024 / 1024;

      URL.revokeObjectURL(url);

      // 비호환 포맷은 무조건 압축 필요
      if (incompatible) {
        resolve({
          needsCompression: true,
          width,
          height,
          duration,
          sizeMB,
          incompatibleFormat: true,
          reason: `MP4로 변환 필요 (${videoFile.name.split('.').pop().toUpperCase()})`
        });
        return;
      }

      // 호환 포맷이고 720p 이하면 압축 불필요
      if (compatible && height <= 720) {
        resolve({
          needsCompression: false,
          width,
          height,
          duration,
          sizeMB,
          reason: '호환 포맷 (원본 업로드)'
        });
        return;
      }

      // 720p 초과면 압축 필요
      if (height > 720) {
        resolve({
          needsCompression: true,
          width,
          height,
          duration,
          sizeMB,
          reason: `720p로 압축 (${height}p → 720p)`
        });
        return;
      }

      // 기타: 원본 사용
      resolve({
        needsCompression: false,
        width,
        height,
        duration,
        sizeMB,
        reason: '원본 업로드'
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);

      // 로드 실패해도 비호환 포맷이면 변환 시도
      if (incompatible) {
        resolve({
          needsCompression: true,
          incompatibleFormat: true,
          reason: `MP4로 변환 필요 (${videoFile.name.split('.').pop().toUpperCase()})`
        });
      } else {
        // 호환 포맷이면 원본 사용
        resolve({
          needsCompression: false,
          reason: '원본 업로드'
        });
      }
    };
  });
};

/**
 * 동영상 압축 지원 여부 확인
 * 싱글 스레드 버전 사용으로 대부분의 브라우저에서 지원
 */
export const isVideoCompressionSupported = () => {
  // WebAssembly 지원 확인 (거의 모든 최신 브라우저에서 지원)
  return typeof WebAssembly !== 'undefined';
};

export default {
  compressVideo,
  checkVideoNeedsCompression,
  isVideoCompressionSupported
};
