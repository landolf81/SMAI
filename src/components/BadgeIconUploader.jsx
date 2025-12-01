import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faTimes } from '@fortawesome/free-solid-svg-icons';
import { API_BASE_URL } from '../config/api';

const BadgeIconUploader = ({
  onIconChange,
  currentIcon = null,
  disabled = false
}) => {
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // 파일 선택 핸들러 - 크롭 없이 바로 적용
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    // 이미지 파일 체크
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    // 이미지를 128x128로 리사이즈
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 캔버스로 128x128 리사이즈
        const canvas = document.createElement('canvas');
        const outputSize = 128;
        canvas.width = outputSize;
        canvas.height = outputSize;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, outputSize, outputSize);

        // 이미지 비율에 맞춰 contain 방식으로 그리기
        const imgRatio = img.width / img.height;
        let drawWidth, drawHeight, offsetX, offsetY;

        if (imgRatio > 1) {
          drawWidth = outputSize;
          drawHeight = outputSize / imgRatio;
          offsetX = 0;
          offsetY = (outputSize - drawHeight) / 2;
        } else {
          drawHeight = outputSize;
          drawWidth = outputSize * imgRatio;
          offsetX = (outputSize - drawWidth) / 2;
          offsetY = 0;
        }

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        // Blob으로 변환
        canvas.toBlob((blob) => {
          const resizedFile = new File([blob], `icon_${file.name}`, {
            type: 'image/png',
            lastModified: Date.now()
          });

          const dataUrl = canvas.toDataURL('image/png');
          setPreviewUrl(dataUrl);

          // 부모에게 전달
          const iconData = {
            type: 'image',
            file: resizedFile,
            value: null,
            background: 'transparent'
          };
          onIconChange(iconData);
        }, 'image/png', 1.0);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // 이미지 삭제
  const handleRemoveImage = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onIconChange({
      type: 'image',
      file: null,
      value: null,
      background: 'transparent'
    });
  };

  // 현재 아이콘 렌더링
  const renderCurrentIcon = () => {
    if (previewUrl) {
      return (
        <img
          src={previewUrl}
          alt="Preview"
          className="w-16 h-16 rounded object-cover border-2 border-blue-300"
        />
      );
    }

    if (currentIcon) {
      const imgUrl = currentIcon.startsWith('/uploads/')
        ? `${API_BASE_URL}${currentIcon}`
        : currentIcon;
      return (
        <img
          src={imgUrl}
          alt="Badge Icon"
          className="w-16 h-16 rounded object-cover border-2 border-gray-300"
        />
      );
    }

    return (
      <div className="w-16 h-16 rounded bg-gray-200 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300">
        <FontAwesomeIcon icon={faUpload} className="text-xl" />
      </div>
    );
  };

  if (disabled) {
    return (
      <div className="flex items-center gap-3">
        {renderCurrentIcon()}
        <span className="text-sm text-gray-500">아이콘 수정 불가</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 현재 아이콘 미리보기 및 업로드 버튼 */}
      <div className="flex items-center gap-4">
        {renderCurrentIcon()}

        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-outline btn-sm flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faUpload} />
            {previewUrl || currentIcon ? '이미지 변경' : '이미지 업로드'}
          </button>

          {(previewUrl || currentIcon) && (
            <button
              type="button"
              onClick={handleRemoveImage}
              className="btn btn-ghost btn-xs text-red-500 flex items-center gap-1"
              title="이미지 삭제"
            >
              <FontAwesomeIcon icon={faTimes} />
              삭제
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        • 최대 5MB, JPG/PNG/GIF 형식 • 128x128px로 자동 변환됩니다
      </p>
    </div>
  );
};

export default BadgeIconUploader;
