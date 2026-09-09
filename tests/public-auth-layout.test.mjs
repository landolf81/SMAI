import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const appPath = new URL('../src/App.jsx', import.meta.url).pathname;

function mockComponent(name) {
  return `import React from 'react';
export default function ${name.replace(/\W/g, '')}() {
  return React.createElement('div', { 'data-component': ${JSON.stringify(name)} });
}`;
}

async function loadAppWithCapturedRouter() {
  globalThis.window = { innerWidth: 1024, addEventListener() {}, removeEventListener() {} };
  globalThis.document = {
    visibilityState: 'visible',
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.__smaiAuthContext = undefined;
  globalThis.__smaiRouter = undefined;

  const result = await build({
    entryPoints: [appPath],
    absWorkingDir: new URL('..', import.meta.url).pathname,
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    jsx: 'automatic',
    external: ['react', 'react/jsx-runtime'],
    plugins: [{
      name: 'app-test-mocks',
      setup(plugin) {
        plugin.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: 'router', namespace: 'mock' }));
        plugin.onResolve({ filter: /^@tanstack\/react-query$/ }, () => ({ path: 'query', namespace: 'mock' }));
        plugin.onResolve({ filter: /^react-hot-toast$/ }, () => ({ path: 'toast', namespace: 'mock' }));
        plugin.onResolve({ filter: /^@vercel\/(analytics|speed-insights)\/react$/ }, (args) => ({ path: args.path, namespace: 'mock' }));
        plugin.onResolve({ filter: /^\.\/components\/AuthRouteGuards$/ }, () => ({
          path: new URL('../src/components/AuthRouteGuards.js', import.meta.url).pathname,
        }));
        plugin.onResolve({ filter: /^\./ }, (args) => ({
          path: `${args.importer}:${args.path}`,
          namespace: args.path === './App.css' ? 'css-mock' : 'component-mock',
        }));
        plugin.onLoad({ filter: /.*/, namespace: 'css-mock' }, () => ({ contents: '' }));
        plugin.onLoad({ filter: /^router$/, namespace: 'mock' }, () => ({ contents: `
          import React from 'react';
          export function createBrowserRouter(routes) {
            globalThis.__smaiRouter = { routes };
            return { routes };
          }
          export function RouterProvider() { return null; }
          export function Outlet() { return React.createElement('main', { 'data-testid': 'public-outlet' }, 'public content'); }
          export function Navigate({ to }) { return React.createElement('div', { 'data-testid': 'navigate', 'data-to': to }); }
          export function useLocation() { return { pathname: '/community' }; }
          export function useNavigate() { return () => {}; }
          export function useSearchParams() { return [new URLSearchParams(), () => {}]; }
        ` }));
        plugin.onLoad({ filter: /^query$/, namespace: 'mock' }, () => ({ contents: `
          export class QueryClient {}
          export function QueryClientProvider({ children }) { return children; }
        ` }));
        plugin.onLoad({ filter: /^toast$/, namespace: 'mock' }, () => ({ contents: `
          export function Toaster() { return null; }
          export default {};
        ` }));
        plugin.onLoad({ filter: /^@vercel\//, namespace: 'mock' }, () => ({ contents: `
          export function Analytics() { return null; }
          export function SpeedInsights() { return null; }
        ` }));
        plugin.onLoad({ filter: /.*/, namespace: 'component-mock' }, (args) => {
          const importPath = args.path.slice(args.path.lastIndexOf(':') + 1);
          if (/context\/(?:AuthContext|authContext|authState)(?:\.js)?$/i.test(importPath)) {
            return { contents: `
              import React from 'react';
              export const AuthContext = globalThis.__smaiAuthContext ??= React.createContext({ currentUser: null, loading: true, isBanned: false });
            ` };
          }
          if (importPath === './context/ThemeContext') {
            return { contents: `import React from 'react'; export function ThemeProvider({ children }) { return children; }` };
          }
          if (importPath === './hooks/useScrollDirection') {
            return { contents: `export function useScrollDirection() { return 'up'; }` };
          }
          if (importPath === './utils/deviceDetector') {
            return { contents: `export function isMobileDevice() { return false; } export function isTabletDevice() { return false; }` };
          }
          const name = importPath.split('/').pop().replace(/\.[^.]+$/, '');
          return { contents: mockComponent(name) };
        });
      },
    }],
  });
  const tempDir = await mkdtemp(new URL('./.public-auth-layout-', import.meta.url).pathname);
  const modulePath = `${tempDir}/app.mjs`;
  try {
    await writeFile(modulePath, result.outputFiles[0].text);
    await import(`${pathToFileURL(modulePath).href}?${Date.now()}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  return {
    authContext: globalThis.__smaiAuthContext,
    routes: globalThis.__smaiRouter.routes,
    cleanup() {
      delete globalThis.window;
      delete globalThis.document;
      delete globalThis.__smaiAuthContext;
      delete globalThis.__smaiRouter;
    },
  };
}

function routeElement(routes, path) {
  for (const route of routes) {
    if (route.path === path) return route.element;
    const nested = route.children && routeElement(route.children, path);
    if (nested) return nested;
  }
}

function render(element, authContext, value) {
  return renderToStaticMarkup(
    React.createElement(authContext.Provider, { value }, element),
  );
}

test('public route content remains visible while authentication is loading', async () => {
  const app = await loadAppWithCapturedRouter();
  try {
    const html = render(app.routes[0].element, app.authContext, {
      currentUser: null,
      loading: true,
      isBanned: false,
    });

    assert.match(html, /data-testid="public-outlet"/);
    assert.match(html, /public content/);
  } finally {
    app.cleanup();
  }
});

test('protected account route waits for auth, then redirects signed-out users', async () => {
  const app = await loadAppWithCapturedRouter();
  try {
    const accountRoute = routeElement(app.routes, '/favorite-prices');
    assert.ok(accountRoute, 'favorite-prices route should be captured');

    const loadingHtml = render(accountRoute, app.authContext, {
      currentUser: null,
      loading: true,
      isBanned: false,
    });
    assert.match(loadingHtml, /aria-label="로그인 상태 확인 중"/);
    assert.doesNotMatch(loadingHtml, /data-testid="navigate"/);

    const signedOutHtml = render(accountRoute, app.authContext, {
      currentUser: null,
      loading: false,
      isBanned: false,
    });
    assert.match(signedOutHtml, /data-testid="navigate"/);
    assert.match(signedOutHtml, /data-to="\/login"/);
  } finally {
    app.cleanup();
  }
});

test('admin account guard blocks pending auth and renders the child after sign-in', async () => {
  const app = await loadAppWithCapturedRouter();
  try {
    const adminRoute = routeElement(app.routes, '/admin/users');
    assert.ok(adminRoute, 'admin users route should be captured');

    const loadingHtml = render(adminRoute, app.authContext, {
      currentUser: null,
      loading: true,
      isBanned: false,
    });
    assert.match(loadingHtml, /aria-label="로그인 상태 확인 중"/);
    assert.doesNotMatch(loadingHtml, /data-component="AdminUsers"/);

    // Replace the lazy page with a synchronous sentinel so this assertion
    // isolates the guard's allow path from page-code splitting.
    const guardWithSentinel = React.cloneElement(
      adminRoute,
      null,
      React.createElement('div', { 'data-testid': 'admin-child' }, 'admin child'),
    );
    const signedInHtml = render(guardWithSentinel, app.authContext, {
      currentUser: { id: 'test-user' },
      loading: false,
      isBanned: false,
    });
    assert.match(signedInHtml, /data-testid="admin-child"/);
  } finally {
    app.cleanup();
  }
});
