# 번역기 Gemini 서버 이전

번역과 음성 생성을 같은 사이트의 `/api/translation` Vercel Node 함수에서 처리한다. 브라우저에 Gemini 키나 서명 비밀을 전달하지 않는다. 번역기 외 AI 브리핑 서비스는 이번 변경 범위에 포함하지 않는다.

## 동작과 호환

- 한국어·라오어·베트남어·태국어 번역과 역번역을 유지한다. 번역 모델 기본값은 `gemini-3.8-flash`, 서버 allowlist 안에서 `gemini-flash-latest`도 선택 가능하다.
- 번역 성공 약500ms 후 음성을 자동 생성한다. 모델 기본값은 `gemini-3.8-flash-tts`, 선택 가능한 대안은 `gemini-3.8-flash-lite-tts`다. voice 기본 Kore, 허용 Kore/Puck/Aoede.
- Interactions REST에 WAV/24kHz를 요청하고 응답 base64의 RIFF/WAVE 컨테이너를 검증한다. raw PCM을 WAV/MP3로 잘못 표시하거나 이중 헤더를 붙이지 않는다. 최대3MB, 음성 출력 최대2000 tokens, 번역 출력 최대8192 tokens.
- 새 기록은 `.wav`/`audio/wav`, 기존 MP3/audio_url도 재생 가능하다. 회원은 텍스트 기록을 먼저 저장하고 음성이 성공하면 소유자 확인 RPC로 audio_url만 연결한다. 음성 실패는 번역·텍스트 기록을 취소하지 않는다. 기존 R2 저장 및 최대100건 기록 동작을 유지한다. 게스트는 영구 번역 기록을 저장하지 않는다.
- 같은 번역 UUID에 음성을 연결하고 소유자·번역문·언어 fingerprint를 검증한다. 동시 TTS는 같은 Promise를 공유하며 완료된 요청은 캐시에서 재사용한다. 진행 중 요청은409, 실패한 요청은 다시 공급자를 호출하지 않는다. timeout에도 자동 재시도하거나 예약 횟수를 반환하지 않는다.
- 결과 모달의 재생 실패는 사용자에게 알리고 오디오 참조를 해제한다. 캐시 재생은 새 음성 생성이 아니다. 브라우저 재생 성공/소리 전달/발음 품질은 생성 완료 상태와 별도로 확인해야 한다.

## 승인된 운영 기본 한도

| 항목 | 기본값 |
| --- | ---: |
| 게스트 입력 | Unicode100자/회 |
| 게스트 사용 | 3묶음/일, 3묶음/시간, 3묶음/분 |
| 공유 IP의 게스트 사용 | 30묶음/일 |
| 회원 입력 | 5000 UTF-16 code units/회 |
| 회원 사용 | 100묶음/일,20묶음/시간,6묶음/분 |
| 음성 대상 번역문 | Unicode300자/회 |
| 전체 사용 | 250묶음/일 |

한 묶음은 번역1+음성1이며 시작 시 전체 카운터에 공급자 호출2단위를 미리 예약한다. 전체 기본500단위는 최대250묶음이다. 음성을 사용하지 않거나 실패해도 예약은 반환하지 않는다. 이는 요청/문자수 상한이며 금액 상한이 아니다. 일일 카운터는 UTC00:00, 한국시간09:00에 초기화한다. 시간/분 카운터도 UTC 달력 구간 기준이다.

환경 변수로 조정 가능: `TRANSLATION_GUEST_CHARS=100`, `TRANSLATION_GUEST_DAILY=3`, `TRANSLATION_GUEST_IP_DAILY=30`, `TRANSLATION_MEMBER_DAILY=100`, `TRANSLATION_MEMBER_HOURLY=20`, `TRANSLATION_GLOBAL_DAILY=500`, `TRANSLATION_AUDIO_CHARS=300`. 설정이 없으면 위 기본값을 사용하며 범위를 벗어난 값은 설정 오류로 차단한다.

## 서버 설정과 비밀 관리

사용자 직접 설정 목적지: Vercel의 `jeong-byeonggeuns-projects / seongjumai_2025` → Settings → Environment Variables. 운영에는 Production 대상 적용이 필요하며 변경 후 새 배포가 필요하다. 값은 채팅·소스·로그에 넣거나 환경파일로 다운로드하지 않는다.

필수 서버 전용 변수:

- `GEMINI_TRANSLATION_API_KEY`: 정상 계정의 Gemini 키. 어떤 `VITE_*` 변수로도 복사하거나 fallback하지 않는다.
- `TRANSLATION_COOKIE_SECRET`: 쿠키 서명·회원/게스트 ID·IP HMAC 해시용 충분한 무작위 비밀, 최소32자. 사용자가 직접 생성·입력한다.
- `TRANSLATION_RPC_SECRET`: DB gateway HMAC 서명용 별도 충분한 무작위 비밀, 최소32자. 사용자가 Vercel과 Supabase Table Editor의 `translation_private.settings.signing_secret`에 동일하게 직접 등록한다. 쿠키 비밀과 분리하고 실제 비밀 등록 SQL을 파일로 저장하지 않는다.

