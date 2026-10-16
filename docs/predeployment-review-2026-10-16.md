# 참외이야기 배포 전 회귀·호환성 재검토

2026-10-16 · 브랜치 codex/security-cleanup-20261016 · 운영 적용/키 변경은 수행하지 않음.

## 결론

AI 텍스트 브리핑 제거와 로컬 수정은 검증했지만 **현재 브랜치를 운영 전체에 일괄 적용하도록 승인할 단계는 아니다.** 미디어 과거 소유권, push 클라이언트/함수의 동시 전환, 일부 내부 자동화 인증, 새 서버 KMA 설정을 확인해야 한다. 아래 묶음별로 운영 승인이 필요하다. 기존 DB/크론/키는 수정하지 않았다.

## 운영 읽기 대조로 확정한 사실

- www.seonnam.com은 Vercel 프로젝트 `seongjumai_2025`의 검증된 도메인이다. production deployment는 READY, framework=vite, type=LAMBDAS, Git main의 `e1431cca1672d9b4608a6116107282a380aaea7b`이다. 앞선 번들 해시 차이만으로 소스 커밋 불일치를 추정할 필요는 없어졌다. 빌드 환경 차이까지 재현한 것은 아니다.
- 운영 응답은 Cloudflare를 앞단에 두고 Vercel 헤더도 제공한다. **Vercel의 api/weather.js 서버 함수로 이전하는 구성은 맞다.** 새 명시적 /api/weather rewrite가 전체 /api/render rewrite보다 앞에 있다. 정적 Vite preview나 Cloudflare Pages에 dist만 올리는 구성에서는 이 Node API가 실행되지 않는다.
- public.post_tags에 post_id→posts(id), tag_id→tags(id) 외래키와 UNIQUE(post_id,tag_id)가 있다. post_id/tag_id는 bigint다. `filter_tags:post_tags!inner(tag_id)` 조인 경로와 필터 방식은 현재 스키마에 맞는다.
- pg_cron job 5 `update-weather-cache`는 매시간 15분에 활성. 명령에 들어 있는 JWT는 **DB 내부에서 role만 추출해 service_role 확인**. 키 원문을 반환하거나 요청에 사용하지 않았다. 현재 서버 키와의 일치·유효성은 미검증.
- job 20 `check-price-push`는 활성(52 2 * * *), Authorization/Bearer와 current_setting·service_role 이름을 참조한다. 설정값 존재/현재 서버 키 일치까지 확인하지 않았다.
- job 8 `request-agent-briefing`은 **이미 비활성**이다. 이번 조회된 pg_cron에 generate-briefings를 직접 호출하는 활성 작업은 없었다. 외부 OpenClaw/클라우드 스케줄 전체가 없다는 뜻은 아니다.
- 사용자 로컬 crontab은 읽을 수 있었으며 smai/seonnam/santi/market/briefing 관련 명령을 찾지 못했다. ~/.openclaw/cron/jobs.json은 없었다. 외부 호스트/다른 사용자/launchd의 모든 스케줄을 조사한 것은 아니다.
- public SQL 함수 중 prosrc에 send-push/check-price-push 문자열이 들어 있는 함수는 조회 결과 없었다. 테이블 레코드/메시지 등 사용자 행은 읽지 않았다.

## 재검토에서 추가 수정한 회귀와 보안

1. **관리자 DM/멘션 회귀:** 관리자는 원래 전체 푸시 경로로 먼저 분기했으나, 새 프런트의 referenceId-only payload에는 title/body가 없어 거절될 수 있었다. event-only 요청은 관리자도 일반 사용자와 동일한 DB 이벤트 검증을 거치도록 수정하고 회귀 테스트 추가. 관리자 명시적 공지와 서버 서비스 호출의 기존 title/body 계약은 유지한다.
2. **SSRF:** 링크 미리보기는 HTTPS·자격증명 없는 URL만 받는다. 서버 fetch는 정확한 호스트 허용목록(주요 SNS/네이버/다음/일부 농업 공공기관/참외이야기)으로 제한한다. redirect 매 단계도 다시 검사하고 manual redirect, 5초 timeout, 1MiB 최대 크기를 적용한다. 알 수 없는 HTTPS 호스트는 원격 호출 없이 도메인명 기본 카드로 반환한다. IP/localhost류·HTTP는 거절한다. raw oEmbed HTML 반환도 제거했다. **임의 외부 사이트의 제목/사진 미리보기가 더 이상 생성되지 않는 기능 차이**가 있으므로 이 묶음은 별도 승인 대상이다. 링크 자체는 남는다.
3. **미사용 sharp:** 모든 추적 코드/스크립트/설정에서 sharp 사용처를 찾지 못해 개발 의존성에서 제거했다. 실제 저장소 이미지 변환은 브라우저 도구/기존 서비스가 담당하며 변경하지 않았다. 작업사본에 lockfile 재설치 후 검증했다.

## 기존 미디어 삭제 정책

