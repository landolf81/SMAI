# 게시글별 공유카드 · 배포 전 검토

기준: main b65e1f1 (2026-10-18 원격 확인). 독립 복사본에서 구현했으며 원본 저장소는 수정하지 않았다.

## 변경 동작

/post/:id 링크를 읽는 크롤러와 일반 브라우저의 초기 HTML에 실제 공개 게시글 제목·설명과 전용 PNG URL을 제공한다. SPA 경로 이동에서도 같은 공개 메타 API를 사용한다. 299번 글의 문구나 사진은 코드에 고정하지 않는다. 두 게시글 공유 버튼은 현재 페이지 URL 대신 해당 게시글의 정규 URL을 공유하며, 익명 공개 조회를 통과한 제목과 설명만 보낸다. 별도의 Kakao SDK나 새 키는 추가하지 않는다.

새 Node 함수 `/api/share?id=ID`는 공개 메타 JSON, `&format=png`는 1200×630 PNG를 제공한다. 기존 Edge `/api/render`는 유지한다. 기존 전역 rewrite 앞에 새 API 경로를 명시한다. 사이트 기본 OG 파일과 게시글 본문 썸네일은 교체하지 않는다.

카드는 아이보리/짙은 녹색/작은 노랑 포인트와 기존 브랜드 로고로 구성한다. 제목 길이에 맞춰 한국어 단어 경계를 우선해 줄바꿈하고 글자 크기를 조절한다. 매우 긴 제목은 이미지에서만 줄여 쓰며 메타 제목에는 실제 제목을 최대 300자까지 유지한다. 제목 없는 글은 공개 본문의 앞부분, 본문도 없으면 기본 제목을 사용한다. 사진 없는 글과 사진 실패는 동일한 브랜드형 카드로 처리한다.

## 공개 범위와 원격 이미지 보안

