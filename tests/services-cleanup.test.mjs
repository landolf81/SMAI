// 서비스 정리 회귀 검사: 원격 호출 없이 pagination/cache/API 연결을 검증한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

let moduleLoadId = 0;
async function loadModule(relative, mocks = {}) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(relative, import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', write: false,
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_SUPABASE_URL': '"https://test.invalid"', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '"test"' },
    plugins: [{ name: 'offline-service-mocks', setup(plugin) {
      plugin.onResolve({ filter: /^\./ }, ({ path }) => path in mocks ? { path, namespace: 'mock' } : undefined);
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path] }));
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${++moduleLoadId}`);
}

test('market grades loads full and partial pages and normalizes duplicate names', async () => {
  const ranges = [];
  const pages = [Array.from({ length: 1000 }, () => ({ market_name: '성주'.normalize('NFD'), grade: '특' })), [{ market_name: '성주', grade: '상' }]];
  globalThis.__cleanupSupabase = { from() { return { select() { return { async range(start, end) { ranges.push([start, end]); return { data: pages.shift(), error: null }; } }; } }; } };
  const { marketService } = await loadModule('../src/services/marketService.js', { '../config/supabase.js': 'export const supabase = globalThis.__cleanupSupabase;' });
  try {
    assert.deepEqual(await marketService.getAllMarketGrades(), { 성주: ['특', '상'] });
    assert.deepEqual(ranges, [[0, 999], [1000, 1999]]);
  } finally { delete globalThis.__cleanupSupabase; }
});

test('agent request helper reuses a current KST-day cache without triggering network', async () => {
  let cutoff;
  const chain = { select() { return this; }, eq() { return this; }, gte(field, value) { cutoff = value; return this; }, order() { return this; }, limit() { return this; }, async maybeSingle() { return { data: { response: 'cached response' } }; } };
  globalThis.__cleanupSupabase = { from() { return chain; } };
  const { getLatestOrRequest } = await loadModule('../src/services/agentService.js', { '../config/supabase.js': 'export const supabase = globalThis.__cleanupSupabase;' });
  try {
    assert.equal(await getLatestOrRequest(), 'cached response');
    const today = new Date(Date.now() + 9 * 3600000).toISOString().split('T')[0];
    assert.equal(cutoff, new Date(`${today}T00:00:00+09:00`).toISOString());
  } finally { delete globalThis.__cleanupSupabase; }
});

test('secure ad wrapper passes request params through the imported client', async () => {
  const calls = [];
  globalThis.__cleanupClient = { async get(...args) { calls.push(args); return { data: ['ad'] }; } };
  const { SecureAdAPI } = await loadModule('../src/utils/secureAuth.js', { '../config/supabase': '', '../axios': 'export const makeRequest = globalThis.__cleanupClient;' });
  try {
    assert.deepEqual(await new SecureAdAPI(() => {}).getAds({ page: 2 }), { data: ['ad'] });
    assert.deepEqual(calls, [['/ads', { params: { page: 2 } }]]);
  } finally { delete globalThis.__cleanupClient; }
});

const postServiceMocks = {
  '../config/supabase.js': 'export const supabase = globalThis.__cleanupSupabase;',
  '../utils/sessionCache.js': 'export function getCachedSession() { return null; }',
  './r2Service.js': 'export function deleteFromR2() {} export function isR2Url() { return false; }',
  './notificationService.js': 'export const notificationService = {};',
};

test('split post service preserves its method API and cached hottest formatter receiver', async () => {
  const post = { id: 7, description: '참외', photo: 'photo.jpg', user_id: 'u', users: { name: '농부' } };
  globalThis.__cleanupSupabase = { from(table) {
    assert.equal(table, 'cached_hottest_post');
    return { select() { return this; }, async single() { return { data: { posts: post, expires_at: new Date(Date.now() + 60000).toISOString() } }; } };
  } };
  const { postService } = await loadModule('../src/services/postService.js', postServiceMocks);
  try {
    assert.equal(Object.keys(postService).length, 33);
    assert.equal(typeof postService.updateTradeStatus, 'function');
    assert.equal(typeof postService.updateReportStatus, 'function');
    assert.equal(typeof postService.savePost, 'function');
    const hottest = await postService.getHottestPost();
    assert.equal(hottest.desc, '참외');
    assert.equal(hottest.name, '농부');
    assert.equal(hottest.profilePic, 'defaultAvatar.png');
  } finally { delete globalThis.__cleanupSupabase; }
});

test('split saved-post methods retain duplicate-save handling and saved order', async () => {
  globalThis.__cleanupSupabase = { from(table) {
    if (table === 'saved_posts') return {
      async insert(rows) { assert.deepEqual(rows, [{ user_id: 'u', post_id: 'p' }]); return { error: { code: '23505' } }; },
      select() { return this; }, eq() { return this; },
      async order() { return { data: [{ post_id: 2 }, { post_id: 1 }], error: null }; },
    };
    assert.equal(table, 'posts');
    return { select() { return this; }, in() { return this; }, async or() { return { data: [{ id: 1, description: 'first' }, { id: 2, description: 'second' }], error: null }; } };
  } };
  const { postService } = await loadModule('../src/services/postService.js', postServiceMocks);
  try {
    assert.deepEqual(await postService.savePost('p', 'u'), { success: true, alreadySaved: true });
    const saved = await postService.getSavedPosts('u');
    assert.deepEqual(saved.map(post => [post.id, post.content]), [[2, 'second'], [1, 'first']]);
  } finally { delete globalThis.__cleanupSupabase; }
});