Supabase URL/anon 키는 공개 설정이다. 기존 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 서버에서도 재사용하므로 중복 등록이 필요 없다. 별도 `SUPABASE_URL`, `SUPABASE_ANON_KEY`가 있으면 각각 우선 사용한다. URL은 앞뒤 공백·끝 슬래시를 정규화하며 HTTPS의 단일 프로젝트 `*.supabase.co` 루트만 허용한다. 사용자정보·별도 포트·하위 경로·쿼리·fragment는 거부한다. 잘못된 명시 URL이 있으면 다른 프로젝트로 조용히 fallback하지 않는다.

`SUPABASE_SERVICE_ROLE_KEY` 및 새 광범위 DB 역할은 필요 없다. 선택 변수 `GEMINI_TRANSLATION_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_TTS_VOICE`는 위 allowlist 내 값만 허용한다.

## 인증·사용량·DB 보존

- 게스트는 서버 서명 HttpOnly/Secure/SameSite 쿠키로 구분한다. 기존 client localStorage ID는 유료 API 권한으로 신뢰하지 않는다. Vercel이 덮어쓰는 단일 IP 헤더만 신뢰하며 원본 IP를 저장하지 않는다. 공유 IP 제한은 NAT 사용자를 함께 제한할 수 있고 VPN·분산 봇을 완전히 구분하지 못한다.
- 회원 access token은 Supabase `/auth/v1/user`로 검증한다. 잘못된 토큰을 게스트로 낮추지 않으며 anonymous auth 세션은 거부한다.
- `supabase/migrations/20260930_translation_quota.sql`: 비공개 settings/nonces/counters/jobs4개 테이블과 제한 RPC를 정의한다. 서버 HMAC이 정확한 전송 문자열·60초 timestamp·nonce를 검증한 뒤에만 gateway를 실행한다. transaction advisory lock으로 quota/job 상태를 직렬화한다.
- `translation_private`의 schema/table 접근은 anon/authenticated에 차단된다. `public.translation_gateway(text,text)`는 두 역할에 실행 권한이 있으나 유효한 서버 HMAC 없이는 처리하지 않는다. `attach_translation_audio(uuid,text)`는 authenticated 소유자의 audio_url만 수정한다. 두 함수는 SECURITY DEFINER, 빈 search_path를 사용한다.
- 요청 원문은 임시 jobs에 저장하지 않는다. 해시화한 소유자/IP·요청 fingerprint·횟수·nonce·상태를 저장하며, 번역 결과와 WAV base64는 중복 과금 방지용15분 캐시다. 만료 후 재사용 불가. 기존 회원 영구 번역 기록은 이전 기능과 동일하게 원문을 포함할 수 있다.
- `supabase/migrations/20260930_translation_cleanup_optional.sql`: 승인된 pg_cron 작업이5분마다 만료 내용을 삭제한다. 내용 보존은 대략 최대20분+스케줄 지연이며, 내용 없는 중복 방지 tombstone/카운터는25시간+정리 지연까지 유지한다. nonce는2분 후 정리한다.15분 접근 차단과 물리 삭제는 다르다.
- migration과 cron은 사용자 승인 후 브라우저 담당자가 실제 적용했다.4개 테이블, 제한 권한, SECURITY DEFINER/search_path, 비밀 행 존재 및 cron 첫 실행 성공을 확인했다. mock 검사와 실제 DB 검증을 구분하며 모든 quota 동시성/nonce replay 시나리오를 실DB에서 검사한 것은 아니다.

## 검증 및 범위

Protected Preview에서 한국어→라오어와 라오어→한국어 각1문장의 번역·역번역·자동TTS를 검증했다. jobs2건이done/done이고 UI 캐시 재생 상태를 확인했다. 추가 유료 재시도는 없었다. 실제 청구액과 실제 청취·라오어 발음 품질은 확인하지 않았다. 로컬 WAV fixture, 인증·실패·캐시·기록·재생 거절 mock 회귀검사를 별도로 수행했다.

시험용 Preview의 정적 라우팅과 설정 진단 파일은 `/tmp` staging에만 있으며 운영 코드에는 포함하지 않는다. 운영은 기존 `/api/render` SEO 라우팅을 유지한다. 운영 유료 추가시험은 별도 승인 대상이다.

번역기 외 `briefingService.js`, `weatherBriefingService.js`는 기존 `VITE_GEMINI_API_KEY` 브라우저 호출을 유지한다. 새 서버 키를 그 변수에 넣지 않는다. Azure 자격증명은 삭제/revoke/변경하지 않았으며 과거 키 밴 원인은 미확인이다. 의존성 버전 변경은 없다.

공식 확인 자료:

- https://ai.google.dev/gemini-api/docs/speech-generation — Interactions REST, 라오어, 기본 WAV
- https://ai.google.dev/gemini-api/docs/models — 모델/endpoint 지원
- https://ai.google.dev/gemini-api/docs/pricing — 계정별 과금/무료 쿼터는 별도 확인
- https://vercel.com/docs/headers/request-headers — 신뢰할 Vercel IP 헤더
