import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

const ImageCropper = ({ imageSrc, onCropComplete, onCancel, aspectRatio = 1 }) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 200, height: 200 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 });

  // 원형 크롭인지 확인 (1:1 비율 = 프로필 사진)
  const isCircleCrop = aspectRatio === 1;

  // 이미지 로드 처리
  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;

    // 컨테이너 크기에 맞춰 최대 크기 계산
    const maxWidth = Math.min(350, window.innerWidth - 48);
    const maxHeight = Math.min(350, window.innerHeight - 250);

    let width = img.naturalWidth;
    let height = img.naturalHeight;

    // 이미지 크기 조정
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width *= ratio;
      height *= ratio;
    }

    setImageSize({ width, height });
    setCanvasSize({ width, height });

    // 초기 크롭 영역 설정 (중앙에 배치)
    const minDim = Math.min(width, height);
    const cropWidth = minDim * 0.7;
    const cropHeight = aspectRatio === 1 ? cropWidth : cropWidth / aspectRatio;

    setCropArea({
      x: (width - cropWidth) / 2,
      y: (height - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight
    });

    setImageLoaded(true);
  }, [aspectRatio]);

  useEffect(() => {
    if (imageSrc && imageRef.current) {
      const img = imageRef.current;

      // 이미지가 이미 로드된 경우
      if (img.complete && img.naturalWidth > 0) {
        handleImageLoad();
      } else {
        img.onload = handleImageLoad;
      }
    }
  }, [imageSrc, handleImageLoad]);

  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [imageLoaded, cropArea, isCircleCrop]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    if (!canvas || !ctx || !img) return;

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // 배경 그리기
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, imageSize.width, imageSize.height);

    // 크롭 영역 외부를 어둡게 표시
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 크롭 영역을 원래 밝기로 표시
    ctx.globalCompositeOperation = 'destination-out';

    if (isCircleCrop) {
      // 원형 크롭 영역
      const centerX = cropArea.x + cropArea.width / 2;
      const centerY = cropArea.y + cropArea.height / 2;
      const radius = Math.min(cropArea.width, cropArea.height) / 2;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 사각형 크롭 영역
      ctx.fillRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    }

    // 크롭 영역 테두리
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;

    if (isCircleCrop) {
      // 원형 테두리
      const centerX = cropArea.x + cropArea.width / 2;
      const centerY = cropArea.y + cropArea.height / 2;
      const radius = Math.min(cropArea.width, cropArea.height) / 2;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // 가이드 십자선 (선택적)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX - radius, centerY);
      ctx.lineTo(centerX + radius, centerY);
      ctx.moveTo(centerX, centerY - radius);
      ctx.lineTo(centerX, centerY + radius);
      ctx.stroke();
    } else {
      // 사각형 테두리
      ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    }

    // 모서리 핸들 (더 크게)
    const handleSize = 16;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    const handlePositions = [
      { x: cropArea.x, y: cropArea.y }, // 좌상단
      { x: cropArea.x + cropArea.width, y: cropArea.y }, // 우상단
      { x: cropArea.x, y: cropArea.y + cropArea.height }, // 좌하단
      { x: cropArea.x + cropArea.width, y: cropArea.y + cropArea.height } // 우하단
    ];

    handlePositions.forEach(pos => {
      // 흰색 테두리
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, handleSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // 초록색 내부
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, handleSize / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  // 포인터 위치 가져오기 (마우스 또는 터치)
  const getPointerPos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // 터치 이벤트인 경우
    if (e.touches && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }

    // 마우스 이벤트
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, []);

  // 핸들 위치 확인
  const getHandleAtPosition = useCallback((pos) => {
    const handleSize = 24; // 터치 영역 확대
    const handles = [
      { name: 'nw', x: cropArea.x, y: cropArea.y },
      { name: 'ne', x: cropArea.x + cropArea.width, y: cropArea.y },
      { name: 'sw', x: cropArea.x, y: cropArea.y + cropArea.height },
      { name: 'se', x: cropArea.x + cropArea.width, y: cropArea.y + cropArea.height }
    ];

    for (const handle of handles) {
      if (Math.abs(pos.x - handle.x) < handleSize && Math.abs(pos.y - handle.y) < handleSize) {
        return handle.name;
      }
    }
    return null;
  }, [cropArea]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getPointerPos(e);

    // 먼저 핸들 체크 (리사이즈)
    const handle = getHandleAtPosition(pos);
    if (handle) {
      setIsResizing(true);
      setResizeHandle(handle);
      setDragStart(pos);
      return;
    }

    // 크롭 영역 내부 클릭 확인 (드래그)
    if (isCircleCrop) {
      // 원형 영역 내부인지 확인
      const centerX = cropArea.x + cropArea.width / 2;
      const centerY = cropArea.y + cropArea.height / 2;
      const radius = Math.min(cropArea.width, cropArea.height) / 2;
      const distance = Math.sqrt(Math.pow(pos.x - centerX, 2) + Math.pow(pos.y - centerY, 2));

      if (distance <= radius) {
        setIsDragging(true);
        setDragStart({ x: pos.x - cropArea.x, y: pos.y - cropArea.y });
      }
    } else {
      if (pos.x >= cropArea.x && pos.x <= cropArea.x + cropArea.width &&
          pos.y >= cropArea.y && pos.y <= cropArea.y + cropArea.height) {
        setIsDragging(true);
        setDragStart({ x: pos.x - cropArea.x, y: pos.y - cropArea.y });
      }
    }
  }, [getPointerPos, getHandleAtPosition, cropArea, isCircleCrop]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging && !isResizing) return;

    // preventDefault는 touchmove에서만 필요
    if (e.cancelable) {
      e.preventDefault();
    }

    const pos = getPointerPos(e);

    if (isResizing && resizeHandle) {
      // 리사이즈 처리
      let newX = cropArea.x;
      let newY = cropArea.y;
      let newWidth = cropArea.width;
      let newHeight = cropArea.height;

      const minSize = 60;

      switch (resizeHandle) {
        case 'se': // 우하단
          newWidth = Math.max(minSize, Math.min(pos.x - cropArea.x, imageSize.width - cropArea.x));
          newHeight = aspectRatio === 1 ? newWidth : newWidth / aspectRatio;
          break;
        case 'sw': // 좌하단
          newWidth = Math.max(minSize, cropArea.x + cropArea.width - pos.x);
          newHeight = aspectRatio === 1 ? newWidth : newWidth / aspectRatio;
          newX = cropArea.x + cropArea.width - newWidth;
          break;
        case 'ne': // 우상단
          newWidth = Math.max(minSize, Math.min(pos.x - cropArea.x, imageSize.width - cropArea.x));
          newHeight = aspectRatio === 1 ? newWidth : newWidth / aspectRatio;
          newY = cropArea.y + cropArea.height - newHeight;
          break;
        case 'nw': // 좌상단
          newWidth = Math.max(minSize, cropArea.x + cropArea.width - pos.x);
          newHeight = aspectRatio === 1 ? newWidth : newWidth / aspectRatio;
          newX = cropArea.x + cropArea.width - newWidth;
          newY = cropArea.y + cropArea.height - newHeight;
          break;
      }

      // 경계 체크
      newX = Math.max(0, Math.min(newX, imageSize.width - minSize));
      newY = Math.max(0, Math.min(newY, imageSize.height - minSize));

      if (newX + newWidth > imageSize.width) {
        newWidth = imageSize.width - newX;
        newHeight = aspectRatio === 1 ? newWidth : newWidth / aspectRatio;
      }
      if (newY + newHeight > imageSize.height) {
        newHeight = imageSize.height - newY;
        newWidth = aspectRatio === 1 ? newHeight : newHeight * aspectRatio;
      }

      setCropArea({ x: newX, y: newY, width: newWidth, height: newHeight });
    } else if (isDragging) {
      // 드래그 처리
      const newX = Math.max(0, Math.min(pos.x - dragStart.x, imageSize.width - cropArea.width));
      const newY = Math.max(0, Math.min(pos.y - dragStart.y, imageSize.height - cropArea.height));
      setCropArea(prev => ({ ...prev, x: newX, y: newY }));
    }
  }, [isDragging, isResizing, resizeHandle, cropArea, imageSize, aspectRatio, dragStart, getPointerPos]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  }, []);

  const cropImage = () => {
    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 원본 이미지 크기 비율 계산
    const scaleX = img.naturalWidth / imageSize.width;
    const scaleY = img.naturalHeight / imageSize.height;

    // 크롭 크기 설정 (정사각형으로 강제)
    const cropSize = Math.min(cropArea.width, cropArea.height);
    const outputSize = Math.min(512, cropSize * Math.max(scaleX, scaleY)); // 최대 512px
    canvas.width = outputSize;
    canvas.height = outputSize;

    // 크롭된 이미지 그리기
    ctx.drawImage(
      img,
      cropArea.x * scaleX,
      cropArea.y * scaleY,
      cropSize * scaleX,
      cropSize * scaleY,
      0,
      0,
      outputSize,
      outputSize
    );

    // Blob으로 변환
    canvas.toBlob((blob) => {
      if (blob) {
        onCropComplete(blob);
      }
    }, 'image/jpeg', 0.9);
  };

  // 전역 이벤트 리스너 (드래그 중 캔버스 밖으로 나가도 작동)
  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleGlobalMove = (e) => {
      handlePointerMove(e);
    };

    const handleGlobalUp = () => {
      handlePointerUp();
    };

    // 마우스 이벤트
    document.addEventListener('mousemove', handleGlobalMove);
    document.addEventListener('mouseup', handleGlobalUp);

    // 터치 이벤트 - passive: false로 설정하여 preventDefault 허용
    document.addEventListener('touchmove', handleGlobalMove, { passive: false });
    document.addEventListener('touchend', handleGlobalUp);
    document.addEventListener('touchcancel', handleGlobalUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('mouseup', handleGlobalUp);
      document.removeEventListener('touchmove', handleGlobalMove);
      document.removeEventListener('touchend', handleGlobalUp);
      document.removeEventListener('touchcancel', handleGlobalUp);
    };
  }, [isDragging, isResizing, handlePointerMove, handlePointerUp]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full mx-4 overflow-hidden shadow-2xl">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white p-4">
          <h3 className="text-lg font-bold">이미지 자르기</h3>
          <p className="text-emerald-100 text-sm">
            {isCircleCrop ? '프로필 사진 (원형)' : `가로형 (${aspectRatio}:1)`}
          </p>
        </div>

        {/* 캔버스 영역 */}
        <div ref={containerRef} className="p-4 bg-gray-100 flex justify-center">
          {!imageLoaded && (
            <div className="w-full h-64 flex items-center justify-center">
              <div className="loading loading-spinner loading-lg text-emerald-500"></div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            className={`border-2 border-gray-300 rounded-lg touch-none select-none ${
              imageLoaded ? 'block' : 'hidden'
            }`}
            style={{
              maxWidth: '100%',
              height: 'auto',
              cursor: isDragging ? 'grabbing' : isResizing ? 'nwse-resize' : 'grab'
            }}
          />
          <img
            ref={imageRef}
            src={imageSrc}
            crossOrigin="anonymous"
            style={{ display: 'none' }}
            alt="Crop source"
          />
        </div>

        {/* 안내 */}
        <div className="px-4 py-2 bg-gray-50 border-t">
          <p className="text-sm text-gray-600 text-center">
            {isCircleCrop
              ? '원 안을 드래그하여 이동, 모서리를 드래그하여 크기 조절'
              : '영역을 드래그하여 이동, 모서리를 드래그하여 크기 조절'
            }
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 p-4 border-t">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
          >
            취소
          </button>
          <button
            onClick={cropImage}
            className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-xl font-medium hover:from-emerald-700 hover:to-teal-600 transition-colors disabled:opacity-50"
            disabled={!imageLoaded}
          >
            자르기 완료
          </button>
        </div>
      </div>
    </div>
  );
};

ImageCropper.propTypes = {
  imageSrc: PropTypes.string.isRequired,
  onCropComplete: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  aspectRatio: PropTypes.number
};

export default ImageCropper;
