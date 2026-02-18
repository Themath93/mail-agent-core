# UI 전체 한글화 + 메일 기반 대시보드 구축 실행 계획

## TL;DR

> **Quick Summary**: 현재 운영 콘솔형 사이드패널을 기준으로, 사용자 노출 텍스트를 한국어로 완전 전환하고, PRD/상세계획에 정의된 메일 기반 Dashboard/Search/Timeline 경험을 단계적으로 구현한다.
>
> **Deliverables**:
> - 사용자 표시 문자열 한글화 체계(표시문구/계약값 분리)
> - Dashboard/Search/Timeline 계약 + UI + QA 게이트
> - WCAG/그리드/저모션 기준을 만족하는 디자인 시스템
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 0 -> Task 1 -> Task 2 -> Task 5 -> Task 8 -> Task 11

---

## Context

### Original Request
- 사용자에게 보이는 UI를 모두 한글로 바꾸는 작업 계획 수립
- `pm_notes/` 기반 메일 대시보드 상세 계획 수립
- 대시보드는 UI/UX 품질을 최우선으로 설계

### Interview Summary
**Key Discussions**:
- 계획서만 요구됨(구현 아님)
- 기존 계획/문서에는 Dashboard/Search/Timeline 요구가 있으나, 실제 구현은 운영 패널 중심
- 대시보드 디자인 품질이 핵심이며 `ui-ux-pro-max` 권고를 최대 반영

**Research Findings**:
- 현재 확장 화면: `extension/sidepanel.html`, `extension/sidepanel.js` 중심
- 대시보드 화면/라우팅/모듈은 별도 구현 없음
- 핵심 primitive(메일 동기화/근거/투두/deep link)는 일부 존재
- 테스트 인프라 존재: `bun run ci`, Vitest, 커버리지 85% 임계치
- 확장 UI 테스트 갭: `vitest.config.ts`에서 `extension/**` 제외

### Metis Review
**Identified Gaps (addressed)**:
- 문자열 번역 시 계약 필드(action/error_code/enum) 오염 위험 -> 표시문구/계약값 분리 규칙 명시
- 대시보드 구현 순서 리스크 -> 계약 고정(Contract freeze) 선행
- 테스트 문자열 결합 위험 -> 텍스트 기반 assertion 최소화 + 코드/키 기반 검증 강화
- 접근성/밀도 충돌 위험 -> WCAG + USWDS/Carbon 기준을 acceptance criteria에 강제

---

## Work Objectives

### Core Objective
사용자 노출 텍스트를 한국어로 완전 전환하면서, 메일/근거/투두/타임라인을 연결하는 대시보드 제품 경험을 PRD 기준으로 구현 가능하도록 단일 실행계획으로 정리한다.

### Concrete Deliverables
- 단일 실행계획서: `.sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md`
- 로컬라이제이션 범위/가드레일/검증 시나리오
- Dashboard/Search/Timeline 계약/스토리지/화면/QA 시나리오

### Definition of Done
- [x] i18n/e2e 검증 인프라 부트스트랩이 선행 정의됨
- [x] 로컬라이제이션 범위가 파일 단위로 누락 없이 정의됨
- [x] Dashboard/Search/Timeline 구현 태스크가 계약-저장-UI-검증 순서로 정의됨
- [x] 모든 TODO에 agent-executable QA 시나리오 포함
- [x] WCAG/저모션/반응형/밀도 기준이 수치화되어 있음

### Must Have
- 사용자 표시 문자열 100% 한국어화(라벨/상태/오류/placeholder/문서)
- 계약값 번역 금지(action/error_code/enum/value 키)
- Dashboard KPI + Search + Timeline + Evidence jump 흐름
- `mail_store.list_*` 등 계약 분리 구간의 source-of-truth 결정 및 정합화 계획
- 디자인 토큰(색/타이포/간격/모션) + 차트 전략 + 접근성 가드레일

### Must NOT Have (Guardrails)
- 계약 키(`action`, `error_code`, enum values) 번역 금지
- 수동 검증 의존 acceptance criteria 금지
- 대시보드 범위 외 기능(알림센터/협업 권한/멀티유저/신규 인증플로우) 추가 금지
- 시각 품질 명목으로 과도한 모션/저대비 텍스트/색상 단독 의미 전달 금지

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> 모든 검증은 명령/도구로 실행 가능해야 하며, "사용자가 확인" 문구를 금지한다.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after + agent-executed QA
- **Framework**: Vitest + Playwright + Bash
- **Coverage policy**: 85% (`vitest.config.ts`)

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

