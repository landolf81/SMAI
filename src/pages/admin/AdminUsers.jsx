import React, { useState, useEffect } from 'react';
import PeopleIcon from "@mui/icons-material/People";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import SecurityIcon from "@mui/icons-material/Security";
import DeleteIcon from "@mui/icons-material/Delete";
import { AdminOnly } from '../../components/PermissionComponents';
import UserTagPermissions from '../../components/UserTagPermissions';
import { useAdminPermissions } from '../../hooks/usePermissions';
import { userService } from '../../services';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState(''); // 입력 필드용 state
  const [searchTerm, setSearchTerm] = useState(''); // 실제 검색용 state
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('users');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const adminPermissions = useAdminPermissions();

  // 사용자 목록 조회
  const fetchUsers = async (page = 1, search = '', role = 'all', status = 'all') => {
    try {
      setLoading(true);
      setError(null);

      const result = await userService.getAdminUsers({
        page,
        limit: pagination.limit,
        search,
        role,
        status
      });

      if (result) {
        const { users: userList = [], pagination: paginationData } = result;

        // 사용자 데이터 정규화 및 관리자 우선 정렬
        const processedUsers = userList.map(user => ({
          ...user,
          role: user.role || 'member',
          status: user.status || 'active',
          posts_count: user.posts_count || 0,
          comments_count: user.comments_count || 0,
          created_at: user.created_at || user.createdAt,
          profilePic: user.profile_pic
        }));

        // 관리자 우선 정렬: super_admin > market_admin > content_admin > advertiser > member
        const sortedUsers = processedUsers.sort((a, b) => {
          const roleOrder = {
            super_admin: 5,
            market_admin: 4,
            content_admin: 3,
            advertiser: 2,
            member: 1
          };
          const aOrder = roleOrder[a.role] || 0;
          const bOrder = roleOrder[b.role] || 0;

          if (aOrder !== bOrder) {
            return bOrder - aOrder; // 내림차순으로 관리자가 먼저
          }

          // 같은 역할일 경우 ID 오름차순
          return a.id - b.id;
        });

        setUsers(sortedUsers);

        if (paginationData) {
          setPagination({
            page: paginationData.page || page,
            limit: paginationData.limit || 20,
            total: paginationData.total || sortedUsers.length,
            totalPages: paginationData.totalPages || Math.ceil(paginationData.total / 20)
          });
        }
      }
    } catch (err) {
      console.error('사용자 목록 조회 실패:', err);
      setError('사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1, searchTerm, filterRole, filterStatus);
  }, [searchTerm, filterRole, filterStatus]);

  // 검색 버튼 클릭 핸들러
  const handleSearch = () => {
    setSearchTerm(searchInput);
  };

  // Enter 키 입력 핸들러
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 사용자 상태 토글
  const handleStatusToggle = async (userId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'banned' : 'active';

      await userService.updateUserStatus(userId, newStatus);

      // 로컬 상태 업데이트
      setUsers(users.map(user =>
        user.id === userId ? { ...user, status: newStatus } : user
      ));

      alert(`사용자 상태가 ${newStatus === 'active' ? '활성화' : '차단'}되었습니다.`);
    } catch (err) {
      console.error('사용자 상태 변경 실패:', err);
      const errorMessage = err.message || '사용자 상태 변경에 실패했습니다.';
      alert(errorMessage);
    }
  };

  // 사용자 역할 변경
  const handleRoleChange = async (userId, newRole) => {
    try {
      console.log('🔄 역할 변경 시작:', { userId, newRole });
      const result = await userService.updateUserRole(userId, newRole);
      console.log('✅ 역할 변경 응답:', result);

      // 데이터베이스에서 최신 데이터 다시 가져오기
      await fetchUsers(pagination.page, searchTerm, filterRole, filterStatus);

      alert('사용자 역할이 변경되었습니다.');
    } catch (err) {
      console.error('❌ 사용자 역할 변경 실패:', err);
      console.error('에러 상세:', err.message, err.code, err.details);
      const errorMessage = err.message || '사용자 역할 변경에 실패했습니다.';
      alert(errorMessage);
    }
  };

  // 사용자 삭제
  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`정말 '${username}' 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      await userService.deleteUser(userId);

      // 로컬 상태에서 제거
      setUsers(users.filter(user => user.id !== userId));

      // 페이지네이션 정보 업데이트
      setPagination(prev => ({
        ...prev,
        total: prev.total - 1
      }));

      alert('사용자가 삭제되었습니다.');
    } catch (err) {
      console.error('사용자 삭제 실패:', err);
      const errorMessage = err.message || '사용자 삭제에 실패했습니다.';
      alert(errorMessage);
    }
  };

  const getRoleText = (role) => {
    // 역할을 영어 그대로 표시
    return role || 'user';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'badge-success';
      case 'banned': return 'badge-error';
      case 'inactive': return 'badge-warning';
      default: return 'badge-ghost';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return '활성';
      case 'banned': return '차단';
      case 'inactive': return '비활성';
      default: return status;
    }
  };

  if (loading) {
    return (
      <AdminOnly>
        <div className="flex items-center justify-center min-h-screen">
          <div className="loading loading-spinner loading-lg"></div>
          <span className="ml-4">사용자 목록을 불러오는 중...</span>
        </div>
      </AdminOnly>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserListContent
          users={users}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          searchTerm={searchTerm}
          handleSearch={handleSearch}
          handleSearchKeyPress={handleSearchKeyPress}
          filterRole={filterRole}
          setFilterRole={setFilterRole}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          handleStatusToggle={handleStatusToggle}
          handleRoleChange={handleRoleChange}
          handleDeleteUser={handleDeleteUser}
          getRoleText={getRoleText}
          getStatusColor={getStatusColor}
          getStatusText={getStatusText}
          fetchUsers={fetchUsers}
          pagination={pagination}
          loading={loading}
        />;
      case 'permissions':
        return (
          <AdminOnly 
            customCheck={() => adminPermissions.canAssignPermissions}
            fallback={<div className="text-center py-8"><p className="text-gray-600">사용자 권한 관리 권한이 없습니다.</p></div>}
          >
            <UserTagPermissions />
          </AdminOnly>
        );
      default:
        return <UserListContent />;
    }
  };

  return (
    <AdminOnly>
      <div className="p-6 max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <PeopleIcon className="text-3xl text-red-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
              <p className="text-gray-600">전체 사용자 목록 및 권한 관리</p>
            </div>
          </div>
          
          {activeTab === 'users' && (
            <button 
              onClick={() => fetchUsers(1, searchTerm, filterRole, filterStatus)}
              className="btn btn-outline gap-2"
              disabled={loading}
            >
              새로고침
            </button>
          )}
        </div>

        {/* 에러 표시 */}
        {error && (
          <div className="alert alert-error mb-6">
            <div>{error}</div>
          </div>
        )}

        {/* 탭 네비게이션 */}
        <div className="tabs tabs-boxed mb-6 bg-white p-2 rounded-lg shadow-sm">
          <button
            onClick={() => setActiveTab('users')}
            className={`tab tab-lg flex items-center space-x-2 ${
              activeTab === 'users' ? 'tab-active' : ''
            }`}
          >
            <PeopleIcon />
            <span>사용자 목록</span>
          </button>

          {adminPermissions.canAssignPermissions && (
            <button
              onClick={() => setActiveTab('permissions')}
              className={`tab tab-lg flex items-center space-x-2 ${
                activeTab === 'permissions' ? 'tab-active' : ''
              }`}
            >
              <SecurityIcon />
              <span>권한 관리</span>
            </button>
          )}
        </div>

        {/* 콘텐츠 영역 */}
        <div className="content-area">
          {renderContent()}
        </div>
      </div>
    </AdminOnly>
  );
};

// 사용자 목록 컴포넌트 분리
const UserListContent = ({
  users = [],
  searchInput,
  setSearchInput,
  searchTerm,
  handleSearch,
  handleSearchKeyPress,
  filterRole,
  setFilterRole,
  filterStatus,
  setFilterStatus,
  handleStatusToggle,
  handleRoleChange,
  handleDeleteUser,
  getRoleText,
  getStatusColor,
  getStatusText,
  fetchUsers,
  pagination,
  loading
}) => {
  return (
    <div>
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="stat bg-white rounded-lg shadow">
          <div className="stat-title">전체 사용자</div>
          <div className="stat-value text-blue-600">{pagination?.total || users.length}</div>
          <div className="stat-desc">시스템 전체</div>
        </div>
        <div className="stat bg-white rounded-lg shadow">
          <div className="stat-title">Super Admin</div>
          <div className="stat-value text-purple-600">
            {users.filter(u => u.role === 'super_admin').length}
          </div>
          <div className="stat-desc">All permissions</div>
        </div>
        <div className="stat bg-white rounded-lg shadow">
          <div className="stat-title">Admins</div>
          <div className="stat-value text-orange-600">
            {users.filter(u => ['content_admin', 'market_admin', 'advertiser'].includes(u.role)).length}
          </div>
          <div className="stat-desc">Limited permissions</div>
        </div>
        <div className="stat bg-white rounded-lg shadow">
          <div className="stat-title">활성 사용자</div>
          <div className="stat-value text-green-600">
            {users.filter(u => u.status === 'active').length}
          </div>
          <div className="stat-desc">정상 이용</div>
        </div>
        <div className="stat bg-white rounded-lg shadow">
          <div className="stat-title">차단 사용자</div>
          <div className="stat-value text-red-600">
            {users.filter(u => u.status === 'banned').length}
          </div>
          <div className="stat-desc">이용 제한</div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex gap-2">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="사용자명 또는 이메일로 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="input input-bordered w-full pl-10"
              />
            </div>
            <button
              onClick={handleSearch}
              className="btn btn-primary"
            >
              검색
            </button>
          </div>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="select select-bordered"
          >
            <option value="all">All Roles</option>
            <option value="member">member</option>
            <option value="advertiser">advertiser</option>
            <option value="content_admin">content_admin</option>
            <option value="market_admin">market_admin</option>
            <option value="super_admin">super_admin</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="select select-bordered"
          >
            <option value="all">모든 상태</option>
            <option value="active">활성</option>
            <option value="banned">차단</option>
            <option value="inactive">비활성</option>
          </select>
        </div>
      </div>

      {/* 사용자 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>사용자</th>
                <th>역할</th>
                <th>상태</th>
                <th>가입일</th>
                <th>게시물/댓글</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="avatar">
                        <div className="w-12 h-12 rounded-full">
                          <img
                            src={user.profilePic
                              ? `/uploads/profiles/${user.profilePic}`
                              : user.avatar || "/default/default_profile.png"
                            }
                            alt="프로필"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="font-bold">{user.username || user.name}</div>
                        <div className="text-sm opacity-50">{user.email}</div>
                        <div className="text-xs text-gray-500">ID: {user.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="select select-xs select-bordered"
                    >
                      <option value="member">member</option>
                      <option value="advertiser">advertiser</option>
                      <option value="content_admin">content_admin</option>
                      <option value="market_admin">market_admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${getStatusColor(user.status)}`}>
                      {getStatusText(user.status)}
                    </span>
                  </td>
                  <td>
                    <div className="text-sm">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                    </div>
                  </td>
                  <td>
                    <div className="text-sm">
                      <div>게시물: {user.posts_count || 0}</div>
                      <div>댓글: {user.comments_count || 0}</div>
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        className={`btn btn-xs ${
                          user.status === 'active' ? 'btn-error' : 'btn-success'
                        }`}
                        onClick={() => handleStatusToggle(user.id, user.status)}
                        title={user.status === 'active' ? '차단' : '활성화'}
                      >
                        {user.status === 'active' ? (
                          <BlockIcon fontSize="small" />
                        ) : (
                          <CheckCircleIcon fontSize="small" />
                        )}
                      </button>
                      <button
                        className="btn btn-ghost btn-xs text-red-600"
                        onClick={() => handleDeleteUser(user.id, user.username || user.name)}
                        title="삭제"
                      >
                        <DeleteIcon fontSize="small" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {users.length === 0 && !loading && (
        <div className="text-center py-12">
          <PeopleIcon className="mx-auto text-gray-400 text-6xl mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">사용자가 없습니다</h3>
          <p className="text-gray-500">검색 조건을 확인하거나 필터를 변경해보세요.</p>
        </div>
      )}

      {/* 페이지네이션 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col items-center gap-4 mt-6">
          {/* 페이지 정보 */}
          <div className="text-sm text-gray-600">
            전체 {pagination.total}명 중 {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}명 표시
          </div>
          
          {/* 페이지 버튼 */}
          <div className="btn-group">
            <button 
              className="btn btn-sm"
              disabled={pagination.page === 1 || loading}
              onClick={() => fetchUsers(1, searchTerm, filterRole, filterStatus)}
              title="첫 페이지"
            >
              ««
            </button>
            <button 
              className="btn btn-sm"
              disabled={pagination.page === 1 || loading}
              onClick={() => fetchUsers(pagination.page - 1, searchTerm, filterRole, filterStatus)}
              title="이전 페이지"
            >
              «
            </button>
            
            {/* 페이지 번호들 */}
            {(() => {
              const currentPage = pagination.page;
              const totalPages = pagination.totalPages;
              const pages = [];
              
              // 현재 페이지 주변 페이지들 계산
              let start = Math.max(1, currentPage - 2);
              let end = Math.min(totalPages, start + 4);
              
              if (end - start < 4) {
                start = Math.max(1, end - 4);
              }
              
              for (let i = start; i <= end; i++) {
                pages.push(
                  <button
                    key={i}
                    className={`btn btn-sm ${i === currentPage ? 'btn-active' : ''}`}
                    onClick={() => fetchUsers(i, searchTerm, filterRole, filterStatus)}
                    disabled={loading}
                  >
                    {i}
                  </button>
                );
              }
              
              return pages;
            })()}
            
            <button 
              className="btn btn-sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchUsers(pagination.page + 1, searchTerm, filterRole, filterStatus)}
              title="다음 페이지"
            >
              »
            </button>
            <button 
              className="btn btn-sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchUsers(pagination.totalPages, searchTerm, filterRole, filterStatus)}
              title="마지막 페이지"
            >
              »»
            </button>
          </div>
          
          {/* 페이지 크기 선택 */}
          <div className="flex items-center gap-2 text-sm">
            <span>페이지당</span>
            <select
              value={pagination.limit}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value);
                setPagination(prev => ({ ...prev, limit: newLimit }));
                fetchUsers(1, searchTerm, filterRole, filterStatus);
              }}
              className="select select-xs select-bordered"
              disabled={loading}
            >
              <option value={10}>10개</option>
              <option value={20}>20개</option>
              <option value={50}>50개</option>
              <option value={100}>100개</option>
            </select>
            <span>표시</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;