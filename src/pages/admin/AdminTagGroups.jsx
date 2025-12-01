import React from 'react';
import CategoryIcon from "@mui/icons-material/Category";
import { AdminOnly } from '../../components/PermissionComponents';
import TagGroupManager from '../../components/TagGroupManager';

const AdminTagGroups = () => {
  return (
    <AdminOnly>
      <div className="p-6 max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <CategoryIcon className="text-3xl text-red-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">태그 그룹 관리</h1>
            <p className="text-gray-600">태그 그룹 생성 및 분류 관리</p>
          </div>
        </div>

        {/* 기존 TagGroupManager 컴포넌트 사용 */}
        <div className="bg-white rounded-lg shadow">
          <TagGroupManager />
        </div>
      </div>
    </AdminOnly>
  );
};

export default AdminTagGroups;