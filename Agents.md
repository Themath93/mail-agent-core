# Agents Instructions

이 문서는 이 저장소에서 작업하는 에이전트/자동화 도구의 공통 규칙입니다.

## 0) 문서 운영 원칙

- 본 규칙은 실행 전 제일 먼저 확인합니다.
- 충돌 시 우선순위:
  1) `CONTRIBUTING.md`
  2) `README.md`
  3) `pm_notes/코드_규칙.md`
  4) 이 문서(`Agents.md`)
- 규칙 충돌 시 상위 우선순위를 적용하고 변경 사유를 PR 본문/커밋에 남깁니다.

## 1) 브랜치/PR/배포 시작 규칙

- `main`에서 직접 작업하지 않습니다.
- 항상 새 브랜치에서 시작: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`.
- PR은 항상 `main` 대상으로 생성합니다.
- PR 제목 형식: `v<major>.<minor>.<patch> | <요약>`
- PR 본문은 `.github/PULL_REQUEST_TEMPLATE.md`를 그대로 사용하고, 필수 섹션을 누락하지 않습니다.
  - `## 개요`
  - `## 검증`
  - `## 핵심 체크` (3개 항목 모두 `[x]`)
    - `main` 병합 전용 작업인지 확인
    - 브랜치에서 시작해 PR로 `main` 대상인지 확인
    - 커밋 메시지(한글) 및 롤백 포인트 명시
  - `## 위험/롤백`

## 2) TDD 기반 구현 규칙 (최우선)

- 기본 방식은 TDD입니다.
  1. 실패 테스트 작성
  2. 최소 코드로 통과
  3. 리팩터링
- 테스트만 맞추는 완화 수정은 하지 않습니다.
- 회귀 우려가 있는 경우:
  - 실패 테스트 원인 분석
  - 최소 범위 수정
  - 재실행으로 안정성 확인
- 테스트 실패가 반복되면 기존 안정화 버전 기준으로 롤백 지점을 먼저 정하고 이어서 진행합니다.

## 3) 커밋/PR/릴리즈 운영

- 커밋 메시지는 한글로 작성하고 권장 형식을 사용합니다.
  - `feat: ...`, `fix: ...`, `test: ...`, `chore: ...`, `revert: ...`
  - 자세한 설명은 `.github/commit_template.md` 템플릿으로 보완
- 커밋 단위는 작게 나눠서 롤백 가능한 크기로 유지합니다.
- 문서/임시 산출물(예: 로컬 DB, 로그, 실험 스냅샷)은 의도적 변경이 아니면 커밋하지 않습니다.
- 머지 전 조건: `bun run ci` 통과 + 커버리지 85% 이상.
- 릴리즈 태그는 병합 후 Git 태그로 명시합니다.
  - 추천: `git tag -a v<major>.<minor>.<patch> -m "<요약>"`
  - `git push origin v<major>.<minor>.<patch>`
- `main` 병합 시 버전 라벨/변경 이유/검증 결과를 PR 및 릴리즈 노트에 명시합니다.

## 4) 검증 명령 체계

### 최소 로컬 검증
- 변경 범위 검증: `bunx vitest run <변경 파일 그룹>`
- 포맷/타입/빌드/기본 테스트:
  - `bun run lint`
  - `bun run typecheck`
  - `bun run test`

### 병합 전 필수 검증
- `bun run ci`
- `ci` 스크립트는 현재 저장소 기준:
  - `bun run lint`
  - `bun run typecheck`
  - `bun run test`
  - `bun run coverage`
- 실패 내역은 PR `## 위험/롤백` 항목에 이유와 복구 경로를 명시합니다.

## 5) 작업 범위와 아키텍처 준수

- 변경은 요청 범위로 제한하고, 무관 리팩터링은 금지합니다.
- 가능한 한 Clean Architecture, MVC/MVVM 관점을 유지합니다.
  - Domain(순수 로직)
  - Application(유스케이스)
  - Infra(저장소/외부 연동)
  - Interface(입출력 경계)
- 동일 기능은 한 번에 처리하되, 모듈 단위로 커밋하여 되돌리기 쉽도록 분리합니다.

## 6) Directory-Scoped 규칙 (계층형 가이드)

- 현재는 루트 `Agents.md` 단일 운영 규칙입니다.
- 하위 AGENTS 생성 조건(필요 시 즉시 추가):
  - 동일 디렉토리에서 규칙 분기점이 많아지거나,
  - 테스트/아키텍처 정책이 서로 다를 때,
  - 팀 규모 증가로 경로별 운영 지침이 필요해질 때
- 하위 규칙이 생기면 "깊은 경로 우선(deepest path wins)"로 적용합니다.

## 7) MCP/Skills 공통 참고 섹션 (root/하위 AGENTS 공통)