| Type | Tool | Verification |
|------|------|--------------|
| Localization integrity | Bash + Node | 표시문구/계약값 분리 및 번역 누락 탐지 |
| Contract correctness | Vitest | MCP 도구/스키마/이벤트 흐름 검증 |
| UI/UX quality | Playwright | 대시보드 레이아웃/접근성/반응형/저모션 검증 |
| CI gate | Bash | `bun run ci` 통과 |

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
- Task 0: 검증 인프라 부트스트랩 (i18n/e2e)
- Task 1: 로컬라이제이션 계약 규칙 고정
- Task 2: 문자열 인벤토리/카탈로그 작성
- Task 5: 대시보드 계약/데이터모델 고정

Wave 2 (After Wave 1):
- Task 3: sidepanel 표시문구 한글화
- Task 4: domain 메시지 한글화 + 테스트 전환
- Task 6: 디자인 시스템 토큰/차트/레이아웃 규칙

Wave 3 (After Wave 2):
- Task 7: Dashboard/Search/Timeline UI IA 및 화면 명세
- Task 8: backend-contract 연동 명세(mcp/storage/index)
- Task 9: 접근성/저모션/반응형 검증 시나리오 패키지

Wave 4 (After Wave 3):
- Task 10: 문서 동기화 계획
- Task 11: 통합 QA 게이트/롤아웃/롤백 전략

Critical Path: Task 0 -> Task 1 -> Task 2 -> Task 5 -> Task 8 -> Task 11

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 0 | None | 11 | 1,2,5 |
| 1 | None | 3,4,8 | 0,2,5 |
| 2 | None | 3,4 | 0,1,5 |
| 3 | 1,2 | 11 | 4,6 |
| 4 | 1,2 | 11 | 3,6 |
| 5 | None | 7,8 | 0,1,2 |
| 6 | 5 | 7,9 | 3,4 |
| 7 | 5,6 | 11 | 8,9 |
| 8 | 1,5 | 11 | 7,9 |
| 9 | 6 | 11 | 7,8 |
| 10 | 3,4,7,8 | 11 | None |
| 11 | 0,3,4,7,8,9,10 | None | None |

---

## TODOs

- [x] 0. 검증 인프라 부트스트랩 (i18n/e2e)

  **What to do**:
  - `test:i18n-contract`, `test:e2e` 실행 기반을 명시적으로 준비한다.
  - Playwright 설정 파일(`playwright.config.ts`)과 최소 실행 스크립트 추가 계획을 고정한다.
  - `extension/**` 커버리지 제외 갭을 e2e 게이트로 보완하는 원칙을 문서화한다.

  **Must NOT do**:
  - 기존 `bun run ci` 표준 흐름을 깨지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 11
  - **Blocked By**: None

  **References**:
  - `package.json` - 현재 스크립트 구성
  - `vitest.config.ts` - `extension/**` 제외 정책
  - `.github/workflows/ci.yml` - CI 표준 게이트

  **Acceptance Criteria**:
  - [x] `package.json`에 `test:i18n-contract`, `test:e2e` 추가 계획 명시
  - [x] Playwright 설정 파일 생성/유지 계획 명시
  - [x] CI 실패 시 게이트 우회 금지 원칙 명시

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 테스트 부트스트랩 항목 존재 검증
    Tool: Bash
    Steps:
      1. grep -q "test:i18n-contract" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      2. grep -q "test:e2e" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      3. grep -q "playwright.config.ts" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
    Expected Result: 부트스트랩 핵심 항목 명시
    Evidence: .sisyphus/evidence/task-0-test-bootstrap.txt
  ```

- [x] 1. 로컬라이제이션 계약 규칙 고정 (표시문구 vs 계약값)

  **What to do**:
  - 번역 가능한 문자열과 번역 금지 계약값을 명시적으로 분리한다.
  - 금지 목록: `action`, `error_code`, enum value(`manual`, `open` 등), payload key(`mail_folder` 등).

  **Must NOT do**:
  - 계약값을 한국어로 변환하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 3,4,8
  - **Blocked By**: None

  **References**:
  - `extension/sidepanel.html` - 표시 라벨/placeholder/option label
  - `extension/sidepanel.js` - 상태/오류 표시 문자열
  - `src/domain/mcp.ts` - 계약필드/오류코드/도구명

  **Acceptance Criteria**:
  - [x] 번역 가능/금지 문자열 분류표가 작성된다.
  - [x] 계약값 번역 금지 규칙이 전 태스크 가드레일로 반영된다.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 계약값 번역 금지 룰 검증
    Tool: Bash
    Steps:
      1. grep -q "action" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      2. grep -q "error_code" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      3. grep -q "enum value" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
    Expected Result: 계약값 번역 금지 규칙 존재
    Evidence: .sisyphus/evidence/task-1-contract-localization-guard.txt
  ```

