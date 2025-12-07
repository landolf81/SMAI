# CLAUDE.md

## Project Overview

성주마이 (SMAI) - 성주군 농업인을 위한 커뮤니티 웹앱. React + Vite 기반.

## Development Commands

```bash
npm run dev          # 개발 서버 (localhost:3000)
npm run build:prod   # 프로덕션 빌드
npm run lint:fix     # 린트 자동 수정
```

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + DaisyUI
- **State**: React Context (AuthContext) + TanStack Query
- **Backend**: Supabase (Auth, Database, Storage)
- **Routing**: React Router v6

## 컴포넌트 의존성 맵

### 주요 컴포넌트 사용 위치

| 파일 | 사용 위치 | 라우트 | 역할 |
|------|----------|-------|------|
| **EnhancedInstagramPost.jsx** | EnhancedInstagramFeed.jsx | 피드 전체 | 게시물 카드 (현재 사용) |
| **EnhancedInstagramFeed.jsx** | Community.jsx | `/community` | 피드 목록 |
| **CommentsPreview.jsx** | EnhancedInstagramPost.jsx | 피드 내 | 댓글 미리보기 (3개) |
| **CommentsSection.jsx** | Post.jsx | - | 전체 댓글 (레거시) |
| **ImageSlider.jsx** | EnhancedInstagramPost, Post | 피드 내 | 다중 이미지 슬라이더 |
| **MediaModal.jsx** | EnhancedInstagramPost.jsx | 피드 내 | 전체화면 미디어 뷰어 |
| **PostDetail.jsx** | App.jsx (route) | `/post/:postId` | 게시물 상세 페이지 |
| **PostDetailModal.jsx** | LikedPosts, UserComments, AdminReports | 모달 | 게시물 상세 모달 |
| **Post.jsx** | **미사용 (레거시)** | - | 구형 게시물 카드 |
| **SecondHandCard.jsx** | SecondHand.jsx | `/secondhand` | 중고거래 카드 |
| **SecondHandEditor.jsx** | App.jsx (route) | `/secondhand/new`, `/secondhand/edit/:id` | 중고거래 에디터 |
| **QnAForm.jsx** | QnA.jsx | `/qna/new` | QnA 질문 작성 |
| **QnADetail.jsx** | App.jsx (route) | `/qna/:questionId` | QnA 상세 |
| **ProfileModal.jsx** | 여러 컴포넌트 | 모달 | 사용자 프로필 |

### 라우팅 구조

```
App.jsx
├── /community → Community.jsx → EnhancedInstagramFeed → EnhancedInstagramPost
├── /post/:postId → PostDetail.jsx
├── /secondhand → SecondHand.jsx → SecondHandCard
├── /secondhand/new → SecondHandEditor.jsx
├── /qna → QnA.jsx
├── /qna/:questionId → QnADetail.jsx
├── /profile/:id → Profile.jsx → LikedPosts → PostDetailModal
└── /admin/* → Admin pages
```

### 레거시 vs 현재 컴포넌트

| 레거시 (미사용) | 현재 사용 중 |
|---------------|-------------|
| Post.jsx | EnhancedInstagramPost.jsx |
| CommentsSection.jsx (일부) | CommentsPreview.jsx |

### Services Layer

```javascript
import { postService, commentService, userService, qnaService, storageService } from './services';
```

## Environment Variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
