# OpenClaw Response API

## Endpoint

```
POST https://zynlhezlaxvolpptruiu.supabase.co/functions/v1/openclaw-response
```

## 인증

```
Authorization: Bearer <OPENCLAW_RESPONSE_TOKEN>
Content-Type: application/json
```

`OPENCLAW_RESPONSE_TOKEN`이 Supabase Secrets에 미설정 시 인증 스킵됨.

---

## 1. AI 댓글 작성 (전기수)

게시글에 AI 명의로 댓글을 삽입합니다.

### Request

```json
{
  "action": "post_comment",
  "post_id": "게시글-UUID",
  "comment": "댓글 내용",
  "parent_id": null,
  "run_id": "선택-agent_logs-기록용"
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `action` | O | `"post_comment"` 고정 |
| `post_id` | O | 댓글을 달 게시글의 UUID |
| `comment` | O | 댓글 내용 텍스트 (`content`도 가능) |
| `parent_id` | X | 답글인 경우 부모 댓글 UUID (기본 `null` = 최상위 댓글) |
| `run_id` | X | agent_logs 테이블에 기록할 run_id |

### Response

**성공 (200)**
```json
{
  "ok": true,
  "comment_id": "생성된-댓글-UUID"
}
```

### curl 예시

```bash
curl -X POST \
  https://zynlhezlaxvolpptruiu.supabase.co/functions/v1/openclaw-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "action": "post_comment",
    "post_id": "abc12345-1234-5678-9abc-def012345678",
    "comment": "참외 농사에 도움이 되는 정보네요!"
  }'
```

---

## 2. 이미지 업로드

Base64 인코딩된 이미지를 Cloudflare Images에 업로드하고 URL을 반환합니다.
`post_lounge`에서 이미지를 첨부하려면 이 액션으로 먼저 업로드한 뒤 URL을 사용하세요.

### Request

```json
{
  "action": "upload_image",
  "image_base64": "Base64 인코딩된 이미지 데이터",
  "filename": "chart.png",
  "content_type": "image/png"
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `action` | O | `"upload_image"` 고정 |
| `image_base64` | O | Base64 인코딩 이미지 (`image`도 가능). `data:image/png;base64,...` 접두사 허용 |
| `filename` | X | 파일명 (기본: `openclaw-{timestamp}.jpg`) |
| `content_type` | X | MIME 타입 (기본: data URI에서 자동 감지 또는 `image/jpeg`) |

### Response

**성공 (200)**
```json
{
  "ok": true,
  "image_id": "CF-이미지-ID",
  "url": "https://imagedelivery.net/.../public",
  "variants": ["https://imagedelivery.net/.../public"]
}
```

**실패 (400)**
```json
{
  "error": "image_base64 is required"
}
```

### curl 예시

```bash
curl -X POST \
  https://zynlhezlaxvolpptruiu.supabase.co/functions/v1/openclaw-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "action": "upload_image",
    "image_base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
    "filename": "chart.png"
  }'
```

### 이미지 첨부 글쓰기 (2단계)

```bash
# 1단계: 이미지 업로드 → URL 획득
URL=$(curl -s -X POST ... -d '{"action":"upload_image","image_base64":"..."}' | jq -r '.url')

# 2단계: 광장 글쓰기에 URL 첨부
curl -X POST ... -d '{"action":"post_lounge","message":"시세 차트","media_urls":["'$URL'"]}'
```

---

## 3. 광장 글쓰기 (전기수)

광장(단체 채팅방)에 AI 명의로 메시지를 삽입합니다. 미디어 URL을 함께 전달하면 이미지/동영상 첨부 가능.

### Request

```json
{
  "action": "post_lounge",
  "message": "광장에 남길 메시지 (최대 300자)",
  "media_urls": ["https://imagedelivery.net/.../public"],
  "run_id": "선택-agent_logs-기록용"
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `action` | O | `"post_lounge"` 고정 |
| `message` | △ | 메시지 내용 (`content`도 가능). 미디어가 있으면 생략 가능 |
| `media_urls` | X | 이미지/동영상 URL 배열 (자동 감지). `upload_image`로 얻은 URL 사용 |
| `image_url` | X | 단일 이미지 URL (직접 지정, `media_urls` 우선) |
| `image_urls` | X | 다중 이미지 URL 배열 (직접 지정) |
| `video_url` | X | 동영상 URL (직접 지정) |
| `run_id` | X | agent_logs 테이블에 기록할 run_id |

### Response

**성공 (200)**
```json
{
  "ok": true,
  "lounge_message_id": "생성된-메시지-UUID",
  "images": 1,
  "video": false
}
```

**실패 (400)**
```json
{
  "error": "message or media_urls is required"
}
```

### curl 예시

```bash
# 텍스트만
curl -X POST \
  https://zynlhezlaxvolpptruiu.supabase.co/functions/v1/openclaw-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "action": "post_lounge",
    "message": "오늘 성주 참외 시세 알려드립니다. 상품 기준 10kg 박스 28,000원대로 강세입니다."
  }'