- [x] 2. 사용자 노출 문자열 인벤토리 작성

  **What to do**:
  - UI 표시 문자열을 파일/영역/리스크(High/Medium/Low)로 분류한다.
  - 테스트 결합 파일(`tests/mcp.test.ts` 등)까지 영향 범위를 포함한다.

  **Must NOT do**:
  - 문자열 변경을 구현 단계처럼 수행하지 않는다(계획 단계는 목록화 중심).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 3,4
  - **Blocked By**: None

  **References**:
  - `extension/sidepanel.html`
  - `extension/sidepanel.js`
  - `src/domain/mcp.ts`, `src/domain/evidence.ts`, `src/domain/deep-link*.ts`
  - `tests/mcp.test.ts`, `tests/evidence.test.ts`, `tests/deep-link.test.ts`

  **Acceptance Criteria**:
  - [x] 문자열 인벤토리가 파일 단위로 작성됨
  - [x] High/Medium/Low 리스크 분류가 포함됨
  - [x] 테스트 영향 목록이 포함됨

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 문자열 인벤토리 범위 검증
    Tool: Bash
    Steps:
      1. grep -q "extension/sidepanel.html" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      2. grep -q "extension/sidepanel.js" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      3. grep -q "tests/mcp.test.ts" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
    Expected Result: 핵심 UI/테스트 파일 포함
    Evidence: .sisyphus/evidence/task-2-string-inventory-scope.txt
  ```

- [x] 3. sidepanel 표시문구 한글화 실행 계획

  **What to do**:
  - `extension/sidepanel.html` 라벨/placeholder/상태 초기 문구 한글화 계획을 수립한다.
  - option label은 번역하되 `value`는 유지하는 규칙을 명시한다.

  **Must NOT do**:
  - `id`/`type`/DOM 계약을 변경하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 11
  - **Blocked By**: 1,2

  **References**:
  - `extension/sidepanel.html`
  - `extension/sidepanel.js` (ID/type coupling 확인용)

  **Acceptance Criteria**:
  - [x] 사용자 표시 버튼/헤딩/placeholder 영문 잔존 0
  - [x] select option value 계약값 미변경
  - [x] `extension/sidepanel.js` diff 없음

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: HTML 표시문구 영문 잔존 검증
    Tool: Bash
    Steps:
      1. grep -n "<button[^>]*>[^<]*[A-Za-z][^<]*</button>" extension/sidepanel.html
      2. grep -n "placeholder=\"[^\"]*[A-Za-z][^\"]*\"" extension/sidepanel.html
    Expected Result: 사용자 표시 영역 영문 0건
    Evidence: .sisyphus/evidence/task-3-sidepanel-koreanization.txt

  Scenario: ID/type/JS 불변 검증
    Tool: Bash
    Steps:
      1. git diff --name-only -- extension/sidepanel.js
      2. node invariant-id-type-check.js (또는 동등 one-liner)
    Expected Result: JS 무변경 + ID/type invariant pass
    Evidence: .sisyphus/evidence/task-3-sidepanel-invariant.txt
  ```

