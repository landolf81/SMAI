// Validate production component contracts offline, without mounting effects or contacting services.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import PropTypes from 'prop-types';
import { marketType, pollOptionType, adPollType } from '../src/components/propShapes.js';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');

async function contract(file, component) {
  const source = await readFile(new URL(`../src/components/${file}`, import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const assignment = ast.program.body.find(statement => {
    const expression = statement.expression;
    return expression?.type === 'AssignmentExpression' && expression.left.object?.name === component && expression.left.property?.name === 'propTypes';
  });
  assert.ok(assignment, `${component} has an explicit propTypes contract`);
  const context = { PropTypes, Map, marketType, pollOptionType, adPollType, [component]: {} };
  runInNewContext(source.slice(assignment.start, assignment.end), context);
  return context[component].propTypes;
}

function warnings(types, props, name) {
  const messages = [];
  const previous = console.error;
  console.error = message => messages.push(message);
  try {
    PropTypes.resetWarningCache();
    PropTypes.checkPropTypes(types, props, 'prop', name);
  } finally {
    console.error = previous;
  }
  return messages;
}

test('market card accepts numeric aggregates, boolean errors, object totals and Map details', async () => {
  const types = await contract('MarketCards.jsx', 'MarketCards');
  const total = { name: '산지 합계', totalQuantity: 120, averagePrice: 35000, maxPrice: 40000, minPrice: 30000, error: false, isFinalized: true };
  assert.deepEqual(warnings(types, { marketData: [total], seongjuTotal: total, wholesaleTotal: total, marketInfoMap: new Map(), formatPrice: String }, 'MarketCards'), []);
  assert.ok(warnings(types, { marketData: [{ totalQuantity: 'invalid', error: 'invalid' }] }, 'MarketCards').length > 0);
});

test('poll cards accept option objects and reject a scalar options field', async () => {
  for (const [file, component, field] of [['ad/AdPollCard.jsx', 'AdPollCard', 'ad_poll_options'], ['lounge/PollCard.jsx', 'PollCard', 'lounge_poll_options']]) {
    const types = await contract(file, component);
    const poll = { id: 'poll-1', [field]: [{ id: 'option-1', option_text: '판매', display_order: 0, vote_count: 1 }], is_multiple: false, total_votes: 1 };
    assert.deepEqual(warnings(types, { poll, myVotes: ['option-1'], onVote() {}, isVoting: false }, component), []);
    assert.ok(warnings(types, { poll: { ...poll, [field]: 'invalid' } }, component).length > 0);
  }
});

test('permission components accept callback checks and boolean conditions with renderable fallback', async () => {
  const admin = await contract('PermissionComponents.jsx', 'AdminOnly');
  assert.deepEqual(warnings(admin, { customCheck: () => true, children: 'content', fallback: 'waiting' }, 'AdminOnly'), []);
  assert.ok(warnings(admin, { customCheck: 'invalid' }, 'AdminOnly').length > 0);
  const conditional = await contract('PermissionComponents.jsx', 'ConditionalRender');
  assert.deepEqual(warnings(conditional, { when: true, children: 'content', otherwise: 'waiting' }, 'ConditionalRender'), []);
  assert.ok(warnings(conditional, { when: 'invalid' }, 'ConditionalRender').length > 0);
});


test('tag write permission accepts the tag permission object and rejects a scalar', async () => {
  const types = await contract('PermissionComponents.jsx', 'TagWritePermission');
  assert.deepEqual(warnings(types, { tag: { permission_level: 'public' }, children: 'content' }, 'TagWritePermission'), []);
  assert.ok(warnings(types, { tag: 'invalid' }, 'TagWritePermission').length > 0);
});
