/** Hook dependency regression checks; all permission services are local mocks. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Minimal committed-render hook scheduler for dependency/callback checks without a DOM.
function createScheduler() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const equal = (a, b) => a && b && a.length === b.length && b.every((v, i) => Object.is(v, a[i]));
  const api = {
    user: { id: 'member' },
    calls: [],
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useContext() { return { currentUser: api.user }; },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!slots[index] || !equal(slots[index].deps, deps)) slots[index] = { deps, value: factory() };
      return slots[index].value;
    },
    useCallback(fn, deps) { return api.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || !equal(slots[index].deps, deps)) {
        slots[index] = { deps };
        effects.push(fn);
      }
    },
    async render(fn) {
      cursor = 0;
      effects = [];
      const result = fn();
      for (const effect of effects) effect();
      // Settle permission Promise.all and state updates without external requests.
      for (let i = 0; i < 8; i++) await Promise.resolve();
      return result;
    },
  };
  return api;
}

async function loadHooks(scheduler) {
  globalThis.__smaiHookScheduler = scheduler;
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/hooks/usePermissions.js', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'local-hook-mocks', setup(plugin) {
      plugin.onResolve({ filter: /^(react|\.\.\/context\/AuthContext|\.\.\/utils\/permissions)$/ }, args => ({ path: args.path, namespace: 'mock' }));
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, args => {
        if (args.path === 'react') return { contents: `
          const api = globalThis.__smaiHookScheduler;
          export const { useState, useEffect, useContext, useCallback, useMemo, useRef } = api;
        ` };
        if (args.path.includes('AuthContext')) return { contents: 'export const AuthContext = {};' };
        return { contents: `
          export async function checkTagPermission(id, type) {
            globalThis.__smaiHookScheduler.calls.push([id, type]); return true;
          }
          export async function getWritableTags() { return []; }
          export const ADMIN_ROLES = {};
          export const isAdmin = () => false, isSuperAdmin = () => false,
            canManageTags = () => false, canAssignPermissions = () => false,
            canWriteToTag = () => false, getUserRole = () => null;
        ` };
      });
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${Math.random()}`);
}

test('single-tag permission rechecks only when user, tag or permission changes', async () => {
  const api = createScheduler();
  const hooks = await loadHooks(api);
  const first = await api.render(() => hooks.useTagPermission(1));
  const second = await api.render(() => hooks.useTagPermission(1));
  assert.equal(first.checkPermission, second.checkPermission);
  assert.deepEqual(api.calls, [[1, 'write']]);
  await api.render(() => hooks.useTagPermission(2, 'read'));
  assert.deepEqual(api.calls, [[1, 'write'], [2, 'read']]);
});

test('equal inline tag arrays do not repeat permission requests', async () => {
  const api = createScheduler();
  const hooks = await loadHooks(api);
  await api.render(() => hooks.useMultipleTagPermissions([1, 2]));
  await api.render(() => hooks.useMultipleTagPermissions([1, 2]));
  assert.equal(api.calls.length, 2);
  await api.render(() => hooks.useMultipleTagPermissions([1, 3]));
  assert.deepEqual(api.calls, [[1, 'write'], [2, 'write'], [1, 'write'], [3, 'write']]);
});

test('dynamic permission dependencies retain explicit triggers and retry sees latest callback', async () => {
  const api = createScheduler();
  const hooks = await loadHooks(api);
  const calls = [];
  await api.render(() => hooks.usePermissionWithError(async () => { calls.push('first'); return true; }, [1]));
  const current = await api.render(() => hooks.usePermissionWithError(async () => { calls.push('latest'); return true; }, [1]));
  assert.deepEqual(calls, ['first']);
  await current.retry();
  assert.deepEqual(calls, ['first', 'latest']);
  await api.render(() => hooks.usePermissionWithError(async () => { calls.push('changed'); return false; }, [2]));
  assert.deepEqual(calls, ['first', 'latest', 'changed']);
});