- [x] 4. domain 표시 메시지 한글화 + 테스트 전환 계획

  **What to do**:
  - `src/domain/*` 사용자 노출 오류/가이던스 문구 한글화 계획을 수립한다.
  - 테스트 assertion을 텍스트 결합 최소화(코드/키 중심)로 전환 계획을 포함한다.

  **Must NOT do**:
  - `error_code` 의미/값을 변경하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 11
  - **Blocked By**: 1,2

  **References**:
  - `src/domain/mcp.ts`, `src/domain/evidence.ts`, `src/domain/deep-link.ts`, `src/domain/deep-link-workflow.ts`
  - `tests/mcp.test.ts`, `tests/evidence.test.ts`, `tests/deep-link.test.ts`

  **Acceptance Criteria**:
  - [x] 사용자 노출 문자열 카탈로그 기반 변경 계획 존재
  - [x] 텍스트 의존 테스트 개선 계획 존재
  - [x] 계약 코드/enum 불변 규칙 존재

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 도메인 문자열/계약값 분리 검증
    Tool: Bash
    Steps:
      1. grep -q "error_code" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      2. grep -q "tests/mcp.test.ts" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
    Expected Result: 문자열 변경 + 테스트 대응 모두 포함
    Evidence: .sisyphus/evidence/task-4-domain-localization-plan.txt
  ```

- [x] 5. Dashboard/Search/Timeline 계약 고정 (Contract Freeze)

  **What to do**:
  - 신규 도구 계약 초안을 고정한다: `dashboard.get_overview`, `search.query`, `timeline.list`.
  - 입력/출력 스키마, KPI 필드, drilldown payload 규약을 정의한다.

  **Must NOT do**:
  - UI 선행 구현으로 계약을 흔들지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7,8
  - **Blocked By**: None

  **References**:
  - `pm_notes/outlook_mail_agent_prd_v0_2.md` (Dashboard UX 요구)
  - `pm_notes/outlook_mail_agent_detailed_plan_v0_2.md` (Epic F)
  - `src/domain/mcp.ts` (현재 도구 계약)

  **Acceptance Criteria**:
  - [x] 3개 신규 도구 계약이 필드 수준으로 명시됨
  - [x] KPI(오늘 메일/오늘 투두/진행상태/주간 완료/주요 상대) 매핑 존재
  - [x] drilldown 대상과 payload 정의 존재

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 계약 고정 항목 존재 검증
    Tool: Bash
    Steps:
      1. grep -q "dashboard.get_overview" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      2. grep -q "search.query" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      3. grep -q "timeline.list" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
    Expected Result: 3개 계약 명시
    Evidence: .sisyphus/evidence/task-5-contract-freeze.txt
  ```

- [x] 6. 대시보드 디자인 시스템 정의 (ui-ux-pro-max 최대 반영)

  **What to do**:
  - Calm Ops 방향의 토큰/타이포/간격/컴포넌트 규칙을 정의한다.
  - 차트 전략(line/stacked bar/funnel/histogram)과 데이터 표시 원칙을 고정한다.
  - 구현 기준 문서를 `docs/dashboard-design-system-v1.md`에 작성해 Task 7/9 입력으로 사용한다.

  **Must NOT do**:
  - 장식 중심 과모션/저대비 스타일을 허용하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `ui-ux-pro-max`, `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 7,9
  - **Blocked By**: 5

  **References**:
  - `bg_fc0d0247` 결과(토큰/레이아웃/차트 권고)
  - `pm_notes/outlook_mail_agent_prd_v0_2.md` UX 요구

  **Acceptance Criteria**:
  - [x] 색/타이포/간격/모션 토큰 명세 존재
  - [x] chart type-by-metric 매핑 존재
  - [x] anti-pattern 금지 목록 존재

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 디자인 시스템 완결성 검증
    Tool: Bash
    Steps:
      1. grep -q "Color Tokens" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      2. grep -q "Typography" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      3. grep -q "Chart" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
    Expected Result: 핵심 디자인 섹션 존재
    Evidence: .sisyphus/evidence/task-6-design-system-check.txt
  ```

- [x] 7. Dashboard/Search/Timeline IA 및 화면 구성 명세

  **What to do**:
  - 데스크톱 tri-pane, 사이드패널 single-column IA를 명세한다.
  - 대시보드 카드/KPI 드릴다운/검색결과/타임라인/근거점프 플로우를 연결한다.

  **Must NOT do**:
  - IA 없이 컴포넌트를 임의 나열하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `ui-ux-pro-max`, `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 11
  - **Blocked By**: 5,6

  **References**:
  - `pm_notes/outlook_mail_agent_detailed_plan_v0_2.md`
  - `extension/sidepanel.html` (현행 운영 UI)

  **Acceptance Criteria**:
  - [x] Dashboard/Todos/Search/Settings 정보구조 정의
  - [x] KPI -> drilldown -> evidence jump 흐름 정의
  - [x] 사이드패널/대시보드 반응형 분기 정의

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: IA 흐름 완전성 검증
    Tool: Bash
    Steps:
      1. grep -q "Dashboard" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      2. grep -q "Search" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      3. grep -q "Timeline" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
    Expected Result: 핵심 화면 흐름 명시
    Evidence: .sisyphus/evidence/task-7-ia-flow.txt
  ```

