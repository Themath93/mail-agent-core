# Outlook 로컬 업무 자동화 에이전트

Microsoft Graph API 기반으로 Outlook 메일과 첨부 파일을 로컬에서 동기화하고, 근거(Evidence) 기반 투두를 생성·업데이트하는 개인용 자동화 시스템입니다.

## 프로젝트 개요

- **범위**: Chrome Extension + Native Host(MCP/Local API) + 문서 분석 파이프라인
- **저장 원칙**: 데이터와 분석 산출물은 기본적으로 로컬(SQLite/파일시스템)에 저장
- **핵심 기능**: 메일 동기화, 첨부 분석, 근거 링크(Deep Link), 투두 자동화, 검색/타임라인 추적
- **현재 상태**: `pm_notes/outlook_mail_agent_prd_v0_2.md`, `pm_notes/outlook_mail_agent_specs_v0_2.md`, `pm_notes/outlook_mail_agent_detailed_plan_v0_2.md`를 기반으로 진행

## 사용 가이드(초안)

- 사용자 사용 설명서: `docs/chrome-extension-user-guide.md`
- 설치 가이드: `docs/install-guide.md`
- 크롬 확장 로드 경로: `extension/`

### 실행 흐름

1. Chrome Extension은 인증/동기화 UI와 사이드 패널을 제공
2. Native Host가 Graph OAuth2 PKCE로 로그인 및 토큰 갱신 수행
3. 초기 동기화 + Delta Sync로 메일/첨부를 로컬에 반영
4. 첨부 분석 결과를 Evidence로 남기고 투두 생성/갱신
5. 검색·근거 이동 기능으로 이력 검증

## 브랜치 정책

- `main`은 운영 브랜치입니다.
- 기능 개발은 반드시 **새 브랜치**에서 시작하고, `main`으로 PR을 올립니다.
- 브랜치 명은 `feat/<short-topic>` / `fix/<short-topic>` / `chore/<short-topic>` 형태를 권장합니다.

## 병합/릴리즈 원칙

- `main`으로 병합할 때는 반드시 **버전 라벨**을 명시합니다.
- PR 제목/본문·릴리즈 노트에는 버전, 핵심 변경점, 검증 결과를 간결히 기재합니다.
- 핵심기능은 CI 통과 + 테스트 커버리지 85% 이상 + TDD 기반 검증을 만족해야 병합 대상이 됩니다.
- PR 본문은 `.github/PULL_REQUEST_TEMPLATE.md`를 사용하고, 커밋은 기능 단위로 작은 단위로 분리합니다.
- 권장 커밋 메시지: `feat: 간결한 한국어 요약`, `fix: 간결한 한국어 요약`, `revert: 롤백 내용`

## 규칙 문서

- 코드 작성/테스트/리뷰 규칙은 `pm_notes/코드_규칙.md`를 참고합니다.
- 기능 개발 단계, PR 절차, 커밋 규칙은 위 규칙 문서에 통합 관리합니다.
- 기여 규칙은 `CONTRIBUTING.md`에서 `main` 대상 브랜치·PR·커밋 템플릿을 함께 확인하세요.
- 에이전트/자동화 작업 공통 규칙은 `Agents.md`를 기준으로 따릅니다.

## 에이전트 작업 공통 규칙

- 작업 시작 전 `Agents.md` 확인 (브랜치/PR/검증/롤백 공통 규칙)
- PR 생성 시 제목 형식 `v<major>.<minor>.<patch> | <요약>` 준수
- PR 본문은 `.github/PULL_REQUEST_TEMPLATE.md`의 필수 섹션(`개요/검증/핵심 체크/위험/롤백`)을 모두 작성
- 머지 전 `bun run ci` 통과와 커버리지 임계치(85% 이상) 충족

## CI/CD 요건

- GitHub Actions 필수 적용
- 최소 체크 항목
  - 형식 검사 / 타입 검사 / 빌드 / 테스트 / 커버리지 집계
  - 커버리지 임계치(=85% 이상) 미달 시 병합 금지
  - 병합 전 핵심 시나리오 통합 테스트 통과

## 커밋 메시지

- `.github/commit_template.md` 템플릿을 적용하면 한글 커밋 메시지를 안정적으로 유지할 수 있습니다.

## 작업 철학

- 핵심 기능 완료가 될 때까지 반복적으로 개발하고, 목표 달성 전에는 작업 종료를 선언하지 않습니다.
- 리스크 대응 및 롤백 가능한 변경 단위를 우선 구성합니다.
