import React from 'react';
import { useQuery } from '@tanstack/react-query';
import CampaignIcon from "@mui/icons-material/Campaign";
import { AdminOnly } from '../../components/PermissionComponents';
import { adService } from '../../services';

const AdminAdsSimple = () => {
  // Supabase에서 광고 목록 조회
  const { data: ads = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['ads'],
    queryFn: async () => {
      console.log('🔍 [AdminAdsSimple] 광고 목록 조회 시작');
      const result = await adService.getAds();
      console.log('✅ [AdminAdsSimple] 광고 목록 조회 완료:', result);
      return result;
    }
  });

  if (loading) {
    return (
      <AdminOnly>
        <div className="flex items-center justify-center min-h-screen">
          <div className="loading loading-spinner loading-lg"></div>
          <span className="ml-4">광고 목록을 불러오는 중...</span>
        </div>
      </AdminOnly>
    );
  }

  if (error) {
    return (
      <AdminOnly>
        <div className="p-6 max-w-7xl mx-auto">
          <div className="alert alert-error">
            <div>
              <h3 className="font-bold">오류 발생!</h3>
              <div className="text-xs">{error.message || '광고를 불러오는데 실패했습니다.'}</div>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="btn btn-primary mt-4"
          >
            다시 시도
          </button>
        </div>
      </AdminOnly>
    );
  }

  return (
    <AdminOnly>
      <div className="p-6 max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <CampaignIcon className="text-3xl text-red-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">광고 관리 (간단 버전)</h1>
            <p className="text-gray-600">광고 목록 확인 및 디버깅</p>
          </div>
        </div>

        {/* 디버그 정보 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-800 mb-2">디버그 정보</h3>
          <div className="text-sm text-blue-700">
            <p>• 로딩 상태: {loading ? '로딩 중' : '완료'}</p>
            <p>• 에러: {error ? error.message : '없음'}</p>
            <p>• 광고 개수: {ads.length}개</p>
            <p>• 데이터 타입: {Array.isArray(ads) ? '배열' : typeof ads}</p>
            <p>• 데이터 소스: Supabase (adService)</p>
          </div>
        </div>

        {/* 광고 목록 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">광고 목록 ({ads.length}개)</h2>
          
          {ads.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              등록된 광고가 없습니다.
            </div>
          ) : (
            <div className="grid gap-4">
              {ads.map((ad) => (
                <div key={ad.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{ad.title}</h3>
                      <p className="text-gray-600 mt-2">{ad.content}</p>
                      <div className="flex gap-4 mt-2 text-sm text-gray-500">
                        <span>ID: {ad.id}</span>
                        <span>노출: {ad.view_count || 0}</span>
                        <span>클릭: {ad.click_count || 0}</span>
                        <span>활성: {ad.is_active ? '예' : '아니오'}</span>
                      </div>
                      {ad.start_date && ad.end_date && (
                        <div className="text-sm text-gray-500 mt-1">
                          기간: {ad.start_date} ~ {ad.end_date}
                        </div>
                      )}
                    </div>
                    
                    {ad.image_content && (
                      <div className="ml-4">
                        <img 
                          src={ad.image_content} 
                          alt={ad.image_alt || ad.title}
                          className="w-20 h-20 object-cover rounded"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 새로고침 버튼 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => refetch()}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? '로딩 중...' : '새로고침'}
          </button>
        </div>
      </div>
    </AdminOnly>
  );
};

export default AdminAdsSimple;