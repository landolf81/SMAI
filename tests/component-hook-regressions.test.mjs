// Offline hook regressions: mocked media services never contact production.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Buffer } from 'node:buffer';
import { setImmediate } from 'node:timers';
import { fileURLToPath } from 'node:url';

function hookRuntime() {
  const slots = [];
  let cursor = 0;
  let dirty = false;
  let pending = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const runtime = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { state: typeof initial === 'function' ? initial() : initial };
      const set = value => {
        const next = typeof value === 'function' ? value(slots[index].state) : value;
        if (!Object.is(next, slots[index].state)) { slots[index].state = next; dirty = true; }
      };
      return [slots[index].state, set];
    },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useMemo(fn, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { value: fn(), deps };
      return slots[index].value;
    },
    useCallback(fn, deps) { return runtime.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) pending.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, cleanup: fn() };
      });
    },
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    async render(Component, props, commit = () => {}) {
      for (let cycle = 0; cycle < 20; cycle++) {
        dirty = false; cursor = 0;
        const tree = Component(props);
        commit(tree);
        const effects = pending; pending = []; effects.forEach(fn => fn());
        await new Promise(resolve => setImmediate(resolve));
        if (!dirty) return tree;
      }
      assert.fail('Effects repeatedly updated state; possible render/fetch loop');
    },
    states() { return slots.filter(slot => Object.hasOwn(slot, 'state')).map(slot => slot.state); },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
  return runtime;
}

async function loadComponent(filename) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(`../src/components/${filename}`, import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'transform',
    plugins: [{ name: 'offline-component-mocks', setup(plugin) {
      plugin.onResolve({ filter: /^(react|prop-types)$/ }, args => ({ path: args.path, namespace: 'mock' }));
      plugin.onResolve({ filter: /^(\.|@)/ }, args => args.kind === 'entry-point' ? undefined : ({ path: args.path, namespace: 'mock' }));
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => {
        if (path === 'react') return { contents: `const R=globalThis.__componentHookRuntime; export default R; export const {useState,useRef,useEffect,useMemo,useCallback}=R;` };
        if (path === 'prop-types') return { contents: `const p=new Proxy(function(){return p},{get(){return p}}); export default p;` };
        if (path === '../services') return { contents: `export const adService=globalThis.__componentAdService; export const storageService={};` };
        if (path === '../config/api') return { contents: `export const getImageUrl=x=>x;` };
        if (path.endsWith('/mediaUtils')) return { contents: `export const getCloudflareStreamUid=x=>x; export const isVideoFile=x=>/\\.mp4$/.test(x || ''); export const normalizeMediaUrl=(x,b)=>b+x; export const getMediaIcon=()=>null; export const validateUploadFile=()=>({valid:true}); export const getAcceptedFileTypes=()=>'*';` };
        return { contents: `const icon=()=>null; export default icon; export const FontAwesomeIcon=icon; export const faPlay={},faPause={},faVolumeUp={},faVolumeMute={},faExpand={};` };
      });
    } }],
  });
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).default;
}

function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return;
  if (predicate(tree)) return tree;
  for (const child of (tree.props?.children || []).flat(Infinity)) {
    const match = find(child, predicate); if (match) return match;
  }
}

test('media gallery fetches once per ad and uses the latest parent callback for refresh', async () => {
  const runtime = hookRuntime(); globalThis.__componentHookRuntime = runtime;
  const calls = []; const first = []; const latest = [];
  globalThis.__componentAdService = { async getAdMedia(id) { calls.push(id); return []; } };
  const Component = await loadComponent('MediaGallery.jsx');
  try {
    await runtime.render(Component, { adId: 'ad-1', onMediaChange: items => first.push(items) });
    assert.deepEqual(calls, ['ad-1']); assert.equal(first.length, 1);
    await runtime.render(Component, { adId: 'ad-1', onMediaChange: items => latest.push(items) });
    assert.deepEqual(calls, ['ad-1'], 'parent callback identity must not trigger another fetch');
    await runtime.render(Component, { adId: 'ad-2', onMediaChange: items => latest.push(items) });
    assert.deepEqual(calls, ['ad-1', 'ad-2']); assert.equal(latest.length, 1);
  } finally { runtime.unmount(); delete globalThis.__componentHookRuntime; delete globalThis.__componentAdService; }
});

test('video slider initialization preserves play state across parent rerenders', async () => {
  const runtime = hookRuntime(); globalThis.__componentHookRuntime = runtime;
  const Component = await loadComponent('ImageSlider.jsx');
  try {
    let tree = await runtime.render(Component, { images: ['https://example.invalid/video.mp4', 'https://example.invalid/image.jpg'], disableAutoplay: true });
    let video = find(tree, node => node.type === 'video'); assert.ok(video);
    video.props.onPlay();
    tree = await runtime.render(Component, { images: ['https://example.invalid/video.mp4', 'https://example.invalid/image.jpg'], disableAutoplay: true });
    video = find(tree, node => node.type === 'video');
    const videoStates = runtime.states()[1];
    assert.ok(video, 'video should remain mounted');
    assert.equal(videoStates[0].isPlaying, true, 'initialization must preserve an already playing video');
    assert.equal(videoStates[0].isMuted, true, 'initialization must preserve existing mute state');
  } finally { runtime.unmount(); delete globalThis.__componentHookRuntime; }
});


test('stream player resumes autoplay after external pause and cleans up the captured video', async () => {
  const runtime = hookRuntime(); globalThis.__componentHookRuntime = runtime;
  const Component = await loadComponent('CloudflareStreamPlayer.jsx');
  const listeners = new Map(); let playCount = 0; let pauseCount = 0;
  const video = {
    canPlayType: () => 'probably',
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
    play: async () => { playCount++; }, pause: () => { pauseCount++; },
    videoWidth: 720, videoHeight: 1280, src: '', muted: true,
  };
  let ref;
  const commit = tree => { const node = find(tree, item => item.type === 'video'); if (node) { ref = node.props.ref; ref.current = video; } };
  try {
    const props = { uid: 'test-stream', autoplay: true, paused: true };
    await runtime.render(Component, props, commit);
    listeners.get('loadedmetadata')();
    await runtime.render(Component, props, commit);
    assert.equal(playCount, 0, 'externally paused video must not autoplay when HLS becomes ready');
    await runtime.render(Component, { ...props, paused: false }, commit);
    assert.equal(playCount, 1, 'releasing the external pause should re-evaluate autoplay');
    const pausesBeforeUnmount = pauseCount;
    ref.current = { pause() { assert.fail('cleanup used the replacement ref instead of the original video'); } };
    runtime.unmount();
    assert.equal(pauseCount, pausesBeforeUnmount + 1);
    assert.equal(video.src, '', 'unmount should release the original video source');
    assert.equal(listeners.size, 0, 'native video listeners should be removed');
  } finally { delete globalThis.__componentHookRuntime; }
});
