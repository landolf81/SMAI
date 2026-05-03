import React, { useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '../../services';

/**
 * BannerAdImagesInput
 * - 다중 이미지 업로드 + 순서 변경(↑/↓) + 삭제
 * - 부모는 value(문자열 배열)와 onChange(배열) 받음
 * - 첫 번째 이미지가 primary (DB의 image_url로 저장됨), 나머지가 추가 이미지
 *
 * Props:
 *  - value: string[] (이미지 URL 배열)
 *  - onChange: (urls: string[]) => void
 */
const BannerAdImagesInput = ({ value = [], onChange }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [manualUrl, setManualUrl] = useState('');

  const images = Array.isArray(value) ? value : [];

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

  const uploadOne = async (file) => {
    validateFile(file);
    const adId = uuidv4();
    const result = await storageService.uploadAdImage(adId, file, (p) => {
      if (typeof p === 'number') setProgress(20 + Math.round(p * 0.7));
    });
    const url = result?.url;
    if (!url) throw new Error('업로드 응답에 URL이 없습니다.');
    return url;
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    setProgress(10);

    try {
      const urls = [];
      for (let i = 0; i < files.length; i++) {
        const u = await uploadOne(files[i]);
        urls.push(u);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      onChange?.([...images, ...urls]);
    } catch (err) {
      console.error('배너 이미지 업로드 실패:', err);
      setError(err?.message || '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 600);
    }
  };

  const handleSelect = (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const removeAt = (idx) => {
    const next = images.slice();
    next.splice(idx, 1);
    onChange?.(next);
  };

  const moveUp = (idx) => {
    if (idx <= 0) return;
    const next = images.slice();
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange?.(next);
  };

  const moveDown = (idx) => {
    if (idx >= images.length - 1) return;
    const next = images.slice();
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    onChange?.(next);
  };

  const addManualUrl = () => {
    const url = manualUrl.trim();
    if (!url) return;
    onChange?.([...images, url]);
    setManualUrl('');
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleSelect}
      />

      {/* 이미지 리스트 */}
      {images.length > 0 && (
        <ul className="space-y-2">
          {images.map((url, idx) => (
            <li
              key={`${url}-${idx}`}
              className="flex items-center gap-2 bg-base-100 border border-base-300 rounded-lg p-2"
            >
              <img
                src={url}
                alt={`이미지 ${idx + 1}`}
                className="w-20 h-12 object-cover rounded bg-base-200 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">
                  {idx === 0 ? '🟢 기본(첫 화면)' : `추가 #${idx}`}
                </p>
                <p className="text-[11px] text-base-content/60 truncate font-mono">{url}</p>
              </div>
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  className="btn btn-xs btn-ghost px-1"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0 || uploading}
                  title="위로"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost px-1"
                  onClick={() => moveDown(idx)}
                  disabled={idx === images.length - 1 || uploading}
                  title="아래로"
                >
                  ↓
                </button>
              </div>
              <button
                type="button"
                className="btn btn-xs btn-ghost text-red-500 shrink-0"
                onClick={() => removeAt(idx)}
                disabled={uploading}
                title="삭제"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 업로드 버튼 */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn btn-sm btn-outline"
          disabled={uploading}
        >
          {images.length === 0 ? '이미지 선택' : '이미지 추가'}
        </button>
        {uploading && (
          <span className="self-center text-xs text-base-content/70 flex items-center gap-1">
            <span className="loading loading-spinner loading-xs" />
            업로드 중… {progress}%
          </span>
        )}
      </div>

      {/* 수동 URL 추가 */}
      <div className="flex gap-2">
        <input
          type="url"
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
          placeholder="이미지 URL 직접 추가 (외부 호스팅 GIF 등)"
          className="input input-bordered input-sm flex-1 font-mono text-xs"
          disabled={uploading}
        />
        <button
          type="button"
          onClick={addManualUrl}
          className="btn btn-sm btn-ghost"
          disabled={uploading || !manualUrl.trim()}
        >
          추가
        </button>
      </div>

      <p className="text-xs text-base-content/60">
        여러 장을 등록하면 4초마다 자동으로 회전 노출됩니다. 첫 이미지가 기본 노출/대표 이미지입니다.
        JPG·PNG·WebP·GIF (최대 50MB).
      </p>

      {error && <p className="text-xs text-red-500">⚠ {error}</p>}
    </div>
  );
};

export default BannerAdImagesInput;
