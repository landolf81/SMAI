import React, { useState, useEffect } from 'react';
import { userService, tagService } from '../services';

const UserTagPermissions = () => {
    const [users, setUsers] = useState([]);
    const [tags, setTags] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGrantModal, setShowGrantModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedTag, setSelectedTag] = useState('');
    const [permissionType, setPermissionType] = useState('write');
    const [expiresAt, setExpiresAt] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // 사용자 목록 조회
    const fetchUsers = async () => {
        try {
            const result = await userService.getUsers();
            // getUsers()는 { users: [...] } 형태로 반환하므로 users 배열만 추출
            const usersArray = result?.users || [];
            setUsers(usersArray);
        } catch (error) {
            console.error('사용자 목록 조회 실패:', error);
            setUsers([]); // 에러 시 빈 배열로 초기화
        }
    };

    // 태그 목록 조회
    const fetchTags = async () => {
        try {
            const tagsData = await tagService.getTags();
            setTags(Array.isArray(tagsData) ? tagsData : []);
        } catch (error) {
            console.error('태그 목록 조회 실패:', error);
        }
    };

    // 권한 목록 조회
    const fetchPermissions = async () => {
        try {
            // 모든 사용자의 태그 권한을 가져오는 API가 없으므로 임시로 빈 배열
            // 실제로는 관리자용 전체 권한 조회 API가 필요
            setPermissions([]);
            setLoading(false);
        } catch (error) {
            console.error('권한 목록 조회 실패:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchTags();
        fetchPermissions();
    }, []);

    // 권한 부여
    const handleGrantPermission = async (e) => {
        e.preventDefault();

        if (!selectedUser || !selectedTag) {
            alert('사용자와 태그를 선택해주세요.');
            return;
        }

        try {
            const data = {
                userId: parseInt(selectedUser),
                tagId: parseInt(selectedTag),
                permissionType,
                expiresAt: expiresAt || null
            };

            await userService.grantTagPermission(data);

            setShowGrantModal(false);
            setSelectedUser('');
            setSelectedTag('');
            setPermissionType('write');
            setExpiresAt('');
            fetchPermissions();

            alert('권한이 성공적으로 부여되었습니다.');
        } catch (error) {
            console.error('권한 부여 실패:', error);
            alert(error.message || '권한 부여에 실패했습니다.');
        }
    };

    // 권한 제거
    const handleRevokePermission = async (permissionId) => {
        if (!confirm('정말로 이 권한을 제거하시겠습니까?')) return;

        try {
            await userService.revokeTagPermission(permissionId);
            fetchPermissions();
            alert('권한이 성공적으로 제거되었습니다.');
        } catch (error) {
            console.error('권한 제거 실패:', error);
            alert(error.message || '권한 제거에 실패했습니다.');
        }
    };

    // 일괄 권한 부여
    const handleBulkGrant = async () => {
        const userIds = selectedUsers;
        if (userIds.length === 0 || !selectedTag) {
            alert('사용자들과 태그를 선택해주세요.');
            return;
        }

        try {
            const data = {
                userIds: userIds.map(id => parseInt(id)),
                tagId: parseInt(selectedTag),
                permissionType,
                expiresAt: expiresAt || null
            };

            await userService.bulkGrantTagPermissions(data);

            setSelectedUsers([]);
            alert('일괄 권한 부여가 완료되었습니다.');
        } catch (error) {
            console.error('일괄 권한 부여 실패:', error);
            alert('일괄 권한 부여에 실패했습니다.');
        }
    };

    // 권한 타입 표시 텍스트
    const getPermissionTypeText = (type) => {
        const types = {
            'read': '읽기',
            'write': '쓰기',
            'manage': '관리'
        };
        return types[type] || type;
    };

    // 필터링된 사용자 목록
    const filteredUsers = users.filter(user => 
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="loading loading-spinner loading-lg"></div>
            </div>
        );
    }

    return (
        <div className="user-tag-permissions bg-white p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">사용자 태그 권한 관리</h2>
                <div className="flex space-x-2">
                    <button
                        onClick={() => setShowGrantModal(true)}
                        className="btn btn-primary"
                    >
                        권한 부여
                    </button>
                    <button
                        onClick={() => fetchPermissions()}
                        className="btn btn-outline"
                    >
                        새로고침
                    </button>
                </div>
            </div>

            {/* 검색 */}
            <div className="mb-6">
                <div className="form-control w-full max-w-xs">
                    <label className="label">
                        <span className="label-text">사용자 검색</span>
                    </label>
                    <input
                        type="text"
                        placeholder="이름 또는 사용자명으로 검색"
                        className="input input-bordered w-full max-w-xs"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* 사용자별 권한 현황 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUsers.map(user => (
                    <UserPermissionCard
                        key={user.id}
                        user={user}
                        tags={tags}
                        onRefresh={fetchPermissions}
                    />
                ))}
            </div>

            {/* 권한 부여 모달 */}
            {showGrantModal && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">태그 권한 부여</h3>
                        
                        <form onSubmit={handleGrantPermission} className="space-y-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">사용자 선택</span>
                                </label>
                                <select
                                    value={selectedUser}
                                    onChange={(e) => setSelectedUser(e.target.value)}
                                    className="select select-bordered"
                                    required
                                >
                                    <option value="">사용자 선택</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.name} ({user.username})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">태그 선택</span>
                                </label>
                                <select
                                    value={selectedTag}
                                    onChange={(e) => setSelectedTag(e.target.value)}
                                    className="select select-bordered"
                                    required
                                >
                                    <option value="">태그 선택</option>
                                    {tags.map(tag => (
                                        <option key={tag.id} value={tag.id}>
                                            {tag.display_name} ({tag.name})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">권한 타입</span>
                                </label>
                                <select
                                    value={permissionType}
                                    onChange={(e) => setPermissionType(e.target.value)}
                                    className="select select-bordered"
                                    required
                                >
                                    <option value="read">읽기</option>
                                    <option value="write">쓰기</option>
                                    <option value="manage">관리</option>
                                </select>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">만료일 (선택사항)</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                    className="input input-bordered"
                                />
                                <label className="label">
                                    <span className="label-text-alt">비워두면 영구 권한</span>
                                </label>
                            </div>

                            <div className="modal-action">
                                <button type="submit" className="btn btn-primary">
                                    권한 부여
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowGrantModal(false)}
                                    className="btn"
                                >
                                    취소
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// 개별 사용자 권한 카드 컴포넌트
const UserPermissionCard = ({ user, tags, onRefresh }) => {
    const [userPermissions, setUserPermissions] = useState([]);
    const [loading, setLoading] = useState(false);

    // 사용자별 권한 조회
    const fetchUserPermissions = async () => {
        setLoading(true);
        try {
            const permissions = await userService.getUserTagPermissions(user.id);
            setUserPermissions(permissions);
        } catch (error) {
            console.error('사용자 권한 조회 실패:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUserPermissions();
    }, [user.id]);

    return (
        <div className="card bg-base-100 border shadow-sm">
            <div className="card-body p-4">
                <div className="flex items-center mb-3">
                    <div className="avatar placeholder mr-3">
                        <div className="bg-neutral-focus text-neutral-content rounded-full w-10">
                            <span className="text-sm">{user.name?.[0] || 'U'}</span>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold">{user.name}</h4>
                        <p className="text-sm text-gray-600">@{user.username}</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-4">
                        <div className="loading loading-spinner loading-sm"></div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {userPermissions.length > 0 ? (
                            userPermissions.map(permission => (
                                <div key={permission.id} className="flex items-center justify-between text-sm">
                                    <div>
                                        <span className="font-medium">{permission.tag_display_name}</span>
                                        <span className="ml-2 badge badge-xs">
                                            {permission.permission_type}
                                        </span>
                                    </div>
                                    {permission.expires_at && (
                                        <span className="text-xs text-gray-500">
                                            만료: {new Date(permission.expires_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-2">
                                특별 권한 없음
                            </p>
                        )}
                    </div>
                )}

                <div className="card-actions justify-end mt-3">
                    <button
                        onClick={fetchUserPermissions}
                        className="btn btn-xs btn-outline"
                    >
                        새로고침
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserTagPermissions;