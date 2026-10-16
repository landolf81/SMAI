# 승인된 DB·푸시 릴리스 — DB 및 함수 적용 확인

## 맥미니 OpenClaw 재개 결과 (2026-10-16)

- 정상 apply_migration 성공. 실제 migration version **20261016161714**, name approved_db_push_boundaries_20261016. 중복 실행 금지.
- 준비 version 20261016043829와 달리 도구가 실제 적용 시각으로 기록했으므로 로컬 migration 파일명을 실제 version에 맞춤. SQL 내용은 SHA256 b2f3bb711b0978f8f23c757374f8010f9c287b017e44c8fad3cc4692effb8e3a로 동일. 원본은 외부 db-push-backup-20261016에 보존. fixture 참조 경로만 변경.
- 운영 PostgreSQL17.6에서 새 정책·함수·ACL·trigger 확인. 임시 fixture rollback 검사 통과, quota fixture 잔존0. 운영 trade 정책식을 임시 fixture에 복제하여 본인 INSERT/UPDATE/DELETE 허용 및 타인 거부 확인. 실제 사용자 쓰기/테스트 알림 없음.
- send-push **version20 ACTIVE**, verify_jwt=true. entrypoint 및 공유 파일5개가 로컬과 byte 일치. 무인증 호출401 확인.
- node tests69/69, lint, build, 로컬 migration fixture12/12 재검증 통과. 빌드의 기존 큰 chunk 경고는 남음.
- main push 및 Vercel 배포의 최종 SHA/status는 외부 openclaw-db-push-result-20261016.md에 기록한다.
- 제외 범위 및 사용자 untracked 문서를 보존. 기존 인증만 사용하며 새 자격증명은 설정하지 않음.

아래는 이전 차단 당시 기록이며 현재 적용 상태가 아니다.

# 승인된 DB·푸시 릴리스 — 실행 도구 오류로 미적용

사용자가 2026-10-16 04:34 UTC에 승인한 구독 본인 조회·메시지 신원/시각 보호·프로필 관리 상태 보호·거래 소유권·서버 quota·구형 화면 호환 push만 main a7bd73e에서 분리했다. 미디어/KMA/프로필 읽기 컬럼/투표/market_alerts/내부 자동화 변경은 포함하지 않는다.

## 실행 상태

- Supabase apply_migration의 approved_db_push_boundaries_20261016을 정상 도구 경로로 두 번 시도했으나 Invalid or expired requestState로 종료. 미적용을 재확인한 뒤 메인 대화 지시에 따라 새 요청을 한 번 제출했으나 같은 오류(-32602, INVALID_ARGUMENT, reason=invalid_request_state). 추가 재시도 중단.
- 새 요청도 종료됐고 활성 functions.exec cell 없음. 제공된 도구에 별도 manager 승인 요청 상태 조회 API는 없어 네이티브 승인 카드의 pending 여부를 독립 확인할 수 없다.
- 세 차례 요청 뒤 read-only catalog 검증: security_runtime 없음, quota RPC/두 guard/count RPC 없음, 이전 구독 전체 SELECT 정책 유지. list_migrations에도 새 항목 없음. **DB 적용 성공으로 표시하면 안 됨.**
- send-push 배포, main 병합/push, Vercel 운영 배포 모두 미실행. DB가 없는데 새 함수를 먼저 배포하면 quota503, 새 화면만 먼저 배포하면 count RPC 부재/구형 push 계약 문제가 있어 연쇄 반영을 중단했다.
- 기존 작업 승인은 유지된다. 같은 만료 요청을 기다리거나 SQL 도구/CLI의 다른 경로로 권한 승인을 우회하지 않는다. 앱/커넥터의 쓰기 실행 승인 상태를 복구한 뒤 정상 apply_migration 경로에서 재개해야 한다. 새 연결/키 설정은 하지 않았다.

## 준비 자료

