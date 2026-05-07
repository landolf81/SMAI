-- banner_ads.slot CHECK 제약에 'favorite_prices_top' 추가
-- 즐겨찾기 시세 페이지(/favorite-prices) 상단 배너 슬롯 신설
-- 작성일: 2026-05-07

ALTER TABLE banner_ads
  DROP CONSTRAINT IF EXISTS banner_ads_slot_check;

ALTER TABLE banner_ads
  ADD CONSTRAINT banner_ads_slot_check
  CHECK (slot IN (
    'home_top',
    'prices_top',
    'prices_middle',
    'favorite_prices_top',
    'market_trend_top',
    'lounge_top',
    'community_top'
  ));
