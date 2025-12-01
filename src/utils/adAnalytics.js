/**
 * 광고 통계 및 분석 유틸리티
 * - 통계 데이터 계산 및 처리
 * - 성과 지표 산출
 * - 트렌드 분석
 * - 예측 알고리즘
 */

import { adService } from '../services';

class AdAnalyticsCalculator {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5분 캐시
    }

    // 캐시 키 생성
    getCacheKey(endpoint, params) {
        return `${endpoint}_${JSON.stringify(params)}`;
    }

    // 캐시된 데이터 가져오기
    getCachedData(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    // 데이터 캐시 저장
    setCachedData(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    // 기본 통계 계산
    calculateBasicStats(data) {
        if (!data || data.length === 0) {
            return {
                totalViews: 0,
                totalClicks: 0,
                totalCost: 0,
                totalRevenue: 0,
                totalConversions: 0,
                avgCTR: 0,
                avgCPC: 0,
                avgCPM: 0,
                avgConversionRate: 0
            };
        }

        const totals = data.reduce((acc, item) => ({
            views: acc.views + (item.views || 0),
            clicks: acc.clicks + (item.clicks || 0),
            cost: acc.cost + (item.cost || 0),
            revenue: acc.revenue + (item.revenue || 0),
            conversions: acc.conversions + (item.conversions || 0)
        }), { views: 0, clicks: 0, cost: 0, revenue: 0, conversions: 0 });

        const avgCTR = totals.views > 0 ? (totals.clicks / totals.views) * 100 : 0;
        const avgCPC = totals.clicks > 0 ? totals.cost / totals.clicks : 0;
        const avgCPM = totals.views > 0 ? (totals.cost / totals.views) * 1000 : 0;
        const avgConversionRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;

        return {
            totalViews: totals.views,
            totalClicks: totals.clicks,
            totalCost: totals.cost,
            totalRevenue: totals.revenue,
            totalConversions: totals.conversions,
            avgCTR: parseFloat(avgCTR.toFixed(2)),
            avgCPC: parseFloat(avgCPC.toFixed(2)),
            avgCPM: parseFloat(avgCPM.toFixed(2)),
            avgConversionRate: parseFloat(avgConversionRate.toFixed(2))
        };
    }

    // CTR 등급 계산
    getCTRGrade(ctr) {
        if (ctr >= 5.0) return { grade: 'A+', color: '#10B981', description: '매우 우수' };
        if (ctr >= 3.0) return { grade: 'A', color: '#34D399', description: '우수' };
        if (ctr >= 2.0) return { grade: 'B+', color: '#60A5FA', description: '양호' };
        if (ctr >= 1.5) return { grade: 'B', color: '#93C5FD', description: '보통' };
        if (ctr >= 1.0) return { grade: 'C+', color: '#FCD34D', description: '개선필요' };
        if (ctr >= 0.5) return { grade: 'C', color: '#F59E0B', description: '주의' };
        return { grade: 'D', color: '#EF4444', description: '위험' };
    }

    // 성과 트렌드 계산
    calculateTrend(currentData, previousData) {
        if (!previousData || !currentData) return 0;
        
        const current = typeof currentData === 'object' ? currentData.value : currentData;
        const previous = typeof previousData === 'object' ? previousData.value : previousData;
        
        if (previous === 0) return current > 0 ? 100 : 0;
        
        return parseFloat((((current - previous) / previous) * 100).toFixed(1));
    }

    // 시간대별 성과 분석
    analyzeHourlyPerformance(data) {
        const hourlyStats = Array.from({ length: 24 }, (_, hour) => ({
            hour,
            views: 0,
            clicks: 0,
            ctr: 0,
            cost: 0
        }));

        data.forEach(item => {
            const hour = new Date(item.timestamp).getHours();
            if (hour >= 0 && hour < 24) {
                hourlyStats[hour].views += item.views || 0;
                hourlyStats[hour].clicks += item.clicks || 0;
                hourlyStats[hour].cost += item.cost || 0;
            }
        });

        // CTR 계산
        hourlyStats.forEach(stat => {
            stat.ctr = stat.views > 0 ? ((stat.clicks / stat.views) * 100) : 0;
        });

        return hourlyStats;
    }

    // 위치별 성과 분석
    analyzePositionPerformance(data) {
        const positionStats = {};

        data.forEach(item => {
            const position = item.position || 'unknown';
            if (!positionStats[position]) {
                positionStats[position] = {
                    position,
                    views: 0,
                    clicks: 0,
                    cost: 0,
                    conversions: 0
                };
            }

            positionStats[position].views += item.views || 0;
            positionStats[position].clicks += item.clicks || 0;
            positionStats[position].cost += item.cost || 0;
            positionStats[position].conversions += item.conversions || 0;
        });

        // 성과 지표 계산
        Object.values(positionStats).forEach(stat => {
            stat.ctr = stat.views > 0 ? ((stat.clicks / stat.views) * 100) : 0;
            stat.cpc = stat.clicks > 0 ? (stat.cost / stat.clicks) : 0;
            stat.conversionRate = stat.clicks > 0 ? ((stat.conversions / stat.clicks) * 100) : 0;
        });

        return Object.values(positionStats);
    }

    // 광고별 효율성 분석
    analyzeAdEfficiency(ads) {
        return ads.map(ad => {
            const efficiency = this.calculateBasicStats([ad]);
            const ctrGrade = this.getCTRGrade(efficiency.avgCTR);
            
            // 효율성 점수 (0-100)
            let efficiencyScore = 0;
            efficiencyScore += Math.min(efficiency.avgCTR * 10, 40); // CTR (최대 40점)
            efficiencyScore += Math.min(efficiency.avgConversionRate * 2, 30); // 전환율 (최대 30점)
            efficiencyScore += Math.min((efficiency.totalRevenue / (efficiency.totalCost || 1)) * 10, 30); // ROI (최대 30점)

            return {
                ...ad,
                ...efficiency,
                ctrGrade,
                efficiencyScore: Math.round(efficiencyScore),
                recommendations: this.generateRecommendations(ad, efficiency)
            };
        });
    }

    // 개선 추천 생성
    generateRecommendations(ad, stats) {
        const recommendations = [];

        if (stats.avgCTR < 1.0) {
            recommendations.push({
                type: 'warning',
                title: '클릭률 개선 필요',
                description: '광고 제목이나 이미지를 더 매력적으로 수정해보세요.',
                action: 'optimize_creative'
            });
        }

        if (stats.avgConversionRate < 2.0) {
            recommendations.push({
                type: 'info',
                title: '전환율 향상 방안',
                description: '랜딩 페이지 최적화를 고려해보세요.',
                action: 'optimize_landing'
            });
        }

        if (stats.avgCPC > 1000) {
            recommendations.push({
                type: 'warning',
                title: '클릭당 비용 최적화',
                description: '타겟팅을 더 구체적으로 설정해보세요.',
                action: 'optimize_targeting'
            });
        }

        if (stats.totalViews > 10000 && stats.totalClicks < 100) {
            recommendations.push({
                type: 'error',
                title: '광고 성과 검토 필요',
                description: '많은 노출에 비해 클릭이 적습니다. 광고 콘텐츠를 재검토하세요.',
                action: 'review_content'
            });
        }

        return recommendations;
    }

    // 예측 분석
    predictPerformance(historicalData, days = 7) {
        if (!historicalData || historicalData.length < 3) {
            return null;
        }

        // 간단한 선형 회귀를 사용한 예측
        const dataPoints = historicalData.map((item, index) => ({
            x: index,
            y: item.clicks || 0
        }));

        const n = dataPoints.length;
        const sumX = dataPoints.reduce((sum, point) => sum + point.x, 0);
        const sumY = dataPoints.reduce((sum, point) => sum + point.y, 0);
        const sumXY = dataPoints.reduce((sum, point) => sum + (point.x * point.y), 0);
        const sumXX = dataPoints.reduce((sum, point) => sum + (point.x * point.x), 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // 미래 예측
        const predictions = [];
        for (let i = 1; i <= days; i++) {
            const futureX = n + i - 1;
            const predictedY = Math.max(0, Math.round(slope * futureX + intercept));
            predictions.push({
                date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                predictedClicks: predictedY,
                confidence: Math.max(0, Math.min(100, 100 - (i * 10))) // 신뢰도는 시간이 지날수록 감소
            });
        }

        return predictions;
    }

    // A/B 테스트 분석
    analyzeABTest(adA, adB) {
        const statsA = this.calculateBasicStats([adA]);
        const statsB = this.calculateBasicStats([adB]);

        // 통계적 유의성 검정 (간단한 버전)
        const significance = this.calculateSignificance(
            statsA.totalClicks, statsA.totalViews,
            statsB.totalClicks, statsB.totalViews
        );

        return {
            adA: { ...adA, stats: statsA },
            adB: { ...adB, stats: statsB },
            winner: statsA.avgCTR > statsB.avgCTR ? 'A' : 'B',
            improvement: Math.abs(((statsA.avgCTR - statsB.avgCTR) / Math.max(statsA.avgCTR, statsB.avgCTR)) * 100),
            significance,
            recommendation: significance > 95 ? 'significant' : 'need_more_data'
        };
    }

    // 통계적 유의성 계산 (간단한 Z-test)
    calculateSignificance(clicksA, viewsA, clicksB, viewsB) {
        if (viewsA === 0 || viewsB === 0) return 0;

        const ctrA = clicksA / viewsA;
        const ctrB = clicksB / viewsB;
        const pooledCTR = (clicksA + clicksB) / (viewsA + viewsB);
        const standardError = Math.sqrt(pooledCTR * (1 - pooledCTR) * (1/viewsA + 1/viewsB));
        
        if (standardError === 0) return 0;
        
        const zScore = Math.abs(ctrA - ctrB) / standardError;
        
        // Z-score를 신뢰도로 변환 (간단한 근사)
        return Math.min(99.9, Math.max(0, (1 - Math.exp(-zScore * 0.5)) * 100));
    }

    // 예산 최적화 분석
    analyzeBudgetOptimization(ads, totalBudget) {
        const adsWithROI = ads.map(ad => {
            const stats = this.calculateBasicStats([ad]);
            const roi = stats.totalCost > 0 ? (stats.totalRevenue / stats.totalCost) : 0;
            return { ...ad, stats, roi };
        });

        // ROI 기준으로 정렬
        adsWithROI.sort((a, b) => b.roi - a.roi);

        // 예산 재분배 추천
        const recommendations = adsWithROI.map((ad, index) => {
            let budgetChange = 0;
            let reason = '';

            if (ad.roi > 2.0 && index < 3) {
                budgetChange = 20; // 상위 3개 고ROI 광고는 예산 증액
                reason = '높은 ROI로 인한 예산 증액 추천';
            } else if (ad.roi < 0.5) {
                budgetChange = -30; // 낮은 ROI 광고는 예산 감액
                reason = '낮은 ROI로 인한 예산 감액 추천';
            }

            return {
                adId: ad.id,
                currentBudget: ad.budget || 0,
                recommendedChange: budgetChange,
                reason,
                expectedImprovement: budgetChange > 0 ? `+${budgetChange * 0.5}% 수익 증가 예상` : 
                                  budgetChange < 0 ? `${Math.abs(budgetChange * 0.3)}% 비용 절감` : '현상 유지'
            };
        });

        return recommendations;
    }

    // 종합 성과 리포트 생성
    async generateComprehensiveReport(dateRange = 'week') {
        try {
            const cacheKey = this.getCacheKey('comprehensive_report', { dateRange });
            const cached = this.getCachedData(cacheKey);
            if (cached) return cached;

            // Supabase에서 광고 데이터 가져오기
            const ads = await adService.getAds();

            // 클라이언트 사이드에서 분석
            const summary = this.calculateBasicStats(ads);
            const positions = this.analyzePositionPerformance(ads);
            const hourly = this.analyzeHourlyPerformance(ads);
            const adAnalysis = this.analyzeAdEfficiency(ads);

            // 종합 분석
            const report = {
                summary,
                trends: ads, // 트렌드 데이터는 ads 배열 사용
                positions,
                hourly,
                ads: adAnalysis,
                predictions: this.predictPerformance(ads),
                budgetOptimization: this.analyzeBudgetOptimization(ads),
                insights: this.generateInsights(summary, ads),
                generatedAt: new Date().toISOString()
            };

            this.setCachedData(cacheKey, report);
            return report;

        } catch (error) {
            console.error('종합 리포트 생성 실패:', error);
            throw error;
        }
    }

    // 인사이트 생성
    generateInsights(summary, trends) {
        const insights = [];

        // 성과 트렌드 인사이트
        if (trends && trends.length > 1) {
            const recentTrend = this.calculateTrend(trends[trends.length - 1], trends[trends.length - 2]);
            if (recentTrend > 20) {
                insights.push({
                    type: 'positive',
                    title: '성과 급상승',
                    description: `최근 성과가 ${recentTrend}% 향상되었습니다.`,
                    priority: 'high'
                });
            } else if (recentTrend < -20) {
                insights.push({
                    type: 'negative',
                    title: '성과 하락 주의',
                    description: `최근 성과가 ${Math.abs(recentTrend)}% 하락했습니다.`,
                    priority: 'high'
                });
            }
        }

        // CTR 인사이트
        if (summary.avgCTR > 3.0) {
            insights.push({
                type: 'positive',
                title: '우수한 클릭률',
                description: '평균 클릭률이 업계 평균을 크게 상회합니다.',
                priority: 'medium'
            });
        } else if (summary.avgCTR < 1.0) {
            insights.push({
                type: 'warning',
                title: '클릭률 개선 필요',
                description: '클릭률이 낮습니다. 광고 크리에이티브 개선을 고려하세요.',
                priority: 'high'
            });
        }

        return insights;
    }
}

// 전역 인스턴스
const adAnalytics = new AdAnalyticsCalculator();

// 개발 모드에서 디버깅을 위해 전역 객체에 추가
if (process.env.NODE_ENV === 'development') {
    window.adAnalytics = adAnalytics;
}

export default adAnalytics;