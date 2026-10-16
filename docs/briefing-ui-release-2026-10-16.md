# 참외이야기 부분 운영 릴리스

main e1431cca1672d9b4608a6116107282a380aaea7b 기반. 원본 보안 브랜치 codex/security-cleanup-20261016(0863278)은 보존한다.

## 포함
- 홈 날씨/시세 AI 텍스트 브리핑과 관리자 생성·재생성 버튼 및 호출 경로 삭제. 실제 날씨 위젯·모달, 경매 숫자/표/차트와 번역/TTS 유지.
- 하단 종합 시세 카드·차트 viewport 근접 시 로딩.
- 오류 toast의 외부 문자열을 HTML 대신 textContent로 표시.
- 이미 검증한 호환 의존성/lockfile 정리 및 사용하지 않는 sharp 제거, node:test 명령 정리.

## 이번 배포에서 제외
KMA 서버 이전(api/weather.js/weatherService.js/vite.config.js/vercel.json), push 클라이언트 계약, 미디어 소유권/인증, 내부 자동화/웹훅 인증, link-preview 정책, 태그 쿼리 변경, 모든 Supabase 함수와 DB 정책/마이그레이션. 이 경로들은 main과 동일하게 유지한다. 기존 날씨 클라이언트 키 사용 및 미반영 서버 보안 문제는 남는다.

## 브리핑 서버 함수
브라우저 서비스/호출부는 제거하지만 generate-briefings/request-agent의 운영 함수는 이번에 폐기/배포하지 않는다. 두 함수의 별도 예약 작업은 pg_cron 조회상 비활성 또는 직접 활성 호출 없음. 외부 호출 전체를 확인하지 못했으므로 서버 폐기는 별도 조율한다. 실제 날씨·가격 수집 cron은 유지한다.

## 검증
로컬 테스트·린트·빌드, main 대비 경로 검토 후 운영 반영한다. 실제 운영 커밋/배포와 공개 번들에서 관리자 브리핑 버튼·호출 제거, 날씨/시세·번역/TTS 경로 유지를 점검한다. 로그인/쓰기/업로드/삭제/유료 Gemini 생성 호출은 하지 않는다.

최종 로컬 검증: node:test 61/61, lint, Vite build(5.82초) 통과. 브라우저 JS에서 브리핑 관리자 버튼/함수 URL/Google provider 주소 및 가짜 Gemini 키가 없음을 확인. 기존 weather 파일을 유지했으므로 가짜 KMA 표식은 예상대로 포함됨. 실제 키는 사용하지 않음.
