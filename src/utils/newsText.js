// RSS 텍스트 전용 정리. HTML을 DOM에 삽입하거나 실행하지 않는다.
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…',
};

export function cleanNewsText(value) {
  if (!value) return '';
  let text = String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  // 중첩된 &amp;lt; 및 숫자 엔티티도 태그 제거 전에 해석한다.
  for (let depth = 0; depth < 8; depth += 1) {
    const decoded = text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
      if (code[0] !== '#') return ENTITIES[code] ?? entity;
      const point = code[1].toLowerCase() === 'x'
        ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point) : '\uFFFD';
    });
    if (decoded === text) break;
    text = decoded;
  }
  return text
    .replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')
    .replace(/<\/?[a-z][^>]*(?:>|$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