- 새 direct upload의 creator는 클라이언트 body가 아니라 검증된 사용자 ID로 서버가 지정한다.
- 삭제는 Cloudflare 상세조회에서 creator가 본인인지 확인한다. 관리자/기존 서비스 호출은 관리자 경로로 처리한다.
- **creator가 비어 있는 기존 이미지/영상은 일반 사용자 삭제를 거절한다.** 게시물에 URL을 붙이는 기능이 있어 ‘내 게시물에 URL이 있다’만으로 소유권을 인정하면 타인의 파일을 삭제할 수 있다. 그런 우회는 넣지 않았다.
- 새 업로드 및 삭제와 과거 파일 관리자 처리/신뢰 가능한 소유권 backfill을 확인한 후 이 묶음을 적용해야 한다. 실제 Cloudflare metadata와 token의 상세조회 권한은 읽거나 실험하지 않았다.
- 프런트 기존 삭제 실패 처리 때문에 게시물 삭제는 성공해도 과거 미디어 원본이 남을 수 있다. 이 저장공간 정리 영향을 사용자에게 알려야 한다. 이 결과는 실제 파일을 지워 시험한 것이 아니다.

## 댓글·좋아요·DM·멘션 알림 경로

- 댓글/답글: src/services/commentService.js의 createNotification → user_notifications.
- 좋아요: src/services/postService.js의 createNotification → user_notifications.
- 위 경로와 user_notifications 정책은 이번 수정에서 변경하지 않았다. 해당 일반 알림이 관리자 전용으로 바뀐 것은 아니다.
- Web Push의 일반 사용자 호출은 DM(dmService.js)과 광장 멘션(loungeService.js). 둘 다 저장 후 referenceId/userId/tag를 전송한다. 서버는 최근 5분 내 본인 이벤트·실제 수신자/멘션을 검증하고 제목·본문을 만든다.
- AdminPushNotifications의 명시적 전체 공지는 관리자 경로. OpenClaw의 서비스 호출은 기존 title/body/userId 형식 유지.
- 프런트와 send-push는 **동시 전환 필요**. 새 프런트만 먼저 배포하면 옛 함수는 title/body가 없어 거절하고, 새 함수만 먼저 배포하면 구형 프런트의 일반 사용자 payload는 referenceId가 없어 거절된다. API 버전 전환 기간/유지보수 창 없이 무중단 호환을 보장할 수 없다.
- 페이지가 열린 기존 탭/서비스워커의 옛 JS도 고려해야 한다. 배포 전 승인된 테스트 계정으로 DM/멘션 양방향 확인 및 구형 탭 갱신 안내가 필요하다.
- 전역 지속형 중복/발송 횟수 제한은 아직 없다. warm instance 중복 방지는 multi-instance 재전송을 완전히 막지 않는다.

## 태그 페이지 끝 판단

태그 필터는 post_tags inner join에 먼저 걸고 이후 range를 적용한다. 태그 없는 개인화 RPC는 유지하며, 태그 모드는 최신순+id 정렬이다. 반환된 10건이면 다음 페이지, 10건 미만이면 끝이다. 정확히 10의 배수면 마지막에 빈 페이지 요청 1회가 추가될 수 있으나 관련 글이 뒤에 있는데 중단되는 기존 문제는 피한다. 실제 사용자 게시물은 조회하지 않았고, 실제 제약조건 대조 및 mock에서 첫 비필터 페이지 뒤에 있는 20개 일치글을 두 페이지로 가져오는 경우를 검증했다. PostgREST 실행/RLS/운영 쿼리 계획은 미확인이다.

## 사용자에게 요청할 정확한 운영 적용 묶음

| 묶음 | 적용 대상 | 선행조건·기능 영향 |
|---|---|---|
| A. 웹 UI/정확성/로딩/호환 의존성 | Vercel frontend, /api/weather, 태그/DOM/차트/브리핑 제거 | 사용자가 Vercel 프로젝트의 **서버 KMA_API_KEY**를 직접 설정·검증. Node API가 실행되는 환경 필요. 키는 VITE_ 이름으로 등록하지 않음. 새 Gemini 브리핑 키는 필요 없음. 이 브랜치의 push 클라이언트 변경은 B와 함께 전환하거나 별도 release 브랜치에서 분리해야 함. |
| B. 미디어+푸시 경계 | upload-image/video, delete-image/video, send-push와 공유 모듈 + 대응 프런트 | 과거 creator 없는 파일의 관리자 처리 승인, Cloudflare 상세조회 권한 확인, 승인된 테스트 계정으로 새 업로드/본인·타인 삭제/DM·멘션 확인. A의 대응 프런트와 동시 적용. 기존 탭 영향 안내. |
| C. 내부 자동화/웹훅/미리보기 | update-weather, check-price-push, collect-market-data, collect-youtube-videos, sync-pesticide-data, telegram-notify, openclaw-response, link-preview | 각 실제 cron/수집 봇의 현재 service credential 계약 확인. 콜백 발신자가 기존 OPENCLAW_RESPONSE_TOKEN을 보내는지 확인. 미설정이면 503. 링크 미리보기의 제한된 호스트 정책 승인. 인증 설정 변경이 필요하면 별도 승인 후 사용자 처리. |
| D. AI 브리핑 생성 중단 | generate-briefings/request-agent의 410 소스 및 관련 외부 스케줄 | pg_cron 날씨 AI job8은 이미 꺼져 있음. 외부 예약 작업 존재 여부 확인 후 필요한 항목만 중단 승인. 실제 날씨 update-weather/경매 수집은 중지하면 안 됨. 저장 브리핑 DB 삭제는 요청 범위 아님. |
| 보류: DB 정책 | docs/security/rls-draft.sql | fixture DB 검증과 별도 migration 승인 필요. market_alerts.integer 사용자 ID 매핑, 익명 투표의 서명된 식별 계약, users 개인정보 컬럼 분리 등 미완료. 이번 묶음에 포함해 자동 적용하면 안 됨. |

