---
name: design-guide
description: 성주마이 프로젝트의 Tailwind CSS, DaisyUI 디자인. 반응형 레이아웃, 색상 테마, 컴포넌트 스타일링, UI/UX 개선.
allowed-tools: Read, Grep, Glob
---

# 성주마이 디자인 가이드

## 기술 스택
- Tailwind CSS
- DaisyUI 4.x
- React 18
- Vite

## 색상 팔레트
- Primary: yellow-400 ~ yellow-600 (참외 테마)
- Secondary: green-400 ~ green-600 (농업 테마)
- Background: gray-50, white
- Text: gray-800, gray-600

## 반응형 Breakpoints
- Mobile: `sm` (640px 이상)
- Tablet: `md` (768px 이상)
- Desktop: `lg` (1024px 이상)

## 주요 컴포넌트
- EnhancedInstagramPost (피드 카드)
- SecondHandCard (중고거래 카드)
- QnADetail (QnA 상세)
- MobileBottomNav (모바일 하단 네비게이션)

## 디자인 원칙
1. **모바일 우선** (mobile-first approach)
2. **일관된 간격** (spacing scale: 4, 8, 12, 16, 20, 24...)
3. **둥근 모서리** (rounded-xl, rounded-2xl, rounded-3xl)
4. **그림자** (shadow-sm, shadow-md, shadow-lg)
5. **접근성** (충분한 색상 대비, 포커스 상태)

## 자주 사용하는 패턴
```css
/* 카드 스타일 */
bg-white rounded-2xl shadow-lg border border-gray-100 p-4

/* 버튼 스타일 */
bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white font-bold py-3 px-6 rounded-xl

/* 입력 필드 */
w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400
```

## 아이콘
- Material UI Icons (@mui/icons-material)
- 일관된 크기: text-xl, text-2xl

## 애니메이션
- transition-all duration-300
- hover 효과: scale, opacity, color 변화
