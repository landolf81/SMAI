# 피드 로딩 성능 개선 계획서

## 현재 상태 분석

### 피드 로딩 시 실행되는 쿼리 (6개)
1. `posts` + `users` JOIN - 게시물 기본 정보
2. `post_tags` - 태그 정보
3. `likes` - 좋아요 수 집계
4. `comments` - 댓글 수 집계
5. `trade_items` - 중고거래 상태
6. `user_post_views` - 열람 기록 (로그인 시)

### 현재 설정 (개선 후)
- 초기 로드: **5개** ✅
- staleTime: **5분** ✅
- gcTime: **10분** ✅

---

## 개선 작업 목록

### Phase 1: 프론트엔드 최적화 (즉시 적용)

#### 1.1 초기 로드 개수 조정 ✅
- [x] `limit: 10` → `limit: 5` 변경
- 파일: `src/components/EnhancedInstagramFeed.jsx:50`
- 예상 효과: 첫 화면 로딩 시간 50% 감소

#### 1.2 캐시 시간 증가 ✅
- [x] `staleTime: 1분` → `staleTime: 5분`
- [x] `gcTime: 5분` → `gcTime: 10분`
- 파일: `src/components/EnhancedInstagramFeed.jsx:60-61`
- 예상 효과: 재방문 시 즉시 표시

#### 1.3 이미지 로딩 최적화 ✅
- [x] 이미지에 `loading="lazy"` 속성 추가
- [ ] 이미지 placeholder (blur/skeleton) 추가 (선택적)
- 파일: `src/components/EnhancedInstagramPost.jsx`, `src/components/ImageSlider.jsx`

#### 1.4 스켈레톤 UI 개선 ✅
- [x] 로딩 중 스켈레톤 카드 표시 (이미 구현됨)
- 파일: `src/components/EnhancedInstagramFeed.jsx:498-519`

---

### Phase 2: 데이터베이스 최적화 (중기)

#### 2.1 집계 컬럼 추가 (Supabase)
```sql
-- posts 테이블에 집계 컬럼 추가
ALTER TABLE posts ADD COLUMN likes_count INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN comments_count INTEGER DEFAULT 0;

-- 트리거로 자동 업데이트
```
- 예상 효과: likes, comments 쿼리 2개 제거

#### 2.2 인덱스 추가
```sql
-- 피드 조회용 복합 인덱스
CREATE INDEX idx_posts_feed ON posts(post_type, created_at DESC);
CREATE INDEX idx_posts_user ON posts(user_id, created_at DESC);
```

#### 2.3 DB View 생성
```sql
-- 피드용 뷰 생성 (모든 정보 포함)
CREATE VIEW posts_feed_view AS
SELECT
  p.*,
  u.username, u.name, u.profile_pic,
  COUNT(DISTINCT l.id) as likes_count,
  COUNT(DISTINCT c.id) as comments_count
FROM posts p
LEFT JOIN users u ON p.user_id = u.id
LEFT JOIN likes l ON p.id = l.post_id
LEFT JOIN comments c ON p.id = c.post_id
GROUP BY p.id, u.id;
```
- 예상 효과: 쿼리 6개 → 1개로 감소

---

### Phase 3: 고급 최적화 (장기)

#### 3.1 Supabase Edge Functions
- 서버 측에서 데이터 조합 후 단일 응답 반환
- 클라이언트 부하 감소

#### 3.2 이미지 CDN 최적화
- Supabase Storage Transform 활용
- WebP 자동 변환
- 썸네일 자동 생성

#### 3.3 무한 스크롤 프리페칭
- 현재 페이지 로드 시 다음 페이지 미리 로드
- `prefetchQuery` 활용

---

## 작업 우선순위

| 순서 | 작업 | 난이도 | 효과 | 상태 |
|------|------|--------|------|------|
| 1 | 초기 로드 5개로 변경 | 쉬움 | 높음 | ✅ |
| 2 | staleTime 5분으로 증가 | 쉬움 | 중간 | ✅ |
| 3 | 스켈레톤 UI 추가 | 쉬움 | 중간 | ✅ (이미 구현됨) |
| 4 | 이미지 lazy loading 추가 | 쉬움 | 중간 | ✅ |
| 5 | 집계 컬럼 추가 (DB) | 중간 | 높음 | ✅ |
| 6 | DB View 생성 | 중간 | 높음 | ⬜ (선택적) |

---

## 측정 방법

### 성능 측정 지표
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)

### 측정 도구
- Chrome DevTools > Performance
- Lighthouse
- React Query DevTools

---

## 변경 이력

| 날짜 | 작업 | 담당 |
|------|------|------|
| 2024-12-06 | 계획서 작성 | Claude |
| 2024-12-06 | 초기 로드 5개로 변경, staleTime 5분으로 증가 | Claude |
| 2024-12-06 | 이미지 lazy loading 속성 추가 | Claude |
| 2024-12-06 | DB 집계 컬럼(likes_count, comments_count) + 트리거 추가 | Claude |
| 2024-12-06 | postService.js에서 likes/comments 쿼리 제거, DB 컬럼 활용 | Claude |