전환 전에는 운영 commit/deployment ID와 현 Edge Function 버전을 기록하고, 웹/함수 각각 이전 버전으로 되돌릴 경로를 준비해야 한다. 롤백하면 기존 보안 문제도 다시 나타난다. 어떤 운영 변경도 이번 작업에서 실행하지 않았다.

## 남아 있던 high 7개 패키지의 실제 경로

재검토 전 7개 중 sharp는 제거했다. 현재 **high 6 / moderate 4 / critical 0, 총 10개**다.

| 기존 high 항목 | 실제 설치/사용 경로 | 판단 |
|---|---|---|
| brace-expansion 2.0.2 | @tanstack/eslint-plugin-query → @typescript-eslint/utils → typescript-estree → minimatch 9 → brace-expansion | 개발 lint의 glob 처리. 브라우저 사용자 입력이 직접 이 Node 코드를 실행하는 경로는 확인하지 못함. |
| braces 3.0.3 | Tailwind → micromatch/fast-glob, Tailwind → chokidar → braces | CSS build/watch glob. |
| chokidar 3.6.0 | Tailwind → chokidar | 개발 파일 감시. |
| fast-glob 3.3.3 | Tailwind → fast-glob | 빌드 시 content 파일 탐색. |
| micromatch 4.0.8 | Tailwind → fast-glob → micromatch 등 | 빌드 패턴 처리. |
| tailwindcss 3.4.19 | postcss.config.js의 Tailwind 플러그인. react-daisyui peer 경로도 존재 | dev:false 표기만으로 서버 런타임 실행이라 단정하지 않음. 이 앱은 빌드한 CSS를 제공. 4.x 전환은 UI 회귀 검토 필요. |
| sharp 0.34.5 | 직접 devDependency였으나 추적 소스/스크립트 사용처 없음 | 이번 추가 검토에서 제거. |

나머지 moderate 중 react-router/react-router-dom은 실제 브라우저 라우팅 경로다. 7.x 전환은 따로 검증해야 한다. 위 high들은 개발/빌드 입력에 대한 위험이므로 신뢰하지 않는 소스/패턴을 실행하는 CI에서도 주의가 필요하며, 운영 사용자 대상 침해가 입증된 것은 아니다. npm explain과 보안권고를 읽기 조회했고 강제 major update는 하지 않았다.

## 키에 관한 사용자 단계

- 날씨: 사용자가 현재 유효한 공공데이터포털 키를 직접 확인한 뒤 Vercel 해당 프로젝트의 서버 KMA_API_KEY에 설정. 실제 값을 채팅·코드·VITE_ 환경변수에 넣지 않는다. 이번 작업에서 기존 키를 복사·전송·등록하지 않았다.
- 브리핑: 두 기능은 제거했으므로 새 Gemini 키 등록이 필요 없다. 기존 공개 키의 활성/차단 여부는 별개로 AI Studio에서 사용자가 확인. 키 원문은 보내지 않는다.
- 번역/TTS: 기존 서버 GEMINI_TRANSLATION_API_KEY 등은 이번 삭제 범위 밖이며 변경하지 않았다.
- 미디어/웹훅: 기존 환경변수 이름을 그대로 사용한다. 실환경의 누락/권한/발신 계약 확인이 필요하며 새 비밀값 생성·이동은 하지 않았다.

## 검증과 한계

재검토 후 **79/79 mock·회귀 테스트, lint, build가 통과**했다. 빌드는 5.87초였으며 실사용 로딩 시간 측정이 아니다. 실제 키를 제공한 API 호출·운영 글쓰기·파일 업로드/삭제·푸시 발송은 하지 않았다. Deno entrypoint는 원격 모듈을 external로 둔 로컬 번들 검증이며 실제 Deno 배포 런타임·provider 권한 검증이 아니다. RLS 초안은 실제 PostgreSQL fixture에서 실행하지 않았다. 실제 기기 LCP/INP/CLS·구형 탭 동시 전환·운영 provider 오류·함수별 secret 상태는 미확인이다. 따라서 mock 통과를 운영 승인/무중단 보장으로 표현하지 않는다.

공식 문서와 연결된 Vercel/Supabase 메타데이터를 사용했다. 추가 브라우저 조작이나 운영 변경은 하지 않았다.
