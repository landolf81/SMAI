import { supabase } from '../config/supabase.js';

/**
 * 배너 광고 서비스 (slot 기반)
 *
 * - 활성 광고 조회: getActiveAdBySlot(slot)
 * - 노출/클릭 추적: 메모리 캐시로 동일 세션 중복 방지
 * - 랜딩페이지 조회: getAdBySlug(slug)
 * - 관리자: list/create/update/delete + 통계
 *
 * service role key는 사용하지 않음. 모든 RLS 규칙은 supabase migration 참조.
 */

// 슬롯 상수
export const BANNER_SLOTS = Object.freeze({
  HOME_TOP: 'home_top',
  PRICES_TOP: 'prices_top',
  PRICES_MIDDLE: 'prices_middle',
  MARKET_TREND_TOP: 'market_trend_top',
  LOUNGE_TOP: 'lounge_top',
  COMMUNITY_TOP: 'community_top',
});

export const BANNER_SLOT_LABELS = Object.freeze({
  home_top: '홈 상단',
  prices_top: '경락가 상단',
  prices_middle: '경락가 중간',
  market_trend_top: '시세 추세 상단',
  lounge_top: '라운지 상단',
  community_top: '커뮤니티 상단',
});

// 메모리 캐시 (세션 내 중복 노출 방지)
const _trackedImpressions = new Set();   // `${adId}_${YYYY-MM-DD}`
const _pendingImpressions = new Map();
// 슬롯별 캐시 (잦은 fetch 방지)
const _slotCache = new Map();            // slot -> { ts, data }
const SLOT_CACHE_TTL_MS = 60 * 1000;

const _getKstToday = () => {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
};

const _getSessionId = () => {
  let id = localStorage.getItem('banner_ad_session_id');
  if (!id) {
    id = 'ban_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('banner_ad_session_id', id);
  }
  return id;
};

const _activeFilter = (q, today) =>
  q.eq('is_active', true)
   .or(`start_date.is.null,start_date.lte.${today}`)
   .or(`end_date.is.null,end_date.gte.${today}`);

