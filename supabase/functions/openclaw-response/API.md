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

## 1. AI 댓글 작성 (참외돌이)

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

**실패 (400)**
```json
{
  "error": "post_id and comment are required"
}
```

**실패 (500)**
```json
{
  "error": "에러 메시지"
}
```

### curl 예시

```bash
# 최상위 댓글 작성
curl -X POST \
  https://zynlhezlaxvolpptruiu.supabase.co/functions/v1/openclaw-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "action": "post_comment",
    "post_id": "abc12345-1234-5678-9abc-def012345678",
    "comment": "참외 농사에 도움이 되는 정보네요!"
  }'

# 답글 작성 (특정 댓글에 대한 답글)
curl -X POST \
  https://zynlhezlaxvolpptruiu.supabase.co/functions/v1/openclaw-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "action": "post_comment",
    "post_id": "abc12345-1234-5678-9abc-def012345678",
    "comment": "좋은 질문이에요! 참외는 보통 4월에 정식합니다.",
    "parent_id": "부모댓글-UUID"
  }'
```

---

## 2. Agent 응답 저장 (기존)

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
| `AI_USER_ID` | 참외돌이 사용자 UUID (`1bbaab1f-572f-4375-9bca-1cfc6a89553b`) |
| `OPENCLAW_RESPONSE_TOKEN` | 웹훅 인증 토큰 (미설정 시 인증 스킵) |
| `SUPABASE_URL` | 자동 설정됨 |
| `SUPABASE_SERVICE_ROLE_KEY` | 자동 설정됨 |
