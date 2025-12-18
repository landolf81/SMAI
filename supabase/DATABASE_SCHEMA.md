# 성주마이 데이터베이스 스키마

## 주요 테이블

### 1. posts
게시물 메인 테이블 (커뮤니티, 중고거래 통합)

**컬럼**:
- `id` (uuid, PK)
- `user_id` (uuid, FK → users)
- `post_type` (text): 'community', 'secondhand' 등
- `title` (text)
- `description` (text)
- `images` (text[])
- `videos` (text[])
- `is_hidden` (boolean)
- `status` (text)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**post_type 값**:
- `'community'`: 일반 커뮤니티 게시물
- `'secondhand'`: 중고거래 게시물

### 2. users
사용자 정보

**컬럼**:
- `id` (uuid, PK)
- `username` (text, unique)
- `name` (text)
- `email` (text)
- `profile_pic` (text)
- `role` (text): 'user', 'admin', 'super_admin'
- `is_banned` (boolean)
- `created_at` (timestamp)

### 3. comments
댓글

**컬럼**:
- `id` (uuid, PK)
- `post_id` (uuid, FK → posts)
- `user_id` (uuid, FK → users)
- `content` (text)
- `is_hidden` (boolean)
- `created_at` (timestamp)

### 4. likes
좋아요

**컬럼**:
- `id` (uuid, PK)
- `post_id` (uuid, FK → posts)
- `user_id` (uuid, FK → users)
- `created_at` (timestamp)

### 5. tags
태그 정보

**컬럼**:
- `id` (int, PK)
- `name` (text, unique)
- `display_name` (text)
- `color` (text)

### 6. post_tags
게시물-태그 관계

**컬럼**:
- `id` (uuid, PK)
- `post_id` (uuid, FK → posts)
- `tag_id` (int, FK → tags)

### 7. reports
신고

**컬럼**:
- `id` (uuid, PK)
- `post_id` (uuid, FK → posts, nullable)
- `comment_id` (uuid, FK → comments, nullable)
- `user_id` (uuid, FK → users)
- `category_id` (int, FK → report_categories)
- `custom_reason` (text, nullable)
- `status` (text): 'pending', 'approved', 'rejected'
- `created_at` (timestamp)

### 8. report_categories
신고 카테고리

**컬럼**:
- `id` (int, PK)
- `name` (text)
- `description` (text)

### 9. user_post_views
게시물 조회 이력

**컬럼**:
- `id` (uuid, PK)
- `user_id` (uuid, FK → users)
- `post_id` (uuid, FK → posts)
- `viewed_at` (timestamp)

## 중요 사항

### ⚠️ 존재하지 않는 테이블
- `secondhand_posts` ❌ (posts 테이블의 post_type='secondhand'로 구분)
- `qna_posts` ❌ (별도 테이블 없음, posts 테이블 사용)

### 인덱스 전략
- **posts**: user_id, post_type, is_hidden, created_at 조합
- **comments**: post_id, is_hidden, created_at 조합
- **likes**: post_id, user_id
- **post_tags**: post_id, tag_id
- **reports**: post_id, comment_id, status, created_at

## 참고
이 문서는 2025-12-18 기준으로 작성되었습니다.
테이블 구조 변경 시 반드시 이 문서를 업데이트하세요.
