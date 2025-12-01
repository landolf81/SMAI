import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

const ImageCropper = ({ imageSrc, onCropComplete, onCancel, aspectRatio = 1 }) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 200, height: 200 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 });

  useEffect(() => {
    if (imageSrc && imageRef.current) {
      imageRef.current.onload = () => {
        const img = imageRef.current;
        const maxWidth = 400;
        const maxHeight = 400;
        
        let { width, height } = img;
        
        // 이미지 크기 조정
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        setImageSize({ width, height });
        setCanvasSize({ width, height });
        setImageLoaded(true);
        
        // 초기 크롭 영역 설정 (중앙에 정사각형)
        const minSize = Math.min(width, height) * 0.6;
        setCropArea({
          x: (width - minSize) / 2,
          y: (height - minSize) / 2,
          width: minSize,
          height: aspectRatio === 1 ? minSize : minSize / aspectRatio
        });
      };
    }
  }, [imageSrc, aspectRatio]);

  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [imageLoaded, cropArea]);

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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 크롭 영역을 원래 밝기로 표시
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    
    // 크롭 영역 테두리
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    
    // 모서리 핸들
    const handleSize = 8;
    ctx.fillStyle = '#ffffff';
    // 좌상단
    ctx.fillRect(cropArea.x - handleSize/2, cropArea.y - handleSize/2, handleSize, handleSize);
    // 우상단  
    ctx.fillRect(cropArea.x + cropArea.width - handleSize/2, cropArea.y - handleSize/2, handleSize, handleSize);
    // 좌하단
    ctx.fillRect(cropArea.x - handleSize/2, cropArea.y + cropArea.height - handleSize/2, handleSize, handleSize);
    // 우하단
    ctx.fillRect(cropArea.x + cropArea.width - handleSize/2, cropArea.y + cropArea.height - handleSize/2, handleSize, handleSize);
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e) => {
    const pos = getMousePos(e);
    
    // 크롭 영역 내부 클릭 확인
    if (pos.x >= cropArea.x && pos.x <= cropArea.x + cropArea.width &&
        pos.y >= cropArea.y && pos.y <= cropArea.y + cropArea.height) {
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const pos = getMousePos(e);
    const newX = Math.max(0, Math.min(pos.x - cropArea.width / 2, imageSize.width - cropArea.width));
    const newY = Math.max(0, Math.min(pos.y - cropArea.height / 2, imageSize.height - cropArea.height));
    
    setCropArea(prev => ({ ...prev, x: newX, y: newY }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const cropImage = () => {
    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 원본 이미지 크기 비율 계산
    const scaleX = img.naturalWidth / imageSize.width;
    const scaleY = img.naturalHeight / imageSize.height;
    
    // 크롭 크기 설정 (정사각형으로 강제)
    const cropSize = Math.min(cropArea.width, cropArea.height);
    canvas.width = cropSize;
    canvas.height = cropSize;
    
    // 크롭된 이미지 그리기
    ctx.drawImage(
      img,
      cropArea.x * scaleX,
      cropArea.y * scaleY,
      cropSize * scaleX,
      cropSize * scaleY,
      0,
      0,
      cropSize,
      cropSize
    );
    
    // Blob으로 변환
    canvas.toBlob((blob) => {
      if (blob) {
        onCropComplete(blob);
      }
    }, 'image/jpeg', 0.8);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">이미지 자르기</h3>
        
        <div className="relative mb-4">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="border border-gray-300 cursor-move"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
          <img
            ref={imageRef}
            src={imageSrc}
            style={{ display: 'none' }}
            alt="Crop source"
          />
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          드래그하여 크롭 영역을 이동하세요. 정사각형으로 자동 조정됩니다.
        </p>
        
        <div className="flex justify-end space-x-2">
          <button
            onClick={onCancel}
            className="btn btn-outline"
          >
            취소
          </button>
          <button
            onClick={cropImage}
            className="btn btn-primary"
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