import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const { parse } = require('espree');
const root = fileURLToPath(new URL('..', import.meta.url));
async function source(file) {
  return readFile(`${root}/src/pages/${file}`, 'utf8');
}
function declarations(code) {
  const found = [];
  const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, range: true });
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator') found.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (key === 'range') continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  return found;
}
function functionFromSource(code, name, globals = {}) {
  const node = declarations(code).find(node => node.id.name === name).init;
  const fn = node.type === 'CallExpression' ? node.arguments[0] : node;
  return runInNewContext(`(${code.slice(...fn.range)})`, globals);
}

test('price grade ordering uses cached settings, preserves data, and keeps unknown grades last', async () => {
  const code = await source('Prices.jsx');
  const ref = { current: { grade_orders: { market: ['특', '상'] } } };
  const sort = functionFromSource(code, 'sortDetailsByGradeOrder', { gradeSettingsRef: ref });
  const items = [{ grade: '보통' }, { grade: '상' }, { grade: '특' }];
  assert.deepEqual(Array.from(sort(items, 'market'), item => item.grade), ['특', '상', '보통']);
  assert.deepEqual(items.map(item => item.grade), ['보통', '상', '특']);
  ref.current = { grade_orders: { market: ['상', '특'] } };
  assert.deepEqual(Array.from(sort(items, 'market'), item => item.grade), ['상', '특', '보통']);
});

test('market trend date helpers preserve the 364-day same-weekday comparison', async () => {
  const code = await source('MarketTrend.jsx');
  const shift = functionFromSource(code, 'shiftBack364');
  const range = functionFromSource(code, 'getLastYearRange', { shiftBack364: shift });
  const result = range('2026-09-30', '2026-10-07');
  assert.equal(result.startDate, '2025-10-01');
  assert.equal(result.endDate, '2025-10-08');
  assert.equal(new Date(result.startDate).getDay(), new Date('2026-09-30').getDay());
});

test('loader pages render without hook dependency temporal-dead-zone errors', async () => {
  globalThis.localStorage = { getItem() { return null; } };
  globalThis.window = { innerWidth: 390, navigator: { userAgent: 'test' } };
  for (const page of ['Alerts.jsx', 'Favorites.jsx', 'Markets.jsx', 'MarketTrend.jsx', 'Prices.jsx', 'Translate.jsx', 'admin/AdminUsers.jsx', 'admin/AdminDetailGradeSettings.jsx']) {
    const code = await source(page);
    const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } });
    const imports = new Map(ast.body.filter(node => node.type === 'ImportDeclaration').map(node => [node.source.value, node.specifiers]));
    const result = await build({
      stdin: { contents: code, loader: 'jsx', resolveDir: `${root}/src/pages` },
      bundle: true, platform: 'node', format: 'esm', write: false, jsx: 'automatic',
      external: ['react', 'react/jsx-runtime', 'prop-types'],
      plugins: [{ name: 'read-only-page-mocks', setup(plugin) {
        plugin.onResolve({ filter: /.*/ }, args => {
          if (['react', 'react/jsx-runtime', 'prop-types'].includes(args.path)) return;
          return { path: args.path, namespace: 'mock' };
        });
        plugin.onLoad({ filter: /.*/, namespace: 'mock' }, args => {
          const specs = imports.get(args.path) || [];
          const statements = ['import React from "react";'];
          for (const spec of specs) {
            const name = spec.type === 'ImportDefaultSpecifier' ? 'default' : spec.imported?.name;
            let value = '() => null';
            if (name === 'AuthContext') value = 'React.createContext({currentUser:null,loading:false})';
            else if (name === 'useQuery') value = '() => ({data:[],isLoading:false,isPending:false})';
            else if (name === 'useNavigate') value = '() => () => {}';
            else if (name === 'useSearchParams') value = '() => [new URLSearchParams(), () => {}]';
            else if (name === 'useTheme') value = '() => ({isDark:false})';
            else if (name === 'useAdminPermissions') value = '() => ({isAdmin:false})';
            else if (name === 'BANNER_SLOTS') value = '{}';
            else if (name?.endsWith('Service') || name === 'supabase') value = '{}';
            statements.push(name === 'default' ? `export default ${value};` : `export const ${name} = ${value};`);
          }
          return { contents: statements.join('\n') };
        });
      } }],
    });
    const temp = await mkdtemp(`${root}/tests/.pages-cleanup-`);
    try {
      const file = `${temp}/page.mjs`;
      await writeFile(file, result.outputFiles[0].text);
      const { default: Page } = await import(pathToFileURL(file).href);
      assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(Page)), page);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }
});
