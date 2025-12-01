// Markets 페이지 API 호출 테스트
console.log('Markets API 테스트 시작...');

// 첫 번째 API: 이용 가능한 시장 목록
fetch('http://localhost:8801/api/markets/available?date=2025-07-16')
  .then(response => {
    console.log('✅ Markets Available API Response Status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('📊 Available Markets:', data);
    
    if (data.markets && data.markets.length > 0) {
      // 두 번째 API: 여러 시장 데이터
      const markets = data.markets.slice(0, 3).join(','); // 처음 3개 시장만
      
      return fetch(`http://localhost:8801/api/markets/multiple?markets=${encodeURIComponent(markets)}&date=2025-07-16`);
    }
  })
  .then(response => {
    if (response) {
      console.log('✅ Markets Multiple API Response Status:', response.status);
      return response.json();
    }
  })
  .then(data => {
    if (data) {
      console.log('📊 Multiple Markets Data:', data);
    }
  })
  .catch(error => {
    console.error('❌ API 호출 오류:', error);
  });
