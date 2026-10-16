# 참외이야기 보안·정확성 정리 (2026-10-16)

## 현재 범위

별도 브랜치 `codex/security-cleanup-20261016`에서 로컬 소스만 수정했다. 원본 main/사용자 미추적 문서 보존. push, 배포, 운영 DB/정책/크론 변경, 키 생성·복사·설정·폐기는 하지 않았다. 실제 키를 신규 요청에 담아 유효성을 검사하지 않았다. 공개 번들 포함과 현재 활성 여부는 별개이며, 활성 상태는 미확정이다.

## 완료한 변경

- **사용자 최신 요청: 날씨·공판장 AI 텍스트 브리핑 제거.** 홈·시세 페이지의 상태/조회/생성/공유 배너/관리자 생성 버튼, WeatherModal의 텍스트 브리핑을 제거. 관련 클라이언트 서비스와 프롬프트·게이트웨이 코드도 제거했다. 실제 WeatherWidget/WeatherModal 수치, 경락표/경매 데이터, 시세 공유 유틸의 가격 데이터, 차트는 유지한다. 번역/TTS 게이트웨이·히스토리·음성은 변경하지 않았다.
- `generate-briefings`, 날씨 전용 `request-agent`의 로컬 엔드포인트를 410 응답으로 종료해 향후 배포 후에도 생성 호출/DB 쓰기를 하지 않게 했다. 운영 배포본·저장 브리핑·cron은 그대로 남아 있으므로 이 소스 변경만으로 현재 운영 생성이 중단되는 것은 아니다.
- 기상청 직접 fallback은 `/api/weather`로 통일. 키는 **서버 `KMA_API_KEY`**만 사용한다. provider path/쿼리 매개변수 허용목록, 중복/클라이언트 serviceKey 거절, timeout, 정상 응답 CDN 캐시, 오류 정제 추가. VITE_KMA_API_KEY 참조와 raw dev proxy 제거.
- 미디어 함수는 검증된 Auth 사용자와 admin_roles를 확인한다. 새 direct upload에 **서버에서 creator를 지정**하며, 삭제 시 Cloudflare의 creator와 사용자 ID를 비교한다. 요청 body의 owner·사용자가 첨부한 공개 URL은 소유권으로 믿지 않는다. 업로드 TTL/크기 메타데이터/영상 최대 길이 검사와 ID 형식 검증 추가.
- `send-push` 전체 발송은 관리자/서비스 호출만 허용. 일반 사용자의 DM/mention 알림은 저장된 최근 본인 메시지 referenceId로 확인해 제목/본문/수신자를 서버에서 만든다. 작성자·수신자·멘션·5분 유효시간 검사. 동일 warm instance 이벤트 중복 방지. 프런트도 referenceId를 전송하도록 수정.
- 수집/동기화/날씨갱신/Telegram/시세푸시 내부 함수는 기존 service-role Bearer만 허용. 브라우저 anon 키는 내부 작업을 시작할 권한이 없다. OpenClaw 응답은 토큰 미설정이면 503, 불일치면 401이며 토큰 일부/본문 로그 제거.
- 태그를 post_tags inner join으로 **DB에서 필터한 후** 페이지 제한. 태그 모드는 최신순으로 정렬하며 동일 시각은 id로 안정화. 태그 없는 개인화 피드는 기존 RPC 유지.
- 외부 오류문구의 innerHTML 보간을 제거하고 textContent로 삽입. 정적 토스트 마크업·상수 클래스는 유지.
- 홈 하단 종합카드는 300px 근처에 접근할 때 동적 로드. 실제 차트 기능·데이터는 유지. 기본 `npm test`는 node:test 회귀군 실행.
- `npm audit fix --package-lock-only`를 호환 버전 범위에서 수행하고 작업사본에 새 lockfile을 `npm ci --ignore-scripts --legacy-peer-deps`로 설치했다. 원본 node_modules를 수정하지 않았다. Supabase는 기존 설치 버전 2.88.0으로 고정. AWS SDK는 R2 마이그레이션 스크립트가 사용하므로 무작정 삭제하지 않았다.

## 배포 전 반드시 확인할 계약/영향

