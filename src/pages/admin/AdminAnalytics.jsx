import React, { useState, useEffect } from 'react';
import AnalyticsIcon from "@mui/icons-material/Analytics";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PeopleIcon from "@mui/icons-material/People";
import ArticleIcon from "@mui/icons-material/Article";
import CampaignIcon from "@mui/icons-material/Campaign";
import DateRangeIcon from "@mui/icons-material/DateRange";
import { AdminOnly } from '../../components/PermissionComponents';

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7days');
  const [analytics, setAnalytics] = useState({
    overview: {
      totalUsers: 0,
      activeUsers: 0,
      totalPosts: 0,
      totalViews: 0,
      adClicks: 0,
      revenue: 0
    },
    userGrowth: [],
    postActivity: [],
    popularTags: [],
    adPerformance: []
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      // 실제 API 호출 대신 샘플 데이터
      setTimeout(() => {
        setAnalytics({
          overview: {
            totalUsers: 1234,
            activeUsers: 892,
            totalPosts: 2456,
            totalViews: 12450,
            adClicks: 334,
            revenue: 125000
          },
          userGrowth: [
            { date: '2025-01-24', users: 45 },
            { date: '2025-01-25', users: 52 },
            { date: '2025-01-26', users: 38 },
            { date: '2025-01-27', users: 67 },
            { date: '2025-01-28', users: 73 },
            { date: '2025-01-29', users: 81 },
            { date: '2025-01-30', users: 95 }
          ],
          postActivity: [
            { date: '2025-01-24', posts: 23 },
            { date: '2025-01-25', posts: 31 },
            { date: '2025-01-26', posts: 28 },
            { date: '2025-01-27', posts: 42 },
            { date: '2025-01-28', posts: 38 },
            { date: '2025-01-29', posts: 45 },
            { date: '2025-01-30', posts: 51 }
          ],
          popularTags: [
            { tag: '가격정보', count: 234, growth: 12 },
            { tag: '참외', count: 189, growth: 8 },
            { tag: '질문', count: 156, growth: -3 },
            { tag: '시장정보', count: 134, growth: 15 },
            { tag: '농업기술', count: 98, growth: 22 }
          ],
          adPerformance: [
            { id: 1, title: '농기계 할인', impressions: 1250, clicks: 89, ctr: 7.1, revenue: 45000 },
            { id: 2, title: '비료 특가', impressions: 980, clicks: 45, ctr: 4.6, revenue: 23000 },
            { id: 3, title: '종자 판매', impressions: 750, clicks: 32, ctr: 4.3, revenue: 18000 }
          ]
        });
        setLoading(false);
      }, 1000);
    };

    fetchAnalytics();
  }, [dateRange]);

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
            <AnalyticsIcon className="text-3xl text-red-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">통계 분석</h1>
              <p className="text-gray-600">사이트 활동 및 성과 분석</p>
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
              <option value="1year">최근 1년</option>
            </select>
          </div>
        </div>

        {/* 주요 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-figure text-blue-600">
              <PeopleIcon />
            </div>
            <div className="stat-title">전체 사용자</div>
            <div className="stat-value text-blue-600">{analytics.overview.totalUsers.toLocaleString()}</div>
            <div className="stat-desc">활성 사용자 {analytics.overview.activeUsers}</div>
          </div>

          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-figure text-green-600">
              <ArticleIcon />
            </div>
            <div className="stat-title">총 게시물</div>
            <div className="stat-value text-green-600">{analytics.overview.totalPosts.toLocaleString()}</div>
            <div className="stat-desc">↗︎ 12% (지난 주 대비)</div>
          </div>

          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-figure text-purple-600">
              <TrendingUpIcon />
            </div>
            <div className="stat-title">총 조회수</div>
            <div className="stat-value text-purple-600">{analytics.overview.totalViews.toLocaleString()}</div>
            <div className="stat-desc">↗︎ 8% (지난 주 대비)</div>
          </div>

          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-figure text-orange-600">
              <CampaignIcon />
            </div>
            <div className="stat-title">광고 클릭</div>
            <div className="stat-value text-orange-600">{analytics.overview.adClicks}</div>
            <div className="stat-desc">CTR 5.2%</div>
          </div>

          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-title">광고 수익</div>
            <div className="stat-value text-green-600">₩{analytics.overview.revenue.toLocaleString()}</div>
            <div className="stat-desc">이번 달</div>
          </div>

          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-title">성장률</div>
            <div className="stat-value text-blue-600">+15%</div>
            <div className="stat-desc">월간 사용자 증가</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 사용자 증가 차트 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">일일 활성 사용자</h3>
            <div className="h-64 flex items-end justify-between gap-2">
              {analytics.userGrowth.map((item, index) => (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div
                    className="bg-blue-500 rounded-t w-full transition-all hover:bg-blue-600"
                    style={{ height: `${(item.users / 100) * 100}%` }}
                  ></div>
                  <div className="text-xs mt-2 text-gray-500">
                    {new Date(item.date).getDate()}일
                  </div>
                  <div className="text-xs font-medium">{item.users}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 게시물 활동 차트 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">일일 게시물 수</h3>
            <div className="h-64 flex items-end justify-between gap-2">
              {analytics.postActivity.map((item, index) => (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div
                    className="bg-green-500 rounded-t w-full transition-all hover:bg-green-600"
                    style={{ height: `${(item.posts / 60) * 100}%` }}
                  ></div>
                  <div className="text-xs mt-2 text-gray-500">
                    {new Date(item.date).getDate()}일
                  </div>
                  <div className="text-xs font-medium">{item.posts}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 인기 태그 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">인기 태그</h3>
            <div className="space-y-4">
              {analytics.popularTags.map((tag, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">#{tag.tag}</span>
                    <span className="text-sm text-gray-500">{tag.count}회 사용</span>
                  </div>
                  <div className={`text-sm font-medium ${
                    tag.growth > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {tag.growth > 0 ? '+' : ''}{tag.growth}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 광고 성과 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">광고 성과</h3>
            <div className="overflow-x-auto">
              <table className="table table-compact w-full">
                <thead>
                  <tr>
                    <th>광고</th>
                    <th>노출</th>
                    <th>클릭</th>
                    <th>CTR</th>
                    <th>수익</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.adPerformance.map((ad) => (
                    <tr key={ad.id}>
                      <td className="font-medium">{ad.title}</td>
                      <td>{ad.impressions.toLocaleString()}</td>
                      <td>{ad.clicks}</td>
                      <td>{ad.ctr}%</td>
                      <td>₩{ad.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminOnly>
  );
};

export default AdminAnalytics;