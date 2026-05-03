import React, { useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '../../services';

/**
 * BannerAdImageInput
 * - BannerAdForm 전용 단순 이미지 업로더
 * - 모든 button에 type="button"을 명시해 부모 form의 submit이 트리거되지 않게 함
 * - storageService.uploadAdImage를 객체 메서드로 직접 호출 (this 바인딩 유지)
 *
 * Props:
 *  - value: 현재 image_url
 *  - onChange: (url) => void
 */
const BannerAdImageInput = ({ value = '', onChange }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const validateFile = (file) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const maxBytes = 50 * 1024 * 1024;
    if (!allowed.includes(file.type)) {
      throw new Error('JPG, PNG, GIF, WebP 파일만 업로드 가능합니다.');
    }
    if (file.size > maxBytes) {
      throw new Error('파일 크기는 50MB 이하여야 합니다.');
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    try {
      validateFile(file);
      setUploading(true);
      setProgress(20);

      const adId = uuidv4();
      // storageService를 객체로 호출 → 내부 this.uploadFile 바인딩 유지
      const result = await storageService.uploadAdImage(adId, file, (p) => {
        if (typeof p === 'number') setProgress(20 + Math.round(p * 0.7));
      });

      setProgress(100);
      const url = result?.url || '';
      if (!url) throw new Error('업로드는 완료되었지만 URL을 받지 못했습니다.');

      onChange?.(url);
    } catch (err) {
      console.error('배너 이미지 업로드 실패:', err);
      setError(err?.message || '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 600);
    }
  };

  const handleSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ''; // 같은 파일 재선택 가능하게
  };

  const handleRemove = () => {
    onChange?.('');
    setError(null);
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSelect}
      />

      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="배너 미리보기"
            className="w-full max-w-xs h-auto rounded-lg border border-base-300 object-contain bg-base-200"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-sm btn-outline"
              disabled={uploading}
            >
              이미지 변경
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="btn btn-sm btn-ghost text-red-500"
              disabled={uploading}
            >
              삭제
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-xs h-32 border-2 border-dashed border-base-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-base-200 transition-colors"
          disabled={uploading}
        >
          <svg className="w-8 h-8 text-base-content/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <span className="text-sm text-base-content/60">이미지 선택</span>
          <span className="text-[11px] text-base-content/40">JPG · PNG · WebP (최대 50MB)</span>
        </button>
      )}

      {uploading && (
        <div className="flex items-center gap-2 text-xs text-base-content/70">
          <span className="loading loading-spinner loading-xs" />
          업로드 중… {progress}%
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500">⚠ {error}</p>
      )}
    </div>
  );
};

export default BannerAdImageInput;