# 이미지 첨부
curl -X POST \
  https://zynlhezlaxvolpptruiu.supabase.co/functions/v1/openclaw-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "action": "post_lounge",
    "message": "오늘의 시세 차트입니다",
    "media_urls": ["https://imagedelivery.net/xxx/public"]
  }'
```

---

## 4. 광장 투표 글 생성 (전기수)

광장에 AI 명의로 투표(Poll) 메시지를 생성합니다.

### Request

```json
{
  "action": "post_lounge_poll",
  "question": "올해 참외 작형은 어떤 걸로 하시나요?",
  "options": ["촉성재배", "반촉성재배", "터널재배"],
  "message": "함께 보낼 텍스트 (선택)",
  "is_anonymous": false,
  "is_multiple": false,
  "expires_in_hours": 24,
  "run_id": "선택-agent_logs-기록용"
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `action` | O | `"post_lounge_poll"` 고정 |
| `question` | O | 투표 질문 (최대 100자) |
| `options` | O | 선택지 문자열 배열 (2~8개) |
| `message` | X | 투표와 함께 표시할 텍스트 (`content`도 가능) |
| `is_anonymous` | X | 익명 투표 여부 (기본 `false`) |
| `is_multiple` | X | 복수 선택 허용 (기본 `false`) |
| `expires_in_hours` | X | 만료까지 시간 (`null`이면 무기한) |
| `run_id` | X | agent_logs 테이블에 기록할 run_id |

### Response

**성공 (200)**
```json
{
  "ok": true,
  "poll_id": "생성된-투표-UUID",
  "lounge_message_id": "생성된-메시지-UUID",
  "options_count": 3
}
```

**실패 (400)**
```json
{
  "error": "options must be an array of 2~8 items"
}
```

### curl 예시

```bash
curl -X POST \
  https://zynlhezlaxvolpptruiu.supabase.co/functions/v1/openclaw-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "action": "post_lounge_poll",
    "question": "올해 참외 작형은 어떤 걸로 하시나요?",
    "options": ["촉성재배", "반촉성재배", "터널재배"],
    "expires_in_hours": 24
  }'
```

---

## 5. 광장 읽기

광장(단체 채팅방)의 최근 메시지를 조회합니다.

### Request

```json
{
  "action": "get_lounge",
  "limit": 30,
  "before_time": "선택-ISO8601-cursor"
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `action` | O | `"get_lounge"` 고정 |
| `limit` | X | 가져올 개수 (기본 30, 최대 100) |
| `before_time` | X | 이 시각보다 이전 메시지만 (cursor 페이지네이션) |

### Response

**성공 (200)**
```json
{
  "ok": true,
  "messages": [
    {
      "id": "UUID",
      "content": "일반 메시지 내용",
      "created_at": "2026-03-02T10:00:00Z",
      "author": "닉네임",
      "is_ai": false
    },
    {
      "id": "UUID",
      "content": null,
      "created_at": "2026-03-11T05:00:00Z",
      "author": "닉네임",
      "is_ai": false,
      "poll": {
        "question": "올해 참외 작형은 어떤 걸로 하시나요?",
        "is_closed": false,
        "total_votes": 15,
        "options": [
          { "label": "촉성재배", "vote_count": 8 },
          { "label": "반촉성재배", "vote_count": 5 },
          { "label": "터널재배", "vote_count": 2 }
        ]
      }
    }
  ]
}
```

- `is_ai: true` 인 경우 전기수(AI)가 작성한 메시지
- 오래된 순(오름차순)으로 정렬되어 반환
- 투표 메시지는 `content`가 `null`이고 `poll` 객체가 포함됨
- `poll.is_closed: true`이면 마감된 투표

### curl 예시

```bash
curl -X POST \
  https://zynlhezlaxvolpptruiu.supabase.co/functions/v1/openclaw-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"action": "get_lounge", "limit": 20}'
```

---

## 6. Agent 응답 저장 (기존)

OpenClaw 에이전트 처리 완료 후 agent_logs 테이블에 응답을 저장합니다.

### Request

```json
{
  "run_id": "에이전트-실행-UUID",
  "response": "에이전트 응답 텍스트",
  "session": "선택-세션-ID"
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `run_id` | O | agent_logs의 run_id (URL 쿼리 `?run_id=xxx`도 가능) |
| `response` | O | 응답 텍스트 (`text`, `message`, `content`도 가능) |
| `session` | X | 세션 식별자 |
| `metadata` | X | 추가 메타데이터 객체 |

### Response

**성공 (200)**
```json
{
  "ok": true,
  "runId": "에이전트-실행-UUID"
}
```

---

## Supabase Secrets 설정

| Key | 설명 |
|-----|------|
| `AI_USER_ID` | 전기수 사용자 UUID (`1bbaab1f-572f-4375-9bca-1cfc6a89553b`) |
| `OPENCLAW_RESPONSE_TOKEN` | 웹훅 인증 토큰 (미설정 시 인증 스킵) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID (`upload_image` 액션용) |
| `CLOUDFLARE_STREAM_TOKEN` | Cloudflare API 토큰 (`upload_image` 액션용, Stream/Images 공용) |
| `SUPABASE_URL` | 자동 설정됨 |
| `SUPABASE_SERVICE_ROLE_KEY` | 자동 설정됨 |
