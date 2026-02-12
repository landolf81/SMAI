import { adService } from '../services';

/**
 * 광고 추적 및 분석 유틸리티
 * - 노출 추적
 * - 클릭 추적
 * - 세션 관리
 * - 성과 분석
 */

class AdTracker {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.viewedAds = new Set();
        this.clickedAds = new Set();
        this.exposureStartTimes = new Map();
        this.batchQueue = [];
        this.batchSize = 5;
        this.batchInterval = 10000; // 10초
        
        this.startBatchProcessor();
        this.setupVisibilityTracking();
    }

    // 세션 ID 생성
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 광고 노출 추적
    trackAdView(adId, position, context = {}) {
        if (this.viewedAds.has(adId)) return; // 이미 추적된 광고
        
        this.viewedAds.add(adId);
        this.exposureStartTimes.set(adId, Date.now());

        const viewData = {
            type: 'view',
            adId,
            position,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            pageUrl: window.location.href,
            context
        };

        this.addToBatch(viewData);
        
        // 즉시 서버에 전송 (중요한 노출 데이터)
        this.sendViewTracking(adId);
    }

    // 광고 클릭 추적
    trackAdClick(adId, position, linkUrl, context = {}) {
        if (this.clickedAds.has(adId)) return false; // 중복 클릭 방지
        
        this.clickedAds.add(adId);
        
        const exposureDuration = this.exposureStartTimes.has(adId) 
            ? Date.now() - this.exposureStartTimes.get(adId)
            : 0;

        const clickData = {
            type: 'click',
            adId,
            position,
            linkUrl,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            exposureDuration,
            context
        };

        this.addToBatch(clickData);
        
        // 즉시 서버에 전송 (중요한 클릭 데이터)
        this.sendClickTracking(adId);
        
        return true;
    }

    // 배치에 추가
    addToBatch(data) {
        this.batchQueue.push(data);
        
        if (this.batchQueue.length >= this.batchSize) {
            this.processBatch();
        }
    }

    // 배치 처리기 시작
    startBatchProcessor() {
        setInterval(() => {
            if (this.batchQueue.length > 0) {
                this.processBatch();
            }
        }, this.batchInterval);
    }

    // 배치 처리
    async processBatch() {
        if (this.batchQueue.length === 0) return;

        const batch = [...this.batchQueue];
        this.batchQueue = [];

        try {
            await adService.trackBatch({
                sessionId: this.sessionId,
                events: batch
            });
        } catch {
            // 실패한 데이터를 다시 큐에 추가 (최대 재시도 3회)
            batch.forEach(item => {
                if (!item.retryCount) item.retryCount = 0;
                if (item.retryCount < 3) {
                    item.retryCount++;
                    this.batchQueue.push(item);
                }
            });
        }
    }

    // 즉시 노출 추적 전송
    async sendViewTracking(adId) {
        try {
            await adService.trackAdImpression(adId);
        } catch {
            // 무시
        }
    }

    // 즉시 클릭 추적 전송
    async sendClickTracking(adId) {
        try {
            await adService.trackAdClick(adId);
        } catch {
            // 무시
        }
    }

    // 페이지 가시성 추적 설정
    setupVisibilityTracking() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                // 페이지를 떠날 때 배치 처리
                this.processBatch();
            }
        });

        // 페이지 언로드 시 배치 처리
        window.addEventListener('beforeunload', () => {
            this.processBatch();
        });
    }

    // 광고 가시성 확인
    isElementVisible(element, threshold = 0.5) {
        if (!element) return false;

        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;

        const verticalVisible = rect.top < windowHeight && rect.bottom > 0;
        const horizontalVisible = rect.left < windowWidth && rect.right > 0;

        if (!verticalVisible || !horizontalVisible) return false;

        // 가시 영역 비율 계산
        const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
        const visibleWidth = Math.min(rect.right, windowWidth) - Math.max(rect.left, 0);
        const visibleArea = visibleHeight * visibleWidth;
        const totalArea = rect.height * rect.width;

        return (visibleArea / totalArea) >= threshold;
    }

    // 교차 관찰자 설정
    createIntersectionObserver(callback, threshold = 0.5) {
        if (!window.IntersectionObserver) {
            // 폴백: 스크롤 이벤트 사용
            return this.createScrollObserver(callback, threshold);
        }

        return new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
                    callback(entry.target);
                }
            });
        }, {
            threshold: threshold,
            rootMargin: '0px'
        });
    }

    // 스크롤 기반 관찰자 (폴백)
    createScrollObserver(callback, threshold) {
        const elements = new Set();
        
        const checkVisibility = () => {
            elements.forEach(element => {
                if (this.isElementVisible(element, threshold)) {
                    callback(element);
                    elements.delete(element);
                }
            });
        };

        window.addEventListener('scroll', checkVisibility, { passive: true });
        window.addEventListener('resize', checkVisibility, { passive: true });

        return {
            observe: (element) => {
                elements.add(element);
                checkVisibility(); // 즉시 체크
            },
            unobserve: (element) => {
                elements.delete(element);
            },
            disconnect: () => {
                elements.clear();
                window.removeEventListener('scroll', checkVisibility);
                window.removeEventListener('resize', checkVisibility);
            }
        };
    }

    // 세션 통계 조회
    getSessionStats() {
        return {
            sessionId: this.sessionId,
            viewedAdsCount: this.viewedAds.size,
            clickedAdsCount: this.clickedAds.size,
            viewedAds: Array.from(this.viewedAds),
            clickedAds: Array.from(this.clickedAds),
            pendingBatch: this.batchQueue.length
        };
    }

    // 리셋
    reset() {
        this.sessionId = this.generateSessionId();
        this.viewedAds.clear();
        this.clickedAds.clear();
        this.exposureStartTimes.clear();
        this.batchQueue = [];
    }
}

// 전역 인스턴스 생성
const adTracker = new AdTracker();

export default adTracker;