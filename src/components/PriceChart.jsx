import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BarChartIcon from '@mui/icons-material/BarChart';
import { marketService } from '../services';

const PriceChart = ({ 
  isOpen, 
  onClose, 
  marketName, 
  weight, 
  grade,
  currentPrice,
  isOverall = false // 전체 데이터 표시 여부
}) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(7); // 7일 또는 30일
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState('both'); // 'both', 'price', 'volume'

  // 차트 데이터 가져오기
  const fetchChartData = async (days) => {
    try {
      setLoading(true);
      setError(null);

      const response = await marketService.getMarketAnalysis(marketName, days);

      if (response && response.raw_data) {
        if (isOverall) {
          // 전체 데이터 (모든 품목 합계)
          const overallData = response.raw_data
            .map(dayData => {
              return {
                date: dayData.market_date,
                dateFormatted: new Date(dayData.market_date).toLocaleDateString('ko-KR', {
                  month: 'short',
                  day: 'numeric'
                }),
                avgPrice: dayData.summary?.overall_avg_price || 0,
                volume: dayData.summary?.total_boxes || 0,
                totalAmount: dayData.summary?.total_amount || 0
              };
            })
            .filter(item => item.avgPrice > 0)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

          setChartData(overallData);
        } else {
          // 특정 무게/등급의 데이터만 필터링
          const filteredData = response.raw_data
            .map(dayData => {
              const targetItem = dayData.details.find(
                item => item.weight === weight && item.grade === grade
              );
              
              if (targetItem) {
                return {
                  date: dayData.market_date,
                  dateFormatted: new Date(dayData.market_date).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric'
                  }),
                  avgPrice: targetItem.avg_price,
                  minPrice: targetItem.min_price,
                  maxPrice: targetItem.max_price,
                  volume: targetItem.boxes,
                  totalAmount: targetItem.avg_price * targetItem.boxes
                };
              }
              return null;
            })
            .filter(item => item !== null)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

          setChartData(filteredData);
        }
      } else {
        setChartData([]);
      }
    } catch (error) {
      console.error('Chart data fetch error:', error);
      setError('차트 데이터를 불러올 수 없습니다.');
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && marketName) {
      fetchChartData(period);
    }
  }, [isOpen, marketName, weight, grade, period, isOverall]);

  const formatPrice = (price) => {
    return price ? price.toLocaleString('ko-KR') : '0';
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {
                entry.name.includes('Price') || entry.name.includes('가격') 
                  ? `${formatPrice(entry.value)}원` 
                  : `${entry.value}상자`
              }
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!isOpen) return null;

  const modalClass = isFullscreen 
    ? "fixed inset-0 z-50 bg-white" 
    : "fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4";

  const contentClass = isFullscreen
    ? "w-full h-full flex flex-col"
    : "bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col";

  return (
    <div className={modalClass}>
      <div className={contentClass}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <TrendingUpIcon className="text-green-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                {marketName} - {isOverall ? '전체 거래 요약' : `참외 ${weight} ${grade}`}
              </h2>
              <p className="text-sm text-gray-600">
                {isOverall ? '전체 시장 ' : ''}가격 추이 ({period}일간)
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* 기간 선택 */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setPeriod(7)}
                className={`px-3 py-1 text-sm rounded ${
                  period === 7 
                    ? 'bg-white text-green-600 shadow-sm' 
                    : 'text-gray-600 hover:text-green-600'
                }`}
              >
                7일
              </button>
              <button
                onClick={() => setPeriod(30)}
                className={`px-3 py-1 text-sm rounded ${
                  period === 30 
                    ? 'bg-white text-green-600 shadow-sm' 
                    : 'text-gray-600 hover:text-green-600'
                }`}
              >
                30일
              </button>
            </div>

            {/* 보기 모드 선택 */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('both')}
                className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${
                  viewMode === 'both' 
                    ? 'bg-white text-green-600 shadow-sm' 
                    : 'text-gray-600 hover:text-green-600'
                }`}
              >
                <TrendingUpIcon fontSize="small" />
                <BarChartIcon fontSize="small" />
                전체
              </button>
              <button
                onClick={() => setViewMode('price')}
                className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${
                  viewMode === 'price' 
                    ? 'bg-white text-green-600 shadow-sm' 
                    : 'text-gray-600 hover:text-green-600'
                }`}
              >
                <TrendingUpIcon fontSize="small" />
                가격
              </button>
              <button
                onClick={() => setViewMode('volume')}
                className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${
                  viewMode === 'volume' 
                    ? 'bg-white text-green-600 shadow-sm' 
                    : 'text-gray-600 hover:text-green-600'
                }`}
              >
                <BarChartIcon fontSize="small" />
                물량
              </button>
            </div>

            {/* 전체화면 토글 */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title={isFullscreen ? "창 모드" : "전체화면"}
            >
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </button>

            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="닫기"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* 현재 가격 정보 */}
        <div className="px-4 py-3 bg-green-50 border-b">
          <div className="flex items-center justify-between">
            <div className="text-sm text-green-700">
              현재 평균 가격
            </div>
            <div className="text-xl font-bold text-green-800">
              {formatPrice(currentPrice)} 원
            </div>
          </div>
        </div>

        {/* 차트 영역 */}
        <div className="flex-1 p-4" style={{ minHeight: viewMode === 'both' ? '600px' : '400px' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="loading loading-spinner loading-lg text-primary"></div>
                <p className="mt-4 text-gray-600">차트 데이터를 불러오는 중...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-600">
                <p className="text-lg font-semibold mb-2">데이터 로드 실패</p>
                <p className="text-sm">{error}</p>
                <button
                  onClick={() => fetchChartData(period)}
                  className="mt-4 btn btn-primary btn-sm"
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-lg font-semibold mb-2">데이터가 없습니다</p>
                <p className="text-sm">
                  해당 기간에 거래 데이터가 없습니다.
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full" style={{ minHeight: '300px' }}>
              {viewMode === 'both' ? (
                <div className={`h-full ${isFullscreen ? 'flex gap-4' : 'flex flex-col gap-4'}`}>
                  {/* 가격 차트 */}
                  <div className="flex-1" style={{ minHeight: '200px' }}>
                    <div className="mb-2">
                      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                        <TrendingUpIcon fontSize="small" className="text-green-600" />
                        가격 추이
                      </h3>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="dateFormatted" 
                          stroke="#666"
                          fontSize={12}
                        />
                        <YAxis 
                          stroke="#666"
                          fontSize={12}
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="avgPrice" 
                          stroke="#10b981" 
                          strokeWidth={3}
                          name="평균 가격"
                          dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                        />
                        {!isOverall && (
                          <>
                            <Line 
                              type="monotone" 
                              dataKey="maxPrice" 
                              stroke="#ef4444" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              name="최고 가격"
                              dot={false}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="minPrice" 
                              stroke="#3b82f6" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              name="최저 가격"
                              dot={false}
                            />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* 물량 차트 */}
                  <div className="flex-1" style={{ minHeight: '200px' }}>
                    <div className="mb-2">
                      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                        <BarChartIcon fontSize="small" className="text-blue-600" />
                        거래량 추이
                      </h3>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="dateFormatted" 
                          stroke="#666"
                          fontSize={12}
                        />
                        <YAxis 
                          stroke="#666"
                          fontSize={12}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar 
                          dataKey="volume" 
                          fill="#3b82f6" 
                          name="거래량 (상자)"
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {viewMode === 'price' ? (
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="dateFormatted" 
                        stroke="#666"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="#666"
                        fontSize={12}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="avgPrice" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        name="평균 가격"
                        dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                      />
                      {!isOverall && (
                        <>
                          <Line 
                            type="monotone" 
                            dataKey="maxPrice" 
                            stroke="#ef4444" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            name="최고 가격"
                            dot={false}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="minPrice" 
                            stroke="#3b82f6" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            name="최저 가격"
                            dot={false}
                          />
                        </>
                      )}
                    </LineChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="dateFormatted" 
                        stroke="#666"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="#666"
                        fontSize={12}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar 
                        dataKey="volume" 
                        fill="#10b981" 
                        name="거래량 (상자)"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>

        {/* 하단 통계 정보 */}
        {!loading && !error && chartData.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <p className="text-gray-500">기간 평균</p>
                <p className="font-semibold text-green-600">
                  {formatPrice(
                    Math.round(
                      chartData.reduce((sum, item) => sum + item.avgPrice, 0) / chartData.length
                    )
                  )} 원
                </p>
              </div>
              {!isOverall && (
                <>
                  <div className="text-center">
                    <p className="text-gray-500">최고가</p>
                    <p className="font-semibold text-red-600">
                      {formatPrice(Math.max(...chartData.map(item => item.maxPrice)))} 원
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">최저가</p>
                    <p className="font-semibold text-blue-600">
                      {formatPrice(Math.min(...chartData.map(item => item.minPrice)))} 원
                    </p>
                  </div>
                </>
              )}
              <div className="text-center">
                <p className="text-gray-500">총 거래량</p>
                <p className="font-semibold text-gray-700">
                  {chartData.reduce((sum, item) => sum + item.volume, 0).toLocaleString()} 상자
                </p>
              </div>
              {isOverall && (
                <div className="text-center">
                  <p className="text-gray-500">총 거래금액</p>
                  <p className="font-semibold text-blue-600">
                    {formatPrice(chartData.reduce((sum, item) => sum + item.totalAmount, 0))} 원
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceChart;