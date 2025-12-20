import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BadgeIconUploader from '../../components/BadgeIconUploader';
import BadgeDisplay from '../../components/BadgeDisplay';
import toast from 'react-hot-toast';
import { badgeService, userService, storageService } from '../../services';

// Icons
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VerifiedIcon from '@mui/icons-material/Verified';
import SearchIcon from '@mui/icons-material/Search';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';

const AdminBadgesNew = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('manage'); // manage, add, types
  const [searchTerm, setSearchTerm] = useState('');
  const [badgeSearchTerm, setBadgeSearchTerm] = useState(''); // 뱃지 검색용
  const [selectedUser, setSelectedUser] = useState(null); // 선택된 사용자 객체
  const [manageSearchTerm, setManageSearchTerm] = useState(''); // 뱃지 관리 탭 사용자 검색
  
  // 뱃지 추가 폼 상태
  const [badgeForm, setBadgeForm] = useState({
    userId: null, // 단일 사용자 선택
    selectedBadgeTypes: [] // 다중 뱃지 타입 선택
  });
  
  // 뱃지 수정 상태 (삭제됨 - 더 이상 사용하지 않음)
  
  // 뱃지 타입 관리 상태
  const [editingType, setEditingType] = useState(null);
  const [typeForm, setTypeForm] = useState({
    type: '',
    name: '',
    description: '',
    color: '#3B82F6',
    iconType: 'image',  // 이미지만 사용
    iconValue: null,
    iconBackground: 'transparent',
    iconFile: null,
    sortOrder: 0
  });
  
  const [newTypeForm, setNewTypeForm] = useState({
    type: '',
    name: '',
    description: '',
    color: '#3B82F6',
    iconType: 'image',  // 이미지만 사용
    iconValue: null,
    iconBackground: 'transparent',
    iconFile: null,
    sortOrder: 0
  });

  // 뱃지 타입 조회 (Supabase)
  const { data: badgeTypes } = useQuery({
    queryKey: ['badgeTypes'],
    queryFn: () => badgeService.getBadgeTypes()
  });

  // 사용자 목록 조회 (검색용, Supabase)
  const { data: usersResponse } = useQuery({
    queryKey: ['users', searchTerm],
    queryFn: () => userService.getUsers({ search: searchTerm, limit: 20 }),
    enabled: searchTerm.length > 1
  });

  const users = usersResponse?.users || [];

  // 모든 뱃지 데이터 조회 후 프론트엔드에서 그룹화 (Supabase)
  const { data: allBadges, isLoading } = useQuery({
    queryKey: ['allBadges'],
    queryFn: () => badgeService.getAllBadges()
  });

  // 프론트엔드에서 뱃지별로 그룹화 및 검색 필터링
  const badgesByType = React.useMemo(() => {
    if (!allBadges) return [];
    
    const badgeGroups = {};
    
    allBadges.forEach(badge => {
      const key = `${badge.badge_type}_${badge.badge_name}_${badge.badge_color}_${badge.icon_type || ''}_${badge.icon_value || ''}_${badge.icon_background || ''}`;
      
      if (!badgeGroups[key]) {
        badgeGroups[key] = {
          badge_type: badge.badge_type,
          badge_name: badge.badge_name,
          badge_color: badge.badge_color,
          icon_type: badge.icon_type,
          icon_value: badge.icon_value,
          icon_background: badge.icon_background,
          user_count: 0,
          users: []
        };
      }
      
      badgeGroups[key].users.push({
        id: badge.id,
        user_id: badge.user_id,
        username: badge.username,
        user_name: badge.user_name,
        profilePic: badge.profilePic,
        profilePicUrl: badge.profilePicUrl,
        created_at: badge.created_at,
        verified_by_name: badge.verified_by_name
      });
      
      badgeGroups[key].user_count = badgeGroups[key].users.length;
    });
    
    // 배열로 변환
    let result = Object.values(badgeGroups);
    
    // 검색어가 있는 경우 사용자 필터링
    if (manageSearchTerm) {
      result = result.map(badgeGroup => {
        const filteredUsers = badgeGroup.users.filter(user => 
          (user.user_name && user.user_name.toLowerCase().includes(manageSearchTerm.toLowerCase())) ||
          (user.username && user.username.toLowerCase().includes(manageSearchTerm.toLowerCase()))
        );
        
        return {
          ...badgeGroup,
          users: filteredUsers,
          user_count: filteredUsers.length
        };
      }).filter(badgeGroup => badgeGroup.user_count > 0); // 검색 결과가 있는 뱃지만 표시
    }
    
    // 사용자 수 기준으로 정렬
    return result.sort((a, b) => b.user_count - a.user_count);
  }, [allBadges, manageSearchTerm]);

  // 뱃지 추가 뮤테이션 (Supabase)
  const addBadgeMutation = useMutation({
    mutationFn: async (badgeData) => {
      return badgeService.addBadge(badgeData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allBadges'] });
      queryClient.invalidateQueries({ queryKey: ['badges'] });
      resetBadgeForm();
      toast.success('뱃지가 성공적으로 추가되었습니다.');
    },
    onError: (error) => {
      toast.error(`뱃지 추가 실패: ${error.message}`);
    }
  });

  // 뱃지 삭제 뮤테이션 (Supabase)
  const deleteBadgeMutation = useMutation({
    mutationFn: (badgeId) => badgeService.deleteBadge(badgeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allBadges'] });
      toast.success('뱃지가 성공적으로 삭제되었습니다.');
    },
    onError: (error) => {
      toast.error(`뱃지 삭제 실패: ${error.message}`);
    }
  });

  // 뱃지 타입 추가 뮤테이션 (Supabase)
  const addBadgeTypeMutation = useMutation({
    mutationFn: async (typeData) => {
      return badgeService.addBadgeType(typeData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badgeTypes'] });
      resetNewTypeForm();
      toast.success('뱃지 타입이 성공적으로 추가되었습니다.');
    },
    onError: (error) => {
      toast.error(`뱃지 타입 추가 실패: ${error.message}`);
    }
  });

  // 뱃지 타입 수정 뮤테이션 (Supabase)
  const updateBadgeTypeMutation = useMutation({
    mutationFn: async ({ typeId, typeData }) => {
      return badgeService.updateBadgeType(typeId, typeData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badgeTypes'] });
      setEditingType(null);
      toast.success('뱃지 타입이 성공적으로 수정되었습니다.');
    },
    onError: (error) => {
      toast.error(`뱃지 타입 수정 실패: ${error.message}`);
    }
  });

  // 뱃지 타입 삭제 뮤테이션 (Supabase)
  const deleteBadgeTypeMutation = useMutation({
    mutationFn: (typeId) => badgeService.deleteBadgeType(typeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badgeTypes'] });
      toast.success('뱃지 타입이 삭제되었습니다.');
    },
    onError: (error) => {
      toast.error(`뱃지 타입 삭제 실패: ${error.message}`);
    }
  });

  // 폼 리셋 함수들
  const resetBadgeForm = () => {
    setBadgeForm({
      userId: null,
      selectedBadgeTypes: []
    });
    setSelectedUser(null);
    setSearchTerm('');
    setBadgeSearchTerm('');
  };

  const resetNewTypeForm = () => {
    setNewTypeForm({
      type: '',
      name: '',
      description: '',
      color: '#3B82F6',
      iconType: 'color',
      iconValue: null,
      iconBackground: 'transparent',
      iconFile: null,
      sortOrder: 0
    });
  };

  // 사용자 선택 핸들러 (단일 선택)
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setBadgeForm({
      ...badgeForm,
      userId: user.id
    });
    setSearchTerm('');
  };

  // 뱃지 타입 선택 핸들러 (다중 선택)
  const handleBadgeTypeSelect = (badgeType) => {
    const isAlreadySelected = badgeForm.selectedBadgeTypes.some(bt => bt.id === badgeType.id);
    if (!isAlreadySelected) {
      setBadgeForm({
        ...badgeForm,
        selectedBadgeTypes: [...badgeForm.selectedBadgeTypes, badgeType]
      });
    }
  };

  // 선택된 뱃지 타입 제거
  const handleRemoveBadgeType = (badgeTypeId) => {
    setBadgeForm({
      ...badgeForm,
      selectedBadgeTypes: badgeForm.selectedBadgeTypes.filter(bt => bt.id !== badgeTypeId)
    });
  };

  // 아이콘 변경 핸들러 (삭제 - 뱃지 추가에서는 더 이상 필요없음)

  // 뱃지 추가 제출 (단일 사용자, 다중 뱃지) - Supabase
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!badgeForm.userId || !selectedUser) {
      toast.error('사용자를 선택해주세요.');
      return;
    }

    if (badgeForm.selectedBadgeTypes.length === 0) {
      toast.error('최소 하나 이상의 뱃지를 선택해주세요.');
      return;
    }

    // 선택된 뱃지들을 순차적으로 추가
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const badgeType of badgeForm.selectedBadgeTypes) {
        const badgeData = {
          userId: badgeForm.userId,
          badgeType: badgeType.type,
          badgeName: badgeType.name,
          badgeColor: badgeType.color,
          iconType: badgeType.icon_type || 'color',
          iconValue: badgeType.icon_value || null,
          iconBackground: badgeType.icon_background || 'transparent'
        };

        try {
          await addBadgeMutation.mutateAsync(badgeData);
          successCount++;
        } catch (error) {
          console.error('뱃지 추가 실패:', error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${selectedUser.name || selectedUser.username}님에게 ${successCount}개의 뱃지가 추가되었습니다.`);
      }

      if (errorCount > 0) {
        toast.error(`${errorCount}개의 뱃지 추가에 실패했습니다.`);
      }

      // 폼 리셋
      resetBadgeForm();

    } catch (error) {
      toast.error('뱃지 추가 중 오류가 발생했습니다.');
    }
  };

  // 뱃지 타입 추가 제출 (Supabase)
  const handleAddBadgeType = async (e) => {
    e.preventDefault();

    if (!newTypeForm.type || !newTypeForm.name) {
      toast.error('타입과 이름을 입력해주세요.');
      return;
    }

    // 아이콘 파일 필수 검증
    if (!newTypeForm.iconFile) {
      toast.error('아이콘 이미지를 업로드해주세요.');
      return;
    }

    try {
      console.log('📋 newTypeForm 상태:', {
        iconType: newTypeForm.iconType,
        iconFile: newTypeForm.iconFile,
        iconValue: newTypeForm.iconValue
      });

      // 1. 파일 업로드 처리
      let iconValue = newTypeForm.iconValue;

      console.log('📁 배지 아이콘 파일 업로드 시작...');
      const uploadResult = await storageService.uploadBadgeIcon(newTypeForm.type, newTypeForm.iconFile);
      iconValue = uploadResult.url;
      console.log('✅ 업로드 완료:', iconValue);

      // 2. 뱃지 타입 데이터 준비
      const typeData = {
        type: newTypeForm.type,
        name: newTypeForm.name,
        description: newTypeForm.description || '',
        color: newTypeForm.color,
        sortOrder: newTypeForm.sortOrder || 0,
        iconType: newTypeForm.iconType || 'color',
        iconValue: iconValue,
        iconBackground: newTypeForm.iconBackground || 'transparent'
      };

      console.log('📤 전송할 typeData:', typeData);

      // 3. mutation 실행
      addBadgeTypeMutation.mutate(typeData);
    } catch (error) {
      console.error('❌ 뱃지 타입 추가 중 오류:', error);
      toast.error(`파일 업로드 실패: ${error.message}`);
    }
  };

  // 뱃지 타입 수정 제출 (Supabase)
  const handleUpdateBadgeType = async (e) => {
    e.preventDefault();

    try {
      // 1. 파일 업로드가 필요한 경우 먼저 처리
      let iconValue = typeForm.iconValue;

      if (typeForm.iconType === 'image' && typeForm.iconFile) {
        console.log('📁 배지 아이콘 파일 업로드 시작...');
        const uploadResult = await storageService.uploadBadgeIcon(typeForm.type, typeForm.iconFile);
        iconValue = uploadResult.url;
        console.log('✅ 업로드 완료:', iconValue);
      }

      // 2. 뱃지 타입 데이터 준비
      const typeData = {
        type: typeForm.type,
        name: typeForm.name,
        description: typeForm.description || '',
        color: typeForm.color,
        sortOrder: typeForm.sortOrder || 0,
        iconType: typeForm.iconType || 'color',
        iconValue: iconValue,
        iconBackground: typeForm.iconBackground || 'transparent'
      };

      console.log('📤 전송할 typeData:', typeData);

      // 3. mutation 실행
      updateBadgeTypeMutation.mutate({
        typeId: editingType,
        typeData
      });
    } catch (error) {
      console.error('❌ 뱃지 타입 수정 중 오류:', error);
      toast.error(`파일 업로드 실패: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="loading loading-spinner loading-lg"></div>
        <span className="ml-3">뱃지 정보를 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pt-20">
      <div className="bg-white rounded-lg shadow-sm border">
        {/* 헤더 */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <VerifiedIcon className="text-blue-500" />
                뱃지 관리 (아이콘 지원)
              </h1>
              <p className="text-gray-600 mt-1">사용자의 인증 뱃지를 관리하고 아이콘을 설정할 수 있습니다</p>
            </div>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('manage')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'manage'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              뱃지 관리
            </button>
            <button
              onClick={() => setActiveTab('add')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'add'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              뱃지 추가
            </button>
            <button
              onClick={() => setActiveTab('types')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'types'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              뱃지 타입 관리
            </button>
          </nav>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="p-6">
          {activeTab === 'manage' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">뱃지별 발급 현황</h3>
              <p className="text-gray-600 mb-4">각 뱃지별로 발급받은 사용자 목록을 확인하고 개별 뱃지를 삭제할 수 있습니다.</p>
              
              {/* 사용자 검색 */}
              <div className="mb-6">
                <div className="relative max-w-md">
                  <input
                    type="text"
                    value={manageSearchTerm}
                    onChange={(e) => setManageSearchTerm(e.target.value)}
                    placeholder="사용자 이름으로 검색..."
                    className="input input-bordered w-full pl-10"
                  />
                  <SearchIcon className="absolute left-3 top-3 text-gray-400" />
                </div>
                {manageSearchTerm && (
                  <p className="text-sm text-gray-500 mt-2">
                    '{manageSearchTerm}' 검색 결과
                    <button
                      onClick={() => setManageSearchTerm('')}
                      className="ml-2 text-blue-500 hover:text-blue-700"
                    >
                      검색 초기화
                    </button>
                  </p>
                )}
              </div>
              
              {badgesByType && badgesByType.length > 0 ? (
                <div className="space-y-6">
                  {badgesByType.map((badgeGroup, index) => (
                    <div key={index} className="bg-white rounded-lg border shadow-sm">
                      {/* 뱃지 정보 헤더 */}
                      <div className="border-b border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <BadgeDisplay
                              badge={{
                                badge_type: badgeGroup.badge_type,
                                badge_name: badgeGroup.badge_name,
                                badge_color: badgeGroup.badge_color,
                                icon_type: badgeGroup.icon_type,
                                icon_value: badgeGroup.icon_value,
                                icon_background: badgeGroup.icon_background
                              }}
                              size="lg"
                            />
                            <div>
                              <h4 className="font-semibold text-lg">{badgeGroup.badge_name}</h4>
                              <p className="text-sm text-gray-500">타입: {badgeGroup.badge_type}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-blue-600">{badgeGroup.user_count}</div>
                            <div className="text-xs text-gray-500">명이 보유</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* 사용자 목록 */}
                      <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {badgeGroup.users.map((user) => (
                            <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <img
                                  src={user.profilePicUrl || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"%3E%3Ccircle cx="16" cy="16" r="16" fill="%23e5e7eb"/%3E%3Cpath d="M16 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 10c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" fill="%239ca3af"/%3E%3C/svg%3E'}
                                  alt={user.user_name}
                                  className="w-8 h-8 rounded-full transition-opacity duration-300 bg-gray-100"
                                  loading="lazy"
                                  onError={(e) => {
                                    if (e.target.src !== 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"%3E%3Ccircle cx="16" cy="16" r="16" fill="%23e5e7eb"/%3E%3Cpath d="M16 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 10c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" fill="%239ca3af"/%3E%3C/svg%3E') {
                                      console.error('프로필 이미지 로드 실패:', user.profilePicUrl);
                                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"%3E%3Ccircle cx="16" cy="16" r="16" fill="%23e5e7eb"/%3E%3Cpath d="M16 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 10c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" fill="%239ca3af"/%3E%3C/svg%3E';
                                    }
                                  }}
                                />
                                <div>
                                  <div className="font-medium text-sm">{user.user_name || user.username}</div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(user.created_at).toLocaleDateString('ko-KR')}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  if (window.confirm(`${user.user_name || user.username}님의 '${badgeGroup.badge_name}' 뱃지를 삭제하시겠습니까?`)) {
                                    deleteBadgeMutation.mutate(user.id);
                                  }
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="뱃지 삭제"
                              >
                                <DeleteIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        
                        {badgeGroup.users.length === 0 && (
                          <div className="text-center py-4 text-gray-500">
                            <p>이 뱃지를 보유한 사용자가 없습니다.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <VerifiedIcon className="text-6xl text-gray-300 mb-4" />
                  {manageSearchTerm ? (
                    <>
                      <p>'{manageSearchTerm}' 검색 결과가 없습니다.</p>
                      <p className="text-sm">다른 검색어를 입력하거나 검색을 초기화해보세요.</p>
                    </>
                  ) : (
                    <>
                      <p>아직 발급된 뱃지가 없습니다.</p>
                      <p className="text-sm">뱃지 추가 탭에서 사용자에게 뱃지를 발급해보세요.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'add' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">사용자에게 뱃지 추가</h3>
              <p className="text-gray-600 mb-6">먼저 사용자를 선택한 후, 부여할 뱃지들을 검색하여 선택하세요.</p>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 왼쪽: 사용자 선택 */}
                  <div>
                    <div className="bg-gray-50 rounded-lg p-5">
                      <h4 className="text-md font-semibold text-gray-800 mb-4">1단계: 사용자 선택</h4>
                      
                      {/* 사용자 검색 */}
                      <div className="relative mb-4">
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="사용자 이름 또는 아이디 검색"
                          className="input input-bordered w-full pl-10"
                        />
                        <SearchIcon className="absolute left-3 top-3 text-gray-400" />
                        
                        {/* 검색 결과 드롭다운 */}
                        {searchTerm && users && users.length > 0 && !selectedUser && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {users.map((user) => (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => handleUserSelect(user)}
                                className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                              >
                                <img
                                  src={user.profilePicUrl || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"%3E%3Ccircle cx="16" cy="16" r="16" fill="%23e5e7eb"/%3E%3Cpath d="M16 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 10c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" fill="%239ca3af"/%3E%3C/svg%3E'}
                                  alt={user.name}
                                  className="w-8 h-8 rounded-full transition-opacity duration-300 bg-gray-100"
                                  loading="lazy"
                                  onError={(e) => {
                                    if (e.target.src !== 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"%3E%3Ccircle cx="16" cy="16" r="16" fill="%23e5e7eb"/%3E%3Cpath d="M16 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 10c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" fill="%239ca3af"/%3E%3C/svg%3E') {
                                      console.error('프로필 이미지 로드 실패:', user.profilePicUrl);
                                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"%3E%3Ccircle cx="16" cy="16" r="16" fill="%23e5e7eb"/%3E%3Cpath d="M16 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 10c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" fill="%239ca3af"/%3E%3C/svg%3E';
                                    }
                                  }}
                                />
                                <div>
                                  <div className="font-medium">{user.name || user.username}</div>
                                  <div className="text-sm text-gray-500">@{user.username}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* 선택된 사용자 표시 */}
                      {selectedUser ? (
                        <div className="bg-white rounded-lg p-4 border border-blue-300">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <img
                                src={selectedUser.profilePicUrl || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"%3E%3Ccircle cx="24" cy="24" r="24" fill="%23e5e7eb"/%3E%3Cpath d="M24 12a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 15c-6 0-12 3-12 6v3h24v-3c0-3-6-6-12-6z" fill="%239ca3af"/%3E%3C/svg%3E'}
                                alt={selectedUser.name}
                                className="w-12 h-12 rounded-full transition-opacity duration-300 bg-gray-100"
                                loading="lazy"
                                onError={(e) => {
                                  if (e.target.src !== 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"%3E%3Ccircle cx="24" cy="24" r="24" fill="%23e5e7eb"/%3E%3Cpath d="M24 12a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 15c-6 0-12 3-12 6v3h24v-3c0-3-6-6-12-6z" fill="%239ca3af"/%3E%3C/svg%3E') {
                                    console.error('프로필 이미지 로드 실패:', selectedUser.profilePicUrl);
                                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"%3E%3Ccircle cx="24" cy="24" r="24" fill="%23e5e7eb"/%3E%3Cpath d="M24 12a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 15c-6 0-12 3-12 6v3h24v-3c0-3-6-6-12-6z" fill="%239ca3af"/%3E%3C/svg%3E';
                                  }
                                }}
                              />
                              <div>
                                <div className="font-semibold">{selectedUser.name || selectedUser.username}</div>
                                <div className="text-sm text-gray-500">@{selectedUser.username}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUser(null);
                                setBadgeForm({ ...badgeForm, userId: null });
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <DeleteIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          <VerifiedIcon className="text-5xl mb-2" />
                          <p>사용자를 검색하여 선택해주세요</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 오른쪽: 뱃지 선택 */}
                  <div>
                    <div className="bg-gray-50 rounded-lg p-5">
                      <h4 className="text-md font-semibold text-gray-800 mb-4">
                        2단계: 뱃지 선택 ({badgeForm.selectedBadgeTypes.length}개 선택됨)
                      </h4>
                      
                      {/* 뱃지 검색 */}
                      <div className="relative mb-4">
                        <input
                          type="text"
                          value={badgeSearchTerm}
                          onChange={(e) => setBadgeSearchTerm(e.target.value)}
                          placeholder="뱃지 이름으로 검색"
                          className="input input-bordered w-full pl-10"
                          disabled={!selectedUser}
                        />
                        <SearchIcon className="absolute left-3 top-3 text-gray-400" />
                      </div>
                      
                      {/* 뱃지 타입 목록 */}
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {selectedUser ? (
                          badgeTypes?.filter(badgeType => 
                            !badgeSearchTerm || badgeType.name.toLowerCase().includes(badgeSearchTerm.toLowerCase())
                          ).map((badgeType) => {
                            const isSelected = badgeForm.selectedBadgeTypes.some(bt => bt.id === badgeType.id);
                            return (
                              <div
                                key={badgeType.id}
                                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                                  isSelected 
                                    ? 'border-blue-500 bg-blue-50' 
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => {
                                  if (isSelected) {
                                    handleRemoveBadgeType(badgeType.id);
                                  } else {
                                    handleBadgeTypeSelect(badgeType);
                                  }
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="checkbox checkbox-sm"
                                  />
                                  <BadgeDisplay
                                    badge={{
                                      badge_type: badgeType.type,
                                      name: badgeType.name,
                                      color: badgeType.color,
                                      icon_type: badgeType.icon_type,
                                      icon_value: badgeType.icon_value,
                                      icon_url: badgeType.icon_url,
                                      icon_background: badgeType.icon_background
                                    }}
                                    size="md"
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">{badgeType.name}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-8 text-gray-400">
                            <LocalOfferIcon className="text-5xl mb-2" />
                            <p>먼저 사용자를 선택해주세요</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* 선택된 뱃지 요약 */}
                {selectedUser && badgeForm.selectedBadgeTypes.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-3">선택된 뱃지 목록</h4>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {badgeForm.selectedBadgeTypes.map((badgeType) => (
                        <div
                          key={badgeType.id}
                          className="flex items-center gap-2 bg-white px-3 py-1 rounded-full text-sm border border-blue-200"
                        >
                          <BadgeDisplay
                            badge={{
                              badge_type: badgeType.type,
                              name: badgeType.name,
                              color: badgeType.color,
                              icon_type: badgeType.icon_type,
                              icon_value: badgeType.icon_value,
                              icon_url: badgeType.icon_url,
                              icon_background: badgeType.icon_background
                            }}
                            size="sm"
                          />
                          <span>{badgeType.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveBadgeType(badgeType.id)}
                            className="ml-1 text-gray-500 hover:text-gray-700"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-blue-700">
                      <strong>{selectedUser.name || selectedUser.username}</strong>님에게 
                      <strong>{badgeForm.selectedBadgeTypes.length}개</strong>의 뱃지를 추가합니다.
                    </p>
                  </div>
                )}
                
                {/* 제출 버튼 */}
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={resetBadgeForm}
                    className="btn btn-outline"
                  >
                    초기화
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedUser || badgeForm.selectedBadgeTypes.length === 0 || addBadgeMutation.isPending}
                    className={`btn btn-primary ${addBadgeMutation.isPending ? 'loading' : ''}`}
                  >
                    <AddIcon className="mr-2" />
                    {addBadgeMutation.isPending 
                      ? '추가 중...' 
                      : `뱃지 ${badgeForm.selectedBadgeTypes.length}개 추가`
                    }
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'types' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">뱃지 타입 관리</h3>
              
              {/* 새 뱃지 타입 추가 */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h4 className="font-medium mb-4">새 뱃지 타입 추가</h4>
                <form onSubmit={handleAddBadgeType} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={newTypeForm.type}
                      onChange={(e) => setNewTypeForm(prev => ({ ...prev, type: e.target.value }))}
                      placeholder="타입 (예: new_farmer)"
                      className="input input-bordered"
                      required
                    />
                    <input
                      type="text"
                      value={newTypeForm.name}
                      onChange={(e) => setNewTypeForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="이름 (예: 신규농가)"
                      className="input input-bordered"
                      required
                    />
                  </div>

                  <textarea
                    value={newTypeForm.description}
                    onChange={(e) => setNewTypeForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="설명"
                    className="textarea textarea-bordered w-full"
                    rows={2}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        색상
                      </label>
                      <input
                        type="color"
                        value={newTypeForm.color}
                        onChange={(e) => setNewTypeForm(prev => ({ ...prev, color: e.target.value }))}
                        className="w-full h-10 border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        정렬 순서
                      </label>
                      <input
                        type="number"
                        value={newTypeForm.sortOrder}
                        onChange={(e) => setNewTypeForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                        className="input input-bordered w-full"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* 아이콘 업로더 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      뱃지 아이콘 (필수)
                    </label>
                    <BadgeIconUploader
                      onIconChange={(iconData) => {
                        console.log('🎨 아이콘 변경:', iconData);
                        setNewTypeForm(prev => ({
                          ...prev,
                          iconType: iconData.type,
                          iconValue: iconData.value,
                          iconBackground: iconData.background,
                          iconFile: iconData.file
                        }));
                      }}
                      currentIcon={newTypeForm.iconValue}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={addBadgeTypeMutation.isPending}
                  >
                    {addBadgeTypeMutation.isPending ? '추가 중...' : '타입 추가'}
                  </button>
                </form>
              </div>

              {/* 기존 뱃지 타입 목록 */}
              {badgeTypes && badgeTypes.length > 0 ? (
                <div className="space-y-4">
                  {badgeTypes.map((badgeType) => (
                    <div key={badgeType.id} className="bg-white rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <BadgeDisplay
                            badge={{
                              badge_type: badgeType.type,
                              name: badgeType.name,
                              color: badgeType.color,
                              icon_type: badgeType.icon_type,
                              icon_value: badgeType.icon_value,
                              icon_url: badgeType.icon_url,
                              icon_background: badgeType.icon_background
                            }}
                            size="md"
                          />
                          <div>
                            <div className="font-medium">{badgeType.name}</div>
                            <div className="text-sm text-gray-500">{badgeType.type}</div>
                          </div>
                          <div className="text-xs text-gray-400">
                            순서: {badgeType.sort_order || 0}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingType(badgeType.id);
                              setTypeForm({
                                type: badgeType.type,
                                name: badgeType.name,
                                description: badgeType.description || '',
                                color: badgeType.color,
                                iconType: badgeType.icon_type || 'color',
                                iconValue: badgeType.icon_value,
                                iconBackground: badgeType.icon_background,
                                iconFile: null,
                                sortOrder: badgeType.sort_order || 0
                              });
                            }}
                            className="btn btn-outline btn-sm"
                          >
                            <EditIcon className="w-4 h-4" />
                            수정
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('정말로 이 뱃지 타입을 삭제하시겠습니까?')) {
                                deleteBadgeTypeMutation.mutate(badgeType.id);
                              }
                            }}
                            className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50"
                            disabled={deleteBadgeTypeMutation.isPending}
                          >
                            <DeleteIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <LocalOfferIcon className="text-6xl text-gray-300 mb-4" />
                  <p>뱃지 타입이 없습니다.</p>
                  <p className="text-sm">새 뱃지 타입을 추가해보세요.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 뱃지 타입 수정 모달 */}
      {editingType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">뱃지 타입 수정</h3>
                <button
                  onClick={() => setEditingType(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>

            <form onSubmit={handleUpdateBadgeType} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    타입
                  </label>
                  <input
                    type="text"
                    value={typeForm.type}
                    onChange={(e) => setTypeForm(prev => ({ ...prev, type: e.target.value }))}
                    placeholder="타입 (예: new_farmer)"
                    className="input input-bordered w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이름
                  </label>
                  <input
                    type="text"
                    value={typeForm.name}
                    onChange={(e) => setTypeForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="이름 (예: 신규농가)"
                    className="input input-bordered w-full"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명
                </label>
                <textarea
                  value={typeForm.description}
                  onChange={(e) => setTypeForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="설명"
                  className="textarea textarea-bordered w-full"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    색상
                  </label>
                  <input
                    type="color"
                    value={typeForm.color}
                    onChange={(e) => setTypeForm(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full h-10 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    정렬 순서
                  </label>
                  <input
                    type="number"
                    value={typeForm.sortOrder}
                    onChange={(e) => setTypeForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                    className="input input-bordered w-full"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* 아이콘 업로더 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  뱃지 아이콘
                </label>
                <BadgeIconUploader
                  onIconChange={(iconData) => {
                    console.log('🎨 아이콘 변경 (수정):', iconData);
                    setTypeForm(prev => ({
                      ...prev,
                      iconType: iconData.type,
                      iconValue: iconData.value,
                      iconBackground: iconData.background,
                      iconFile: iconData.file
                    }));
                  }}
                  currentIcon={typeForm.iconValue}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setEditingType(null)}
                  className="btn btn-outline"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updateBadgeTypeMutation.isPending}
                >
                  {updateBadgeTypeMutation.isPending ? '수정 중...' : '수정 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBadgesNew;