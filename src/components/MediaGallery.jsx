import React, { useState, useEffect } from 'react';
import { storageService, adService } from '../services';
import { getImageUrl } from '../config/api';
import { validateUploadFile, getAcceptedFileTypes } from '../utils/mediaUtils';
import ImageIcon from '@mui/icons-material/Image';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import DeleteIcon from '@mui/icons-material/Delete';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const MediaGallery = ({ adId, onMediaChange }) => {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // 미디어 목록 조회 (Supabase)
  const fetchMedia = async () => {
    if (!adId) return;

    try {
      setLoading(true);
      const data = await adService.getAdMedia(adId);
      setMedia(data || []);
      if (onMediaChange) {
        onMediaChange(data || []);
      }
    } catch (error) {
      console.error('미디어 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 미디어 업로드 (Supabase)
  const handleFileUpload = async (files) => {
    if (!adId || !files || files.length === 0) return;

    try {
      setUploading(true);

      // 파일 크기 및 브라우저 호환성 검증
      const validFiles = [];
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) { // 50MB 제한
          alert(`파일 "${file.name}"의 크기가 너무 큽니다. (최대 50MB)`);
          continue;
        }

        // 브라우저 호환 검증
        const validation = validateUploadFile(file);
        if (!validation.valid) {
          alert(validation.message);
          continue;
        }

        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        setUploading(false);
        return;
      }

      // 1. Supabase Storage에 파일 업로드
      console.log('미디어 파일 업로드 시작...', validFiles.length, '개');
      const uploadPromises = validFiles.map(file =>
        storageService.uploadAdImage(adId, file)
      );
      const uploadResults = await Promise.all(uploadPromises);
      const mediaUrls = uploadResults.map(result => result.url);
      console.log('업로드 완료:', mediaUrls);

      // 2. 데이터베이스에 미디어 정보 저장
      await adService.addAdMedia(adId, mediaUrls);

      // 3. 목록 갱신
      await fetchMedia();
      alert(`${validFiles.length}개 파일이 업로드되었습니다.`);
    } catch (error) {
      console.error('미디어 업로드 실패:', error);
      alert('미디어 업로드에 실패했습니다: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 미디어 삭제 (Supabase)
  const handleDeleteMedia = async (mediaId) => {
    if (!confirm('이 미디어를 삭제하시겠습니까?')) return;

    try {
      await adService.deleteAdMedia(mediaId);
      await fetchMedia();
      alert('미디어가 삭제되었습니다.');
    } catch (error) {
      console.error('미디어 삭제 실패:', error);
      alert('미디어 삭제에 실패했습니다: ' + error.message);
    }
  };

  // 미디어 순서 변경
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    try {
      // 새로운 순서 계산
      const newMedia = [...media];
      const draggedItem = newMedia[draggedIndex];
      newMedia.splice(draggedIndex, 1);
      newMedia.splice(dropIndex, 0, draggedItem);

      // 순서 업데이트 데이터 생성
      const mediaOrder = newMedia.map((item, index) => ({
        id: item.id,
        display_order: index
      }));

      // Supabase로 순서 업데이트
      await adService.updateMediaOrder(mediaOrder);
      setMedia(newMedia);

      if (onMediaChange) {
        onMediaChange(newMedia);
      }
    } catch (error) {
      console.error('미디어 순서 변경 실패:', error);
      alert('미디어 순서 변경에 실패했습니다: ' + error.message);
    } finally {
      setDraggedIndex(null);
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
      e.target.value = ''; // 같은 파일 선택 시 다시 업로드 가능하도록
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [adId]);

  if (!adId) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <p className="text-gray-500">광고를 먼저 저장한 후 미디어를 업로드할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 업로드 영역 */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
        <input
          type="file"
          id="media-upload"
          multiple
          accept={getAcceptedFileTypes()}
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        <label
          htmlFor="media-upload"
          className={`cursor-pointer flex flex-col items-center gap-2 ${uploading ? 'opacity-50' : ''}`}
        >
          <AddPhotoAlternateIcon className="text-4xl text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-700">
              {uploading ? '업로드 중...' : '이미지 또는 동영상 선택'}
            </p>
            <p className="text-xs text-gray-500">
              JPG, PNG, GIF, MP4, MOV 등 (최대 50MB, 여러 파일 선택 가능)
            </p>
          </div>
        </label>
      </div>

      {/* 미디어 목록 */}
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="loading loading-spinner loading-md"></div>
        </div>
      ) : media.length === 0 ? (
        <div className="text-center p-8 text-gray-500">
          <ImageIcon className="text-4xl mb-2" />
          <p>업로드된 미디어가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className="relative group bg-white rounded-lg shadow-sm border overflow-hidden cursor-move"
            >
              {/* 드래그 핸들 */}
              <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <DragIndicatorIcon className="text-white text-shadow" />
              </div>

              {/* 미디어 컨텐츠 */}
              <div className="aspect-square relative">
                {item.media_type === 'image' ? (
                  <img
                    src={getImageUrl(item.media_url)}
                    alt={item.caption || `미디어 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-black flex items-center justify-center relative">
                    {item.thumbnail_url ? (
                      <img
                        src={getImageUrl(item.thumbnail_url)}
                        alt={item.caption || `동영상 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <VideoFileIcon className="text-6xl text-white" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PlayArrowIcon className="text-4xl text-white opacity-80" />
                    </div>
                  </div>
                )}
              </div>

              {/* 미디어 정보 */}
              <div className="p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {item.media_type === 'image' ? (
                      <ImageIcon className="text-sm text-gray-500" />
                    ) : (
                      <VideoFileIcon className="text-sm text-gray-500" />
                    )}
                    <span className="text-xs text-gray-600 capitalize">
                      {item.media_type}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">#{index + 1}</span>
                </div>
                
                {item.caption && (
                  <p className="text-xs text-gray-600 mt-1 truncate" title={item.caption}>
                    {item.caption}
                  </p>
                )}
              </div>

              {/* 삭제 버튼 */}
              <button
                onClick={() => handleDeleteMedia(item.id)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <DeleteIcon className="text-sm" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 미디어 개수 표시 */}
      {media.length > 0 && (
        <div className="text-sm text-gray-600 text-center">
          총 {media.length}개의 미디어 파일
        </div>
      )}
    </div>
  );
};

export default MediaGallery;