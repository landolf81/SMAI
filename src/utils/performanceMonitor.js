// 성능 모니터링 및 분석 도구
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.startTimes = new Map();
    this.enabled = process.env.NODE_ENV === 'development';
  }

  // 성능 측정 시작
  start(name) {
    if (!this.enabled) return;
    this.startTimes.set(name, performance.now());
  }

  // 성능 측정 종료
  end(name) {
    if (!this.enabled) return;
    
    const startTime = this.startTimes.get(name);
    if (!startTime) return;

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name).push({
      duration,
      timestamp: Date.now()
    });

    this.startTimes.delete(name);
    
    // 개발 환경에서 로그 출력
    if (duration > 100) { // 100ms 이상인 경우 경고
      console.warn(`⚠️ ${name}: ${duration.toFixed(2)}ms (느림)`);
    } else {
      console.log(`✅ ${name}: ${duration.toFixed(2)}ms`);
    }
  }

  // 통계 조회
  getStats(name) {
    const measurements = this.metrics.get(name);
    if (!measurements || measurements.length === 0) return null;

    const durations = measurements.map(m => m.duration);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    return {
      name,
      count: measurements.length,
      average: avg.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      latest: durations[durations.length - 1].toFixed(2)
    };
  }

  // 모든 통계 조회
  getAllStats() {
    const stats = {};
    for (const name of this.metrics.keys()) {
      stats[name] = this.getStats(name);
    }
    return stats;
  }

  // 메모리 사용량 체크
  checkMemoryUsage() {
    if (!this.enabled || !performance.memory) return null;

    return {
      used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
      total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
      limit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
    };
  }

  // 페이지 로딩 성능 체크
  checkPageLoadPerformance() {
    if (!this.enabled || !performance.timing) return null;

    const timing = performance.timing;
    const navigation = performance.navigation;

    return {
      redirectTime: timing.redirectEnd - timing.redirectStart,
      dnsTime: timing.domainLookupEnd - timing.domainLookupStart,
      connectTime: timing.connectEnd - timing.connectStart,
      requestTime: timing.responseStart - timing.requestStart,
      responseTime: timing.responseEnd - timing.responseStart,
      domLoadTime: timing.domContentLoadedEventStart - timing.navigationStart,
      loadTime: timing.loadEventStart - timing.navigationStart,
      navigationType: navigation.type === 0 ? 'navigate' : 
                     navigation.type === 1 ? 'reload' : 
                     navigation.type === 2 ? 'back_forward' : 'reserved'
    };
  }

  // 성능 리포트 생성
  generateReport() {
    if (!this.enabled) return '성능 모니터링이 비활성화되어 있습니다.';

    const stats = this.getAllStats();
    const memory = this.checkMemoryUsage();
    const pageLoad = this.checkPageLoadPerformance();

    const report = {
      timestamp: new Date().toISOString(),
      performanceMetrics: stats,
      memoryUsage: memory,
      pageLoadMetrics: pageLoad,
      recommendations: this.generateRecommendations(stats)
    };

    console.group('🔍 성능 리포트');
    console.table(stats);
    console.log('💾 메모리 사용량:', memory);
    console.log('⏱️ 페이지 로딩:', pageLoad);
    console.log('💡 권장사항:', report.recommendations);
    console.groupEnd();

    return report;
  }

  // 성능 개선 권장사항 생성
  generateRecommendations(stats) {
    const recommendations = [];

    for (const [name, stat] of Object.entries(stats)) {
      if (!stat) continue;

      if (parseFloat(stat.average) > 500) {
        recommendations.push(`${name}: 평균 응답시간이 500ms를 초과합니다. API 최적화가 필요합니다.`);
      }
      
      if (parseFloat(stat.max) > 2000) {
        recommendations.push(`${name}: 최대 응답시간이 2초를 초과합니다. 캐싱 또는 코드 최적화를 고려하세요.`);
      }
    }

    const memory = this.checkMemoryUsage();
    if (memory && parseFloat(memory.used) > 50) {
      recommendations.push('메모리 사용량이 50MB를 초과합니다. 메모리 누수를 확인하세요.');
    }

    return recommendations.length > 0 ? recommendations : ['현재 성능이 양호합니다.'];
  }

  // 자동 모니터링 시작
  startAutoMonitoring() {
    if (!this.enabled) return;

    // 5분마다 리포트 생성
    setInterval(() => {
      this.generateReport();
    }, 5 * 60 * 1000);

    // 메모리 사용량 체크 (1분마다)
    setInterval(() => {
      const memory = this.checkMemoryUsage();
      if (memory && parseFloat(memory.used) > 100) {
        console.warn('⚠️ 메모리 사용량이 높습니다:', memory);
      }
    }, 60 * 1000);
  }
}

// 전역 성능 모니터 인스턴스
export const performanceMonitor = new PerformanceMonitor();

// React Hook for performance monitoring
export const usePerformanceMonitor = (name) => {
  React.useEffect(() => {
    performanceMonitor.start(name);
    return () => {
      performanceMonitor.end(name);
    };
  }, [name]);
};

// HOC for component performance monitoring
export const withPerformanceMonitoring = (WrappedComponent, componentName) => {
  return React.memo((props) => {
    usePerformanceMonitor(`Component:${componentName}`);
    return <WrappedComponent {...props} />;
  });
};

// API 호출 성능 측정 데코레이터
export const measureApiCall = (apiFunction, name) => {
  return async (...args) => {
    performanceMonitor.start(`API:${name}`);
    try {
      const result = await apiFunction(...args);
      performanceMonitor.end(`API:${name}`);
      return result;
    } catch (error) {
      performanceMonitor.end(`API:${name}`);
      throw error;
    }
  };
};

// 페이지 로딩 시간 측정
export const measurePageLoad = (pageName) => {
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      setTimeout(() => {
        performanceMonitor.start(`Page:${pageName}`);
        performanceMonitor.end(`Page:${pageName}`);
      }, 100);
    });
  }
};

// 자동 모니터링 시작
if (typeof window !== 'undefined') {
  performanceMonitor.startAutoMonitoring();
}

export default performanceMonitor;