export const bannerAdService = {
  BANNER_SLOTS,
  BANNER_SLOT_LABELS,

  /** 슬롯에 노출할 광고 1개 조회 (priority 높은 순, 같은 priority면 무작위) */
  async getActiveAdBySlot(slot) {
    if (!slot) return null;

    const cached = _slotCache.get(slot);
    if (cached && Date.now() - cached.ts < SLOT_CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const today = _getKstToday();
      const { data, error } = await _activeFilter(
        supabase
          .from('banner_ads')
          .select('id, name, advertiser_name, slot, image_url, alt_text, landing_slug, external_url, cta_text, title, start_date, end_date, priority')
          .eq('slot', slot),
        today
      ).order('priority', { ascending: false });

      if (error) throw error;

      let ad = null;
      if (Array.isArray(data) && data.length > 0) {
        // 동일 priority 중에서 무작위 선택 (회전 노출)
        const top = data[0].priority;
        const tier = data.filter(a => a.priority === top);
        ad = tier[Math.floor(Math.random() * tier.length)];
      }

      _slotCache.set(slot, { ts: Date.now(), data: ad });
      return ad;
    } catch (err) {
      console.error('배너 광고 조회 실패:', err);
      return null;
    }
  },

  /** 슬롯 캐시 무효화 (관리자 변경 후) */
  invalidateSlotCache(slot) {
    if (slot) _slotCache.delete(slot);
    else _slotCache.clear();
  },

  /** 노출 추적 (세션당 1회 + DB 중복 체크) */
  async trackImpression(adId, source = 'banner') {
    if (!adId) return;
    const key = `${adId}_${_getKstToday()}_${source}`;
    if (_trackedImpressions.has(key)) return;
    if (_pendingImpressions.has(key)) {
      await _pendingImpressions.get(key).catch(() => {});
      return;
    }
    _trackedImpressions.add(key);
    const p = this._doTrackImpression(adId, source, key);
    _pendingImpressions.set(key, p);
    try { await p; } finally { _pendingImpressions.delete(key); }
  },

  async _doTrackImpression(adId, source, cacheKey) {
    try {
      const sessionId = _getSessionId();
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;

      // DB 중복 체크 (KST 자정 이후)
      const kstMidnight = new Date(`${_getKstToday()}T00:00:00+09:00`).toISOString();
      let q = supabase
        .from('banner_ad_views')
        .select('id', { head: false, count: 'exact' })
        .eq('banner_ad_id', adId)
        .eq('source', source)
        .gte('viewed_at', kstMidnight)
        .limit(1);
      if (userId) q = q.eq('user_id', userId);
      else q = q.eq('session_id', sessionId);

      const { data: existing } = await q;
      if (existing && existing.length > 0) return;

      await supabase.rpc('increment_banner_ad_impressions', { ad_id_param: adId });
      await supabase.from('banner_ad_views').insert([{
        banner_ad_id: adId,
        user_id: userId,
        session_id: sessionId,
        viewed_at: new Date().toISOString(),
        user_agent: navigator.userAgent.slice(0, 500),
        source,
      }]);
    } catch {
      _trackedImpressions.delete(cacheKey); // 다음 기회에 재시도 허용
    }
  },

  /** 클릭 추적 */
  async trackClick(adId) {
    if (!adId) return;
    try {
      const sessionId = _getSessionId();
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      await supabase.rpc('increment_banner_ad_clicks', { ad_id_param: adId });
      await supabase.from('banner_ad_clicks').insert([{
        banner_ad_id: adId,
        user_id: userId,
        session_id: sessionId,
        clicked_at: new Date().toISOString(),
        user_agent: navigator.userAgent.slice(0, 500),
      }]);
    } catch {
      // 무시 (사용자 흐름 차단 방지)
    }
  },

  /** 랜딩페이지용 광고 조회 (slug) */
  async getAdBySlug(slug) {
    if (!slug) return null;
    try {
      const today = _getKstToday();
      const { data, error } = await _activeFilter(
        supabase
          .from('banner_ads')
          .select('id, name, advertiser_name, slot, image_url, alt_text, landing_slug, external_url, cta_text, title, body, contact_phone, start_date, end_date, priority')
          .eq('landing_slug', slug),
        today
      ).maybeSingle();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('랜딩 광고 조회 실패:', err);
      return null;
    }
  },

  // ────────────────────────────── 관리자 API ──────────────────────────────

  /** 전체 목록 (관리자) */
  async listAll({ slot = null } = {}) {
    let q = supabase
      .from('banner_ads')
      .select('*')
      .order('created_at', { ascending: false });
    if (slot) q = q.eq('slot', slot);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  /** 생성 */
  async create(payload) {
    const insert = _normalizePayload(payload);
    const { data, error } = await supabase
      .from('banner_ads')
      .insert([insert])
      .select()
      .single();
    if (error) throw error;
    this.invalidateSlotCache(insert.slot);
    return data;
  },

  /** 수정 */
  async update(id, payload) {
    const update = _normalizePayload(payload, { partial: true });
    update.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('banner_ads')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.invalidateSlotCache();
    return data;
  },

  /** 활성화 토글 */
  async toggleActive(id) {
    const { data: cur, error: e1 } = await supabase
      .from('banner_ads')
      .select('is_active, slot')
      .eq('id', id)
      .single();
    if (e1) throw e1;

    const { data, error } = await supabase
      .from('banner_ads')
      .update({ is_active: !cur.is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.invalidateSlotCache(cur.slot);
    return data;
  },

  /** 삭제 */
  async remove(id) {
    const { error } = await supabase.from('banner_ads').delete().eq('id', id);
    if (error) throw error;
    this.invalidateSlotCache();
  },

  /** 광고별 노출/클릭 통계 (날짜 필터 지원) */
  async getStats(adId, { startDate = null, endDate = null } = {}) {
    let viewsQ = supabase
      .from('banner_ad_views')
      .select('id', { count: 'exact', head: true })
      .eq('banner_ad_id', adId);
    let clicksQ = supabase
      .from('banner_ad_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('banner_ad_id', adId);

    if (startDate) {
      const startIso = new Date(`${startDate}T00:00:00+09:00`).toISOString();
      viewsQ = viewsQ.gte('viewed_at', startIso);
      clicksQ = clicksQ.gte('clicked_at', startIso);
    }
    if (endDate) {
      const endIso = new Date(`${endDate}T23:59:59+09:00`).toISOString();
      viewsQ = viewsQ.lte('viewed_at', endIso);
      clicksQ = clicksQ.lte('clicked_at', endIso);
    }

    const [{ count: views }, { count: clicks }] = await Promise.all([viewsQ, clicksQ]);
    const v = views || 0;
    const c = clicks || 0;
    return { views: v, clicks: c, ctr: v > 0 ? (c / v) : 0 };
  },
};

function _normalizePayload(p, { partial = false } = {}) {
  const out = {};
  const setIf = (k, v, transform) => {
    if (partial && v === undefined) return;
    out[k] = transform ? transform(v) : (v ?? null);
  };
  const blankToNull = v => (v === '' || v === undefined ? null : v);

  setIf('name', p.name);
  setIf('advertiser_name', blankToNull(p.advertiser_name));
  setIf('slot', p.slot);
  setIf('image_url', p.image_url);
  setIf('alt_text', blankToNull(p.alt_text));
  setIf('landing_slug', blankToNull(p.landing_slug));
  setIf('external_url', blankToNull(p.external_url));
  setIf('cta_text', blankToNull(p.cta_text));
  setIf('title', blankToNull(p.title));
  setIf('body', blankToNull(p.body));
  setIf('contact_phone', blankToNull(p.contact_phone));
  setIf('start_date', blankToNull(p.start_date));
  setIf('end_date', blankToNull(p.end_date));
  setIf('priority', p.priority !== undefined ? Number(p.priority) || 0 : undefined);
  setIf('is_active', p.is_active);
  setIf('memo', blankToNull(p.memo));

  return out;
}

export default bannerAdService;