- [x] 8. MCP/Storage/Index 통합 설계 명세

  **What to do**:
  - `src/domain/mcp.ts`와 `src/storage/interface.ts` 확장 계획을 명시한다.
  - 이벤트 스키마(`event_id`, `event_type`, `source_tool`, `entity_id`, `at`, `payload`)를 정의한다.
  - `mail_store.list_*` 호출계약의 source-of-truth(확장/native-host/core 중 책임 위치)를 명시적으로 결정한다.

  **Must NOT do**:
  - source of truth 불명확 상태로 구현 태스크를 열지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 11
  - **Blocked By**: 1,5

  **References**:
  - `src/domain/mcp.ts`
  - `src/storage/interface.ts`
  - `src/index.ts`

  **Acceptance Criteria**:
  - [x] 신규 도구/스토리지 키/이벤트 모델이 명시됨
  - [x] 기존 primitive(mail sync/evidence/todo/deep-link)와 연결 경로가 명시됨
  - [x] 계약 정합화 리스크와 대응이 명시됨
  - [x] `mail_store.list_*` 계약 소유권/정합화 전략이 명시됨

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 통합 설계 키 항목 검증
    Tool: Bash
    Steps:
      1. grep -q "src/domain/mcp.ts" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      2. grep -q "src/storage/interface.ts" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      3. grep -q "event_type" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      4. grep -q "mail_store.list_" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
    Expected Result: 통합 설계 핵심 항목 존재
    Evidence: .sisyphus/evidence/task-8-integration-model.txt
  ```

- [x] 9. 접근성/저모션/반응형 검증 계획

  **What to do**:
  - WCAG/USWDS/Carbon 기반 수용 기준을 테스트 가능한 형태로 고정한다.
  - 키보드, 대비, focus-visible, reflow(320px), reduced-motion 시나리오를 작성한다.

  **Must NOT do**:
  - "시각적으로 괜찮음" 같은 정성 기준만 남기지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 11
  - **Blocked By**: 6

  **References**:
  - `bg_fc46532d` 결과(WCAG/USWDS/Carbon)
  - `docs/dashboard-a11y-validation-v1.md`

  **Acceptance Criteria**:
  - [x] contrast/focus/keyboard/reflow/reduced-motion 기준 수치가 명시됨
  - [x] Playwright 기반 검증 플로우가 명시됨

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 접근성 수치 기준 존재 검증
    Tool: Bash
    Steps:
      1. grep -q "4.5:1" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      2. grep -q "focus-visible" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      3. grep -q "320 CSS px" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
    Expected Result: 핵심 접근성 기준 존재
    Evidence: .sisyphus/evidence/task-9-a11y-thresholds.txt
  ```