- migration: supabase/migrations/20261016043829_approved_db_push_boundaries_20261016.sql. 공식 Supabase CLI 2.121.0 migration new로 생성. 영구 DDL은 아직 원격 적용하지 않음.
- 함수: send-push + _shared/authorization,pushAuthorization,securityQuota,pushEndpoint,requestBody. verify_jwt=true 유지 예정. old/new 사용자 요청을 canonical DB 이벤트로 검증, 동일 eventKey와 durable quota 사용. 실제 발송 테스트 없음.
- 화면 계약: dmService/loungeService referenceId와 관리자 구독자 수 aggregate RPC. source diff 외 항목은 main과 동일.
- 승인된 SQL에서 초안의 unrelated market_alerts/table-level DDL privilege 정리는 제외. quota는 push-event/push-direct/push-broadcast 범위만 허용.
- 프로필 guard는 기존 admin_roles RLS의 is_admin 함수가 search_path를 상속하는 점을 실제 소스로 확인해 pg_catalog,public 고정 경로 사용. anon/authenticated가 public에 CREATE할 수 없음 확인. 기존 is_admin 함수 자체는 변경하지 않음.
- 임시 테이블/rollback 진단 SQL: docs/security/approved-db-push-rollback-check.sql. 실제 사용자 테이블에 테스트 레코드를 쓰거나 환영/외부 알림을 유발하지 않도록 구성. 이 진단은 격리에서만 실행했고 운영에서는 미실행.
- 검증 스크립트: scripts/verify-db-push-release.mjs (로컬 PGlite dist/index.js를 인자로 받아 메모리 DB만 생성).

## 재개 순서

1. 운영 카탈로그·migration 기록 재조회. 이미 적용됐다면 재실행 금지하고 정의/권한 비교부터 한다.
2. 승인 도구 상태가 정상화되면 같은 SQL을 apply_migration으로 적용. 요청 상태가 불확실하면 읽기로 확인. 새 user 승인 카드가 나타나면 그 실행 승인을 기다림.
3. 정확한 SQL/ACL/guard/정책을 조회하고 rollback-check SQL로 임시 fixture·quota 검사(실 사용자 알림0).
4. send-push와 다섯 공유 파일만 배포, verify_jwt=true. 로그/정의·비인증 거절 확인. 실제 사용자 push 금지.
5. 테스트/빌드 후 main FF·일반 push, Vercel production READY와 커밋·별칭 확인. 공개 홈·날씨/가격·번역 유지, push 호출 계약/관리자 count RPC·새 코드 번들 확인.
6. 최종 git 원격/운영/DB migration 이름과 결과를 기록. 실패하면 leaf 기능을 일시 중단해 수정하며 기존 전체 권한을 재개하지 않음.

## 보존·검증

별도 감사 폴더 ../db-push-backup-20261016/catalog-before.json에 기존 정책·관련 함수 정의/ACL·비밀값 없는 trigger/column 메타데이터를 보존했다. notify-new-user webhook trigger의 인자 등 credential 가능 정보는 제외했고 키·JWT literal 패턴도 확인했다. send-push-before.json에 기존 함수 코드를 보존했다. 백업은 Git 추적하지 않음.

정확한 릴리스 소스는 node:test69/69, lint, build 통과. 실제 운영 관리자 RLS/is_admin 정의 및 실제 send_welcome_dm 함수를 넣은 PGlite12개 검증 통과. 본인/타인/수신자·관리자·서비스·quota·rollback 검사 포함. 실제 soft_delete_user 원본은 실행하지 않았고 종전 surrogate만 기본 호환 테스트에 사용했으므로 탈퇴가 운영에서 정상이라고 보장하지 않음. 로그는 감사 작업폴더의 db-push-release-{tests,lint,build,fixtures}.log.

## 별도 발견: 탈퇴 RPC 보안/정확성

public.soft_delete_user(uuid)는 SECURITY DEFINER/postgres 소유이며 anon/authenticated 모두 EXECUTE 가능. 기존 정의에 대상=auth.uid 검사가 없고 search_path=''에서 users/verification_requests를 schema 없이 참조한다. 인가 경계와 정상 탈퇴 실패 가능성이 있다. 실제 계정을 대상으로 호출하지 않았으며 데이터 변조 실험 없음. 현재 승인된 guard 적용으로 이 RPC까지 해결된다고 표현할 수 없다. RPC 수정(본인/검증 관리자 대상 제한·익명 EXECUTE 회수·테이블명 한정)은 별도 대상과 회귀 검증/승인 후 처리해야 하며 이번 migration에서 변경하지 않았다.
