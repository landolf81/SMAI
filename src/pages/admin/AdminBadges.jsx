import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { badgeService, userService } from '../../services';

// Icons
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VerifiedIcon from '@mui/icons-material/Verified';
import SearchIcon from '@mui/icons-material/Search';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';

const AdminBadges = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('manage'); // manage, add, types
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [badgeForm, setBadgeForm] = useState({
    userId: '',
    badgeType: '',
    badgeName: '',
    badgeColor: '#3B82F6'
  });
  const [editingBadge, setEditingBadge] = useState(null);
  const [editForm, setEditForm] = useState({
    badgeType: '',
    badgeName: '',
    badgeColor: '#3B82F6'
  });
  
  // 뱃지 타입 관리 상태
  const [editingType, setEditingType] = useState(null);
  const [typeForm, setTypeForm] = useState({
    type: '',
    name: '',
    description: '',
    color: '#3B82F6',
    sortOrder: 0
  });
  const [newTypeForm, setNewTypeForm] = useState({
    type: '',
    name: '',
    description: '',
    color: '#3B82F6',
    sortOrder: 0
  });

  // 뱃지 타입 조회
  const { data: badgeTypes } = useQuery({
    queryKey: ['badgeTypes'],
    queryFn: () => badgeService.getBadgeTypes()
  });

  // 사용자 목록 조회 (검색용)
  const { data: usersData } = useQuery({
    queryKey: ['users', searchTerm],
    queryFn: () => userService.getAdminUsers({ search: searchTerm, limit: 20 }),
    enabled: searchTerm.length > 1
  });

  const users = usersData?.users || [];

  // 모든 사용자 뱃지 조회
  const { data: allBadges, isLoading } = useQuery({
    queryKey: ['allBadges'],
    queryFn: () => badgeService.getAllBadges()
  });

  // 뱃지 추가 뮤테이션
  const addBadgeMutation = useMutation({
    mutationFn: (badgeData) => badgeService.createBadge(badgeData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allBadges'] });
      queryClient.invalidateQueries({ queryKey: ['badges'] });
      setBadgeForm({
        userId: '',
        badgeType: '',
        badgeName: '',
        badgeColor: '#3B82F6'
      });
      setSelectedUser('');
      alert('뱃지가 성공적으로 추가되었습니다.');
    },
    onError: (error) => {
      alert(`뱃지 추가 실패: ${error.message}`);
    }
  });

  // 뱃지 수정 뮤테이션
  const updateBadgeMutation = useMutation({
    mutationFn: ({ badgeId, badgeData }) => badgeService.updateBadge(badgeId, badgeData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allBadges'] });
      queryClient.invalidateQueries({ queryKey: ['badges'] });
      alert('뱃지가 성공적으로 수정되었습니다.');
    },
    onError: (error) => {
      alert(`뱃지 수정 실패: ${error.message}`);
    }
  });

  // 뱃지 삭제 뮤테이션
  const deleteBadgeMutation = useMutation({
    mutationFn: (badgeId) => badgeService.deleteBadge(badgeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allBadges'] });
      queryClient.invalidateQueries({ queryKey: ['badges'] });
    },
    onError: (error) => {
      alert(`뱃지 삭제 실패: ${error.message}`);
    }
  });

  // 뱃지 타입 추가 뮤테이션
  const addBadgeTypeMutation = useMutation({
    mutationFn: (typeData) => badgeService.createBadgeType(typeData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badgeTypes'] });
      setNewTypeForm({
        type: '',
        name: '',
        description: '',
        color: '#3B82F6',
        sortOrder: 0
      });
      alert('뱃지 타입이 성공적으로 추가되었습니다.');
    },
    onError: (error) => {
      alert(`뱃지 타입 추가 실패: ${error.message}`);
    }
  });

  // 뱃지 타입 수정 뮤테이션
  const updateBadgeTypeMutation = useMutation({
    mutationFn: ({ typeId, typeData }) => badgeService.updateBadgeType(typeId, typeData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badgeTypes'] });
      alert('뱃지 타입이 성공적으로 수정되었습니다.');
    },
    onError: (error) => {
      alert(`뱃지 타입 수정 실패: ${error.message}`);
    }
  });

  // 뱃지 타입 삭제 뮤테이션
  const deleteBadgeTypeMutation = useMutation({
    mutationFn: (typeId) => badgeService.deleteBadgeType(typeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badgeTypes'] });
    },
    onError: (error) => {
      alert(`뱃지 타입 삭제 실패: ${error.message}`);
    }
  });

  const handleUserSelect = (user) => {
    setSelectedUser(user.name || user.username);
    setBadgeForm({ ...badgeForm, userId: user.id });
    setSearchTerm('');
  };

  const handleBadgeTypeChange = (e) => {
    const selectedType = badgeTypes?.find(type => type.type === e.target.value);
    setBadgeForm({
      ...badgeForm,
      badgeType: e.target.value,
      badgeName: selectedType?.name || '',
      badgeColor: selectedType?.color || '#3B82F6'
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!badgeForm.userId || !badgeForm.badgeType || !badgeForm.badgeName) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    addBadgeMutation.mutate(badgeForm);
  };

  const handleEditBadge = (badge) => {
    setEditingBadge(badge.id);
    setEditForm({
      badgeType: badge.badge_type,
      badgeName: badge.badge_name,
      badgeColor: badge.badge_color
    });
  };

  const handleUpdateBadge = (e) => {
    e.preventDefault();
    updateBadgeMutation.mutate({
      badgeId: editingBadge,
      badgeData: editForm
    });
    setEditingBadge(null);
  };

  const handleCancelEdit = () => {
    setEditingBadge(null);
    setEditForm({
      badgeType: '',
      badgeName: '',
      badgeColor: '#3B82F6'
    });
  };

  const handleDeleteBadge = (badgeId) => {
    if (window.confirm('정말로 이 뱃지를 삭제하시겠습니까?')) {
      deleteBadgeMutation.mutate(badgeId);
    }
  };

  // 뱃지 타입 관리 핸들러들
  const handleAddBadgeType = (e) => {
    e.preventDefault();
    if (!newTypeForm.type || !newTypeForm.name) {
      alert('타입과 이름을 입력해주세요.');
      return;
    }
    addBadgeTypeMutation.mutate(newTypeForm);
  };

  const handleEditType = (badgeType) => {
    setEditingType(badgeType.id);
    setTypeForm({
      type: badgeType.type,
      name: badgeType.name,
      description: badgeType.description || '',
      color: badgeType.color,
      sortOrder: badgeType.sort_order || 0
    });
  };

  const handleUpdateBadgeType = (e) => {
    e.preventDefault();
    updateBadgeTypeMutation.mutate({
      typeId: editingType,
      typeData: typeForm
    });
    setEditingType(null);
  };

  const handleCancelTypeEdit = () => {
    setEditingType(null);
    setTypeForm({
      type: '',
      name: '',
      description: '',
      color: '#3B82F6',
      sortOrder: 0
    });
  };

  const handleDeleteBadgeType = (typeId) => {
    if (window.confirm('정말로 이 뱃지 타입을 삭제하시겠습니까? 사용 중인 뱃지가 있으면 비활성화됩니다.')) {
      deleteBadgeTypeMutation.mutate(typeId);
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
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow-sm border">
        {/* 헤더 */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <VerifiedIcon className="text-blue-500" />
                뱃지 관리
              </h1>
              <p className="text-gray-600 mt-1">사용자의 인증 뱃지를 관리합니다</p>
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
              <h3 className="text-lg font-semibold mb-4">발급된 뱃지 목록</h3>
              
              {allBadges && allBadges.length > 0 ? (
                <div className="space-y-4">
                  {allBadges.map((badge) => (
                    <div key={badge.id} className="bg-gray-50 rounded-lg p-4 border">
                      {editingBadge === badge.id ? (
                        // 수정 모드
                        <form onSubmit={handleUpdateBadge} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                뱃지 타입
                              </label>
                              <select
                                value={editForm.badgeType}
                                onChange={(e) => {
                                  const selectedType = badgeTypes?.find(type => type.type === e.target.value);
                                  setEditForm({
                                    ...editForm,
                                    badgeType: e.target.value,
                                    badgeName: selectedType?.name || editForm.badgeName,
                                    badgeColor: selectedType?.color || editForm.badgeColor
                                  });
                                }}
                                className="select select-bordered select-sm w-full"
                                required
                              >
                                {badgeTypes?.map((type) => (
                                  <option key={type.type} value={type.type}>
                                    {type.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                뱃지 이름
                              </label>
                              <input
                                type="text"
                                value={editForm.badgeName}
                                onChange={(e) => setEditForm({ ...editForm, badgeName: e.target.value })}
                                className="input input-bordered input-sm w-full"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                색상
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={editForm.badgeColor}
                                  onChange={(e) => setEditForm({ ...editForm, badgeColor: e.target.value })}
                                  className="w-8 h-8 border border-gray-300 rounded"
                                />
                                <span
                                  className="px-2 py-1 rounded text-xs font-medium text-white"
                                  style={{ backgroundColor: editForm.badgeColor }}
                                >
                                  {editForm.badgeName}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="btn btn-primary btn-sm"
                              disabled={updateBadgeMutation.isPending}
                            >
                              {updateBadgeMutation.isPending ? '저장 중...' : '저장'}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="btn btn-outline btn-sm"
                            >
                              취소
                            </button>
                          </div>
                        </form>
                      ) : (
                        // 표시 모드
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <img
                              src={badge.profilePic ? `/uploads/profiles/${badge.profilePic}` : '/default-avatar.png'}
                              alt={badge.user_name}
                              className="w-10 h-10 rounded-full"
                            />
                            <div>
                              <div className="font-medium">{badge.user_name || badge.username}</div>
                              <div className="text-sm text-gray-500">@{badge.username}</div>
                            </div>
                            <span
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                              style={{ backgroundColor: badge.badge_color }}
                            >
                              {badge.badge_name}
                            </span>
                            <div className="text-xs text-gray-500">
                              <div>발급: {new Date(badge.created_at).toLocaleDateString('ko-KR')}</div>
                              <div>발급자: {badge.verified_by_name || '시스템'}</div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditBadge(badge)}
                              className="btn btn-outline btn-sm"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteBadge(badge.id)}
                              className="btn btn-error btn-sm"
                              disabled={deleteBadgeMutation.isPending}
                            >
                              <DeleteIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <VerifiedIcon className="text-6xl text-gray-300 mb-4" />
                  <p>아직 발급된 뱃지가 없습니다.</p>
                  <p className="text-sm">뱃지 추가 탭에서 사용자에게 뱃지를 발급해보세요.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'add' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">새 뱃지 추가</h3>
              
              <form onSubmit={handleSubmit} className="max-w-2xl">
                {/* 사용자 검색 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    사용자 검색
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={selectedUser || searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (!e.target.value) {
                          setSelectedUser('');
                          setBadgeForm({ ...badgeForm, userId: '' });
                        }
                      }}
                      placeholder="사용자 이름 또는 아이디를 입력하세요"
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
                              src={user.profilePic ? `/uploads/profiles/${user.profilePic}` : '/default-avatar.png'}
                              alt={user.name}
                              className="w-8 h-8 rounded-full"
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
                </div>

                {/* 뱃지 타입 선택 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    뱃지 타입
                  </label>
                  <select
                    value={badgeForm.badgeType}
                    onChange={handleBadgeTypeChange}
                    className="select select-bordered w-full"
                    required
                  >
                    <option value="">뱃지 타입을 선택하세요</option>
                    {badgeTypes?.map((type) => (
                      <option key={type.type} value={type.type}>
                        {type.name} - {type.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 뱃지 이름 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    뱃지 이름
                  </label>
                  <input
                    type="text"
                    value={badgeForm.badgeName}
                    onChange={(e) => setBadgeForm({ ...badgeForm, badgeName: e.target.value })}
                    className="input input-bordered w-full"
                    placeholder="예: 성주참외작목반"
                    required
                  />
                </div>

                {/* 뱃지 색상 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    뱃지 색상
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={badgeForm.badgeColor}
                      onChange={(e) => setBadgeForm({ ...badgeForm, badgeColor: e.target.value })}
                      className="w-12 h-12 border border-gray-300 rounded"
                    />
                    <input
                      type="text"
                      value={badgeForm.badgeColor}
                      onChange={(e) => setBadgeForm({ ...badgeForm, badgeColor: e.target.value })}
                      className="input input-bordered flex-1"
                      placeholder="#3B82F6"
                    />
                    {/* 미리보기 */}
                    {badgeForm.badgeName && (
                      <span
                        className="px-3 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: badgeForm.badgeColor }}
                      >
                        {badgeForm.badgeName}
                      </span>
                    )}
                  </div>
                </div>

                {/* 제출 버튼 */}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={addBadgeMutation.isPending}
                    className={`btn btn-primary ${addBadgeMutation.isPending ? 'loading' : ''}`}
                  >
                    <AddIcon className="mr-2" />
                    {addBadgeMutation.isPending ? '추가 중...' : '뱃지 추가'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBadgeForm({
                        userId: '',
                        badgeType: '',
                        badgeName: '',
                        badgeColor: '#3B82F6'
                      });
                      setSelectedUser('');
                      setSearchTerm('');
                    }}
                    className="btn btn-outline"
                  >
                    초기화
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'types' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">뱃지 타입 관리</h3>
              
              {/* 새 뱃지 타입 추가 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium mb-3">새 뱃지 타입 추가</h4>
                <form onSubmit={handleAddBadgeType} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <input
                    type="text"
                    value={newTypeForm.type}
                    onChange={(e) => setNewTypeForm({ ...newTypeForm, type: e.target.value })}
                    placeholder="타입 (예: new_farmer)"
                    className="input input-bordered input-sm"
                    required
                  />
                  <input
                    type="text"
                    value={newTypeForm.name}
                    onChange={(e) => setNewTypeForm({ ...newTypeForm, name: e.target.value })}
                    placeholder="이름 (예: 신규농가)"
                    className="input input-bordered input-sm"
                    required
                  />
                  <input
                    type="text"
                    value={newTypeForm.description}
                    onChange={(e) => setNewTypeForm({ ...newTypeForm, description: e.target.value })}
                    placeholder="설명"
                    className="input input-bordered input-sm"
                  />
                  <input
                    type="color"
                    value={newTypeForm.color}
                    onChange={(e) => setNewTypeForm({ ...newTypeForm, color: e.target.value })}
                    className="w-full h-8 border border-gray-300 rounded"
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={addBadgeTypeMutation.isPending}
                  >
                    {addBadgeTypeMutation.isPending ? '추가 중...' : '추가'}
                  </button>
                </form>
              </div>

              {/* 기존 뱃지 타입 목록 */}
              {badgeTypes && badgeTypes.length > 0 ? (
                <div className="space-y-3">
                  {badgeTypes.map((badgeType) => (
                    <div key={badgeType.id} className="bg-white rounded-lg border p-4">
                      {editingType === badgeType.id ? (
                        // 수정 모드
                        <form onSubmit={handleUpdateBadgeType} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                          <input
                            type="text"
                            value={typeForm.type}
                            onChange={(e) => setTypeForm({ ...typeForm, type: e.target.value })}
                            className="input input-bordered input-sm"
                            disabled // 타입은 수정 불가
                          />
                          <input
                            type="text"
                            value={typeForm.name}
                            onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                            className="input input-bordered input-sm"
                            required
                          />
                          <input
                            type="text"
                            value={typeForm.description}
                            onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                            className="input input-bordered input-sm"
                          />
                          <input
                            type="color"
                            value={typeForm.color}
                            onChange={(e) => setTypeForm({ ...typeForm, color: e.target.value })}
                            className="w-full h-8 border border-gray-300 rounded"
                          />
                          <input
                            type="number"
                            value={typeForm.sortOrder}
                            onChange={(e) => setTypeForm({ ...typeForm, sortOrder: parseInt(e.target.value) || 0 })}
                            className="input input-bordered input-sm"
                            placeholder="순서"
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="btn btn-primary btn-sm"
                              disabled={updateBadgeTypeMutation.isPending}
                            >
                              {updateBadgeTypeMutation.isPending ? '저장 중...' : '저장'}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelTypeEdit}
                              className="btn btn-outline btn-sm"
                            >
                              취소
                            </button>
                          </div>
                        </form>
                      ) : (
                        // 표시 모드
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                              style={{ backgroundColor: badgeType.color }}
                            >
                              {badgeType.name}
                            </span>
                            <div>
                              <div className="font-medium">{badgeType.type}</div>
                              <div className="text-sm text-gray-500">{badgeType.description}</div>
                            </div>
                            <div className="text-xs text-gray-400">
                              순서: {badgeType.sort_order || 0}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditType(badgeType)}
                              className="btn btn-outline btn-sm"
                            >
                              <EditIcon className="w-4 h-4" />
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteBadgeType(badgeType.id)}
                              className="btn btn-error btn-sm"
                              disabled={deleteBadgeTypeMutation.isPending}
                            >
                              <DeleteIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
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
    </div>
  );
};

export default AdminBadges;