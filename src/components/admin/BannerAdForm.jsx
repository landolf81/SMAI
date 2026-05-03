import React, { useState, useEffect } from 'react';
import BannerAdImagesInput from './BannerAdImagesInput';
import { BANNER_SLOTS, BANNER_SLOT_LABELS } from '../../services/bannerAdService';

/**
 * BannerAdForm
 * - AdminBannerAds 페이지에서 사용하는 생성/수정 공용 폼
 * - 이미지 업로드는 BannerAdImagesInput (다중 이미지, 순서 변경, 직접 URL 입력 지원)
 * - form.images = [primary, ...extras] 형태로 관리하고 저장 시 서비스가 image_url + image_urls로 분리
 */
const _initialImages = (initial) => {
  if (!initial) return [];
  if (Array.isArray(initial.images) && initial.images.length > 0) return initial.images;
  const primary = initial.image_url ? [initial.image_url] : [];
  const extras = Array.isArray(initial.image_urls) ? initial.image_urls : [];
  return [...primary, ...extras];
};

const BannerAdForm = ({ initial, onSubmit, onCancel, saving }) => {
  const [form, setForm] = useState({
    name: '',
    advertiser_name: '',
    slot: BANNER_SLOTS.HOME_TOP,
    images: [],
    alt_text: '',
    landing_slug: '',
    external_url: '',
    cta_text: '',
    title: '',
    body: '',
    contact_phone: '',
    start_date: '',
    end_date: '',
    priority: 0,
    is_active: true,
    memo: '',
    ...initial,
    images: _initialImages(initial),
  });

  useEffect(() => {
    if (initial) {
      setForm(prev => ({ ...prev, ...initial, images: _initialImages(initial) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  const update = (field) => (e) => {
    const value = e?.target?.type === 'checkbox' ? e.target.checked : (e?.target?.value ?? e);
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const missing = [];
    if (!form.name?.trim()) missing.push('광고명');
    if (!form.slot) missing.push('slot');
    if (!Array.isArray(form.images) || form.images.length === 0) missing.push('배너 이미지(1장 이상)');
    if (missing.length > 0) {
      alert(`다음 필수 항목이 비어 있습니다: ${missing.join(', ')}`);
      return;
    }
    if (form.landing_slug && !/^[a-z0-9-]+$/.test(form.landing_slug)) {
      alert('landing slug는 소문자/숫자/하이픈만 가능합니다.');
      return;
    }
    if (form.start_date && form.end_date && form.start_date > form.end_date) {
      alert('종료일이 시작일보다 빠를 수 없습니다.');
      return;
    }
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="광고명 (관리용)" required>
          <input
            type="text"
            value={form.name}
            onChange={update('name')}
            className="input input-bordered w-full"
            placeholder="예: 성주 OO농약 - 봄 프로모션"
            required
          />
        </Field>

        <Field label="광고주명">
          <input
            type="text"
            value={form.advertiser_name}
            onChange={update('advertiser_name')}
            className="input input-bordered w-full"
            placeholder="예: OO농약사"
          />
        </Field>

        <Field label="노출 위치 (slot)" required>
          <select
            value={form.slot}
            onChange={update('slot')}
            className="select select-bordered w-full"
            required
          >
            {Object.entries(BANNER_SLOT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v} ({k})</option>
            ))}
          </select>
        </Field>

        <Field label="우선순위 (높을수록 먼저)">
          <input
            type="number"
            value={form.priority}
            onChange={update('priority')}
            className="input input-bordered w-full"
            min={0}
            step={1}
          />
        </Field>

        <Field label="시작일">
          <input
            type="date"
            value={form.start_date || ''}
            onChange={update('start_date')}
            className="input input-bordered w-full"
          />
        </Field>

        <Field label="종료일">
          <input
            type="date"
            value={form.end_date || ''}
            onChange={update('end_date')}
            className="input input-bordered w-full"
          />
        </Field>
      </div>

      {/* 배너 이미지 (다중 이미지 — 4초마다 회전) */}
      <Field label="배너 이미지 (1장 이상)" required>
        <BannerAdImagesInput
          value={form.images}
          onChange={(urls) => setForm(prev => ({ ...prev, images: urls }))}
        />
        <p className="text-xs text-base-content/60 mt-2">
          권장 비율 8:3 (예: 1200×450). 여러 장 등록 시 첫 이미지가 정적 노출되고 4초마다 회전합니다.
        </p>
      </Field>

      <Field label="대체 텍스트 (alt)">
        <input
          type="text"
          value={form.alt_text}
          onChange={update('alt_text')}
          className="input input-bordered w-full"
          placeholder="시각장애 사용자/SEO용 설명"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="랜딩 slug (/sponsor/:slug)">
          <input
            type="text"
            value={form.landing_slug}
            onChange={update('landing_slug')}
            className="input input-bordered w-full"
            placeholder="예: oo-pesticide-spring"
          />
          <p className="text-xs text-base-content/60 mt-1">
            소문자/숫자/하이픈만. 비워두면 외부 링크가 사용됩니다.
          </p>
        </Field>

        <Field label="외부 링크 (있으면 우선)">
          <input
            type="url"
            value={form.external_url}
            onChange={update('external_url')}
            className="input input-bordered w-full"
            placeholder="https://example.com 또는 /community"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="CTA 문구">
          <input
            type="text"
            value={form.cta_text}
            onChange={update('cta_text')}
            className="input input-bordered w-full"
            placeholder="예: 자세히 보기 / 견적 문의"
          />
        </Field>

        <Field label="문의 전화">
          <input
            type="tel"
            value={form.contact_phone}
            onChange={update('contact_phone')}
            className="input input-bordered w-full"
            placeholder="예: 054-000-0000"
          />
        </Field>
      </div>

      {/* 랜딩페이지용 콘텐츠 */}
      <div className="border-t border-base-300 pt-4">
        <h4 className="font-semibold text-sm text-base-content/70 mb-2">랜딩페이지 본문 (slug 사용 시)</h4>
        <Field label="랜딩 제목">
          <input
            type="text"
            value={form.title}
            onChange={update('title')}
            className="input input-bordered w-full"
          />
        </Field>
        <Field label="랜딩 본문">
          <textarea
            value={form.body}
            onChange={update('body')}
            className="textarea textarea-bordered w-full min-h-32"
            placeholder="제품/서비스 설명, 혜택, 운영 시간 등"
          />
        </Field>
      </div>

      <Field label="관리자 메모">
        <textarea
          value={form.memo}
          onChange={update('memo')}
          className="textarea textarea-bordered w-full"
          placeholder="계약 기간, 결제 상태 등 내부 메모"
        />
      </Field>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!form.is_active}
          onChange={update('is_active')}
          className="checkbox checkbox-primary"
        />
        <span className="text-sm">활성화 (체크 해제 시 노출되지 않음)</span>
      </label>

      {/* 미리보기 — 첫 이미지 기준 */}
      {Array.isArray(form.images) && form.images.length > 0 && (
        <div className="border-t border-base-300 pt-4">
          <h4 className="font-semibold text-sm text-base-content/70 mb-2">
            미리보기 {form.images.length > 1 && <span className="text-xs text-base-content/50">(실제 노출은 4초마다 회전)</span>}
          </h4>
          <div className="bg-base-100 p-4 rounded-xl border border-base-300 max-w-md">
            <div className="relative w-full bg-base-200 overflow-hidden rounded-xl" style={{ aspectRatio: '8/3' }}>
              <img
                src={form.images[0]}
                alt={form.alt_text || form.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <span className="absolute top-1.5 left-1.5 bg-black/55 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">광고</span>
              {(form.cta_text || form.advertiser_name) && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 flex items-center justify-between">
                  <span className="text-white text-xs font-medium truncate">
                    {form.advertiser_name || form.title || ''}
                  </span>
                  {form.cta_text && (
                    <span className="bg-white/95 text-base-content text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap shrink-0 ml-2">
                      {form.cta_text}
                    </span>
                  )}
                </div>
              )}
              {form.images.length > 1 && (
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                  {form.images.map((_, idx) => (
                    <span
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-white' : 'bg-white/40'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t border-base-300">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={saving}>
          취소
        </button>
      </div>
    </form>
  );
};

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-sm font-medium text-base-content/80 mb-1">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

export default BannerAdForm;