1. `/api/weather`에 새 서버 변수 `KMA_API_KEY`가 필요하다. 실제 비밀값은 설정/복사하지 않았다. `.env.example`에는 빈 항목과 설명만 있다. 없으면 503으로 거절하며 브라우저 서비스의 기존 DB cache/fallback 경로를 사용한다. plain Vite는 /api 핸들러를 실행하지 않으므로 로컬 API 통합은 Vercel dev 또는 배포 전 격리 환경에서 검증해야 한다.
2. **기존 Cloudflare 파일에 creator가 없으면 일반 사용자 삭제가 거절된다.** 새 업로드는 creator가 있으므로 본인 삭제 가능. 기존 파일은 관리자 처리 또는 승인된 소유자 검증/backfill 계획이 필요하다. 실제 provider metadata·토큰 Read 권한은 조회하지 않았다. 공개 게시물 URL을 붙일 수 있으므로 게시물의 URL 일치만으로 삭제를 허용하는 우회는 넣지 않았다.
3. push frontend와 function은 referenceId 계약을 함께 배포해야 한다. admin/service payload는 기존 `{title,body,url,userId?}` 유지. 일반 사용자 payload는 `{tag:'dm'|'mention',referenceId,userId}`. DB event/필드가 없거나 오래됐으면 거절한다. **전역 지속형 rate limit·중복 방지는 미완료**이며 multi-instance replay를 완전히 막는다고 주장하지 않는다. 별도 저장소/RPC와 스키마 승인이 필요하다.
4. 내부 cron/봇이 service-role Bearer를 쓰는지 운영 설정을 대조해야 한다. anon 키를 사용하는 기존 작업은 새 경계에서 거절된다. 스케줄 credential 또는 권한 변경은 수행하지 않았다. 공개 브라우저 호출을 허용하는 폴백도 넣지 않았다.
5. OpenClaw 콜백 발신자가 기존 OPENCLAW_RESPONSE_TOKEN을 전송하고 있는지 확인이 필요하다. 값은 조회·이동·설정하지 않았다. 비밀값 미설정 시 이전처럼 검사를 생략하지 않는다. webhook timestamp/replay 보호는 별도 개선 후보다.
6. 운영 AI 브리핑 생성의 완전 중단은 별도 승인으로 generate-briefings/request-agent 배포본·관련 cron/외부 OpenClaw 스케줄을 중지/정리해야 한다. 날씨 갱신·시세 수집 스케줄과 혼동하면 안 된다. 운영 저장 데이터는 삭제하지 않았다.

## 운영 메타데이터 읽기 확인과 보류 항목

2026-10-16 Supabase 연결 프로젝트 ref와 로컬 project-ref를 대조한 후 pg_policies/columns, 함수 목록만 조회했다. 사용자 행은 조회하지 않았다.

- delete-image/delete-video: verify_jwt=false. 실제 배포 소스의 동일성까지 확인한 것은 아니나 로컬 패치가 필요한 경계다.
- trade_items/market_alerts의 넓은 인증 조건, 익명 poll 삭제 조건, DM UPDATE 조건은 실제 운영 정책에도 존재.
- market_alerts.user_id는 **integer**, Auth/users ID는 UUID. 단순 UUID 소유권 정책을 적용할 수 없다. 승인된 매핑/데이터 마이그레이션 필요.
- users.role은 실제 컬럼 목록에도 없다. admin_roles를 권한 기준으로 사용. users의 공개 SELECT와 민감 컬럼 분리는 소비자 목록/컬럼 GRANT 검토가 필요하다.
- `docs/security/rls-draft.sql`은 운영 스키마와 대조한 trade_items/DM 초안이다. migrations 디렉터리에 넣지 않았으며 마지막에 ROLLBACK한다. **실제 PostgreSQL fixture에서 아직 실행하지 않았다.** 문법·권한·관리자 업무 영향 확인 후 승인된 migration으로 승격해야 한다.
- 익명 투표는 신뢰할 수 있는 서명된 익명 식별 API/UI 동시 변경이 필요하므로 기존 정책을 로컬에서 임의로 무력화하지 않았다.
- 재검토에서 link-preview는 정확한 호스트 허용목록·redirect 검사·크기/시간 제한으로 추가 보강했다. 임의 외부 호스트는 기본 링크 카드만 제공한다. users 컬럼 분리, 전역 rate limit, R2 Worker 서버 권한, CSP/대표 도메인 정리는 아직 미완료다.

## 의존성 남은 항목

최초 감사 50개(critical 1/high 20/moderate 28/low 1)에서 호환 범위 패치 후 critical은 0개. 남은 정확한 수는 감사 폴더 cleanup-npm-audit.json 참조. Tailwind 4·React Router 7·sharp 0.35 등 주요/호환성 변경이 필요한 제안은 force 적용하지 않았다. 현재 UI/라우팅 영향 검증을 별도 작업으로 해야 한다. 재검토에서 추적 소스 사용처가 없는 sharp는 제거했다. 개발 의존성과 실제 운영 공격 도달성은 구분한다.

## 로컬 검증

- 회귀·mock 테스트: npm test. 실제 키·운영 API/DB 호출 없음.
- lint: npm run lint. 자동수정 없음.
- build: npm run build -- --configLoader native. 실제 .env 복사 없이 공개 설정/키에 합성 canary 문자열을 사용한 빌드로 키 포함 부재 확인.
- Edge 함수는 원격 의존성을 external로 두고 전 entrypoint를 로컬 번들링. Deno 실런타임·Cloudflare 업로드·푸시 실발송 검증은 하지 않음.
- 운영 배포 가능하다는 확인이 아니라, 배포 전 계약 확인이 남아 있는 로컬 변경이다.
