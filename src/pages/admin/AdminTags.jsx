import React from 'react';
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { AdminOnly } from '../../components/PermissionComponents';
import TagManager from '../../components/TagManager';

const AdminTags = () => {
  return (
    <AdminOnly>
      <div className="p-6 max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <LocalOfferIcon className="text-3xl text-red-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">태그 관리</h1>
            <p className="text-gray-600">커뮤니티 게시물 태그 생성 및 관리</p>
          </div>
        </div>

        {/* 기존 TagManager 컴포넌트 사용 */}
        <div className="bg-white rounded-lg shadow">
          <TagManager />
        </div>
      </div>
    </AdminOnly>
  );
};

export default AdminTags;