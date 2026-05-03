import React, { useEffect, useState } from 'react';
import { bannerAdService } from '../../services/bannerAdService';

/**
 * BannerAdStatsRow
 * - 광고별 노출/클릭/CTR을 비동기로 가져와 보여주는 인라인 행
 * - 날짜 필터(startDate, endDate)는 부모에서 전달
 */
const BannerAdStatsRow = ({ adId, startDate, endDate }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await bannerAdService.getStats(adId, { startDate, endDate });
        if (!cancelled) setStats(s);
      } catch {
        if (!cancelled) setStats({ views: 0, clicks: 0, ctr: 0 });
      }
    })();
    return () => { cancelled = true; };
  }, [adId, startDate, endDate]);

  if (!stats) {
    return <span className="text-xs text-base-content/40">집계 중…</span>;
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="font-medium">노출 <b>{stats.views.toLocaleString()}</b></span>
      <span className="font-medium">클릭 <b>{stats.clicks.toLocaleString()}</b></span>
      <span className="font-medium">
        CTR <b>{stats.views > 0 ? (stats.ctr * 100).toFixed(2) : '0.00'}%</b>
      </span>
    </div>
  );
};

export default BannerAdStatsRow;