- MCP/Skill은 작업 생산성 확보용 도구로 사용하되, 실행/변경 로그를 남깁니다.
- 하위 디렉토리에 `Agents.md`가 생기면, 본 섹션(7-1~7-6)을 동일하게 복사해 공통 기준으로 사용합니다.

### 7-1. 즉시 재현 가능한 점검 명령 (이 저장소 기준)

```bash
# Skills CLI 기본 도움말
npx skills --help

# 현재 저장소(project-level) Skills 목록
npx skills ls

# 전역(global) Skills 목록
npx skills ls -g

# 필요한 Skill 검색 예시
npx skills find "mcp"

# MCP Inspector CLI 도움말
npx @modelcontextprotocol/inspector --help

# GitHub에서 MCP/Skills 생태계 검색 예시
gh search repos "modelcontextprotocol servers" --limit 5
gh search repos "agent skills" --limit 5
```

### 7-2. 현재 저장소에서 확인된 Skills (project-level)

- `chrome-extension-development`
- `docx`
- `find-skills`
- `pdf`
- `pptx`
- `vercel-react-best-practices`
- `web-design-guidelines`
- `xlsx`

검증 명령: `npx skills ls`

### 7-3. 도구 선택 가이드 (초안)

- 일반 코드 작업: 저장소 규칙(`CONTRIBUTING.md`, `README.md`, `pm_notes/코드_규칙.md`)과 기본 도구를 우선 적용합니다.
- 외부 문서/레퍼런스 조사: 공식 문서, GitHub 검색, `find-skills`로 1차 수집 후 필요한 Skill/MCP를 선택합니다.
- 브라우저 상호작용/웹 검증: `playwright`, `dev-browser` 계열을 우선 사용합니다.
- 파일 특화 작업(문서/데이터): `docx`, `xlsx`, `pdf`, `pptx`를 우선 사용합니다.
- React/Next.js 성능/패턴 점검: `vercel-react-best-practices`를 우선 사용합니다.
- 신규 Skill 도입: `npx skills find <query>` -> `npx skills add <owner/repo@skill>` 순으로 진행합니다.

### 7-4. 문서화 사례 출처 (조사 근거)

- Skills CLI/마켓: `https://github.com/vercel-labs/skills`, `https://skills.sh/`
- MCP 공식 문서/스펙: `https://modelcontextprotocol.io`, `https://github.com/modelcontextprotocol/modelcontextprotocol`
- MCP 서버 예시: `https://github.com/modelcontextprotocol/servers`
- AGENTS 문서 내 Skills 사례: `hashicorp/agent-skills`, `mintlify/starter` 등 공개 저장소

### 7-5. 보안/비밀정보 금지 규칙

- `Agents.md`에 토큰, API 키, OAuth 시크릿, 세션 쿠키 등 자격증명을 기록하지 않습니다.
- 예시 설정에는 반드시 `YOUR_API_KEY` 같은 플레이스홀더를 사용합니다.
- 로컬 비밀값 출력 로그/스크린샷/임시 파일은 커밋 및 PR 본문에 첨부하지 않습니다.

### 7-6. 운영 메모

- MCP/Skill 도입으로 작업 절차가 변경되면 PR `## 검증`, `## 위험/롤백`에 반영합니다.
- 도구 추가/제거 시 본 섹션의 목록과 명령 예시를 함께 업데이트합니다.

## 8) 반드시 지켜야 할 정책

- `as any`, `@ts-ignore`, 빈 catch 블록 같은 타입/에러 억제 패턴은 사용하지 않습니다.
- 공개/실행 설정 파일을 임의 수정하지 않습니다.
- 민감 정보(API 키, 토큰, 토큰 리프레시 값)는 코드에 하드코딩하지 않습니다.
- 이미 커밋된 작업물은 승인되지 않은 대규모 재구성으로 임의 변경하지 않습니다.

## 9) PR 핵심 체크 (자동 점검 대비)

- `main` 대상 PR인지 확인
- `feat/fix/chore` 브랜치에서 시작했는지 확인
- 한글 커밋 + 롤백 포인트(복구 지점) 명시

## 10) 안티패턴

- ❌ 테스트를 통과시키기 위한 임시 해킹성 수정
- ❌ 로컬 패키지/임시 산출물을 커밋
- ❌ 무관한 모듈 동시 대규모 리팩터링
- ❌ 하위 폴더 규칙이 있을 때 루트 규칙만 적용
- ❌ PR 템플릿의 핵심 체크 미기재

## 11) 완결성(요약)

- PR은 `PR 대상: main`, `검증: bun run ci`, `릴리즈: 태그 생성`이 기본 템플릿의 삼각형입니다.
- 기존 코드는 안정성 우선으로 수정하고, 반복 실패 시 근본 원인 해결 뒤 커밋을 진행합니다.