- [x] 10. 사용자 문서 동기화 계획

  **What to do**:
  - UI 문구 변경에 맞춰 문서 동기화 범위를 정의한다.
  - 변경 추적 표(기존 용어 -> 새 한글 용어)를 포함한다.

  **Must NOT do**:
  - 코드 변경과 문서 변경을 분리 없이 진행하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: 11
  - **Blocked By**: 3,4,7,8

  **References**:
  - `README.md`
  - `docs/install-guide.md`
  - `docs/chrome-extension-user-guide.md`

  **문서 동기화 실행안**:

  | 문서 | 동기화 항목(사용자 노출 UI 문구 기준) | Owner | Checkpoint | Evidence |
  |------|----------------------------------------|-------|------------|----------|
  | `README.md` | 로그인/동기화 quick flow에서 영문 UI 잔존(`signed-in`, `initial sync`, `delta sync`, callback 안내)을 Task 3/4 한글 UI 표기로 정렬 | Docs Maintainer (KR UI) | Task 3/4 완료 직후 + Task 11 통합 게이트 직전 `grep` 재검사 | `.sisyphus/evidence/task-10-readme-sync.txt` |
  | `docs/install-guide.md` | 설치 후 점검/장애 대응 섹션의 상태 메시지 및 버튼 표기를 사이드패널 한글 라벨과 1:1 매핑 | Docs Maintainer (KR UI) | 설치 가이드 수정 후 `bun run ci` 전 점검(문서-only 변경 분리 확인) | `.sisyphus/evidence/task-10-install-guide-sync.txt` |
  | `docs/chrome-extension-user-guide.md` | 사용자 작업 단계(로그인/동기화/복구)의 혼합 표기(`signed-in`, `initial sync`, `delta sync`, callback URL/code)를 한국어 우선 + 계약 토큰 보조표기로 통일 | Docs Maintainer (KR UI) | 사용자 가이드 수정 후 `grep` 잔존 스캔 + Task 11 QA 입력 검토 | `.sisyphus/evidence/task-10-user-guide-sync.txt` |

  - 분리 가드레일(필수): 코드 변경 PR과 문서 변경 PR을 분리한다. 동일 PR이 필요한 경우에도 커밋을 `code/*`와 `docs/*`로 분리해 리뷰/롤백 경계를 명확히 유지한다.

  **UI 용어 변경 추적표 (기존 용어 -> 새 한글 용어)**:

  | 기존 용어 | 새 한글 용어 |
  |----------|--------------|
  | 로그인 시작 (유지) | 로그인 시작 |
  | 로그인 완료 (유지) | 로그인 완료 |
  | Auth status | 로그인 상태 |
  | signed-in | 로그인됨 |
  | initial sync | 초기 동기화 |
  | delta sync | 변경 동기화 |
  | callback URL | 콜백 URL |
  | code 입력 | 인증 코드 입력 |
  | Auto sync | 자동 동기화 |
  | Autopilot hint | 자동화 안내 |

  **Acceptance Criteria**:
  - [x] 3개 문서 동기화 항목이 계획에 명시됨
  - [x] UI 용어 변경표가 포함됨
  - [x] 코드/문서 변경 분리 가드레일이 실행안에 명시됨

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 문서 동기화 범위 검증
    Tool: Bash
    Steps:
      1. grep -q "docs/install-guide.md" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      2. grep -q "docs/chrome-extension-user-guide.md" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      3. grep -q "README.md" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
    Expected Result: 문서 동기화 대상 명시
    Evidence: .sisyphus/evidence/task-10-doc-sync.txt
  ```

- [x] 11. 통합 QA 게이트 + 롤아웃/롤백 전략

  **What to do**:
  - 통합 검증 명령과 실패 시 롤백 포인트를 단계별로 정의한다.
  - 기능 플래그(선택) 기반 점진 배포 전략을 포함한다.
  - 아래 롤아웃 페이즈를 명시한다:
    - Phase 1: i18n/e2e 인프라 활성화
    - Phase 2: sidepanel + domain 한글화 적용
    - Phase 3: dashboard/search/timeline 계약 및 UI 적용
    - Phase 4: 문서 동기화 + 최종 QA 게이트
  - 각 Phase 별 rollback 포인트(직전 안정 커밋/플래그 비활성화/계약 revert)를 정의한다.

  **Task 10 출력 소비(필수 입력 고정)**:
  - Task 10의 `문서 동기화 실행안` 표(`README.md`, `docs/install-guide.md`, `docs/chrome-extension-user-guide.md`)를 Phase 4 릴리즈 게이트의 선행 조건으로 승격한다.
  - Task 10의 용어 변경 추적표(기존 용어 -> 새 한글 용어)를 localization integrity 재검증 입력으로 사용한다.
  - Task 10의 owner/checkpoint/evidence를 통합 게이트 증적 경로와 1:1 매핑해 DoD/Final Checklist 종료 조건으로 연결한다.

  **Must NOT do**:
  - 롤백 불가능한 대규모 일괄 전환 전략을 택하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 final
  - **Blocks**: None
  - **Blocked By**: 3,4,7,8,9,10

  **References**:
  - `package.json`
  - `.github/workflows/ci.yml`
  - `vitest.config.ts`
  - `Agents.md`, `.github/PULL_REQUEST_TEMPLATE.md`

  **Acceptance Criteria**:
  - [x] 통합 검증 명령(`bun run test`, `bun run coverage`, `bun run ci`, `bun run test:i18n-contract`, `bun run test:e2e`) 명시
  - [x] localization integrity + dashboard contract + e2e a11y/reduced-motion/keyboard/reflow 게이트 명시
  - [x] 단계별 rollback 포인트(커밋/플래그/계약 revert) 명시

  **통합 QA 게이트 (machine-verifiable)**:

  | Gate ID | Command | Pass 조건 | 실패 시 조치 | Evidence |
  |---------|---------|-----------|--------------|----------|
  | G1-BUILD-LINT-TEST-COVERAGE | `bun run test && bun run coverage && bun run ci` | 테스트/커버리지/CI 모두 성공, 커버리지 85% 임계치 유지 | 최신 기능 커밋 revert 또는 배포 중지 | `.sisyphus/evidence/task-11-g1-core-ci.txt` |
  | G2-LOCALIZATION-INTEGRITY | `bun run test:i18n-contract` | 표시문구 한글화 + 계약 토큰(`action`, `error_code`, enum/value key) 불변 동시 만족 | i18n 변경 커밋만 선택 revert, 계약 토큰 복원 | `.sisyphus/evidence/task-11-g2-localization.txt` |
  | G3-DASHBOARD-CONTRACT | `bun run test tests/dashboard-contract.test.ts` | `dashboard.get_overview`/`search.query`/`timeline.list` 계약 테스트 통과 | 계약 파일 revert(`src/domain/dashboard-contract.ts`) 또는 스키마 변경 롤백 | `.sisyphus/evidence/task-11-g3-dashboard-contract.txt` |
  | G4-E2E-A11Y-KR | `bun run test:e2e -- --grep "@dashboard\|@a11y\|@keyboard\|@reflow\|@reduced-motion\|@ko-layout"` | dashboard 흐름 + 접근성(키보드/reflow/reduced-motion 포함) 통과 | feature flag 비활성화 + 직전 안정 커밋으로 롤백 | `.sisyphus/evidence/task-11-g4-e2e-a11y.txt` |

  **Phase 1~4 롤아웃/롤백 매트릭스 (Task 10 연계 완료)**:

  | Phase | Rollout 범위 | 진입 게이트 | Rollback Point (구체 액션) | Rollback Trigger | Evidence |
  |-------|--------------|-------------|-----------------------------|------------------|----------|
  | Phase 1 | i18n/e2e 인프라 활성화(`test:i18n-contract`, `test:e2e`) | G1 + G2 | (1) 인프라 도입 커밋 revert, (2) e2e 실행 플래그/워크플로 비활성화, (3) CI 기본경로(`bun run ci`)로 즉시 복귀 | 계약 토큰 오염, e2e infra 불안정, CI 지연 임계 초과 | `.sisyphus/evidence/task-11-phase1-rollback.txt` |
  | Phase 2 | sidepanel + domain 한글화 적용 | G2 + `bun run test` | (1) localization 커밋만 selective revert, (2) 노출 문자열 카탈로그 기준으로 영문 fallback 복구, (3) 계약 토큰 스냅샷 재적용 | UI 문구 회귀, 테스트 문자열 결합 회귀, 계약값 번역 오염 | `.sisyphus/evidence/task-11-phase2-rollback.txt` |
  | Phase 3 | dashboard/search/timeline 계약 + UI 적용 | G3 + G4 | (1) feature flag OFF로 신규 화면 차단, (2) dashboard 계약 revert, (3) index/projection 체크포인트를 직전 stable로 재설정 | 계약 파싱 실패, drilldown/jump_evidence 실패, a11y e2e 실패 | `.sisyphus/evidence/task-11-phase3-rollback.txt` |
  | Phase 4 | 문서 동기화 + 최종 QA 게이트 (Task 10 산출물 반영) | G1~G4 + Task 10 checkpoint/evidence 재검증 | (1) docs 커밋 revert(`README.md`, `docs/install-guide.md`, `docs/chrome-extension-user-guide.md`), (2) 릴리즈 태그 보류/철회, (3) phase3 안정 상태로 복귀 | 문서-UI 용어 드리프트, 최종 통합 게이트 실패, 릴리즈 직전 회귀 | `.sisyphus/evidence/task-11-phase4-rollback.txt` |

  - Phase 종료 공통 규칙: 해당 Phase의 evidence 파일이 없거나 gate 하나라도 실패하면 다음 Phase 진입 금지.
  - 배포 완료 규칙: G1~G4 모두 pass + Task 10 문서 체크포인트 충족 시에만 최종 릴리즈 승인.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 통합 게이트 명령 존재 검증
    Tool: Bash
    Steps:
      1. grep -q "bun run ci" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      2. grep -q "test:i18n-contract" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      3. grep -q "test:e2e" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
    Expected Result: 핵심 게이트 명령 명시
    Evidence: .sisyphus/evidence/task-11-gates.txt

  Scenario: 롤백 전략 존재 검증
    Tool: Bash
    Steps:
      1. grep -q "Rollback" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
      2. grep -q "Phase" .sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md
    Expected Result: 단계별 롤백 전략 존재
    Evidence: .sisyphus/evidence/task-11-rollback.txt
  ```

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 0-2 | `chore: UI 한글화 범위와 계약 가드레일을 고정` | plan/docs/config | `bun run ci` |
| 3-4 | `fix: 사용자 표시 문자열 한글화와 테스트 정합성 보강` | extension/src/tests/docs | `bun run ci` |
| 5-8 | `feat: 대시보드 검색 타임라인 계약과 화면 구조를 추가` | src/extension/tests | `bun run ci` + contract tests |
| 9-11 | `test: 접근성 및 통합 게이트와 롤백 전략을 강화` | tests/docs/plan | e2e + `bun run ci` |

