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
import RefreshIcon from "@mui/icons-material/Refresh";
import { AdminOnly } from '../../components/PermissionComponents';
import { userService } from '../../services';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

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

        const processedUsers = userList.map(user => ({
          ...user,
          role: user.role || 'member',
          status: user.status || 'active',
          posts_count: user.posts_count || 0,
          comments_count: user.comments_count || 0,
          created_at: user.created_at || user.createdAt,
          profilePic: user.profile_pic
        }));

        setUsers(processedUsers);

        if (paginationData) {
          setPagination({
            page: paginationData.page || page,
            limit: paginationData.limit || 20,
            total: paginationData.total || processedUsers.length,
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

  const handleSearch = () => {
    setSearchTerm(searchInput);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'banned' : 'active';
      await userService.updateUserStatus(userId, newStatus);
      setUsers(users.map(user =>
        user.id === userId ? { ...user, status: newStatus } : user
      ));
      alert(`사용자 상태가 ${newStatus === 'active' ? '활성화' : '차단'}되었습니다.`);
    } catch (err) {
      console.error('사용자 상태 변경 실패:', err);
      alert(err.message || '사용자 상태 변경에 실패했습니다.');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await userService.updateUserRole(userId, newRole);
      await fetchUsers(pagination.page, searchTerm, filterRole, filterStatus);
      alert('사용자 역할이 변경되었습니다.');
    } catch (err) {
      console.error('사용자 역할 변경 실패:', err);
      alert(err.message || '사용자 역할 변경에 실패했습니다.');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`정말 '${username}' 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      await userService.deleteUser(userId);
      setUsers(users.filter(user => user.id !== userId));
      setPagination(prev => ({ ...prev, total: prev.total - 1 }));
      alert('사용자가 삭제되었습니다.');
    } catch (err) {
      console.error('사용자 삭제 실패:', err);
      alert(err.message || '사용자 삭제에 실패했습니다.');
    }
  };

  const getRoleText = (role) => role || 'user';

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'banned': return 'bg-red-100 text-red-700 border-red-200';
      case 'inactive': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
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

  if (loading && users.length === 0) {
    return (
      <AdminOnly>
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center">
            <div className="loading loading-spinner loading-lg text-[#004225]"></div>
            <p className="mt-4 text-gray-600">사용자 목록을 불러오는 중...</p>
          </div>
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
            <div className="w-12 h-12 bg-[#004225] rounded-xl flex items-center justify-center">
              <PeopleIcon className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
              <p className="text-gray-500 text-sm">전체 사용자 목록 및 권한 관리</p>
            </div>
          </div>

          <button
            onClick={() => fetchUsers(1, searchTerm, filterRole, filterStatus)}
            className="btn bg-[#004225] hover:bg-[#003018] text-white border-none gap-2"
            disabled={loading}
          >
            <RefreshIcon className={loading ? 'animate-spin' : ''} fontSize="small" />
            새로고침
          </button>
        </div>

        {/* 에러 표시 */}
        {error && (
          <div className="alert bg-red-50 border border-red-200 text-red-700 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* 콘텐츠 영역 */}
        <UserListContent
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
          setPagination={setPagination}
          loading={loading}
        />
      </div>
    </AdminOnly>
  );
};

// 사용자 목록 컴포넌트
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
  setPagination,
  loading
}) => {
  return (
    <div>
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">전체 사용자</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{pagination?.total || users.length}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <PeopleIcon className="text-blue-600" fontSize="small" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Super Admin</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {users.filter(u => u.role === 'super_admin').length}
              </p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <SecurityIcon className="text-purple-600" fontSize="small" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Admins</p>
              <p className="text-2xl font-bold text-[#004225] mt-1">
                {users.filter(u => ['content_admin', 'market_admin', 'advertiser'].includes(u.role)).length}
              </p>
            </div>
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <EditIcon className="text-[#004225]" fontSize="small" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">활성</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {users.filter(u => u.status === 'active').length}
              </p>
            </div>
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircleIcon className="text-emerald-600" fontSize="small" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">차단</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {users.filter(u => u.status === 'banned').length}
              </p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <BlockIcon className="text-red-600" fontSize="small" />
            </div>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
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
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              검색
            </button>
          </div>

          <div className="flex gap-2">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
              className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">모든 상태</option>
              <option value="active">활성</option>
              <option value="banned">차단</option>
              <option value="inactive">비활성</option>
            </select>
          </div>
        </div>
      </div>

      {/* 사용자 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">사용자</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">역할</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">상태</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">가입일</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">활동</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200">
                        <img
                          src={(() => {
                            const pic = user.profilePic || user.profile_pic;
                            if (!pic) return user.avatar || "/default/default_profile.png";
                            if (pic.startsWith('http')) return pic;
                            if (pic.startsWith('/uploads/')) return pic;
                            return `/uploads/profiles/${pic}`;
                          })()}
                          alt="프로필"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/default/default_profile.png';
                          }}
                        />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{user.username || user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="member">member</option>
                      <option value="advertiser">advertiser</option>
                      <option value="content_admin">content_admin</option>
                      <option value="market_admin">market_admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(user.status)}`}>
                      {getStatusText(user.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <span className="text-gray-600">게시물</span>
                      <span className="font-medium text-gray-900 ml-1">{user.posts_count || 0}</span>
                      <span className="text-gray-400 mx-2">|</span>
                      <span className="text-gray-600">댓글</span>
                      <span className="font-medium text-gray-900 ml-1">{user.comments_count || 0}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button
                        className={`p-2 rounded-lg transition-colors ${
                          user.status === 'active'
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
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
                        className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
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
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 mt-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <PeopleIcon className="text-gray-400 text-3xl" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">사용자가 없습니다</h3>
          <p className="text-gray-500">검색 조건을 확인하거나 필터를 변경해보세요.</p>
        </div>
      )}

      {/* 페이지네이션 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col items-center gap-4 mt-6">
          <div className="text-sm text-gray-600">
            전체 <span className="font-medium">{pagination.total}</span>명 중{' '}
            <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span>-
            <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span>명 표시
          </div>

          <div className="flex items-center gap-1">
            <button
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={pagination.page === 1 || loading}
              onClick={() => fetchUsers(1, searchTerm, filterRole, filterStatus)}
            >
              ««
            </button>
            <button
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={pagination.page === 1 || loading}
              onClick={() => fetchUsers(pagination.page - 1, searchTerm, filterRole, filterStatus)}
            >
              «
            </button>

            {(() => {
              const currentPage = pagination.page;
              const totalPages = pagination.totalPages;
              const pages = [];

              let start = Math.max(1, currentPage - 2);
              let end = Math.min(totalPages, start + 4);

              if (end - start < 4) {
                start = Math.max(1, end - 4);
              }

              for (let i = start; i <= end; i++) {
                pages.push(
                  <button
                    key={i}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      i === currentPage
                        ? 'bg-[#004225] text-white'
                        : 'border border-gray-200 bg-white hover:bg-gray-50'
                    }`}
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
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchUsers(pagination.page + 1, searchTerm, filterRole, filterStatus)}
            >
              »
            </button>
            <button
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchUsers(pagination.totalPages, searchTerm, filterRole, filterStatus)}
            >
              »»
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>페이지당</span>
            <select
              value={pagination.limit}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value);
                setPagination(prev => ({ ...prev, limit: newLimit }));
                fetchUsers(1, searchTerm, filterRole, filterStatus);
              }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
