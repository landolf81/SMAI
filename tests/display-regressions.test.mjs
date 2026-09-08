import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanNewsText } from '../src/utils/newsText.js';
import moment from '../src/utils/koreanMoment.js';

test('RSS 원문, XML 및 중첩 엔티티의 링크를 텍스트로 정리한다', () => {
  for (const value of [
    '<a href="https://example.com">성주 참외</a>&nbsp;뉴스',
    '&lt;a href=&quot;https://example.com&quot;&gt;성주 참외&lt;/a&gt;&nbsp;뉴스',
    '&amp;lt;a href=&amp;quot;https://example.com&amp;quot;&amp;gt;성주 참외&amp;lt;/a&amp;gt;&amp;nbsp;뉴스',
    '&#60;a href="https://example.com"&#62;성주 참외&#60;/a&#62; 뉴스',
    '<![CDATA[<a href="https://example.com">성주 참외</a> 뉴스]]>',
  ]) assert.equal(cleanNewsText(value), '성주 참외 뉴스');
});
test('실행성 내용과 잘린 HTML을 노출하지 않고 일반 문자를 보존한다', () => {
  assert.equal(cleanNewsText('<script>alert(1)</script><style>bad</style><img src=x onerror=alert(1)>기사'), '기사');
  assert.equal(cleanNewsText('기사 &lt;a href="https://example.com'), '기사');
  assert.equal(cleanNewsText('당도 10 < 12 &amp; 13 > 11'), '당도 10 < 12 & 13 > 11');
  assert.equal(cleanNewsText('&#x1F348; &#39;참외&#39;'), "🍈 '참외'");
  assert.equal(cleanNewsText(null), '');
});
test('다른 페이지 방문 없이 상대 날짜가 한국어로 표시된다', () => {
  const now = moment('2026-09-08T12:00:00+09:00');
  assert.equal(moment('2026-08-08T12:00:00+09:00').from(now), '한 달 전');
  assert.equal(moment('2026-07-08T12:00:00+09:00').from(now), '2달 전');
});

test('뉴스 API도 엔티티를 정리한 뒤 200자로 제한한다', async (t) => {
  const { default: handler } = await import('../api/news.js');
  const description = '&lt;a href=&quot;https://example.com&quot;&gt;' + '성주 참외 '.repeat(60) + '&lt;/a&gt;';
  const xml = `<rss><channel><item><title>성주 참외 뉴스</title><link>https://example.com</link><description>${description}</description></item></channel></rss>`;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, text: async () => xml }));
  let result;
  const res = { setHeader() {}, status(code) { assert.equal(code, 200); return this; }, json(body) { result = body; } };
  await handler({ method: 'GET' }, res);
  assert.equal(result.count, 1);
  assert.equal(result.items[0].description.length, 200);
  assert.ok(result.items[0].description.startsWith('성주 참외'));
  assert.doesNotMatch(result.items[0].description, /href|&lt;|<a/);
});