기존 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`만 사용한다. 서비스 키 대체, 사용자 세션이나 사용자 Bearer를 DB 조회에 전달하지 않는다. 브라우저의 같은 출처 쿠키는 Vercel Preview 인증에만 사용되며 서버 공개 조회는 항상 기존 익명 키로 수행한다. 기존 프로젝트 호스트를 고정하고 공개 posts를 직접 조회하므로 RLS를 따르며, 추가로 is_hidden/is_private=false 또는 null, status=published 또는 null을 필터한다. 필요한 열만 조회하며 작성자·프로필·위치·댓글을 읽지 않는다. 없는/숨김/비공개/삭제/초안 글은 상세 데이터 없는 404, 조회 장애는 일반 안내 503이다. 현재 스키마에는 deleted_at이 없고 삭제된 행은 없는 글로 처리한다. 보조 방어로 삭제 플래그가 있는 반환값도 거부한다.

사진은 기존 프로젝트의 Supabase `/storage/v1/object/public/posts/` 및 기존 R2 공개 호스트만 허용한다. HTTPS만 허용하며 userinfo·별도 포트·쿼리·해시·경로 우회·외부 호스트·SVG는 거부한다. 리디렉션을 따라가지 않는다. 다운로드 최대 6MiB, 4초, 디코딩 최대 3200만 픽셀을 제한하고 실제 래스터 시그니처를 검사한다. 실패하면 같은 제목의 브랜드형 PNG로 대체한다.

## 캐시

이미지 URL 버전은 템플릿 버전과 제목·설명·사진·updated_at에서 생성한다. 메타/HTML/이미지 응답 모두 no-store 정책을 사용한다. 예전 버전 이미지 URL로 요청해도 게시글을 다시 조회하고 비공개 전환 상태를 확인한다. 사이트 SW는 푸시 전용이며 fetch 캐싱을 하지 않는 것을 확인했다.

이미 다른 서비스가 수집한 카드 복사본은 서버에서 즉시 회수할 수 없다. 카카오 등에 이미 저장된 미리보기는 배포 후 해당 서비스의 재수집/캐시 초기화가 필요할 수 있다.

## 검증

- 추가 공유 테스트 20개, 전체 Node 테스트 89개 통과.
- 전체 ESLint 및 git diff --check 통과.
- Vite production build 통과. 기존 큰 번들/Browserslist 안내 외 새 빌드 오류 없음.
- 실제 익명 공개 299번 조회 성공. 실제 API PNG: 200 image/png, 1200×630, 약 538KB.
- 카카오/Facebook/Twitter/일반 브라우저 초기 HTTP 메타의 실제 제목·OG·Twitter 이미지 일치. 크롤러는 JS 실행 없이 읽을 수 있다.
- 실제 없는 ID는 HTML과 이미지 API 모두 404.
- 비공개·숨김·삭제·초안·사진 오류·긴 제목·SSRF·위장 SVG·구버전 이미지 요청은 mock 기반으로 검증. 운영 데이터를 새로 만들거나 비공개 게시글을 읽어 테스트하지 않았다.
- 맥미니 Chrome의 별도 React 검증 화면에서 299번 → 없는 글 → 목록 전환과 OG/Twitter/canonical/robots 정리를 확인했다. 전체 로그인/앱 공유 시트나 실제 카카오 전송은 실행하지 않았다.

## 배포 방법 제안 (미실행)

1. 원격 main과 원본 사용자 변경을 다시 확인하고 이 패치를 별도 브랜치에 적용한다.
2. `npm ci --legacy-peer-deps`, `npm test`, `npm run lint`, `npm run build`를 수행한다. 새 의존성 sharp는 0.34.5로 고정했다. OFL 한국어 글꼴과 라이선스를 포함한다.
3. 기존 Vercel 프로젝트의 기존 환경 변수 이름 존재 여부만 확인한다. 값은 출력하거나 변경하지 않는다. DB/Storage/RLS 변경과 새 인증정보는 필요 없다.
4. 기존 Git/Vercel 연결의 Preview 배포에서 Node용 sharp 네이티브 바이너리 및 글꼴 포함과 /api/share rewrite를 확인한다. 기존 buildCommand와 outputDirectory는 유지한다.
5. Preview에서 카카오 UA HTML, 299 PNG/HEAD, 없는 글 404, 프런트 경로 이동을 다시 검증한다. 운영 승인을 받은 뒤 기존 프로젝트의 통상 배포 절차로 반영한다.
6. 운영 반영 후 카카오 미리보기 재수집과 실제 공유 화면을 확인한다. 문제 시 이 변경 커밋을 되돌리거나 직전 Vercel 배포를 복구한다.

푸시·운영 배포는 수행하지 않았다. 기존 프로젝트의 보호된 Preview에 배포하여 Linux sharp/글꼴 및 크롤러/PNG 응답을 확인했다. 상세 결과는 별도 Preview 검증 보고서에 기록했다.

## Preview 리뷰 추가 수정

- Preview의 OG 이미지는 실제 보호된 Preview origin을 사용한다. 운영 canonical 주소는 유지하며 Host/forwarded Host에서 이미지 origin을 만들지 않는다.
- 하단 로고와 브랜드명의 실제 알파 픽셀 범위를 측정해 중심을 맞춘다. 로컬 차이 0px, Linux Preview PNG 차이 0.5px를 확인했다. 템플릿 버전은 post-card-v2다.
- Edge 호환성을 위해 공개 DB fetch는 문자열 URL과 AbortController 타이머를 사용한다. 조회 오류는 비밀 값 없는 종류/분류 코드만 기록한다.
- 보호된 Preview의 SPA HTML 셸 self-fetch는 플랫폼이 제공한 정확한 배포 origin으로 요청할 때만 기존 cookie/OIDC 헤더를 전달한다. 외부 Host에는 전달하지 않으며 리디렉션도 차단한다.
- Preview 전용 검증 스테이징에서는 기존 buildCommand 앞에 npm test를 붙여 실제 Linux에서 전체 테스트를 실행한다. 운영 패치의 buildCommand는 기존과 동일하다.

- 실제 Edge 로그에서 redirect=error 미지원(TypeError)을 확인했다. 공유 공개 조회와 SPA 셸 요청은 manual 모드와 명시적인 3xx 거부로 수정했다. 원격 사진은 Node 함수에서 redirect=error를 사용하며 어떠한 리디렉션도 따라가지 않는다.

- 보호된 Preview에서 credentials=omit 요청은 Vercel 로그인에도 차단되는 것을 확인했다. SPA와 공유 버튼은 same-origin 쿠키를 유지하며, API는 이를 DB로 전달하지 않고 익명 조회만 수행한다. 관련 실제 훅 동작 회귀 테스트를 추가했다.
