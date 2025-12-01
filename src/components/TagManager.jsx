import React, { useState, useEffect } from 'react';
import { tagService, tagGroupService } from '../services';

const TagManager = () => {
    const [tags, setTags] = useState([]);
    const [tagGroups, setTagGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingTag, setEditingTag] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        display_name: '',
        description: '',
        color: '#007bff',
        permission_level: 'member',
        is_category: false,
        group_id: '',
        sort_order: 0
    });

    // 태그 목록 조회
    const fetchTags = async () => {
        try {
            const data = await tagService.getTags();
            setTags(data);
            setLoading(false);
        } catch (error) {
            console.error('태그 조회 실패:', error);
            setLoading(false);
        }
    };

    // 태그 그룹 목록 조회
    const fetchTagGroups = async () => {
        try {
            const data = await tagGroupService.getTagGroups();
            setTagGroups(data);
        } catch (error) {
            console.error('태그 그룹 조회 실패:', error);
        }
    };

    useEffect(() => {
        fetchTags();
        fetchTagGroups();
    }, []);

    // 폼 데이터 변경 핸들러
    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // 태그 생성/수정
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingTag) {
                await tagService.updateTag(editingTag.id, {
                    name: formData.name,
                    displayName: formData.display_name,
                    description: formData.description,
                    color: formData.color,
                    permissionLevel: formData.permission_level,
                    isCategory: formData.is_category,
                    sortOrder: formData.sort_order
                });
            } else {
                await tagService.createTag({
                    name: formData.name,
                    displayName: formData.display_name,
                    description: formData.description,
                    color: formData.color,
                    permissionLevel: formData.permission_level,
                    isCategory: formData.is_category,
                    sortOrder: formData.sort_order
                });
            }

            setShowCreateModal(false);
            setEditingTag(null);
            setFormData({
                name: '',
                display_name: '',
                description: '',
                color: '#007bff',
                permission_level: 'member',
                is_category: false,
                group_id: '',
                sort_order: 0
            });
            fetchTags();
        } catch (error) {
            console.error('태그 저장 실패:', error);
            alert(error.message || '태그 저장에 실패했습니다.');
        }
    };

    // 태그 삭제
    const handleDelete = async (tagId) => {
        if (!confirm('정말로 이 태그를 삭제하시겠습니까?')) return;

        try {
            await tagService.deleteTag(tagId);
            fetchTags();
        } catch (error) {
            console.error('태그 삭제 실패:', error);
            alert(error.message || '태그 삭제에 실패했습니다.');
        }
    };

    // 수정 모달 열기
    const openEditModal = (tag) => {
        setEditingTag(tag);
        setFormData({
            name: tag.name,
            display_name: tag.display_name,
            description: tag.description || '',
            color: tag.color,
            permission_level: tag.permission_level,
            is_category: tag.is_category,
            group_id: '',
            sort_order: tag.sort_order || 0
        });
        setShowCreateModal(true);
    };

    // 권한 레벨 표시 텍스트
    const getPermissionText = (level) => {
        const permissions = {
            'member': '회원',
            'admin': '관리자'
        };
        return permissions[level] || level;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="loading loading-spinner loading-lg"></div>
            </div>
        );
    }

    return (
        <div className="tag-manager bg-white p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">태그 관리</h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-primary"
                >
                    새 태그 생성
                </button>
            </div>

            {/* 태그 목록 */}
            <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                    <thead>
                        <tr>
                            <th>태그명</th>
                            <th>표시명</th>
                            <th>색상</th>
                            <th>권한</th>
                            <th>카테고리</th>
                            <th>게시물 수</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tags.map(tag => (
                            <tr key={tag.id}>
                                <td>
                                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                                        {tag.name}
                                    </code>
                                </td>
                                <td>
                                    <div className="flex items-center">
                                        <span
                                            className="w-4 h-4 rounded-full mr-2"
                                            style={{ backgroundColor: tag.color }}
                                        ></span>
                                        {tag.display_name}
                                    </div>
                                </td>
                                <td>{tag.color}</td>
                                <td>
                                    <span className={`badge ${
                                        tag.permission_level === 'member' ? 'badge-info' :
                                        tag.permission_level === 'admin' ? 'badge-warning' :
                                        'badge-ghost'
                                    }`}>
                                        {getPermissionText(tag.permission_level)}
                                    </span>
                                </td>
                                <td>
                                    {tag.is_category ? (
                                        <span className="badge badge-primary">카테고리</span>
                                    ) : (
                                        <span className="badge badge-ghost">일반</span>
                                    )}
                                </td>
                                <td className="text-center">{tag.post_count || 0}</td>
                                <td>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => openEditModal(tag)}
                                            className="btn btn-sm btn-outline"
                                        >
                                            수정
                                        </button>
                                        <button
                                            onClick={() => handleDelete(tag.id)}
                                            className="btn btn-sm btn-error btn-outline"
                                        >
                                            삭제
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 생성/수정 모달 */}
            {showCreateModal && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">
                            {editingTag ? '태그 수정' : '새 태그 생성'}
                        </h3>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">태그명 (영문)</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    className="input input-bordered"
                                    placeholder="notice"
                                    required
                                />
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">표시명</span>
                                </label>
                                <input
                                    type="text"
                                    name="display_name"
                                    value={formData.display_name}
                                    onChange={handleFormChange}
                                    className="input input-bordered"
                                    placeholder="공지사항"
                                    required
                                />
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">설명</span>
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleFormChange}
                                    className="textarea textarea-bordered"
                                    placeholder="태그 설명"
                                ></textarea>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">색상</span>
                                </label>
                                <input
                                    type="color"
                                    name="color"
                                    value={formData.color}
                                    onChange={handleFormChange}
                                    className="input input-bordered w-20"
                                />
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">권한 레벨</span>
                                </label>
                                <select
                                    name="permission_level"
                                    value={formData.permission_level}
                                    onChange={handleFormChange}
                                    className="select select-bordered"
                                >
                                    <option value="member">회원</option>
                                    <option value="admin">관리자</option>
                                </select>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">태그 그룹</span>
                                </label>
                                <select
                                    name="group_id"
                                    value={formData.group_id}
                                    onChange={handleFormChange}
                                    className="select select-bordered"
                                >
                                    <option value="">그룹 선택 안함</option>
                                    {tagGroups.map(group => (
                                        <option key={group.id} value={group.id}>
                                            {group.display_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-control">
                                <label className="label cursor-pointer">
                                    <span className="label-text">메인 카테고리로 사용</span>
                                    <input
                                        type="checkbox"
                                        name="is_category"
                                        checked={formData.is_category}
                                        onChange={handleFormChange}
                                        className="checkbox"
                                    />
                                </label>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">정렬 순서</span>
                                </label>
                                <input
                                    type="number"
                                    name="sort_order"
                                    value={formData.sort_order}
                                    onChange={handleFormChange}
                                    className="input input-bordered"
                                    min="0"
                                />
                            </div>

                            <div className="modal-action">
                                <button type="submit" className="btn btn-primary">
                                    {editingTag ? '수정' : '생성'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setEditingTag(null);
                                    }}
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

export default TagManager;