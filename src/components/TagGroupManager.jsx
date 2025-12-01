import React, { useState, useEffect } from 'react';
import { tagGroupService } from '../services';

const TagGroupManager = () => {
    const [tagGroups, setTagGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        display_name: '',
        description: '',
        color: '#6c757d',
        sort_order: 0
    });

    // 태그 그룹 목록 조회
    const fetchTagGroups = async () => {
        try {
            const data = await tagGroupService.getTagGroups();
            setTagGroups(data);
            setLoading(false);
        } catch (error) {
            console.error('태그 그룹 조회 실패:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTagGroups();
    }, []);

    // 폼 데이터 변경 핸들러
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // 태그 그룹 생성/수정
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingGroup) {
                await tagGroupService.updateTagGroup(editingGroup.id, {
                    name: formData.name,
                    color: formData.color
                });
            } else {
                await tagGroupService.createTagGroup({
                    name: formData.name,
                    color: formData.color
                });
            }

            setShowCreateModal(false);
            setEditingGroup(null);
            setFormData({
                name: '',
                display_name: '',
                description: '',
                color: '#6c757d',
                sort_order: 0
            });
            fetchTagGroups();
        } catch (error) {
            console.error('태그 그룹 저장 실패:', error);
            alert(error.message || '태그 그룹 저장에 실패했습니다.');
        }
    };

    // 태그 그룹 삭제
    const handleDelete = async (groupId) => {
        if (!confirm('정말로 이 태그 그룹을 삭제하시겠습니까?')) return;

        try {
            await tagGroupService.deleteTagGroup(groupId);
            fetchTagGroups();
        } catch (error) {
            console.error('태그 그룹 삭제 실패:', error);
            alert(error.message || '태그 그룹 삭제에 실패했습니다.');
        }
    };

    // 수정 모달 열기
    const openEditModal = (group) => {
        setEditingGroup(group);
        setFormData({
            name: group.name,
            display_name: group.display_name,
            description: group.description || '',
            color: group.color,
            sort_order: group.sort_order || 0
        });
        setShowCreateModal(true);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="loading loading-spinner loading-lg"></div>
            </div>
        );
    }

    return (
        <div className="tag-group-manager bg-white p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">태그 그룹 관리</h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-primary"
                >
                    새 그룹 생성
                </button>
            </div>

            {/* 태그 그룹 목록 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tagGroups.map(group => (
                    <div key={group.id} className="card bg-base-100 shadow-xl">
                        <div className="card-body">
                            <div className="flex items-center mb-2">
                                <span
                                    className="w-4 h-4 rounded-full mr-2"
                                    style={{ backgroundColor: group.color }}
                                ></span>
                                <h3 className="card-title text-lg">{group.display_name}</h3>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2">
                                그룹명: <code className="bg-gray-100 px-1 rounded">{group.name}</code>
                            </p>
                            
                            {group.description && (
                                <p className="text-sm text-gray-700 mb-3">{group.description}</p>
                            )}
                            
                            <div className="stats stats-vertical bg-base-200">
                                <div className="stat">
                                    <div className="stat-title">태그 수</div>
                                    <div className="stat-value text-lg">{group.tag_count || 0}</div>
                                </div>
                                <div className="stat">
                                    <div className="stat-title">정렬 순서</div>
                                    <div className="stat-value text-lg">{group.sort_order}</div>
                                </div>
                            </div>
                            
                            <div className="card-actions justify-end mt-4">
                                <button
                                    onClick={() => openEditModal(group)}
                                    className="btn btn-sm btn-outline"
                                >
                                    수정
                                </button>
                                <button
                                    onClick={() => handleDelete(group.id)}
                                    className="btn btn-sm btn-error btn-outline"
                                >
                                    삭제
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 빈 상태 */}
            {tagGroups.length === 0 && (
                <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">태그 그룹이 없습니다</h3>
                    <p className="text-gray-600 mb-4">첫 번째 태그 그룹을 생성해보세요.</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-primary"
                    >
                        그룹 생성하기
                    </button>
                </div>
            )}

            {/* 생성/수정 모달 */}
            {showCreateModal && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">
                            {editingGroup ? '태그 그룹 수정' : '새 태그 그룹 생성'}
                        </h3>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">그룹명 (영문)</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    className="input input-bordered"
                                    placeholder="official"
                                    required
                                />
                                <label className="label">
                                    <span className="label-text-alt">소문자, 숫자, 언더스코어만 사용</span>
                                </label>
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
                                    placeholder="공식"
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
                                    placeholder="그룹 설명"
                                ></textarea>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">색상</span>
                                </label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="color"
                                        name="color"
                                        value={formData.color}
                                        onChange={handleFormChange}
                                        className="input input-bordered w-20"
                                    />
                                    <span className="text-sm text-gray-600">{formData.color}</span>
                                </div>
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
                                <label className="label">
                                    <span className="label-text-alt">숫자가 작을수록 먼저 표시됩니다</span>
                                </label>
                            </div>

                            <div className="modal-action">
                                <button type="submit" className="btn btn-primary">
                                    {editingGroup ? '수정' : '생성'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setEditingGroup(null);
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

export default TagGroupManager;