---

## Success Criteria

### Verification Commands
```bash
bun run test
bun run coverage
bun run ci
bun run test:i18n-contract
bun run test:e2e -- --grep "@dashboard|@a11y|@keyboard|@reduced-motion|@ko-layout"
```

### Final Checklist
- [x] UI 표시 문자열 한글화 누락 0
- [x] 계약값(action/error_code/enum/value key) 번역 오염 0
- [x] 표시 라벨/계약값 분리 매트릭스 검증 완료
- [x] Dashboard KPI/Search/Timeline 핵심 흐름 구현 계획 완비
- [x] WCAG 대비/포커스/키보드/reflow/저모션 기준 충족 계획 완비
- [x] 자동화 게이트 통과/롤백 전략 명시

### Localization Completion Matrix

| Field Type | Example | Translate? | Rule |
|-----------|---------|------------|------|
| Button/Heading/Status label | `로그인 상태 확인`, `동기화 완료` | YES | 사용자 가시 문구는 한글 고정 |
| Placeholder(help text) | `메시지 ID 입력` | YES | 입력 보조 문구 한글화 |
| Option label(text) | `수동`, `검토 후 실행` | YES | 화면 표시 텍스트 한글화 |
| Option value(contract) | `manual`, `review_first`, `open` | NO | 계약값/enum 유지 |
| Action key | `workflow.upsert_todo` | NO | 도구 라우팅 키 번역 금지 |
| Error code | `E_PARSE_FAILED` | NO | 코드 불변, 메시지만 한글화 |
| Payload key | `mail_folder`, `message_pk` | NO | API 계약 키 불변 |

