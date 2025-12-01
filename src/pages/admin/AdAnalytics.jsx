import React, { useState, useEffect } from 'react';
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import CampaignIcon from "@mui/icons-material/Campaign";
import VisibilityIcon from "@mui/icons-material/Visibility";
import MouseIcon from "@mui/icons-material/Mouse";
import DateRangeIcon from "@mui/icons-material/DateRange";
import { AdminOnly } from '../../components/PermissionComponents';
import { adService } from '../../services';

const AdAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7days');
  const [adStats, setAdStats] = useState({
    overview: {
      totalImpressions: 0,
      totalClicks: 0,
      totalRevenue: 0,
      avgCTR: 0,
      activeAds: 0
    },
    adPerformance: [],
    dailyStats: [],
    topPerformers: []
  });

  useEffect(() => {
    const fetchAdAnalytics = async () => {
      try {
        setLoading(true);

        // Supabase에서 광고 데이터 가져오기
        const adsData = await adService.getAds();

        // 활성 광고만 필터링
        const activeAdsData = await adService.getActiveAds();

        // 전체 통계 계산
        const totalImpressions = adsData.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
        const totalClicks = adsData.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
        const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;

        // 개별 광고 성과 계산
        const adPerformance = adsData.map(ad => ({
          id: ad.id,
          title: ad.title,
          impressions: ad.impressions || 0,
          clicks: ad.clicks || 0,
          ctr: ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : 0,
          revenue: 0, // 수익 데이터가 없으므로 0으로 설정
          status: ad.status === 'active' ? 'active' : 'paused',
          period: `${ad.start_date || ''} ~ ${ad.end_date || ''}`
        }));

        // 최고 성과 광고 계산 (CTR 기준)
        const topPerformers = [...adPerformance]
          .sort((a, b) => parseFloat(b.ctr) - parseFloat(a.ctr))
          .slice(0, 4)
          .map(ad => ({
            title: ad.title,
            metric: 'CTR',
            value: `${ad.ctr}%`,
            trend: '+0%' // 트렌드 데이터가 없으므로 임시값
          }));

        setAdStats({
          overview: {
            totalImpressions,
            totalClicks,
            totalRevenue: 0, // 수익 데이터 없음
            avgCTR: parseFloat(avgCTR),
            activeAds: activeAdsData.length
          },
          adPerformance: adPerformance.slice(0, 10), // 상위 10개
          dailyStats: [], // 일별 통계는 별도 구현 필요
          topPerformers
        });

      } catch (error) {
        console.error('광고 분석 데이터 조회 실패:', error);

        // 에러 발생 시 빈 데이터로 설정
        setAdStats({
          overview: {
            totalImpressions: 0,
            totalClicks: 0,
            totalRevenue: 0,
            avgCTR: 0,
            activeAds: 0
          },
          adPerformance: [],
          dailyStats: [],
          topPerformers: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAdAnalytics();
  }, [dateRange]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'badge-success';
      case 'paused': return 'badge-warning';
      case 'expired': return 'badge-error';
      default: return 'badge-ghost';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return '활성';
      case 'paused': return '일시정지';
      case 'expired': return '만료';
      default: return status;
    }
  };

  if (loading) {
    return (
      <AdminOnly>
        <div className="flex items-center justify-center min-h-screen">
          <div className="loading loading-spinner loading-lg"></div>
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
            <TrendingUpIcon className="text-3xl text-red-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">광고 성과 분석</h1>
              <p className="text-gray-600">광고 성과 및 수익 분석 대시보드</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <DateRangeIcon className="text-gray-500" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="select select-bordered"
            >
              <option value="7days">최근 7일</option>
              <option value="30days">최근 30일</option>
              <option value="3months">최근 3개월</option>
            </select>
          </div>
        </div>

        {/* 주요 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-figure text-blue-600">
              <VisibilityIcon />
            </div>
            <div className="stat-title">총 노출수</div>
            <div className="stat-value text-blue-600">{adStats.overview.totalImpressions.toLocaleString()}</div>
            <div className="stat-desc">↗︎ 15% (전주 대비)</div>
          </div>

          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-figure text-green-600">
              <MouseIcon />
            </div>
            <div className="stat-title">총 클릭수</div>
            <div className="stat-value text-green-600">{adStats.overview.totalClicks.toLocaleString()}</div>
            <div className="stat-desc">↗︎ 12% (전주 대비)</div>
          </div>

          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-figure text-orange-600">
              <AttachMoneyIcon />
            </div>
            <div className="stat-title">총 수익</div>
            <div className="stat-value text-orange-600">{formatCurrency(adStats.overview.totalRevenue)}</div>
            <div className="stat-desc">↗︎ 22% (전주 대비)</div>
          </div>

          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-title">평균 CTR</div>
            <div className="stat-value text-purple-600">{adStats.overview.avgCTR}%</div>
            <div className="stat-desc">업계 평균: 4.2%</div>
          </div>

          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-figure text-red-600">
              <CampaignIcon />
            </div>
            <div className="stat-title">활성 광고</div>
            <div className="stat-value text-red-600">{adStats.overview.activeAds}</div>
            <div className="stat-desc">총 12개 광고 중</div>
          </div>
        </div>

        {/* 일별 성과 차트 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">일별 광고 성과</h3>
          <div className="h-64 flex items-end justify-between gap-2">
            {adStats.dailyStats.map((day, index) => (
              <div key={index} className="flex flex-col items-center flex-1">
                <div className="flex flex-col items-center gap-1 mb-2">
                  {/* 수익 바 */}
                  <div
                    className="bg-green-500 rounded-t w-full transition-all hover:bg-green-600"
                    style={{ height: `${(day.revenue / 25000) * 60}px`, minHeight: '10px' }}
                    title={`수익: ${formatCurrency(day.revenue)}`}
                  ></div>
                  {/* 클릭 바 */}
                  <div
                    className="bg-blue-500 rounded w-full transition-all hover:bg-blue-600"
                    style={{ height: `${(day.clicks / 500) * 40}px`, minHeight: '8px' }}
                    title={`클릭: ${day.clicks}`}
                  ></div>
                  {/* 노출 바 */}
                  <div
                    className="bg-purple-500 rounded-b w-full transition-all hover:bg-purple-600"
                    style={{ height: `${(day.impressions / 8000) * 30}px`, minHeight: '6px' }}
                    title={`노출: ${day.impressions.toLocaleString()}`}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(day.date).getDate()}일
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>수익</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>클릭</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded"></div>
              <span>노출</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 광고별 성과 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">광고별 성과</h3>
            <div className="overflow-x-auto">
              <table className="table table-compact w-full">
                <thead>
                  <tr>
                    <th>광고명</th>
                    <th>노출</th>
                    <th>클릭</th>
                    <th>CTR</th>
                    <th>수익</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {adStats.adPerformance.map((ad) => (
                    <tr key={ad.id}>
                      <td>
                        <div className="font-medium">{ad.title}</div>
                        <div className="text-xs text-gray-500">{ad.period}</div>
                      </td>
                      <td>{ad.impressions.toLocaleString()}</td>
                      <td>{ad.clicks.toLocaleString()}</td>
                      <td>
                        <span className={`font-medium ${ad.ctr > 6 ? 'text-green-600' : ad.ctr > 4 ? 'text-blue-600' : 'text-gray-600'}`}>
                          {ad.ctr}%
                        </span>
                      </td>
                      <td className="font-medium text-green-600">
                        {formatCurrency(ad.revenue)}
                      </td>
                      <td>
                        <span className={`badge badge-sm ${getStatusColor(ad.status)}`}>
                          {getStatusText(ad.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 최고 성과 광고 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">최고 성과 광고</h3>
            <div className="space-y-4">
              {adStats.topPerformers.map((performer, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{performer.title}</div>
                    <div className="text-sm text-gray-500">{performer.metric} 기준</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{performer.value}</div>
                    <div className={`text-sm ${performer.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                      {performer.trend}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className="mt-8 flex gap-4">
          <button className="btn btn-primary gap-2">
            <TrendingUpIcon />
            상세 리포트 생성
          </button>
          <button className="btn btn-outline gap-2">
            <AttachMoneyIcon />
            수익 리포트 다운로드
          </button>
          <button className="btn btn-outline gap-2">
            <CampaignIcon />
            광고 최적화 제안
          </button>
        </div>
      </div>
    </AdminOnly>
  );
};

export default AdAnalytics;