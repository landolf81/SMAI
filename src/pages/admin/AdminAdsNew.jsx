import { useState, useEffect, useCallback } from 'react';
import CampaignIcon from "@mui/icons-material/Campaign";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import { AdminOnly } from '../../components/PermissionComponents';
import { adService, storageService } from '../../services';
import { getImageUrl } from '../../config/api';
import { getAcceptedFileTypes } from '../../utils/mediaUtils';
import MediaGallery from '../../components/MediaGallery';
import AdminAdCard from '../../components/AdminAdCard';
import { v4 as uuidv4 } from 'uuid';

const AdminAdsNew = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentView, setCurrentView] = useState('list'); // 'list', 'create', 'edit'
  const [editingAd, setEditingAd] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewAd, setPreviewAd] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0
  });

  // 폼 데이터
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    image_type: 'upload',
    image_content: '',
    image_alt: '',
    link_url: '',
    start_date: '',
    end_date: '',
    is_active: true,
    priority_boost: 0
  });

  // 광고 목록 조회
  const fetchAds = useCallback(async (page = pagination.page) => {
    try {
      setLoading(true);

      // Supabase에서 광고 목록 조회 (페이징 및 정렬 지원)
      const result = await adService.getAdsWithOptions({
        page,
        limit: pagination.limit,
        sortBy,
        sortOrder
      });

      if (result.ads) {
        // 종료일 지난 광고는 비활성화로 표시
        const processedAds = result.ads.map(ad => {
          if (ad.end_date) {
            const endDate = new Date(ad.end_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // 시간 부분 제거

            if (endDate < today) {
              return { ...ad, is_active: false, expired: true };
            }
          }
          return ad;
        });

        setAds(processedAds);

        // 페이지네이션 정보 업데이트
        setPagination(prev => ({
          ...prev,
          page: result.pagination.page,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('광고 목록 조회 실패:', error);
      setError('광고 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, sortBy, sortOrder]);

  // 광고 삭제
  const handleDelete = async (adId) => {
    if (!confirm('정말로 이 광고를 삭제하시겠습니까?')) return;

    try {
      await adService.deleteAd(adId);
      await fetchAds(); // 목록 새로고침
    } catch (error) {
      console.error('광고 삭제 실패:', error);
      alert('광고 삭제에 실패했습니다.');
    }
  };

  // 광고 상태 토글
  const handleToggleStatus = async (adId) => {
    try {
      await adService.toggleAdStatus(adId);
      await fetchAds(); // 목록 새로고침
    } catch (error) {
      console.error('광고 상태 변경 실패:', error);
      alert('광고 상태 변경에 실패했습니다.');
    }
  };

  // 광고 저장 (생성/수정) - Supabase
  const handleSave = async () => {
    if (!formData.title || !formData.content) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      console.log('=== 광고 저장 시작 ===');
      console.log('Edit Mode:', !!editingAd);
      console.log('Selected Files:', selectedFiles);

      if (editingAd) {
        // 수정 모드
        console.log('광고 수정 모드');

        let imageUrl = editingAd.image_url;
        let mediaUrls = editingAd.media_urls || [];

        // 새 파일이 선택되었으면 업로드
        if (selectedFiles.length > 0) {
          console.log('새 이미지 업로드 시작...');

          // 첫 번째 파일을 메인 이미지로 업로드
          const mainImageResult = await storageService.uploadAdImage(editingAd.id, selectedFiles[0]);
          imageUrl = mainImageResult.url;
          console.log('메인 이미지 업로드 완료:', imageUrl);

          // 나머지 파일들을 추가 미디어로 업로드
          if (selectedFiles.length > 1) {
            const additionalFiles = selectedFiles.slice(1);
            const additionalUploads = await Promise.all(
              additionalFiles.map(file => storageService.uploadAdImage(editingAd.id, file))
            );
            mediaUrls = additionalUploads.map(result => result.url);
            console.log('추가 미디어 업로드 완료:', mediaUrls);
          }
        }

        // 광고 데이터 업데이트
        const updateData = {
          ...formData,
          image_url: imageUrl,
          is_active: formData.is_active ? true : false
        };

        await adService.updateAd(editingAd.id, updateData);

        // 추가 미디어가 있으면 ad_media 테이블에 저장
        if (mediaUrls.length > 0) {
          await adService.addAdMedia(editingAd.id, mediaUrls);
          console.log('추가 미디어 DB 저장 완료');
        }

        alert('광고가 수정되었습니다.');
      } else {
        // 생성 모드
        console.log('광고 생성 모드');

        // 1. 고유 ID 생성
        const adId = uuidv4();

        // 2. 파일 업로드
        let imageUrl = null;
        let mediaUrls = [];

        if (selectedFiles.length > 0) {
          console.log('이미지 업로드 시작...');

          // 첫 번째 파일을 메인 이미지로 업로드
          const mainImageResult = await storageService.uploadAdImage(adId, selectedFiles[0]);
          imageUrl = mainImageResult.url;
          console.log('메인 이미지 업로드 완료:', imageUrl);

          // 나머지 파일들을 추가 미디어로 업로드
          if (selectedFiles.length > 1) {
            const additionalFiles = selectedFiles.slice(1);
            const additionalUploads = await Promise.all(
              additionalFiles.map(file => storageService.uploadAdImage(adId, file))
            );
            mediaUrls = additionalUploads.map(result => result.url);
            console.log('추가 미디어 업로드 완료:', mediaUrls);
          }
        }

        // 3. 광고 데이터 생성
        const adData = {
          ...formData,
          image_url: imageUrl,
          is_active: formData.is_active ? true : false
        };

        console.log('광고 생성 데이터:', adData);
        const createdAd = await adService.createAd(adData);

        // 추가 미디어가 있으면 ad_media 테이블에 저장
        if (mediaUrls.length > 0 && createdAd?.id) {
          await adService.addAdMedia(createdAd.id, mediaUrls);
          console.log('추가 미디어 DB 저장 완료');
        }

        alert('광고가 생성되었습니다.');
      }

      resetForm();
      setCurrentView('list');
      await fetchAds(1); // 첫 페이지로 이동
      console.log('✅ 광고 저장 완료');
    } catch (error) {
      console.error('❌ 광고 저장 실패:', error);

      let errorMessage = '광고 저장에 실패했습니다.';
      if (error.message) {
        errorMessage += '\n' + error.message;
      }

      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    
    // 첫 번째 파일이 이미지인 경우만 base64로 변환
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({
          ...prev,
          image_content: event.target.result,
          image_type: 'upload'
        }));
      };
      reader.readAsDataURL(files[0]);
    } else if (files.length > 0 && files[0].type.startsWith('video/')) {
      // 동영상인 경우 image_content를 비워둘고 파일로만 처리
      setFormData(prev => ({
        ...prev,
        image_content: '',
        image_type: 'upload'
      }));
    }
  };

  // 파일 제거
  const removeFile = (index) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    
    if (index === 0) {
      // 첫 번째 파일을 제거한 경우 미리보기도 업데이트
      if (newFiles.length > 0 && newFiles[0].type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setFormData(prev => ({ ...prev, image_content: event.target.result }));
        };
        reader.readAsDataURL(newFiles[0]);
      } else {
        setFormData(prev => ({ ...prev, image_content: '' }));
      }
    }
  };

  // 폼 리셋
  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      image_type: 'upload',
      image_content: '',
      image_alt: '',
      link_url: '',
      start_date: '',
      end_date: '',
      is_active: true,
      priority_boost: 0
    });
    setSelectedFiles([]);
    setEditingAd(null);
  };

  // 수정 모드 진입
  const handleEdit = (ad) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title || '',
      content: ad.content || '',
      image_type: ad.image_type || 'upload',
      image_content: ad.image_content || '',
      image_alt: ad.image_alt || '',
      link_url: ad.link_url || '',
      start_date: ad.start_date ? ad.start_date.split('T')[0] : '',
      end_date: ad.end_date ? ad.end_date.split('T')[0] : '',
      is_active: ad.is_active !== undefined ? ad.is_active : true,
      priority_boost: ad.priority_boost || 0
    });
    setSelectedFiles([]);
    setCurrentView('edit');
  };

  // 입력 핸들러
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // 광고 미리보기
  const showAdPreview = (ad) => {
    setPreviewAd(ad);
    setShowPreview(true);
  };

  // 미리보기 닫기
  const closePreview = () => {
    setShowPreview(false);
    setPreviewAd(null);
  };

  // 미디어 변경 핸들러
  const handleMediaChange = () => {
    // 미디어가 변경되었을 때 필요한 로직
  };

  // 미디어 갤러리 열기
  const openMediaGallery = (ad) => {
    setEditingAd(ad);
    setShowMediaGallery(true);
  };

  // 검색 처리
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setPagination(prev => ({ ...prev, page: 1 })); // 검색 시 첫 페이지로
  };

  // 검색 초기화
  const clearSearch = () => {
    setSearchTerm('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // 검색 필터링된 광고 목록
  const filteredAds = ads.filter(ad => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return ad.title.toLowerCase().includes(search) || 
           ad.content.toLowerCase().includes(search);
  });

  // 미디어 타입 확인 헬퍼 함수
  const isVideoFile = (filename) => {
    if (!filename) return false;
    const videoExtensions = ['.mp4', '.webm', '.avi', '.mov', '.wmv'];
    return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  // 페이지네이션 번호 계산 (최대 7개 표시)
  const getPageNumbers = () => {
    const current = pagination.page;
    const total = pagination.totalPages;
    const maxVisible = 7;
    
    if (total <= maxVisible) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, current - half);
    let end = Math.min(total, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  if (loading) {
    return (
      <AdminOnly>
        <div className="flex items-center justify-center min-h-screen">
          <div className="loading loading-spinner loading-lg"></div>
          <span className="ml-4">광고 목록을 불러오는 중...</span>
        </div>
      </AdminOnly>
    );
  }

  return (
    <AdminOnly>
      <div className="p-6 max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CampaignIcon className="text-3xl text-red-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">광고 관리</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>모바일 광고 생성 및 관리</span>
                <div className="flex items-center gap-2">
                  <span className="badge badge-info">총 {pagination.total}개</span>
                  <span className="badge badge-success">활성 {ads.filter(ad => ad.is_active).length}개</span>
                </div>
              </div>
            </div>
          </div>
          
          {currentView === 'list' && (
            <button
              onClick={() => {
                resetForm();
                setCurrentView('create');
              }}
              className="btn btn-primary gap-2"
            >
              <AddIcon />
              새 광고 생성
            </button>
          )}
        </div>

        {/* 에러 표시 */}
        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        {/* 탭 네비게이션 */}
        <div className="tabs tabs-boxed w-fit mb-6">
          <button 
            className={`tab ${currentView === 'list' ? 'tab-active' : ''}`}
            onClick={() => setCurrentView('list')}
          >
            광고 목록
          </button>
          <button 
            className={`tab ${currentView === 'create' ? 'tab-active' : ''}`}
            onClick={() => {
              resetForm();
              setCurrentView('create');
            }}
          >
            새 광고 생성
          </button>
          {currentView === 'edit' && (
            <button className="tab tab-active">
              광고 수정
            </button>
          )}
        </div>

        {/* 검색창 - 목록 뷰에서만 표시 */}
        {currentView === 'list' && (
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {/* 검색 */}
            <div className="flex-1 max-w-md min-w-64">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="광고 제목이나 내용으로 검색..."
                  className="input input-bordered w-full pr-10"
                />
                {searchTerm && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            
            {/* 정렬 옵션 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">정렬:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="select select-bordered select-sm"
              >
                <option value="created_at">생성일</option>
                <option value="view_count">노출수</option>
                <option value="click_count">클릭수</option>
                <option value="id">ID</option>
                <option value="title">제목</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="select select-bordered select-sm"
              >
                <option value="DESC">내림차순</option>
                <option value="ASC">오름차순</option>
              </select>
            </div>
            
            {searchTerm && (
              <div className="text-sm text-gray-500">
                "{searchTerm}" 검색 결과
              </div>
            )}
          </div>
        )}

        {/* 광고 목록 뷰 */}
        {currentView === 'list' && (
          <div className="space-y-4">
            {filteredAds.length === 0 ? (
              <div className="text-center py-12">
                <CampaignIcon className="text-6xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">
                  {searchTerm ? `"${searchTerm}"에 대한 검색 결과가 없습니다.` : '등록된 광고가 없습니다.'}
                </p>
                <button
                  onClick={() => {
                    resetForm();
                    setCurrentView('create');
                  }}
                  className="btn btn-primary gap-2"
                >
                  <AddIcon />
                  첫 번째 광고 생성하기
                </button>
              </div>
            ) : (
              <>
                {/* 카드 뷰 - 모바일 광고 형식 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredAds.map((ad) => (
                    <AdminAdCard
                      key={ad.id}
                      ad={ad}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleStatus={handleToggleStatus}
                    />
                  ))}
                </div>

                {/* 페이지네이션 */}
                {pagination.totalPages > 1 && (
                  <div className="flex justify-center mt-8">
                    <div className="join">
                      <button 
                        className="join-item btn"
                        disabled={pagination.page === 1}
                        onClick={() => fetchAds(pagination.page - 1)}
                      >
                        이전
                      </button>
                      
                      {/* 첫 페이지와 ... 표시 */}
                      {pagination.page > 4 && (
                        <>
                          <button
                            className="join-item btn"
                            onClick={() => fetchAds(1)}
                          >
                            1
                          </button>
                          {pagination.page > 5 && (
                            <span className="join-item btn btn-disabled">...</span>
                          )}
                        </>
                      )}
                      
                      {/* 현재 페이지 주변 번호들 */}
                      {getPageNumbers().map(page => (
                        <button
                          key={page}
                          className={`join-item btn ${page === pagination.page ? 'btn-active' : ''}`}
                          onClick={() => fetchAds(page)}
                        >
                          {page}
                        </button>
                      ))}
                      
                      {/* 마지막 페이지와 ... 표시 */}
                      {pagination.page < pagination.totalPages - 3 && (
                        <>
                          {pagination.page < pagination.totalPages - 4 && (
                            <span className="join-item btn btn-disabled">...</span>
                          )}
                          <button
                            className="join-item btn"
                            onClick={() => fetchAds(pagination.totalPages)}
                          >
                            {pagination.totalPages}
                          </button>
                        </>
                      )}
                      
                      <button 
                        className="join-item btn"
                        disabled={pagination.page === pagination.totalPages}
                        onClick={() => fetchAds(pagination.page + 1)}
                      >
                        다음
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 광고 생성/수정 폼 */}
        {(currentView === 'create' || currentView === 'edit') && (
          <div className="space-y-6">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-xl mb-6">
                  {currentView === 'edit' ? '광고 수정' : '새 광고 생성'}
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 기본 정보 */}
                  <div className="space-y-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">제목</span>
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        className="input input-bordered w-full"
                        placeholder="광고 제목을 입력하세요"
                      />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">내용</span>
                      </label>
                      <textarea
                        name="content"
                        value={formData.content}
                        onChange={handleInputChange}
                        className="textarea textarea-bordered h-32"
                        placeholder="광고 내용을 입력하세요"
                      />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">미디어 업로드 (이미지/동영상)</span>
                      </label>
                      
                      {/* 이미지 비율 가이드 */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                          <span className="text-sm font-semibold text-blue-800">📱 모바일 광고 최적 비율</span>
                        </div>
                        <div className="text-sm text-blue-700 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-100 px-2 py-1 rounded text-xs font-mono">1:1 정사각형</span>
                            <span>권장 사이즈: 1080x1080px</span>
                          </div>
                          <div className="text-xs text-blue-600">
                            ⚠️ 다른 비율도 지원하지만, 1:1 비율에서 가장 최적화됩니다
                          </div>
                        </div>
                      </div>
                      
                      <input
                        type="file"
                        multiple
                        accept={getAcceptedFileTypes()}
                        onChange={handleFileSelect}
                        className="file-input file-input-bordered w-full"
                      />
                      
                      {/* 선택된 파일 목록 - 썸네일 미리보기 포함 */}
                      {selectedFiles.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm font-medium">선택된 파일 ({selectedFiles.length}개):</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {selectedFiles.map((file, index) => (
                              <div key={index} className="relative group">
                                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                                  {file.type.startsWith('image/') ? (
                                    <img
                                      src={URL.createObjectURL(file)}
                                      alt={file.name}
                                      className="w-full h-full object-cover"
                                      onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                                    />
                                  ) : file.type.startsWith('video/') ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-white">
                                      <svg className="w-8 h-8 mb-1" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z"/>
                                      </svg>
                                      <span className="text-xs">동영상</span>
                                    </div>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                      <span className="text-xs">파일</span>
                                    </div>
                                  )}
                                  {/* 메인 이미지 표시 */}
                                  {index === 0 && (
                                    <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                                      메인
                                    </div>
                                  )}
                                </div>
                                {/* 삭제 버튼 */}
                                <button
                                  type="button"
                                  onClick={() => removeFile(index)}
                                  className="absolute -top-2 -right-2 btn btn-xs btn-circle btn-error opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  ✕
                                </button>
                                {/* 파일 정보 */}
                                <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
                                <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)}MB</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 수정 모드: 기존 미디어 미리보기 (새 파일 선택 없을 때) */}
                      {selectedFiles.length === 0 && editingAd && (editingAd.image_url || (editingAd.media_urls && editingAd.media_urls.length > 0)) && (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm font-medium">현재 등록된 미디어:</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {/* 메인 이미지 */}
                            {editingAd.image_url && (
                              <div className="relative">
                                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-blue-300">
                                  {isVideoFile(editingAd.image_url) ? (
                                    <video
                                      src={getImageUrl(editingAd.image_url)}
                                      className="w-full h-full object-cover"
                                      muted
                                    />
                                  ) : (
                                    <img
                                      src={getImageUrl(editingAd.image_url)}
                                      alt="메인 이미지"
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                                    메인
                                  </div>
                                </div>
                              </div>
                            )}
                            {/* 추가 미디어 */}
                            {editingAd.media_urls && editingAd.media_urls.map((url, index) => (
                              <div key={index} className="relative">
                                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                                  {isVideoFile(url) ? (
                                    <video
                                      src={getImageUrl(url)}
                                      className="w-full h-full object-cover"
                                      muted
                                    />
                                  ) : (
                                    <img
                                      src={getImageUrl(url)}
                                      alt={`추가 미디어 ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500">새 파일을 선택하면 기존 미디어가 교체됩니다.</p>
                        </div>
                      )}
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">이미지 대체 텍스트</span>
                      </label>
                      <input
                        type="text"
                        name="image_alt"
                        value={formData.image_alt}
                        onChange={handleInputChange}
                        className="input input-bordered w-full"
                        placeholder="이미지 설명 (접근성)"
                      />
                    </div>

                    {/* 미디어 갤러리 버튼 - 수정 모드에서만 */}
                    {editingAd && (
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-medium">미디어 갤러리 관리</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => openMediaGallery(editingAd)}
                          className="btn btn-outline gap-2"
                        >
                          <PhotoLibraryIcon />
                          미디어 갤러리 열기
                        </button>
                        <label className="label">
                          <span className="label-text-alt text-gray-500">기존 미디어를 개별적으로 관리하려면 갤러리를 열어주세요</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* 링크 및 설정 */}
                  <div className="space-y-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">링크 URL (선택)</span>
                      </label>
                      <input
                        type="url"
                        name="link_url"
                        value={formData.link_url}
                        onChange={handleInputChange}
                        className="input input-bordered w-full"
                        placeholder="https://example.com"
                      />
                      <label className="label">
                        <span className="label-text-alt text-gray-500">클릭 시 이동할 외부 링크 (비워두면 내용만 표시)</span>
                      </label>
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">시작일</span>
                      </label>
                      <input
                        type="date"
                        name="start_date"
                        value={formData.start_date}
                        onChange={handleInputChange}
                        className="input input-bordered w-full"
                      />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">종료일</span>
                      </label>
                      <input
                        type="date"
                        name="end_date"
                        value={formData.end_date}
                        onChange={handleInputChange}
                        className="input input-bordered w-full"
                      />
                    </div>

                    <div className="form-control">
                      <label className="label cursor-pointer">
                        <span className="label-text font-medium">활성 상태</span>
                        <input
                          type="checkbox"
                          name="is_active"
                          checked={formData.is_active}
                          onChange={handleInputChange}
                          className="checkbox checkbox-primary"
                        />
                      </label>
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">우선순위 부스팅</span>
                        <span className="label-text-alt text-info">현재: +{formData.priority_boost}</span>
                      </label>
                      <div className="space-y-3">
                        <input
                          type="range"
                          name="priority_boost"
                          min="0"
                          max="100"
                          value={formData.priority_boost}
                          onChange={handleInputChange}
                          className="range range-primary"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>기본 (0)</span>
                          <span>중간 (50)</span>
                          <span>최고 (100)</span>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            <span className="text-sm font-medium text-blue-800">우선순위 부스팅 안내</span>
                          </div>
                          <div className="text-xs text-blue-700 space-y-1">
                            <div><strong>0-30:</strong> 기본 노출 (기한 중심)</div>
                            <div><strong>31-70:</strong> 우선 노출 (일반적 부스팅)</div>
                            <div><strong>71-100:</strong> 최우선 노출 (긴급 광고)</div>
                            <div className="text-blue-600 mt-2">
                              💡 <strong>tip:</strong> 부스팅 값은 기한 긴급도에 추가로 더해집니다
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 저장 버튼 */}
                <div className="card-actions justify-end mt-6 pt-6 border-t">
                  <button
                    onClick={() => {
                      resetForm();
                      setCurrentView('list');
                    }}
                    className="btn btn-outline gap-2"
                  >
                    <CancelIcon />
                    취소
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn btn-primary gap-2"
                  >
                    {saving ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      <SaveIcon />
                    )}
                    {saving ? '저장 중...' : (currentView === 'edit' ? '수정' : '생성')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 광고 미리보기 모달 */}
        {showPreview && previewAd && (
          <div className="modal modal-open">
            <div className="modal-box max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">광고 미리보기</h3>
                <button 
                  onClick={closePreview}
                  className="btn btn-ghost btn-sm btn-circle"
                >
                  ✕
                </button>
              </div>
              
              {/* 모바일 광고 미리보기 */}
              <div className="mockup-phone border-primary max-w-xs mx-auto">
                <div className="camera"></div> 
                <div className="display">
                  <div className="artboard artboard-demo phone-1 bg-gray-100 p-2">
                    {/* 인스타그램 스타일 광고 카드 */}
                    <div className="bg-white rounded-xl overflow-hidden shadow-lg"
                         style={{
                           boxShadow: "0px 3px 10px rgba(0, 0, 0, 0.1), -3px 0px 10px rgba(255, 165, 0, 0.3)"
                         }}>
                      
                      {/* 광고 헤더 */}
                      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-gradient-to-r from-orange-400 to-pink-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">AD</span>
                          </div>
                          <span className="text-xs font-semibold text-gray-900">스폰서</span>
                        </div>
                        <span className="text-xs text-gray-500">광고</span>
                      </div>

                      {/* 메인 미디어 */}
                      <div className="relative">
                        {isVideoFile(previewAd.image_content) ? (
                          <video 
                            src={getImageUrl(previewAd.image_content)}
                            className="w-full h-48 object-cover"
                            autoPlay
                            loop
                            muted={false}
                            controls
                            playsInline
                            preload="metadata"
                            onLoadStart={() => console.log('Video load started')}
                            onCanPlay={() => console.log('Video can play')}
                            onError={(e) => console.error('Video error:', e)}
                          />
                        ) : (
                          <img 
                            src={getImageUrl(previewAd.image_content)} 
                            alt={previewAd.image_alt || previewAd.title}
                            className="w-full h-48 object-cover"
                          />
                        )}
                        
                        {/* 광고 배지 */}
                        <div className="absolute top-2 right-2">
                          <span className="bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded-full">
                            AD
                          </span>
                        </div>
                        
                        {/* 그라데이션 오버레이 (동영상이 아닐 때만) */}
                        {!isVideoFile(previewAd.image_content) && (
                          <>
                            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/50 to-transparent"></div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
                          </>
                        )}
                      </div>

                      {/* 콘텐츠 영역 */}
                      <div className="p-3">
                        {/* 제목 */}
                        <h3 className="font-bold text-sm text-gray-900 mb-1 line-clamp-1">
                          {previewAd.title}
                        </h3>
                        
                        {/* 내용 */}
                        <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                          {previewAd.content}
                        </p>
                        
                        {/* 액션 버튼 */}
                        <button className="w-full bg-blue-500 text-white text-xs py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors">
                          자세히 보기
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 광고 정보 */}
              <div className="mt-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-semibold">상태:</span>
                    <span className={`ml-1 ${previewAd.is_active ? 'text-green-600' : 'text-red-600'}`}>
                      {previewAd.is_active ? '활성' : '비활성'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">링크:</span>
                    <span className="ml-1">{previewAd.link_url ? '외부링크' : '없음'}</span>
                  </div>
                  {previewAd.start_date && (
                    <div>
                      <span className="font-semibold">시작:</span>
                      <span className="ml-1">{new Date(previewAd.start_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {previewAd.end_date && (
                    <div>
                      <span className="font-semibold">종료:</span>
                      <span className="ml-1">{new Date(previewAd.end_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-action">
                <button onClick={closePreview} className="btn btn-outline">
                  닫기
                </button>
              </div>
            </div>
            <div className="modal-backdrop" onClick={closePreview}></div>
          </div>
        )}
        
        {/* 미디어 갤러리 모달 */}
        {showMediaGallery && (
          <div className="modal modal-open">
            <div className="modal-box max-w-4xl w-11/12">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">미디어 갤러리 - {editingAd?.title}</h3>
                <button
                  onClick={() => setShowMediaGallery(false)}
                  className="btn btn-sm btn-circle btn-ghost"
                >
                  ✕
                </button>
              </div>
              
              <MediaGallery
                adId={editingAd?.id}
                onMediaChange={handleMediaChange}
              />
              
              <div className="modal-action">
                <button
                  onClick={() => setShowMediaGallery(false)}
                  className="btn btn-outline"
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => setShowMediaGallery(false)}></div>
          </div>
        )}
      </div>
    </AdminOnly>
  );
};

export default AdminAdsNew;