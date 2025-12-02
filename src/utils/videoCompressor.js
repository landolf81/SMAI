/**
 * 동영상 720p 압축 유틸리티
 * MediaRecorder API를 사용하여 브라우저 내에서 동영상을 720p로 압축합니다.
 */

/**
 * 동영상을 720p로 압축
 * @param {File} videoFile - 원본 동영상 파일
 * @param {Object} options - 압축 옵션
 * @param {number} options.maxHeight - 최대 세로 해상도 (기본: 720)
 * @param {number} options.videoBitrate - 비디오 비트레이트 (기본: 2.5Mbps)
 * @param {Function} options.onProgress - 진행률 콜백 (0-100)
 * @returns {Promise<File>} 압축된 동영상 파일
 */
export const compressVideo = async (videoFile, options = {}) => {
  const {
    maxHeight = 720,
    videoBitrate = 2500000, // 2.5 Mbps
    onProgress = () => {}
  } = options;

  return new Promise((resolve, reject) => {
    // 동영상이 아니면 원본 반환
    if (!videoFile.type.startsWith('video/')) {
      resolve(videoFile);
      return;
    }

    // 원본 비디오 요소 생성
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;

    const videoUrl = URL.createObjectURL(videoFile);
    video.src = videoUrl;

    video.onloadedmetadata = async () => {
      try {
        const originalWidth = video.videoWidth;
        const originalHeight = video.videoHeight;
        const duration = video.duration;

        console.log(`원본 동영상: ${originalWidth}x${originalHeight}, ${duration.toFixed(1)}초`);

        // 720p 이하면 압축 불필요
        if (originalHeight <= maxHeight && videoFile.size < 10 * 1024 * 1024) {
          console.log('동영상 압축 불필요: 이미 720p 이하이고 10MB 미만');
          URL.revokeObjectURL(videoUrl);
          resolve(videoFile);
          return;
        }

        // 새 해상도 계산 (비율 유지)
        let newWidth, newHeight;
        if (originalHeight > maxHeight) {
          const ratio = maxHeight / originalHeight;
          newHeight = maxHeight;
          newWidth = Math.round(originalWidth * ratio);
          // 짝수로 맞추기 (인코딩 호환성)
          newWidth = newWidth % 2 === 0 ? newWidth : newWidth + 1;
        } else {
          newWidth = originalWidth;
          newHeight = originalHeight;
        }

        console.log(`압축 목표: ${newWidth}x${newHeight}`);

        // Canvas 생성
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');

        // MediaRecorder 설정
        const stream = canvas.captureStream(30); // 30fps

        // 오디오 트랙 추가 시도
        try {
          const audioContext = new AudioContext();
          const source = audioContext.createMediaElementSource(video);
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);
          source.connect(audioContext.destination); // 재생을 위해

          destination.stream.getAudioTracks().forEach(track => {
            stream.addTrack(track);
          });
        } catch (audioError) {
          console.warn('오디오 트랙 추가 실패 (무음 동영상):', audioError);
        }

        // 지원되는 MIME 타입 확인
        const mimeTypes = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4'
        ];

        let selectedMimeType = 'video/webm';
        for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            selectedMimeType = mimeType;
            break;
          }
        }

        console.log(`사용 MIME 타입: ${selectedMimeType}`);

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedMimeType,
          videoBitsPerSecond: videoBitrate
        });

        const chunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          URL.revokeObjectURL(videoUrl);

          const blob = new Blob(chunks, { type: selectedMimeType });
          const extension = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
          const compressedFile = new File(
            [blob],
            videoFile.name.replace(/\.[^/.]+$/, `.${extension}`),
            { type: selectedMimeType, lastModified: Date.now() }
          );

          const originalSizeMB = (videoFile.size / 1024 / 1024).toFixed(2);
          const compressedSizeMB = (compressedFile.size / 1024 / 1024).toFixed(2);
          const reduction = ((1 - compressedFile.size / videoFile.size) * 100).toFixed(1);

          console.log(`동영상 압축 완료:
            원본: ${originalWidth}x${originalHeight} (${originalSizeMB}MB)
            압축: ${newWidth}x${newHeight} (${compressedSizeMB}MB)
            감소율: ${reduction}%`);

          onProgress(100);
          resolve(compressedFile);
        };

        mediaRecorder.onerror = (e) => {
          URL.revokeObjectURL(videoUrl);
          reject(new Error(`MediaRecorder 오류: ${e.error?.message || '알 수 없는 오류'}`));
        };

        // 녹화 시작
        mediaRecorder.start(100); // 100ms마다 데이터 수집

        // 비디오 재생 및 캔버스에 그리기
        video.currentTime = 0;

        const drawFrame = () => {
          if (video.ended || video.paused) {
            mediaRecorder.stop();
            return;
          }

          ctx.drawImage(video, 0, 0, newWidth, newHeight);

          // 진행률 업데이트
          const progress = Math.min(99, Math.round((video.currentTime / duration) * 100));
          onProgress(progress);

          requestAnimationFrame(drawFrame);
        };

        video.onended = () => {
          mediaRecorder.stop();
        };

        video.onplay = () => {
          drawFrame();
        };

        // 재생 시작
        video.play().catch(err => {
          URL.revokeObjectURL(videoUrl);
          reject(new Error(`동영상 재생 실패: ${err.message}`));
        });

      } catch (error) {
        URL.revokeObjectURL(videoUrl);
        reject(error);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('동영상 로드 실패'));
    };
  });
};

/**
 * 동영상 압축이 필요한지 확인
 * @param {File} videoFile - 동영상 파일
 * @returns {Promise<Object>} { needsCompression, width, height, duration, sizeMB }
 */
export const checkVideoNeedsCompression = async (videoFile) => {
  return new Promise((resolve) => {
    if (!videoFile.type.startsWith('video/')) {
      resolve({ needsCompression: false, reason: '동영상 파일이 아님' });
      return;
    }

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

      // 720p 초과이거나 50MB 이상이면 압축 필요
      const needsCompression = height > 720 || sizeMB > 50;

      resolve({
        needsCompression,
        width,
        height,
        duration,
        sizeMB,
        reason: needsCompression
          ? (height > 720 ? `해상도가 720p를 초과합니다 (${height}p)` : `파일 크기가 50MB를 초과합니다 (${sizeMB.toFixed(1)}MB)`)
          : '압축 불필요'
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ needsCompression: false, reason: '동영상 로드 실패' });
    };
  });
};

/**
 * 동영상 압축 지원 여부 확인
 * @returns {boolean}
 */
export const isVideoCompressionSupported = () => {
  return typeof MediaRecorder !== 'undefined' &&
         typeof HTMLCanvasElement !== 'undefined' &&
         typeof HTMLCanvasElement.prototype.captureStream === 'function';
};

export default {
  compressVideo,
  checkVideoNeedsCompression,
  isVideoCompressionSupported
};
