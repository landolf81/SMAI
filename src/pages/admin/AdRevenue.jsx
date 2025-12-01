import React, { useState, useEffect } from 'react';
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PieChartIcon from "@mui/icons-material/PieChart";
import DownloadIcon from "@mui/icons-material/Download";
import { AdminOnly } from '../../components/PermissionComponents';
import { adService } from '../../services';

const AdRevenue = () => {
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [revenueData, setRevenueData] = useState({
    summary: {
      totalRevenue: 0,
      monthlyGrowth: 0,
      avgDailyRevenue: 0,
      topAdRevenue: 0
    },
    monthlyRevenue: [],
    revenueByAd: [],
    revenueByCategory: []
  });

  useEffect(() => {
    const fetchRevenueData = async () => {
      try {
        setLoading(true);

        // Supabase에서 광고 데이터 가져오기
        const adsData = await adService.getAds();

        // 노출/클릭 기반 가상 수익 계산 (실제 수익 시스템이 없으므로)
        const totalClicks = adsData.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
        const virtualRevenue = totalClicks * 100; // 클릭당 100원 가정

        // 광고별 성과 데이터
        const revenueByAd = adsData.map(ad => ({
          id: ad.id,
          title: ad.title,
          revenue: (ad.clicks || 0) * 100, // 가상 수익
          percentage: totalClicks > 0 ? ((ad.clicks / totalClicks) * 100).toFixed(1) : 0,
          impressions: ad.impressions || 0,
          clicks: ad.clicks || 0,
          ctr: ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : 0
        })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

        setRevenueData({
          summary: {
            totalRevenue: virtualRevenue,
            monthlyGrowth: 0, // 트렌드 데이터 없음
            avgDailyRevenue: Math.floor(virtualRevenue / 30),
            topAdRevenue: revenueByAd[0]?.revenue || 0
          },
          monthlyRevenue: [], // 월별 데이터 없음
          revenueByAd: revenueByAd,
          revenueByCategory: [] // 카테고리 데이터 없음
        });

      } catch (error) {
        console.error('수익 데이터 조회 실패:', error);
        // 에러 발생 시 빈 데이터
        setRevenueData({
          summary: { totalRevenue: 0, monthlyGrowth: 0, avgDailyRevenue: 0, topAdRevenue: 0 },
          monthlyRevenue: [],
          revenueByAd: [],
          revenueByCategory: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRevenueData();
  }, [selectedPeriod]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };

  const formatMonth = (monthStr) => {
    const date = new Date(monthStr + '-01');
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
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
            <AttachMoneyIcon className="text-3xl text-red-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">수익 통계</h1>
              <p className="text-gray-600">광고 수익 분석 및 매출 현황</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="select select-bordered"
            >
              <option value="week">최근 1주</option>
              <option value="month">최근 1개월</option>
              <option value="quarter">최근 분기</option>
              <option value="year">최근 1년</option>
            </select>
            
            <button className="btn btn-outline gap-2">
              <DownloadIcon />
              리포트 다운로드
            </button>
          </div>
        </div>

        {/* 수익 요약 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="stat bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow">
            <div className="stat-title text-green-100">총 수익</div>
            <div className="stat-value">{formatCurrency(revenueData.summary.totalRevenue)}</div>
            <div className="stat-desc text-green-100">이번 달 누적</div>
          </div>

          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-figure text-blue-600">
              <TrendingUpIcon />
            </div>
            <div className="stat-title">월간 성장률</div>
            <div className="stat-value text-blue-600">+{revenueData.summary.monthlyGrowth}%</div>
            <div className="stat-desc text-green-600">↗︎ 전월 대비</div>
          </div>

          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-figure text-purple-600">
              <CalendarTodayIcon />
            </div>
            <div className="stat-title">일평균 수익</div>
            <div className="stat-value text-purple-600">{formatCurrency(revenueData.summary.avgDailyRevenue)}</div>
            <div className="stat-desc">지난 30일 평균</div>
          </div>

          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-figure text-orange-600">
              <PieChartIcon />
            </div>
            <div className="stat-title">최고 수익 광고</div>
            <div className="stat-value text-orange-600">{formatCurrency(revenueData.summary.topAdRevenue)}</div>
            <div className="stat-desc">농기계 할인 특가</div>
          </div>
        </div>

        {/* 월별 수익 차트 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">월별 수익 추이</h3>
          <div className="h-80 flex items-end justify-between gap-3">
            {revenueData.monthlyRevenue.map((month, index) => (
              <div key={index} className="flex flex-col items-center flex-1">
                <div className="mb-2 text-xs text-center">
                  <div className="font-medium text-green-600">
                    {formatCurrency(month.revenue)}
                  </div>
                  <div className={`text-xs ${month.growth > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {month.growth > 0 ? '+' : ''}{month.growth}%
                  </div>
                </div>
                <div
                  className="bg-gradient-to-t from-green-500 to-green-400 rounded-t w-full transition-all hover:from-green-600 hover:to-green-500 cursor-pointer"
                  style={{ height: `${(month.revenue / 2500000) * 240}px`, minHeight: '20px' }}
                  title={`${formatMonth(month.month)}: ${formatCurrency(month.revenue)}`}
                ></div>
                <div className="text-xs mt-2 text-gray-500 transform -rotate-45 origin-top-left w-16">
                  {formatMonth(month.month)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 광고별 수익 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">광고별 수익 순위</h3>
            <div className="space-y-4">
              {revenueData.revenueByAd.map((ad, index) => (
                <div key={ad.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{ad.title}</div>
                      <div className="text-sm text-gray-500">
                        CTR: {ad.ctr}% | 클릭: {ad.clicks.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">{formatCurrency(ad.revenue)}</div>
                    <div className="text-sm text-gray-500">{ad.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 카테고리별 수익 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">카테고리별 수익 분포</h3>
            <div className="space-y-4">
              {revenueData.revenueByCategory.map((category, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{category.category}</span>
                    <span className="text-sm text-gray-500">{category.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`${category.color} h-3 rounded-full transition-all duration-500`}
                      style={{ width: `${category.percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-green-600">{formatCurrency(category.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 수익 예측 및 목표 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">수익 예측 및 목표</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-2">₩3,200,000</div>
              <div className="text-sm text-gray-600">다음 달 예상 수익</div>
              <div className="text-xs text-green-600 mt-1">+30% 증가 예상</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-2">₩5,000,000</div>
              <div className="text-sm text-gray-600">월간 목표 수익</div>
              <div className="text-xs text-blue-600 mt-1">현재 49% 달성</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 mb-2">₩28,000,000</div>
              <div className="text-sm text-gray-600">연간 목표 수익</div>
              <div className="text-xs text-green-600 mt-1">순조로운 진행</div>
            </div>
          </div>
        </div>
      </div>
    </AdminOnly>
  );
};

export default AdRevenue;