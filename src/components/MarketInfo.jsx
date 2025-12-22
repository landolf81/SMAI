import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketService } from '../services';
import LoadingSpinner from './LoadingSpinner';

const MarketInfo = () => {
    const [selectedMarket, setSelectedMarket] = useState('성주참외공판장');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const queryClient = useQueryClient();

    const markets = [
        '성주참외공판장',
        '성주농협공판장',
        '성주원예농협공판장'
    ];

    // Supabase에서 시장 데이터 조회
    const { data: marketData, isLoading: loading, error } = useQuery({
        queryKey: ['marketData', selectedMarket, selectedDate],
        queryFn: () => marketService.getMarketData(selectedMarket, selectedDate),
        enabled: !!selectedMarket && !!selectedDate
    });

    // 가격 포맷팅
    const formatPrice = (price) => {
        return new Intl.NumberFormat('ko-KR').format(price) + '원';
    };

    // 관심 등록 뮤테이션
    const addFavoriteMutation = useMutation({
        mutationFn: (market_name) => marketService.addFavorite({ market_name, item_name: '참외' }),
        onSuccess: () => {
            alert('관심 목록에 추가되었습니다!');
            queryClient.invalidateQueries(['favorites']);
        },
        onError: (err) => {
            alert(err.message || '관심 등록 실패');
        }
    });

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* 헤더 */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                    🥒 참외 경락 정보
                </h1>
                <p className="text-gray-600">
                    성주 지역 참외 공판장의 실시간 경락가 정보를 확인하세요
                </p>
            </div>

            {/* 검색 옵션 */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-48">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            공판장 선택
                        </label>
                        <select 
                            value={selectedMarket}
                            onChange={(e) => setSelectedMarket(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                            {markets.map(market => (
                                <option key={market} value={market}>
                                    {market}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="flex-1 min-w-48">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            날짜 선택
                        </label>
                        <input 
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>
                    
                    <button
                        onClick={() => queryClient.invalidateQueries(['marketData', selectedMarket, selectedDate])}
                        disabled={loading}
                        className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? '조회중...' : '조회'}
                    </button>
                </div>
            </div>

            {/* 로딩 상태 */}
            {loading && (
                <div className="text-center py-8">
                    <LoadingSpinner size="lg" className="mx-auto" />
                    <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
                </div>
            )}

            {/* 에러 상태 */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                    <div className="flex">
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">
                                조회 실패
                            </h3>
                            <div className="mt-2 text-sm text-red-700">
                                {error}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 시장 데이터 표시 */}
            {marketData && !loading && (
                <div className="space-y-6">
                    {/* 요약 정보 */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">
                                    {marketData.market_name}
                                </h2>
                                <p className="text-gray-600">
                                    {marketData.market_date}
                                </p>
                            </div>
                            <button
                                onClick={() => addFavoriteMutation.mutate(marketData.market_name)}
                                disabled={addFavoriteMutation.isPending}
                                className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {addFavoriteMutation.isPending ? '등록중...' : '⭐ 관심 등록'}
                            </button>
                        </div>
                        
                        {marketData.summary && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-white rounded-lg">
                                    <div className="text-2xl font-bold text-green-600">
                                        {marketData.summary.total_boxes.toLocaleString()}
                                    </div>
                                    <div className="text-sm text-gray-600">총 거래량 (상자)</div>
                                </div>
                                <div className="text-center p-4 bg-white rounded-lg">
                                    <div className="text-2xl font-bold text-blue-600">
                                        {formatPrice(marketData.summary.total_amount)}
                                    </div>
                                    <div className="text-sm text-gray-600">총 거래금액</div>
                                </div>
                                <div className="text-center p-4 bg-white rounded-lg">
                                    <div className="text-2xl font-bold text-purple-600">
                                        {formatPrice(marketData.summary.overall_avg_price)}
                                    </div>
                                    <div className="text-sm text-gray-600">평균 가격</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 상세 데이터 테이블 */}
                    {marketData.details && marketData.details.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                            <div className="px-6 py-4 border-b bg-gray-50">
                                <h3 className="text-lg font-semibold text-gray-800">
                                    상세 경락 정보
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                중량
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                등급
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                거래량 (상자)
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                평균가격
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                최저가격
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                최고가격
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {marketData.details.map((item, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {item.weight}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {item.grade}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {item.boxes.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                                                    {formatPrice(item.avg_price)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatPrice(item.min_price)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatPrice(item.max_price)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 데이터 없음 메시지 */}
                    {marketData.details && marketData.details.length === 0 && (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                            <div className="flex flex-col items-center space-y-4">
                                <img 
                                    src="/images/AS_110.png" 
                                    alt="경락가 정보 없음" 
                                    className="w-20 h-20 opacity-60"
                                />
                                <div>
                                    <h3 className="text-lg font-medium text-gray-700 mb-2">경락가 정보가 없습니다</h3>
                                    <p className="text-gray-500 text-sm">
                                        {selectedDate}에 대한 {selectedMarket}의 경락 정보를 찾을 수 없습니다.
                                    </p>
                                    <p className="text-gray-400 text-xs mt-2">
                                        다른 날짜나 다른 공판장을 선택해보세요.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MarketInfo;
