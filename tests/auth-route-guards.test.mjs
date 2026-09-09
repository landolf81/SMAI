import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../src/context/authState.js';
import {
  BannedRestrictedRoute,
  ProtectedRoute,
  SecondHandGuard,
} from '../src/components/AuthRouteGuards.js';

const renderGuard = (Guard, auth) => renderToStaticMarkup(
  React.createElement(
    MemoryRouter,
    null,
    React.createElement(
      AuthContext.Provider,
      { value: auth },
      React.createElement(
        Guard,
        null,
        React.createElement('div', { 'data-testid': 'protected-content' }, '보호 콘텐츠'),
      ),
    ),
  ),
);

test('보호 라우트는 인증 확인 중 자식이나 로그인 화면을 먼저 표시하지 않는다', (t) => {
  t.mock.method(console, 'error', () => {});
  const markup = renderGuard(ProtectedRoute, { currentUser: null, loading: true });

  assert.match(markup, /로그인 상태 확인 중/);
  assert.doesNotMatch(markup, /보호 콘텐츠/);
});

test('보호 라우트는 확인 완료 후 회원만 자식을 렌더링한다', (t) => {
  t.mock.method(console, 'error', () => {});
  const guestMarkup = renderGuard(ProtectedRoute, { currentUser: null, loading: false });
  const memberMarkup = renderGuard(ProtectedRoute, { currentUser: { id: 'member-1' }, loading: false });

  assert.doesNotMatch(guestMarkup, /보호 콘텐츠/);
  assert.match(memberMarkup, /보호 콘텐츠/);
});

test('차단 제한 라우트는 대기 및 차단 상태에서 자식을 숨기고 정상 회원에게만 허용한다', (t) => {
  t.mock.method(console, 'error', () => {});
  const pendingMarkup = renderGuard(BannedRestrictedRoute, {
    currentUser: null,
    loading: true,
    isBanned: false,
  });
  const bannedMarkup = renderGuard(BannedRestrictedRoute, {
    currentUser: { id: 'banned-1' },
    loading: false,
    isBanned: true,
  });
  const memberMarkup = renderGuard(BannedRestrictedRoute, {
    currentUser: { id: 'member-1' },
    loading: false,
    isBanned: false,
  });

  assert.doesNotMatch(pendingMarkup, /보호 콘텐츠/);
  assert.doesNotMatch(bannedMarkup, /보호 콘텐츠/);
  assert.match(memberMarkup, /보호 콘텐츠/);
});

test('사고팔고 읽기 가드는 인증 확인을 기다리고 차단 사용자만 리다이렉트한다', (t) => {
  t.mock.method(console, 'error', () => {});
  const pendingMarkup = renderGuard(SecondHandGuard, {
    currentUser: null,
    loading: true,
    isBanned: false,
  });
  const guestMarkup = renderGuard(SecondHandGuard, {
    currentUser: null,
    loading: false,
    isBanned: false,
  });
  const bannedMarkup = renderGuard(SecondHandGuard, {
    currentUser: { id: 'banned-1' },
    loading: false,
    isBanned: true,
  });

  assert.doesNotMatch(pendingMarkup, /보호 콘텐츠/);
  assert.match(guestMarkup, /보호 콘텐츠/);
  assert.doesNotMatch(bannedMarkup, /보호 콘텐츠/);
});