---

## Design System Baseline (ui-ux-pro-max 반영)

- **Visual Direction**: Calm Ops (저자극 뉴트럴 + 제한된 액센트, 고밀도 스캔 우선)
- **Layout**:
  - Desktop: tri-pane (메일목록 / 스레드 / 투두·근거 레일)
  - Sidepanel: single-column progressive disclosure
- **Typography**:
  - Heading: Manrope 계열
  - Body: Source Sans 3 계열
  - Mono IDs: IBM Plex Mono 계열
- **Charts**:
  - 추세: line
  - 상태/카테고리 비교: stacked/grouped bar
  - 파이프라인: funnel
  - confidence 분포: histogram
- **Motion**: 120/180/240ms, 비필수 모션 제거, reduced-motion 존중
- **A11y**:
  - text 4.5:1, large text 3:1, non-text 3:1
  - focus-visible + focus-obscured 금지
  - keyboard-only 동작 가능, keyboard trap 금지
  - color-only 의미 전달 금지

## Defaults Applied

- 한글화 기본 톤: `ko-KR` 존댓말/운영형 문체
- 테스트 전략 기본값: Tests-after + 계약/접근성 게이트 강화
- 릴리즈 전략 기본값: 기능 플래그 기반 점진 전환(가능한 경우)

## Auto-Resolved

- 대시보드 구현 부재 여부: 현재 코드는 운영 콘솔형이며 대시보드 제품 IA 미구현으로 확정
- 구현 순서 모호성: Contract freeze -> i18n foundation -> dashboard UI -> 통합 QA 순서로 고정
- 문자열 번역 범위 모호성: 표시문구만 번역, 계약값 번역 금지로 확정

## Decisions Needed

- 없음 (요청 범위 내에서 실행 가능한 기본값으로 해소)
