import { useState, useEffect, useCallback } from 'react';
import CampaignIcon from "@mui/icons-material/Campaign";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import SearchIcon from "@mui/icons-material/Search";
import SortIcon from "@mui/icons-material/Sort";
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
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 pt-20">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <span className="text-gray-600 font-medium">광고 목록을 불러오는 중...</span>
          </div>
        </div>
      </AdminOnly>
    );
  }

  return (
    <AdminOnly>
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
        <div className="px-4 sm:px-6 pt-20 pb-6 max-w-7xl mx-auto">
          {/* 헤더 */}
          <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <CampaignIcon className="text-white" style={{ fontSize: 28 }} />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">광고 관리</h1>
                  <p className="text-xs text-gray-500">모바일 광고 생성 및 관리</p>
                </div>
              </div>

              {/* 통계 뱃지 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                  총 {pagination.total}개
                </span>
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  활성 {ads.filter(ad => ad.is_active).length}개
                </span>
                {currentView === 'list' && (
                  <button
                    onClick={() => {
                      resetForm();
                      setCurrentView('create');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                  >
                    <AddIcon style={{ fontSize: 20 }} />
                    <span className="hidden sm:inline">새 광고</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 에러 표시 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* 검색창 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* 검색 */}
                <div className="flex-1">
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style={{ fontSize: 20 }} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={handleSearch}
                      placeholder="광고 제목이나 내용으로 검색..."
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                    />
                    {searchTerm && (
                      <button
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* 정렬 옵션 */}
                <div className="flex items-center gap-2">
                  <SortIcon className="text-gray-400" style={{ fontSize: 20 }} />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                  >
                    <option value="created_at">생성일</option>
                    <option value="view_count">노출수</option>
                    <option value="click_count">클릭수</option>
                    <option value="title">제목</option>
                  </select>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                  >
                    <option value="DESC">내림차순</option>
                    <option value="ASC">오름차순</option>
                  </select>
                </div>
              </div>

              {searchTerm && (
                <div className="mt-3 text-sm text-gray-500">
                  &quot;{searchTerm}&quot; 검색 결과: {filteredAds.length}개
                </div>
              )}
          </div>

          {/* 광고 목록 */}
          <div className="space-y-6">
              {filteredAds.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CampaignIcon className="text-gray-300" style={{ fontSize: 40 }} />
                  </div>
                  <p className="text-gray-500 mb-4 text-lg">
                    {searchTerm ? `"${searchTerm}"에 대한 검색 결과가 없습니다.` : '등록된 광고가 없습니다.'}
                  </p>
                  <button
                    onClick={() => {
                      resetForm();
                      setCurrentView('create');
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                  >
                    <AddIcon />
                    첫 번째 광고 생성하기
                  </button>
                </div>
              ) : (
                <>
                  {/* 카드 뷰 - 모바일 광고 형식 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
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
                      <div className="inline-flex items-center gap-1 bg-white rounded-xl shadow-sm border border-gray-100 p-1">
                        <button
                          className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          disabled={pagination.page === 1}
                          onClick={() => fetchAds(pagination.page - 1)}
                        >
                          이전
                        </button>

                        {/* 첫 페이지와 ... 표시 */}
                        {pagination.page > 4 && (
                          <>
                            <button
                              className="w-10 h-10 rounded-lg text-sm font-medium text-gray-600 hover:bg-amber-50 transition-colors"
                              onClick={() => fetchAds(1)}
                            >
                              1
                            </button>
                            {pagination.page > 5 && (
                              <span className="w-10 h-10 flex items-center justify-center text-gray-400">...</span>
                            )}
                          </>
                        )}

                        {/* 현재 페이지 주변 번호들 */}
                        {getPageNumbers().map(page => (
                          <button
                            key={page}
                            className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                              page === pagination.page
                                ? 'bg-amber-500 text-white'
                                : 'text-gray-600 hover:bg-amber-50'
                            }`}
                            onClick={() => fetchAds(page)}
                          >
                            {page}
                          </button>
                        ))}

                        {/* 마지막 페이지와 ... 표시 */}
                        {pagination.page < pagination.totalPages - 3 && (
                          <>
                            {pagination.page < pagination.totalPages - 4 && (
                              <span className="w-10 h-10 flex items-center justify-center text-gray-400">...</span>
                            )}
                            <button
                              className="w-10 h-10 rounded-lg text-sm font-medium text-gray-600 hover:bg-amber-50 transition-colors"
                              onClick={() => fetchAds(pagination.totalPages)}
                            >
                              {pagination.totalPages}
                            </button>
                          </>
                        )}

                        <button
                          className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

          {/* 광고 생성/수정 모달 */}
          {(currentView === 'create' || currentView === 'edit') && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
              {/* 폼 헤더 */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {currentView === 'edit' ? '광고 수정' : '새 광고 생성'}
                    </h2>
                    <p className="text-amber-100 text-sm mt-1">
                      {currentView === 'edit' ? '기존 광고 정보를 수정합니다' : '새로운 모바일 광고를 생성합니다'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      resetForm();
                      setCurrentView('list');
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* 기본 정보 */}
                  <div className="space-y-5">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <span className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm">1</span>
                      기본 정보
                    </h3>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        제목 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                        placeholder="광고 제목을 입력하세요"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        내용 <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="content"
                        value={formData.content}
                        onChange={handleInputChange}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all resize-none"
                        placeholder="광고 내용을 입력하세요"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        미디어 업로드
                      </label>

                      {/* 이미지 비율 가이드 */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                          <span className="text-sm font-semibold text-amber-800">모바일 광고 최적 비율</span>
                        </div>
                        <div className="text-sm text-amber-700 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="bg-amber-200/50 px-2 py-1 rounded text-xs font-mono">1:1 정사각형</span>
                            <span>권장 사이즈: 1080x1080px</span>
                          </div>
                        </div>
                      </div>

                      <div className="relative">
                        <input
                          type="file"
                          multiple
                          accept={getAcceptedFileTypes()}
                          onChange={handleFileSelect}
                          className="hidden"
                          id="file-upload"
                        />
                        <label
                          htmlFor="file-upload"
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50/50 transition-all"
                        >
                          <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span className="text-sm text-gray-500">클릭하여 파일 선택</span>
                          <span className="text-xs text-gray-400 mt-1">이미지 또는 동영상</span>
                        </label>
                      </div>

                      {/* 선택된 파일 목록 */}
                      {selectedFiles.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-gray-700 mb-3">선택된 파일 ({selectedFiles.length}개)</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {selectedFiles.map((file, index) => (
                              <div key={index} className="relative group">
                                <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200">
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
                                  ) : null}
                                  {index === 0 && (
                                    <div className="absolute top-1 left-1 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                                      메인
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeFile(index)}
                                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                                <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 수정 모드: 기존 미디어 미리보기 */}
                      {selectedFiles.length === 0 && editingAd && (editingAd.image_url || (editingAd.media_urls && editingAd.media_urls.length > 0)) && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-gray-700 mb-3">현재 등록된 미디어</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {editingAd.image_url && (
                              <div className="relative">
                                <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-amber-300">
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
                                  <div className="absolute top-1 left-1 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                                    메인
                                  </div>
                                </div>
                              </div>
                            )}
                            {editingAd.media_urls && editingAd.media_urls.map((url, index) => (
                              <div key={index} className="relative">
                                <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200">
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
                          <p className="text-xs text-gray-500 mt-2">새 파일을 선택하면 기존 미디어가 교체됩니다.</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        이미지 대체 텍스트
                      </label>
                      <input
                        type="text"
                        name="image_alt"
                        value={formData.image_alt}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                        placeholder="이미지 설명 (접근성)"
                      />
                    </div>

                    {/* 미디어 갤러리 버튼 - 수정 모드에서만 */}
                    {editingAd && (
                      <button
                        type="button"
                        onClick={() => openMediaGallery(editingAd)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/50 transition-all"
                      >
                        <PhotoLibraryIcon />
                        <span>미디어 갤러리 열기</span>
                      </button>
                    )}
                  </div>

                  {/* 링크 및 설정 */}
                  <div className="space-y-5">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <span className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm">2</span>
                      설정
                    </h3>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        링크 URL (선택)
                      </label>
                      <input
                        type="url"
                        name="link_url"
                        value={formData.link_url}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                        placeholder="https://example.com"
                      />
                      <p className="text-xs text-gray-500 mt-1">클릭 시 이동할 외부 링크</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          시작일
                        </label>
                        <input
                          type="date"
                          name="start_date"
                          value={formData.start_date}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          종료일
                        </label>
                        <input
                          type="date"
                          name="end_date"
                          value={formData.end_date}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div>
                        <span className="font-medium text-gray-900">활성 상태</span>
                        <p className="text-xs text-gray-500 mt-0.5">비활성화하면 광고가 표시되지 않습니다</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          name="is_active"
                          checked={formData.is_active}
                          onChange={handleInputChange}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          우선순위 부스팅
                        </label>
                        <span className="text-sm font-semibold text-amber-600">+{formData.priority_boost}</span>
                      </div>
                      <input
                        type="range"
                        name="priority_boost"
                        min="0"
                        max="100"
                        value={formData.priority_boost}
                        onChange={handleInputChange}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>기본 (0)</span>
                        <span>중간 (50)</span>
                        <span>최고 (100)</span>
                      </div>

                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p className="text-xs text-amber-700 space-y-1">
                          <span className="block"><strong>0-30:</strong> 기본 노출</span>
                          <span className="block"><strong>31-70:</strong> 우선 노출</span>
                          <span className="block"><strong>71-100:</strong> 최우선 노출</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 저장 버튼 */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                  <button
                    onClick={() => {
                      resetForm();
                      setCurrentView('list');
                    }}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <CancelIcon style={{ fontSize: 20 }} />
                      취소
                    </span>
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <span className="flex items-center justify-center gap-2">
                      {saving ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <SaveIcon style={{ fontSize: 20 }} />
                      )}
                      {saving ? '저장 중...' : (currentView === 'edit' ? '수정하기' : '생성하기')}
                    </span>
                  </button>
                </div>
              </div>
              </div>
            </div>
          )}

          {/* 광고 미리보기 모달 */}
          {showPreview && previewAd && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                  <h3 className="font-bold text-lg">광고 미리보기</h3>
                  <button
                    onClick={closePreview}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* 모바일 광고 미리보기 */}
                <div className="p-4">
                  <div className="bg-white rounded-xl overflow-hidden shadow-lg border border-gray-200">
                    {/* 광고 헤더 */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">AD</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-900">스폰서</span>
                      </div>
                      <span className="text-xs text-gray-500">광고</span>
                    </div>

                    {/* 메인 미디어 */}
                    <div className="relative aspect-square bg-gray-100">
                      {isVideoFile(previewAd.image_content) ? (
                        <video
                          src={getImageUrl(previewAd.image_content)}
                          className="w-full h-full object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={getImageUrl(previewAd.image_content)}
                          alt={previewAd.image_alt || previewAd.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* 콘텐츠 영역 */}
                    <div className="p-4">
                      <h3 className="font-bold text-base text-gray-900 mb-2">
                        {previewAd.title}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-3">
                        {previewAd.content}
                      </p>
                      {previewAd.link_url && (
                        <button className="w-full mt-3 bg-teal-600 text-white text-sm py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors">
                          상세보기
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 광고 정보 */}
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">상태:</span>
                      <span className={`font-medium ${previewAd.is_active ? 'text-green-600' : 'text-red-600'}`}>
                        {previewAd.is_active ? '활성' : '비활성'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">링크:</span>
                      <span className="font-medium">{previewAd.link_url ? '있음' : '없음'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-gray-100">
                  <button
                    onClick={closePreview}
                    className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 미디어 갤러리 모달 */}
          {showMediaGallery && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold">미디어 갤러리 - {editingAd?.title}</h3>
                  <button
                    onClick={() => setShowMediaGallery(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-4">
                  <MediaGallery
                    adId={editingAd?.id}
                    onMediaChange={handleMediaChange}
                  />
                </div>

                <div className="p-4 border-t border-gray-100">
                  <button
                    onClick={() => setShowMediaGallery(false)}
                    className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminOnly>
  );
};

export default AdminAdsNew;
