import React, { useState, useRef, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import CropIcon from '@mui/icons-material/Crop';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';

const ImageCropEditor = ({ imageFile, isOpen, onClose, onCropComplete }) => {
  const canvasRef = useRef(null);
  const [image, setImage] = useState(null);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, size: 100 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasSize] = useState(300); // 편집 캔버스 크기

  useEffect(() => {
    if (imageFile && isOpen) {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        
        // 이미지 전체를 캔버스에 맞추기 위한 계산
        const maxDimension = Math.max(img.width, img.height);
        const minDimension = Math.min(img.width, img.height);
        
        // 초기 줌: 이미지 전체가 캔버스에 보이도록 설정
        const initialZoom = canvasSize / maxDimension;
        
        // 초기 크롭 영역: 이미지 중앙에 정사각형 영역 설정
        const initialCropSize = Math.min(img.width, img.height);
        const initialCropArea = {
          x: (img.width - initialCropSize) / 2,
          y: (img.height - initialCropSize) / 2,
          size: initialCropSize
        };
        
        setCropArea(initialCropArea);
        setZoom(initialZoom);
        drawCanvas(img, initialCropArea, initialZoom, 0);
      };
      
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.readAsDataURL(imageFile);
    }
  }, [imageFile, isOpen]);

  const drawCanvas = (img, crop, currentZoom, currentRotation) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // 변수 선언 (한 번만)
    const imgDisplayWidth = img.width * currentZoom;
    const imgDisplayHeight = img.height * currentZoom;
    const fixedCropScreenSize = canvasSize * 0.8;
    const fixedCropX = (canvasSize - fixedCropScreenSize) / 2;
    const fixedCropY = (canvasSize - fixedCropScreenSize) / 2;

    // 캔버스 클리어
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // 캔버스 중앙으로 이동
    ctx.save();
    ctx.translate(canvasSize / 2, canvasSize / 2);
    
    // 회전 적용
    ctx.rotate((currentRotation * Math.PI) / 180);

    // 전체 이미지를 배경으로 그리기 (반투명)
    
    // 배경 이미지 (어둡게)
    ctx.globalAlpha = 0.3;
    ctx.drawImage(
      img,
      -imgDisplayWidth / 2, -imgDisplayHeight / 2, imgDisplayWidth, imgDisplayHeight
    );

    ctx.restore();

    // 크롭 영역을 밝게 그리기 (고정된 중앙 영역에)
    ctx.save();
    
    // 고정된 크롭 영역을 클립으로 설정
    
    ctx.beginPath();
    ctx.rect(fixedCropX, fixedCropY, fixedCropScreenSize, fixedCropScreenSize);
    ctx.clip();

    // 회전 적용
    ctx.translate(canvasSize / 2, canvasSize / 2);
    ctx.rotate((currentRotation * Math.PI) / 180);

    // 이미지 전체를 다시 그리기 (클립된 영역에만 표시됨)
    ctx.globalAlpha = 1.0;
    ctx.drawImage(
      img,
      -imgDisplayWidth / 2, -imgDisplayHeight / 2, imgDisplayWidth, imgDisplayHeight
    );

    ctx.restore();

    // 고정된 크롭 영역 좌표 (이미 위에서 계산됨)

    // 크롭 영역 외곽선
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    
    // 크롭 영역을 캔버스 중앙에 고정 크기로 표시
    ctx.strokeRect(fixedCropX, fixedCropY, fixedCropScreenSize, fixedCropScreenSize);

    // 크롭 가이드 라인 (3x3 그리드)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    for (let i = 1; i < 3; i++) {
      const posX = fixedCropX + (fixedCropScreenSize / 3) * i;
      const posY = fixedCropY + (fixedCropScreenSize / 3) * i;
      
      // 세로선
      ctx.beginPath();
      ctx.moveTo(posX, fixedCropY);
      ctx.lineTo(posX, fixedCropY + fixedCropScreenSize);
      ctx.stroke();
      
      // 가로선
      ctx.beginPath();
      ctx.moveTo(fixedCropX, posY);
      ctx.lineTo(fixedCropX + fixedCropScreenSize, posY);
      ctx.stroke();
    }

    // 코너 핸들 그리기
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    
    const handleSize = 8;
    const corners = [
      [fixedCropX - handleSize/2, fixedCropY - handleSize/2],
      [fixedCropX + fixedCropScreenSize - handleSize/2, fixedCropY - handleSize/2],
      [fixedCropX - handleSize/2, fixedCropY + fixedCropScreenSize - handleSize/2],
      [fixedCropX + fixedCropScreenSize - handleSize/2, fixedCropY + fixedCropScreenSize - handleSize/2]
    ];
    
    corners.forEach(([x, y]) => {
      ctx.fillRect(x, y, handleSize, handleSize);
      ctx.strokeRect(x, y, handleSize, handleSize);
    });
  };

  const handleMouseDown = (e) => {
    if (!image) return;
    setIsDragging(true);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !image) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    // 화면 좌표를 이미지 좌표로 변환
    // 크롭 영역이 고정되어 있으므로, 마우스 드래그 시 이미지를 반대로 이동
    const deltaX = (currentX - dragStart.x) / zoom;
    const deltaY = (currentY - dragStart.y) / zoom;

    const newCropArea = {
      ...cropArea,
      x: Math.max(0, Math.min(image.width - cropArea.size, cropArea.x - deltaX)),
      y: Math.max(0, Math.min(image.height - cropArea.size, cropArea.y - deltaY))
    };

    setCropArea(newCropArea);
    setDragStart({ x: currentX, y: currentY });
    drawCanvas(image, newCropArea, zoom, rotation);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomChange = (newZoom) => {
    if (!image) return;
    
    // 기본 줌: 이미지 긴 쪽이 캔버스에 맞도록
    const maxDimension = Math.max(image.width, image.height);
    const baseZoom = canvasSize / maxDimension;
    
    // 최소 줌: 기본 줌의 20%까지 축소 가능 (이미지가 작아져도 편집 가능)
    const minZoom = baseZoom * 0.2;
    
    // 최대 줌: 기본 줌의 5배까지 확대
    const maxZoom = baseZoom * 5;
    
    const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
    setZoom(clampedZoom);
    drawCanvas(image, cropArea, clampedZoom, rotation);
  };

  const handleRotation = () => {
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);
    drawCanvas(image, cropArea, zoom, newRotation);
  };

  const handleCropComplete = () => {
    if (!image) return;

    // 최종 크롭된 이미지를 생성
    const outputCanvas = document.createElement('canvas');
    const outputSize = 64; // 최종 출력 크기
    outputCanvas.width = outputSize;
    outputCanvas.height = outputSize;
    
    const ctx = outputCanvas.getContext('2d');
    
    // 회전 적용
    ctx.save();
    ctx.translate(outputSize / 2, outputSize / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    // 크롭된 영역을 정사각형으로 그리기
    ctx.drawImage(
      image,
      cropArea.x, cropArea.y, cropArea.size, cropArea.size,
      -outputSize / 2, -outputSize / 2, outputSize, outputSize
    );

    ctx.restore();

    // Canvas를 Blob으로 변환
    outputCanvas.toBlob((blob) => {
      const croppedFile = new File([blob], `cropped_${imageFile.name}`, {
        type: 'image/png',
        lastModified: Date.now()
      });
      
      onCropComplete(croppedFile, outputCanvas.toDataURL());
      onClose();
    }, 'image/png', 0.9);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CropIcon />
            이미지 편집
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* 편집 영역 */}
        <div className="space-y-4">
          {/* 캔버스 */}
          <div className="flex justify-center">
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
              <canvas
                ref={canvasRef}
                width={canvasSize}
                height={canvasSize}
                className="cursor-move bg-gray-100"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>
          </div>

          {/* 컨트롤 */}
          <div className="space-y-3">
            {/* 줌 컨트롤 */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 w-16">확대:</label>
              <button
                onClick={() => {
                  if (image) {
                    const baseZoom = canvasSize / Math.max(image.width, image.height);
                    const step = baseZoom * 0.3;
                    handleZoomChange(zoom - step);
                  }
                }}
                className="p-1 rounded hover:bg-gray-100"
                title="축소"
              >
                <ZoomOutIcon className="w-4 h-4" />
              </button>
              <input
                type="range"
                min={image ? (canvasSize / Math.max(image.width, image.height)) * 0.2 : 0.1}
                max={image ? (canvasSize / Math.max(image.width, image.height)) * 5 : 3}
                step="0.02"
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <button
                onClick={() => {
                  if (image) {
                    const baseZoom = canvasSize / Math.max(image.width, image.height);
                    const step = baseZoom * 0.3;
                    handleZoomChange(zoom + step);
                  }
                }}
                className="p-1 rounded hover:bg-gray-100"
                title="확대"
              >
                <ZoomInIcon className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 w-16">
                {image ? Math.round((zoom / (canvasSize / Math.max(image.width, image.height))) * 100) : Math.round(zoom * 100)}%
              </span>
            </div>

            {/* 회전 컨트롤 */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 w-16">회전:</label>
              <button
                onClick={handleRotation}
                className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                <RotateRightIcon className="w-4 h-4" />
                90° 회전
              </button>
              <span className="text-sm text-gray-600">
                {rotation}°
              </span>
            </div>
          </div>

          {/* 안내 텍스트 */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-700">
              💡 <strong>사용법:</strong>
            </p>
            <ul className="text-sm text-blue-600 mt-1 space-y-1">
              <li>• 마우스로 드래그하여 크롭 영역을 이동하세요</li>
              <li>• 슬라이더로 20%~500% 확대/축소 가능합니다</li>
              <li>• 회전 버튼으로 이미지를 90도씩 회전시키세요</li>
              <li>• 최종 이미지는 64x64px 정사각형으로 저장됩니다</li>
            </ul>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleCropComplete}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <CheckIcon className="w-4 h-4" />
            적용
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropEditor;