/** Offline Home dependency/initialization regression checks; no production services run. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const savedDate = '2026-09-20';
const storage = (initial = {}) => {
  const entries = new Map(Object.entries(initial));
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value)), removeItem: key => entries.delete(key) };
};

function createScheduler(desktop) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let dirty = false;
  const equal = (a, b) => a && b && a.length === b.length && b.every((value, i) => Object.is(value, a[i]));
  const api = {
    desktop, calls: [],
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      if (!api.setters) api.setters = [];
      if (!api.setters[i]) api.setters[i] = value => {
        const next = typeof value === 'function' ? value(slots[i]) : value;
        if (!Object.is(next, slots[i])) dirty = true;
        slots[i] = next;
      };
      return [slots[i], api.setters[i]];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useContext() { return { currentUser: null, loading: false }; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { deps, fn };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !equal(slots[i].deps, deps)) {
        slots[i] = { deps };
        effects.push(fn);
      }
    },
    async render(Home) {
      for (let attempt = 0; attempt < 20; attempt++) {
        cursor = 0;
        effects = [];
        dirty = false;
        let tree = Home();
        // Execute only the mobile root, never the mocked child components.
        if (typeof tree.type === 'function' && !tree.type.mockName) tree = tree.type(tree.props);
        for (const effect of effects) effect();
        for (let i = 0; i < 20; i++) await Promise.resolve();
        if (!dirty) return tree;
      }
      throw new Error('Home did not settle within 20 committed renders');
    },
  };
  return api;
}

async function loadHome(api, cache = {}) {
  const originals = new Map();
  const mocks = {
    __smaiHomeHarness: api,
    window: { addEventListener() {}, removeEventListener() {} },
    document: {},
    localStorage: storage({ market_selected_date: savedDate, market_selected_date_time: String(Date.now()) }),
    sessionStorage: storage(cache),
    performance: { getEntriesByType: () => [{ type: 'navigate' }] },
  };
  for (const [key, value] of Object.entries(mocks)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/pages/home.jsx', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'transform',
    plugins: [{ name: 'home-offline-mocks', setup(plugin) {
      plugin.onResolve({ filter: /.*/ }, args => args.kind === 'entry-point' ? undefined : ({ path: args.path, namespace: 'mock' }));
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => {
        if (path === 'react') return { contents: `const api = globalThis.__smaiHomeHarness; export default api; export const { useState, useEffect, useRef, useCallback, useContext } = api;` };
        if (path === 'react-router-dom') return { contents: `export const Navigate = 'Navigate', Link = 'Link'; export const useNavigate = () => () => {};` };
        if (path.includes('AuthContext')) return { contents: 'export const AuthContext = {};' };
        if (path.includes('deviceDetector')) return { contents: `export const isDesktopDevice = () => globalThis.__smaiHomeHarness.desktop, isMobileDevice = () => !globalThis.__smaiHomeHarness.desktop, isTabletDevice = () => false;` };
        if (path.includes('useScrollRestore')) return { contents: 'export const useScrollRestore = () => ({ resetScrollPosition() {}, scrollToTop() {} });' };
        if (path.includes('useScrollDirection')) return { contents: `export const useScrollDirection = () => 'up';` };
        if (path.includes('usePermissions')) return { contents: 'export const useAdminPermissions = () => ({ isAdmin: false });' };
        if (path.includes('useWeather')) return { contents: 'export const useWeather = () => ({ data: null });' };
        if (path.includes('bannerAdService')) return { contents: `export const BANNER_SLOTS = { HOME_TOP: 'home' };` };
        if (path === '../services') return { contents: `
          const call = (name, date) => globalThis.__smaiHomeHarness.calls.push([name, date]);
          export const marketService = {
            async getMarketSettings() { call('settings'); return { market_order: ['시장'] }; },
            async getMarketInfo() { call('info'); return []; },
            async getMarketsSummary(date) { call('summary', date); return { markets: [{ market_name: '시장', success: false }] }; },
            async getSeongjuAggregateForCard(date) { call('seongju', date); return null; },
            async getWholesaleAggregateForCard(date) { call('wholesale', date); return null; },
          };
          export const postService = { async getHottestPost() { call('post'); return null; } };
          export const weatherBriefingService = {};
        ` };
        return { contents: `function Mock() { return null; } Mock.mockName = ${JSON.stringify(path.split('/').pop())}; export default Mock;` };
      });
    } }],
  });
  const module = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${Math.random()}`);
  return { Home: module.default, cleanup() {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  } };
}

function findMock(tree, name) {
  if (!tree || typeof tree !== 'object') return;
  if (tree.type?.mockName === name) return tree;
  for (const child of (tree.props?.children ?? []).flat(Infinity)) {
    const found = findMock(child, name);
    if (found) return found;
  }
}
const summaryCalls = api => api.calls.filter(([name]) => name === 'summary');

test('desktop Home redirects without mounting mobile hooks or requesting services', async () => {
  const api = createScheduler(true);
  const app = await loadHome(api);
  try {
    const tree = await api.render(app.Home);
    assert.equal(tree.type, 'Navigate');
    assert.equal(tree.props.to, '/landing');
    assert.deepEqual(api.calls, []);
  } finally { app.cleanup(); }
});

test('mobile initial request runs once and date selection does not restart mount effects', async () => {
  const api = createScheduler(false);
  const app = await loadHome(api);
  try {
    let tree = await api.render(app.Home);
    assert.deepEqual(summaryCalls(api), [['summary', savedDate]]);
    assert.equal(api.calls.filter(([name]) => name === 'info').length, 1);
    const initialSettingsRequests = api.calls.filter(([name]) => name === 'settings').length;
    await api.render(app.Home);
    assert.equal(summaryCalls(api).length, 1);
    findMock(tree, 'DatePickerModal').props.onSelectDate('2026-09-19');
    tree = await api.render(app.Home);
    assert.equal(findMock(tree, 'DatePickerModal').props.selectedDate, '2026-09-19');
    assert.deepEqual(summaryCalls(api), [['summary', savedDate], ['summary', '2026-09-19']]);
    assert.equal(api.calls.filter(([name]) => name === 'info').length, 1);
    await api.render(app.Home);
    assert.equal(summaryCalls(api).length, 2);
    // The stable callback must see committed settings rather than its mount-time null.
    assert.equal(api.calls.filter(([name]) => name === 'settings').length, initialSettingsRequests);
  } finally { app.cleanup(); }
});

test('fresh same-date mobile cache avoids market requests until an explicit date change', async () => {
  const api = createScheduler(false);
  const app = await loadHome(api, {
    home_market_data: JSON.stringify([{ id: 1, name: '시장', averagePrice: 1234 }]),
    home_selected_date: savedDate, home_cache_time: String(Date.now()),
  });
  try {
    const tree = await api.render(app.Home);
    assert.deepEqual(summaryCalls(api), []);
    const cards = findMock(tree, 'MarketCards');
    assert.equal(cards.props.loading, false);
    assert.equal(cards.props.marketData[0].averagePrice, 1234);
    findMock(tree, 'DatePickerModal').props.onSelectDate('2026-09-18');
    await api.render(app.Home);
    await api.render(app.Home);
    assert.deepEqual(summaryCalls(api), [['summary', '2026-09-18']]);
  } finally { app.cleanup(); }
});
