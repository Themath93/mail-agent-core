# Chrome Sidepanel Neutral Minimal Grid - Visual-Only Plan

## TL;DR

> **Quick Summary**: Chrome Extension 사이드패널의 Todo UI를 시각 디자인 전용으로 재설계한다. 동작 로직/호출 계약은 변경하지 않고, Neutral Minimal Grid 스타일(저자극, 고밀도, 저모션)을 토큰 기반으로 적용한다.
>
> **Deliverables**:
> - 시각 전용 IA/레이아웃/토큰 규칙
> - 컴포넌트 시각 상태 명세(checkbox/important/status/result panel)
> - 로직 불변(immutability) 검증 포함 QA 시나리오
>
> **Estimated Effort**: Short-Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 -> Task 3 -> Task 5 -> Task 7

---

## Context

### Original Request
기존 계획을 "로직은 건드리지 말고 시각 디자인 전용"으로 다시 계획한다.

### Interview Summary
**Key Discussions**:
- 본 산출물은 구현이 아닌 실행 계획서다.
- 디자인 방향은 기존 10개 Neutral Minimal Grid 요구사항을 유지한다.
- JavaScript 로직(`extension/sidepanel.js`)과 Native Host/API 계약은 변경 금지한다.

**Research Findings**:
- 런타임 UI 엔트리: `extension/manifest.json` -> `extension/sidepanel.html`.
- 현재 스타일은 `extension/sidepanel.html` 인라인 CSS 기반이며 토큰 시스템 부재.
- 동작은 `extension/sidepanel.js`의 `id` 기반 이벤트 바인딩에 강하게 결합.
- Chrome Side Panel 제약: 패널 너비 직접 제어 불가, 접근성/보안 가드레일 필요.

### Metis Review
**Identified Gaps (addressed)**:
- 로직 손상 위험: ID/컨트롤 타입 불변 검증을 계획에 강제 추가.
- 시각 개선 중 범위팽창 위험: JS 필요 기능(accordion/tab/modal 등) 금지 명시.
- 접근성 회귀 위험: focus/contrast/reduced-motion을 자동 검증 시나리오로 추가.

---

## Work Objectives

### Core Objective
Neutral Minimal Grid 스타일을 사이드패널 UI에 적용하여 가독성/작업속도/장시간 피로도를 개선하되, 기존 기능 로직 및 데이터 계약은 100% 보존한다.

### Concrete Deliverables
- `.sisyphus/plans/chrome-sidepanel-neutral-minimal-grid-todo-plan.md` (본 visual-only 실행계획)
- CSS 토큰 정의서(컬러/타이포/간격/모션)
- 컴포넌트별 시각 규칙(한 줄 한 작업, 상태색 제한, 좌우 대칭)
- 로직 불변/DOM 계약 불변/접근성 검증 체크리스트

### Definition of Done
- [x] 시각 관련 TODO만 포함되고 로직 변경 TODO는 없다.
- [x] `extension/sidepanel.js` 무변경 조건이 수용기준으로 명시된다.
- [x] 기존 주요 `id`와 컨트롤 타입 불변 검증이 포함된다.
- [x] 모든 검증이 agent-executable 기준을 충족한다.

### Must Have
- Neutral Minimal Grid(기하 균형, 대칭, 뉴트럴 그레이 중심) 적용 규칙
- 한 줄 한 작업 밀도 규칙
- Enter quick add/완료/중요 인터랙션에 대한 "시각 피드백" 규칙
- 저모션/고가독성/저피로 기준
- 토큰 기반 확장 구조

### Must NOT Have (Guardrails)
- `extension/sidepanel.js` 로직 변경 금지
- Native Host/API/state contract 변경 금지
- 신규 인터랙션 로직 필요 기능 추가 금지(모달, 탭 전환 로직, 아코디언 로직 등)
- 기존 `id` 삭제/변경 금지, 기존 컨트롤 타입(button/input/select/pre/p) 변경 금지
- 순백/순흑 중심 대비 설계 금지

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> 모든 수용 기준은 명령/도구로 자동 검증 가능해야 한다.

### Test Decision
- **Infrastructure exists**: YES (`vitest`, CI)
- **Automated tests**: Tests-after
- **Framework**: Vitest + Playwright-based UI QA
- **Special invariant checks**: JS immutability + DOM ID contract checks

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

| Type | Tool | Verification |
|------|------|--------------|
| Visual styling | Playwright | 색/간격/행높이/대비/포커스 링 검증 |
| Invariant checks | Bash/Node | JS 무변경, ID/컨트롤 타입 불변 검증 |
| Regression proof | Playwright | 폭 밴드별 스크린샷 및 overflow 검증 |

### Visual Token Blueprint

#### Color Tokens
- `surface`
  - `--nm-surface-base`: 패널 전체 배경
  - `--nm-surface-container`: 카드/섹션 배경
  - `--nm-surface-elevated`: 입력/선택 컨트롤 배경
- `text`
  - `--nm-text-primary`: 기본 본문/제목 텍스트
  - `--nm-text-secondary`: 보조 설명 텍스트
  - `--nm-text-muted`: placeholder/비활성 보조 텍스트
- `border`
  - `--nm-border-subtle`: 기본 구분선
  - `--nm-border-default`: 컨트롤 경계선
  - `--nm-border-strong`: focus/강조 경계선
- `state-only color` (상태 전용)
  - `--nm-state-important`: `important` 상태 표시 전용
  - `--nm-state-completed`: `completed` 상태 표시 전용
  - `--nm-state-error`: `error` 상태 표시 전용
  - `--nm-state-info`: `info` 상태 표시 전용
  - 상태색은 non-status 요소(일반 카드/버튼/입력 기본색)에는 사용 금지

#### Typography Tokens
- `family`
  - `--nm-font-family-base`: 기본 UI 폰트 패밀리
  - `--nm-font-family-mono`: 결과/코드 블록 폰트 패밀리
- `size`
  - `--nm-font-size-12`, `--nm-font-size-14`, `--nm-font-size-16`
- `weight`
  - `--nm-font-weight-400`, `--nm-font-weight-500`, `--nm-font-weight-600`
- `line-height`
  - `--nm-line-height-tight`(one-line row용)
  - `--nm-line-height-normal`(일반 본문용)

#### Spacing Tokens
- `--nm-space-4`, `--nm-space-6`, `--nm-space-8`, `--nm-space-12`, `--nm-space-16`, `--nm-space-20`
- row/card/panel 간격은 위 spacing token 조합으로만 사용
- 임의 숫자 spacing 직접 입력 금지(예: 7px, 11px)

#### Motion Tokens
- `--nm-motion-fast`(80ms), `--nm-motion-base`(120ms)
- `--nm-ease-standard`(기본 easing)
- `prefers-reduced-motion`에서 비필수 transition/animation 제거

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):
- Task 1: Visual-Only Scope Lock + Invariant Baseline
- Task 2: Token System Definition
- Task 4: Color Semantics and Status Mapping

Wave 2 (After Wave 1):
- Task 3: Fixed Internal Grid + Geometry Layout
- Task 5: One-Line Row Visual Rules
- Task 6: Accessibility + Motion Rules

Wave 3 (After Wave 2):
- Task 7: Visual QA Pack + Immutability Checks
- Task 8: Rollout/Risk/Rollback + Commit Strategy

Critical Path: Task 1 -> Task 3 -> Task 5 -> Task 7

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | 3,5,7 | 2,4 |
| 2 | None | 3,5 | 1,4 |
| 3 | 1,2 | 5,7 | 6 |
| 4 | None | 5 | 1,2 |
| 5 | 1,3,4 | 7 | 6 |
| 6 | 1 | 7 | 3,5 |
| 7 | 1,3,5,6 | 8 | None |
| 8 | 7 | None | None |

---

## TODOs

- [x] 1. Visual-Only Scope Lock 및 불변 계약 정의

  **What to do**:
  - 시각 변경 허용 범위(스타일/레이아웃/토큰)와 금지 범위(로직/API)를 명시한다.
  - DOM 계약 불변 목록(ID, 컨트롤 타입)과 JS 무변경 규칙을 정의한다.

  **Must NOT do**:
  - 이벤트 바인딩/함수/호출 payload 변경 계획을 포함하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 범위 고정 및 불변 체크리스트 작성 중심.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: 시각 변경과 비시각 변경 경계 분리.
  - **Skills Evaluated but Omitted**:
    - `git-master`: git 작업 자체는 아직 필요 없음.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2,4)
  - **Blocks**: 3,5,7
  - **Blocked By**: None

  **References**:
  - `extension/sidepanel.js` - ID 기반 로직 결합 지점; 변경 금지 대상.
  - `extension/sidepanel.html` - 시각 변경 허용 대상.
  - `extension/manifest.json` - 사이드패널 진입점 확인.

  **Acceptance Criteria**:
  - [x] "로직 변경 금지"와 "ID/타입 불변" 규칙이 명시된다.
  - [x] JS 변경 금지 검증 명령이 포함된다.

  **Invariant Baseline (Locked)**:
  - Immutable file: `extension/sidepanel.js`
  - Preserved IDs: `extension/sidepanel.html`의 현행 `id` 56개 전부(추가/삭제/이름변경 금지)
  - Preserved control types:
    - `button` ID 25개 타입 고정
    - `input[type=text|number]` ID 20개 타입 고정
    - `select` ID 5개 타입 고정
    - `p` ID 5개 + `pre` ID 1개 노드 타입 고정
  - Binding rationale: `sidepanel.js`는 `document.getElementById(...)` 56개, `?.addEventListener(...)` 28개 결합점 기반으로 동작하므로 타입/ID 변경은 로직 변경으로 간주한다.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: JS 로직 무변경 검증
    Tool: Bash
    Preconditions: 구현 브랜치에서 작업 완료
    Steps:
      1. git diff --name-only -- extension/sidepanel.js
      2. 출력 라인 수 확인
    Expected Result: 출력 없음
    Failure Indicators: 파일명이 출력됨
    Evidence: .sisyphus/evidence/task-1-js-immutability.txt

  Scenario: DOM ID 불변 검증
    Tool: Bash (node one-liner)
    Preconditions: sidepanel.html 변경 완료
    Steps:
      1. sidepanel.html에서 필수 id 목록 존재/중복 여부 검사
      2. 누락 id 목록 출력
    Expected Result: 누락/중복 없음, exit code 0
    Failure Indicators: 누락/중복 id 존재
    Evidence: .sisyphus/evidence/task-1-id-contract.txt
  ```

- [x] 2. Neutral Token System 정의 Visual-only

  **What to do**:
  - 컬러/타이포/간격/모션 토큰을 정의한다.
  - 토큰은 뉴트럴 그레이 중심, 상태색 제한 원칙을 따른다.
  - `extension/sidepanel.html`의 baseline 시각 값(배경/텍스트/카드/간격/모션)을 토큰명으로 매핑한다.

  **Must NOT do**:
  - 임의 hex 하드코딩 확산을 허용하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `ui-ux-pro-max`, `frontend-ui-ux`
  - **Skills Evaluated but Omitted**:
    - `playwright`: 토큰 정의 단계에서는 후순위.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 3,5
  - **Blocked By**: None

  **References**:
  - `extension/sidepanel.html` - 현재 베이스 값(배경, 텍스트, 카드, 간격).
  - `README.md` - 장시간 사용성과 저피로 UI 목표.

  **Acceptance Criteria**:
  - [x] semantic token(`surface/text/border/state`) 정의
  - [x] type token(`size/weight/line-height`) 정의
  - [x] spacing token(최소 5단계) 정의
  - [x] motion token(저모션) 정의

  **Token Dictionary (Visual-only, Implementation-agnostic)**:
  - 아래 사전은 "실행 CSS"가 아니라 시각 규칙 사양이다. 실제 적용 단계(Task 3/5)에서 클래스/선택자에 연결한다.
  - Color
    - `--nm-surface-base`: `#f7f8fa` (패널 배경 baseline)
    - `--nm-surface-container`: `#ffffff` (카드 배경 baseline)
    - `--nm-surface-elevated`: `#f3f4f6` (elevated surface baseline)
    - `--nm-text-primary`: `#1f2937` (기본 텍스트 baseline)
    - `--nm-text-secondary`: `#374151` (보조 텍스트)
    - `--nm-text-muted`: `#6b7280` (placeholder/약한 정보)
    - `--nm-border-subtle`: `#e5e7eb` (카드/구분선 baseline)
    - `--nm-border-default`: `#d1d5db` (입력/선택 기본 경계)
    - `--nm-border-strong`: `#9ca3af` (강조 경계)
    - `--nm-state-important`: `#b45309`
    - `--nm-state-completed`: `#166534`
    - `--nm-state-error`: `#b91c1c`
    - `--nm-state-info`: `#1d4ed8`
  - Typography
    - `--nm-font-family-base`: `"Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
    - `--nm-font-family-mono`: `ui-monospace, SFMono-Regular, Menlo, monospace`
    - `--nm-font-size-12`: `12px`, `--nm-font-size-14`: `14px`, `--nm-font-size-16`: `16px`
    - `--nm-font-weight-400`: `400`, `--nm-font-weight-500`: `500`, `--nm-font-weight-600`: `600`
    - `--nm-line-height-tight`: `1.3`, `--nm-line-height-normal`: `1.5`
  - Spacing
    - `--nm-space-4`: `4px`, `--nm-space-6`: `6px`, `--nm-space-8`: `8px`
    - `--nm-space-12`: `12px`, `--nm-space-16`: `16px`, `--nm-space-20`: `20px`
  - Motion
    - `--nm-motion-fast`: `80ms`, `--nm-motion-base`: `120ms`
    - `--nm-ease-standard`: `cubic-bezier(0.2, 0, 0, 1)`

  **State Color Usage Rules (status-only)**:
  - `important`: 중요 표시 배지/아이콘/좌측 강조선에만 사용 (기본 텍스트색 대체 금지)
  - `completed`: 완료 체크 표시 + 완료 텍스트 장식(예: line-through 보조)에서만 사용
  - `error`: `auth-status`, `autosync-status`, `autopilot-status-text`, `result`의 오류 상태 표시에만 사용
  - `info`: 위 상태 노드들의 중립 안내/진행 상태 표시에만 사용
  - 금지: 상태색을 일반 버튼 기본색, 카드 배경 기본색, 입력 기본 경계색에 재사용

  **Baseline -> Token Mapping (`extension/sidepanel.html`)**:
  - body `padding: 16px` -> `--nm-space-16`
  - body `background: #f7f8fa` -> `--nm-surface-base`
  - body `color: #1f2937` -> `--nm-text-primary`
  - `.card` `background: #ffffff` -> `--nm-surface-container`
  - `.card` `border: 1px solid #e5e7eb` -> `--nm-border-subtle`
  - `.card` `padding: 12px` -> `--nm-space-12`
  - `.card` `margin-bottom: 10px` -> `--nm-space-8 + density offset(visual rule)`
  - `.row` `gap: 6px` / `margin: 6px 0` -> `--nm-space-6`
  - `pre` `padding: 8px` / `background: #f3f4f6` -> `--nm-space-8` / `--nm-surface-elevated`
  - `h1 18px`, `h2 14px`, `pre 12px` -> `--nm-font-size-16 + title offset`, `--nm-font-size-14`, `--nm-font-size-12`

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 토큰 섹션 완결성 검증
    Tool: Bash
    Preconditions: 시각 명세 문서 작성 완료
    Steps:
      1. grep -q "^#### Color Tokens" .sisyphus/plans/chrome-sidepanel-neutral-minimal-grid-todo-plan.md
      2. grep -q "^#### Typography Tokens" .sisyphus/plans/chrome-sidepanel-neutral-minimal-grid-todo-plan.md
      3. grep -q "^#### Spacing Tokens" .sisyphus/plans/chrome-sidepanel-neutral-minimal-grid-todo-plan.md
      4. grep -q "^#### Motion Tokens" .sisyphus/plans/chrome-sidepanel-neutral-minimal-grid-todo-plan.md
    Expected Result: 네 가지 토큰 섹션 모두 존재
    Evidence: .sisyphus/evidence/task-2-token-sections.txt

  Scenario: 상태색 제한 검증
    Tool: Bash
    Preconditions: 디자인 명세 확정
    Steps:
      1. grep -q "state-only color" .sisyphus/plans/chrome-sidepanel-neutral-minimal-grid-todo-plan.md
      2. grep -q "`important`" .sisyphus/plans/chrome-sidepanel-neutral-minimal-grid-todo-plan.md
      3. grep -q "`completed`" .sisyphus/plans/chrome-sidepanel-neutral-minimal-grid-todo-plan.md
    Expected Result: 상태색 사용 목적이 제한적으로 명시됨
    Evidence: .sisyphus/evidence/task-2-state-color-rule.txt
  ```

- [x] 3. Fixed Internal Grid + Geometric Balance 레이아웃 규칙

  **What to do**:
  - 사이드패널 내부 고정 그리드 기준(컬럼/거터/패딩)을 정의한다.
  - 정사각/원형 시각 요소 비율과 좌우 대칭 정렬 규칙을 정의한다.
  - 폭 밴드(320/360/400+)별 시각 유지 규칙을 정의한다.

  **Must NOT do**:
  - 패널 실제 너비 API 제어를 전제로 설계하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `frontend-ui-ux`
  - **Skills Evaluated but Omitted**:
    - `dev-browser`: 검증 단계에서 사용.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: 5,7
  - **Blocked By**: 1,2

  **References**:
  - `extension/sidepanel.html` - 현재 카드/row 구조.
  - Chrome Side Panel docs - 패널 너비 제어 불가 제약.

  **Acceptance Criteria**:
  - [x] 폭 밴드별 간격/정렬 규칙 존재
  - [x] 수평 전체 스크롤 금지 규칙 존재(`#result` 내부 스크롤 제외)
  - [x] 시각 균형 규칙(아이콘/체크/중요 배치) 존재

  **Fixed Internal Grid Spec (Visual-only, one-column shell 고정)**:
  - 공통: side panel은 `manifest` 제약상 실제 패널 폭 제어를 하지 않고, 내부 레이아웃만 제어한다. 모든 섹션은 single-column shell을 유지한다.
  - 공통: `.card`는 내부 그리드 컨테이너로 동작하며, 카드 내부 요소(`h2`, `.row`, `p`, `pre`)는 좌우 동일 기준선에 맞춘다.
  - 공통: `.row`는 기능상 복수 컨트롤을 포함하더라도 시각적으로는 한 줄 리듬을 유지하고, 폭 부족 시 줄바꿈 대신 컨트롤 폭 축소(`min-width: 0`)를 우선한다.
  - 320/360/400+ 폭 밴드 규칙:
    - `320px`: compact column. 패널 좌우 패딩 최소 단계(`--nm-space-12`), 카드 내부 간격은 tight(`--nm-space-6`~`--nm-space-8`), 단일 컬럼만 허용.
    - `360px`: baseline column rhythm. 패널 좌우 패딩 `--nm-space-16`, 카드 내부 간격 `--nm-space-8`~`--nm-space-12`, 단일 컬럼 유지.
    - `400+px`: comfortable spacing. 패널 좌우 패딩 `--nm-space-20`까지 확장 가능, 카드 내부 간격 `--nm-space-12` 중심으로 완화하되 2열 분할 금지(여전히 one-column shell).

  **Geometric Balance Rules (정사각/원형 + 좌우 대칭)**:
  - 정사각 affordance: checkbox/토글형 leading 요소는 정사각 비율(1:1)로 고정하고, 시각 중심은 행 높이의 중앙선과 일치시킨다.
  - 원형 affordance: 중요/상태 배지 점(dot) 또는 아이콘 배경은 원형(50% radius)으로 고정하고, 정사각 요소와 동일한 중심축에 배치한다.
  - 좌우 대칭: 각 row는 `leading affordance - primary text/input - trailing action`의 3구간 기준선을 유지하고, leading/trailing 시각 무게(면적 + 명도 대비)를 균형화한다.
  - 대칭 보정: trailing 버튼 수가 많아지는 행은 텍스트 영역을 희생하지 않도록 버튼 라벨 축약/nowrap 우선 규칙을 적용하고, 좌측 기준선은 절대 이동시키지 않는다.

  **Overflow Policy (강제 규칙)**:
  - 페이지 레벨 수평 overflow는 금지한다(`html`, `body`, 최상위 카드 스택 모두 `overflow-x: hidden` 기준).
  - 내부 스크롤 허용 대상은 `#result` 1개로 제한한다(`overflow: auto` 유지).
  - `#result`를 제외한 입력/버튼/카드/row에서 가로 스크롤바가 발생하면 실패로 간주한다.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 좁은 폭 레이아웃 유지 검증
    Tool: Playwright
    Preconditions: 시각 적용 완료
    Steps:
      1. viewport 320x800으로 로드
      2. 문서 root의 scrollWidth/innerWidth 비교
      3. .card, .row 기준 정렬/패딩 계산값 확인
    Expected Result: 페이지 수평 스크롤 없음, 내부 그리드 유지
    Failure Indicators: body 수평 스크롤 발생
    Evidence: .sisyphus/evidence/task-3-layout-320.png

  Scenario: 360/400 폭 시각 일관성 검증
    Tool: Playwright
    Preconditions: 시각 적용 완료
    Steps:
      1. viewport 360, 400 각각 스크린샷 캡처
      2. 카드 간격/행 높이 비교
    Expected Result: 의도한 그리드/간격 체계 유지
    Evidence: .sisyphus/evidence/task-3-layout-bands.png
  ```

- [x] 4. 상태색 및 시각 피드백 맵 정의 (No logic change)
  <!-- grep-anchor: - [x] 4. 상태색 및 시각 피드백 맵 정의 No logic change -->

  **What to do**:
  - 완료/중요/에러/정보 상태의 색상/경계/텍스트 우선순위를 정의한다.
  - 피드백은 CSS 기반 최소 변화(색/투명도)로 제한한다.

  **State Color Usage Rules (Task 4 Explicit Map)**:

  | 상태 | 토큰 | 적용 대상(허용) | 비대상(금지) |
  |------|------|----------------|-------------|
  | `important` | `--nm-state-important` | todo row의 중요 배지/아이콘, row leading accent border(시각 강조선) | 일반 버튼 기본 배경/텍스트, 카드 기본 배경, 입력 기본 경계 |
  | `completed` | `--nm-state-completed` | checkbox check glyph, 완료 텍스트 보조 장식(예: line-through + 약화된 대비) | 비완료 row 본문색 강제 치환, 일반 CTA 강조색 |
  | `error` | `--nm-state-error` | 상태/결과 노드 전용: `#auth-status`, `#autosync-status`, `#autopilot-status-text`, `#result` | todo row 일반 상태, 카드/입력/버튼 기본 상태 |
  | `info` | `--nm-state-info` | 상태/결과 노드 전용: `#auth-status`, `#autosync-status`, `#autopilot-status-text`, `#result` | 완료/중요 시맨틱 대체, 일반 컴포넌트 기본색 |

  **Minimal Feedback Policy (low-motion, visual-only)**:
  - `hover`: 색/투명도/경계 대비만 변화 허용, `transform`/위치 이동/크기 변화 금지.
  - `focus`/`focus-visible`: `--nm-border-strong` 기반 outline 또는 border 강조만 허용, 깜빡임 애니메이션 금지.
  - `active`: pressed 느낌은 명도 1단계 조정 또는 opacity 미세 조정으로 제한, 이동/스케일 효과 금지.
  - `disabled`: `--nm-text-muted` + 낮은 대비 surface 조합으로 비활성 표현, 상태색(`--nm-state-*`) 사용 금지.
  - 모션 상한: transition은 color/background-color/border-color/opacity로 제한하고 duration은 `--nm-motion-fast`~`--nm-motion-base`(80~120ms) 범위만 허용.
  - `prefers-reduced-motion: reduce`에서는 비필수 transition을 제거하고 즉시 상태 반영(0ms 또는 none)으로 다운그레이드.

  **Must NOT do**:
  - 상태 전이 로직이나 타이밍 로직을 변경하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `ui-ux-pro-max`
  - **Skills Evaluated but Omitted**:
    - `playwright`: 실제 검증은 Task 7.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 5
  - **Blocked By**: None

  **References**:
  - `extension/sidepanel.html` - status text 영역(`#auth-status`, `#autosync-status`, `#autopilot-status-text`).
  - `extension/sidepanel.js` - 상태 문자열 업데이트 지점(로직은 참조만).

  **Acceptance Criteria**:
  - [x] 상태색이 non-status 요소에 확산되지 않는다.
  - [x] 상태 피드백 애니메이션이 저모션 규칙을 따른다.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 상태색 오용 방지 검증
    Tool: Playwright
    Preconditions: 스타일 적용 완료
    Steps:
      1. 일반 row/카드/입력의 computed color 추출
      2. 상태요소의 computed color 추출
      3. 상태색이 상태요소에만 적용되는지 비교
    Expected Result: 상태색은 상태 표시 요소에만 사용
    Evidence: .sisyphus/evidence/task-4-state-color-scope.json

  Scenario: 최소 피드백 규칙 검증
    Tool: Playwright
    Preconditions: prefers-reduced-motion 설정 가능
    Steps:
      1. hover/focus/active 상태 전환
      2. transition-property/duration 확인
    Expected Result: duration <= 120ms, 과도한 transform 없음
    Evidence: .sisyphus/evidence/task-4-motion-minimal.json
  ```

- [x] 5. One-Line Task Density 시각 규칙 명세

  **What to do**:
  - 한 줄 한 작업의 행 높이/줄바꿈/ellipsis 규칙을 정의한다.
  - 빠른 스캔을 위한 타이포 대비와 행 간 리듬을 정의한다.

  **Must NOT do**:
  - 기본 2줄 레이아웃을 허용하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `frontend-ui-ux`, `ui-ux-pro-max`
  - **Skills Evaluated but Omitted**:
    - `artistry`: 실험적 시도보다 정밀한 생산성 UI 우선.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: 7
  - **Blocked By**: 1,3,4

  **References**:
  - `extension/sidepanel.html` - row/card baseline.
  - 외부 패턴 조사 결과(Todoist/Linear/Polaris/Carbon/Material) - 고밀도 리스트 근거.

  **Acceptance Criteria**:
  - [x] one-line 기본 규칙 명시
  - [x] 긴 텍스트 truncation 규칙 명시
  - [x] 행 간격/행 높이 수치 기준 명시

  **One-Line Task Density Spec (Visual-only, Task 5 Lock)**:
  - 기본 행 높이 범위: todo row 시각 높이는 `32px~36px` 허용 범위로 고정하고, 기본 목표값은 `34px`로 둔다. 체크/아이콘/텍스트/우측 액션의 시각 중심은 동일한 수평 중심선에 맞춘다.
  - one-line 강제: 기본 레이아웃은 단일행만 허용하며 2줄 기본 상태를 금지한다. row 텍스트 영역은 줄바꿈 없이 `white-space: nowrap`을 기본값으로 사용한다.
  - truncation(ellipsis) 강제: 긴 제목/라벨은 반드시 `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap` 3종을 함께 적용한다. 셋 중 하나라도 누락되면 규칙 위반으로 간주한다.
  - 폭 수축 우선순위: 줄바꿈 대신 폭 수축을 우선한다. 텍스트 컨테이너와 입력/선택 컨트롤은 `min-width: 0` 기준을 유지해 320폭에서도 row 높이 증가 없이 ellipsis로 수렴시킨다.
  - spacing rhythm(`--nm-space-*` 연동): row 내부 좌우 패딩은 `--nm-space-8`(320) / `--nm-space-12`(360) / `--nm-space-12~16`(400+)만 허용하고, 요소 간 gap은 `--nm-space-6`(compact) 또는 `--nm-space-8`(baseline+)만 사용한다. row 간 수직 리듬은 `--nm-space-6` 고정, 카드 내부 섹션 분리는 `--nm-space-8` 또는 `--nm-space-12`만 사용한다.
  - 타이포 대비(빠른 스캔 기준): primary task text는 `--nm-font-size-14`, `--nm-font-weight-500`, `--nm-line-height-tight`를 기본으로 하고 `--nm-text-primary`를 사용한다. 보조 텍스트는 `--nm-font-size-12`, `--nm-font-weight-400`, `--nm-text-secondary`를 사용하며 primary 대비 시각 우선순위를 역전시키지 않는다.
  - 명도 대비 하한: row 본문(primary)은 `--nm-surface-container` 대비 `7:1` 이상, 보조 텍스트는 `4.5:1` 이상을 유지한다. 대비 미달 시 행 밀도 규칙을 충족해도 실패로 판정한다.
  - KR/EN 혼합 문자열 처리: 한글+영문 혼합 제목은 형태소 경계와 무관하게 one-line 우선 정책을 적용하고, 자동 줄바꿈 대신 ellipsis로 종료한다. 한국어 조사/어미가 중간에서 잘릴 수 있으므로 툴팁/원문 노출은 후속 태스크에서만 다룬다(본 태스크 범위 외).
  - 무공백 토큰 처리: URL, message_id, UUID, snake_case/camelCase 장문처럼 공백 없는 토큰은 강제 줄바꿈 금지(`nowrap`)를 유지하고 ellipsis로 절단한다. row 자체 overflow는 금지하며, overflow 예외는 Task 3 고정 규칙대로 `#result`에만 허용한다.
  - 폭 밴드 호환(320/360/400+):
    - `320px`: `34px` 목표 높이 유지, 텍스트 영역 최소폭 확보를 위해 trailing 액션 라벨 축약/nowrap 우선.
    - `360px`: 기본 밀도 밴드로 간주, `32~36px` 범위 중앙값(`34px`) 유지.
    - `400+px`: 여유 폭에서도 row를 1줄로 유지하고, 높이 확장 대신 좌우 여백(`--nm-space-12~16`)만 완화.
  - 상태색 경계 유지(Task 4 상속): one-line density 적용 중에도 `--nm-state-*`는 상태 의미 영역에만 사용하며, 일반 row 기본 텍스트/배경/입력 경계색으로 확산하지 않는다.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 긴 제목 truncation 시각 검증
    Tool: Playwright
    Preconditions: 샘플 todo row 렌더링 가능
    Steps:
      1. 100자 제목 렌더링
      2. row 높이 측정
      3. text-overflow ellipsis 스타일 확인
    Expected Result: 단일행 유지 + ellipsis 적용
    Evidence: .sisyphus/evidence/task-5-truncation.png

  Scenario: 행 밀도 일관성 검증
    Tool: Playwright
    Preconditions: todo 20개 렌더링
    Steps:
      1. 첫 10개 row 높이/간격 샘플링
      2. 편차 계산
    Expected Result: 지정 허용편차 내 일관성
    Evidence: .sisyphus/evidence/task-5-density-metrics.json
  ```

- [x] 6. Accessibility + Reduced Motion 시각 기준

  **What to do**:
  - 포커스 가시성, 대비, 키보드 탐색 시각 상태를 정의한다.
  - `prefers-reduced-motion` 대응 시각 정책을 정의한다.

  **Accessibility Visual Criteria (Task 6 Locked Spec)**:

  - 대비 기준(측정 단위: WCAG contrast ratio, normal/large text 분리)
    - 일반 텍스트(`--nm-font-size-12`, `--nm-font-size-14`, `--nm-font-size-16` + 600 미만): 배경 대비 `>= 4.5:1`.
    - 큰 텍스트(18px 이상 또는 14px 이상 bold): 배경 대비 `>= 3:1`.
    - 비텍스트 UI 경계(입력/선택/버튼 경계, focus ring): 인접 배경 대비 `>= 3:1`.
    - placeholder/보조 텍스트는 정보 보조 용도로만 사용하고, 핵심 상태/오류 의미 전달에 단독 사용 금지.

  - 키보드 포커스 가시성 기준(`:focus-visible` 전용, `:focus` 대체 금지)
    - 공통: Tab 순회로 도달 가능한 모든 interactive 요소(`button`, `input`, `select`)는 `:focus-visible`에서 시각 변화가 반드시 발생해야 한다.
    - 공통: focus indicator는 color-only가 아닌 형태 변화를 포함한다(예: 2px outline 또는 1px border 굵기 증가 + offset).
    - `button`:
      - `:focus-visible` 시 2px outline(또는 동등 가시성 box-shadow) + 요소 외곽에 분리 가능한 offset 표시.
      - 버튼 배경이 변하지 않더라도 focus 윤곽은 연속적으로 식별 가능해야 한다.
    - `input[type=text|number]`:
      - `:focus-visible` 시 기본 경계 대비 한 단계 높은 `--nm-border-strong` 기반 경계/outline 표시.
      - placeholder가 남아 있어도 caret 영역과 focus 경계가 동시에 식별 가능해야 한다.
    - `select`:
      - `:focus-visible` 시 입력과 동일 강도의 경계/outline 표시를 적용하고, 드롭다운 인디케이터(화살표) 근처에서 가시성 손실이 없어야 한다.
    - 금지: 포커스 표현을 색상 톤 변경만으로 전달(예: 배경색만 미세 변경)하는 패턴.

  - reduced-motion 강등 정책(`prefers-reduced-motion: reduce`)
    - 기본 정책(Task 4와 합치): transition property는 `color/background-color/border-color/opacity`로 제한, duration 상한 120ms 유지.
    - `reduce` 환경에서는 비필수 transition/animation을 제거(`transition: none` 또는 duration 0ms)하고 즉시 상태 반영.
    - hover/active/focus 시 transform/scale/position 기반 모션은 기본/감속 모드 모두 금지.
    - 상태 전달 우선순위는 motion이 아니라 명도 대비/경계/텍스트/아이콘으로 유지한다.

  - color-only 의미 전달 금지 + 보조 단서 의무화
    - `important`: 색상 + 아이콘(또는 배지 라벨) 동시 표기.
    - `completed`: 색상 + 체크 glyph + line-through(또는 동등 텍스트 장식) 동시 표기.
    - `error/info`: 색상 + 상태 텍스트(prefix/명시 문구) 동시 표기.
    - 링크/상호작용 가능 요소는 색상만으로 구분하지 않고 밑줄/굵기/아이콘 중 1개 이상 추가.

  - Task 3/4 일관성 고정 규칙
    - Task 3 overflow 정책 유지: 접근성 강화로 인한 추가 장식은 페이지 수평 overflow를 유발하면 안 되며, 내부 스크롤 예외는 `#result`만 허용.
    - Task 4 최소 피드백 정책 유지: 접근성 표시는 가시성 강화가 목적이며 과도한 모션 추가를 금지한다.
    - 상태색 범위는 Task 4 매핑을 재정의하지 않고, Task 6은 "가시성 임계치"만 보강한다.

  **Must NOT do**:
  - color-only 상태 전달로 의미를 단독 표현하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `frontend-ui-ux`
  - **Skills Evaluated but Omitted**:
    - `dev-browser`: 테스트에서 사용.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 7
  - **Blocked By**: 1

  **References**:
  - Chrome extension a11y guidance
  - `extension/sidepanel.html` 기존 컨트롤 구조

  **Acceptance Criteria**:
  - [x] 텍스트 대비 4.5:1 이상 기준 명시
  - [x] focus-visible 규칙 명시
  - [x] reduced-motion 규칙 명시

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 키보드 focus ring 가시성 검증
    Tool: Playwright
    Preconditions: sidepanel 로드
    Steps:
      1. Tab으로 모든 interactive 요소 순회
      2. 각 요소의 outline/box-shadow 대비 확인
    Expected Result: 모든 요소에서 포커스 시각 확인 가능
    Evidence: .sisyphus/evidence/task-6-focus-visible.png

  Scenario: 대비 기준 자동 점검
    Tool: Playwright + axe(or equivalent)
    Preconditions: 접근성 검사 도구 사용 가능
    Steps:
      1. 페이지 대비 관련 rule 실행
      2. 위반 항목 수집
    Expected Result: 대비 관련 critical 위반 0
    Evidence: .sisyphus/evidence/task-6-contrast-report.json
  ```

- [x] 7. Visual QA Pack + Regression + Invariants

  **What to do**:
  - 폭/줌/상태문자 길이 기준 시각 회귀 시나리오를 정의하고 명령 단위 게이트로 고정한다.
  - 로직 불변(파일/ID/type) 자동검증을 최종 게이트로 묶는다.
  - 결과 패널 overflow 예외(`#result` 내부 스크롤 only)와 페이지 수평 overflow 금지 규칙을 회귀 체크에 포함한다.
  - CI 명령 게이트(`bun run test`, `bun run coverage`, `bun run ci`)를 pass/fail 기준과 함께 명시한다.

  **Must NOT do**:
  - 수동 점검 문구를 acceptance criteria로 남기지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `playwright`, `frontend-ui-ux`
  - **Skills Evaluated but Omitted**:
    - `git-master`: 검증 단계 자체엔 필수 아님.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: 8
  - **Blocked By**: 1,3,5,6

  **References**:
  - `extension/sidepanel.html`
  - `extension/sidepanel.js`
  - `package.json`, `.github/workflows/ci.yml`

  **Acceptance Criteria**:
  - [x] JS 무변경 검증 통과
  - [x] ID/타입 불변 검증 통과
  - [x] 폭 320/360/400 + 줌 200% 시각 회귀 검증 통과
  - [x] 결과 패널(`#result`)만 내부 스크롤 허용, 페이지 수평 스크롤 금지
  - [x] 상태 텍스트 장문(`auth/autosync/autopilot/result`) overflow 안정성 검증 통과
  - [x] CI 명령 게이트 3종(`bun run test`, `bun run coverage`, `bun run ci`) 기준 명시

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: JS immutability 최종 게이트 (hard fail)
    Tool: Bash
    Preconditions: 시각 작업 산출물 반영 완료
    Steps:
      1. git diff --name-only -- extension/sidepanel.js
      2. test -z "$(git diff --name-only -- extension/sidepanel.js)"
    Expected Result: 두 명령 모두 성공, 출력 없음
    Failure Indicators: `extension/sidepanel.js` 경로가 1줄이라도 출력됨 또는 exit code != 0
    Evidence: .sisyphus/evidence/task-7-js-immutability.txt

  Scenario: DOM ID/type 계약 게이트 (hard fail)
    Tool: Bash + Node
    Preconditions: `extension/sidepanel.html` 변경 반영 완료
    Steps:
      1. node -e "const fs=require('node:fs');const h=fs.readFileSync('extension/sidepanel.html','utf8');const ids=[...h.matchAll(/id=\"([^\"]+)\"/g)].map(v=>v[1]);const d=ids.filter((id,i)=>ids.indexOf(id)!==i);const req={button:['start-login','check-auth-status','logout','complete-login','initial-sync','delta-sync','list-messages','list-threads','get-message','get-thread','list-attachments','download-attachment','autosync-start','autosync-stop','autopilot-set-mode','autopilot-status','autopilot-tick','autopilot-pause','autopilot-resume','system-health','reset-session','reset-session-full','create-evidence','upsert-todo','workflow-list'],inputText:['auth-code','sync-folder','message-id','thread-id','attachment-message-id','attachment-id','attachment-message-pk','autopilot-folder','evidence-message-pk','evidence-snippet','todo-id','todo-title','todo-evidence-id'],inputNumber:['sync-days','list-limit','thread-depth','autosync-minutes','autopilot-max-messages','autopilot-max-attachments','evidence-confidence'],select:['message-select','thread-select','attachment-select','autopilot-mode','todo-status'],p:['auth-status','login-url','loaded-at','autosync-status','autopilot-status-text'],pre:['result']};const miss=[];const check=(id,re)=>{if(!re.test(h))miss.push(id)};req.button.forEach(id=>check(id,new RegExp(`<button[^>]*id=\\\"${id}\\\"[^>]*type=\\\"button\\\"`)));req.inputText.forEach(id=>check(id,new RegExp(`<input[^>]*id=\\\"${id}\\\"[^>]*type=\\\"text\\\"`)));req.inputNumber.forEach(id=>check(id,new RegExp(`<input[^>]*id=\\\"${id}\\\"[^>]*type=\\\"number\\\"`)));req.select.forEach(id=>check(id,new RegExp(`<select[^>]*id=\\\"${id}\\\"`)));req.p.forEach(id=>check(id,new RegExp(`<p[^>]*id=\\\"${id}\\\"`)));req.pre.forEach(id=>check(id,new RegExp(`<pre[^>]*id=\\\"${id}\\\"`)));if(d.length||miss.length){console.error(JSON.stringify({duplicateIds:d,missingOrWrongType:miss},null,2));process.exit(1);}console.log('PASS: DOM ID/type invariant');"
    Expected Result: `PASS: DOM ID/type invariant` 출력, exit code 0
    Failure Indicators: duplicateIds/missingOrWrongType JSON 출력 또는 exit code 1
    Evidence: .sisyphus/evidence/task-7-dom-contract.txt

  Scenario: width-band visual regression (320/360/400+) + overflow 규칙
    Tool: Playwright
    Preconditions: sidepanel 렌더링 가능
    Steps:
      1. viewport width 320/360/400 각각에서 full-page screenshot 저장
      2. 각 폭에서 `window.innerWidth`, `document.documentElement.scrollWidth`, `document.body.scrollWidth` 수집
      3. `#result`와 non-`#result` 노드의 computed overflow-x/y 비교
    Expected Result: 320/360/400+ 모두 레이아웃 붕괴 없음, 페이지 수평 스크롤 없음, 내부 스크롤 예외는 `#result`만 허용
    Failure Indicators: `scrollWidth > innerWidth`, `#result` 외 요소에서 가로 스크롤 컨테이너 탐지
    Evidence: .sisyphus/evidence/task-7-width-bands-320-360-400.png

  Scenario: zoom 200% regression
    Tool: Playwright
    Preconditions: sidepanel 로드 완료
    Steps:
      1. emulate media/viewport 후 zoom 200% 상태(또는 equivalent scale)로 렌더
      2. 핵심 인터랙티브(`button/input/select`) clipping 여부와 focus ring 가시성 캡처
      3. 페이지 수평 overflow 재검사(`#result` 예외 유지)
    Expected Result: 200%에서도 컨트롤 잘림/겹침 없이 사용 가능, 수평 overflow 정책 유지
    Failure Indicators: 컨트롤 clipping, focus ring 소실, `scrollWidth > innerWidth`
    Evidence: .sisyphus/evidence/task-7-zoom-200.png

  Scenario: 상태 텍스트 장문 overflow 안정성 (auth/autosync/autopilot/result)
    Tool: Playwright
    Preconditions: 상태 문자열 주입 가능한 테스트 훅/DOM 조작 가능
    Steps:
      1. `#auth-status`, `#autosync-status`, `#autopilot-status-text`에 180자 이상 장문 주입
      2. `#result`에 다중 라인 장문 JSON 주입
      3. 각 노드 bounding box 및 페이지 overflow 재측정
    Expected Result: status 텍스트로 레이아웃 붕괴/페이지 수평 overflow 없음, `#result`는 내부 스크롤로만 수용
    Failure Indicators: 카드/row 폭 이탈, status 노드가 카드 밖으로 넘침, 페이지 스크롤바 발생
    Evidence: .sisyphus/evidence/task-7-long-status-overflow.json

  Scenario: CI command gate (final)
    Tool: Bash
    Preconditions: 문서/시각 변경 커밋 직전
    Steps:
      1. bun run test
      2. bun run coverage
      3. bun run ci
    Expected Result: 3개 명령 모두 exit code 0
    Failure Indicators: 임의 명령 실패(exit code != 0), coverage 임계치 미달, lint/type/test 단계 실패
    Evidence: .sisyphus/evidence/task-7-ci-gates.txt
  ```

- [x] 8. Rollout/Risk/Rollback (Visual-only)

  **What to do**:
  - 적용 순서를 "토큰 -> 레이아웃 -> 컴포넌트 시각 상태 -> QA 게이트"로 정의한다.
  - 단계별 롤백 포인트를 명시한다.
  - 커밋 전략은 시각 변경 단위로 작게 분리한다.

  **Must NOT do**:
  - 로직과 시각 변경을 한 커밋에 혼합하지 않는다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `git-master`
  - **Skills Evaluated but Omitted**:
    - `artistry`: 운영 리스크 태스크와 무관.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 final
  - **Blocks**: None
  - **Blocked By**: 7

  **References**:
  - `Agents.md` - 브랜치/PR/검증 규칙
  - `README.md` - `bun run ci` 기준
  - `.github/PULL_REQUEST_TEMPLATE.md` - PR 구조

  **Acceptance Criteria**:
  - [x] 롤아웃 단계 4단계 명시
  - [x] 각 단계별 롤백 포인트 명시
  - [x] 커밋 메시지 규칙(한글 + feat/fix/chore/test) 명시

  **4-Step Rollout Sequence (Visual-only, 실행 순서 고정)**:
  1. **Phase 1 - tokens**
     - 적용: `--nm-*` 토큰 정의/매핑(색/타이포/간격/모션) 문서와 스타일 선언 정렬.
     - Failure Signal: 토큰 누락/중복, 상태색(`--nm-state-*`)이 non-status 기본색으로 확산.
     - Rollback Point: 토큰 블록 커밋 단위로 되돌림(`chore:` 커밋 1개).
  2. **Phase 2 - layout**
     - 적용: 내부 one-column grid, 320/360/400+ 폭 밴드 spacing, overflow 정책(`#result` 예외) 반영.
     - Failure Signal: `scrollWidth > innerWidth`, `#result` 외 가로 스크롤 컨테이너 탐지.
     - Rollback Point: 레이아웃 CSS 블록/커밋만 선택 롤백(`feat:` 커밋 1개).
  3. **Phase 3 - component visual states**
     - 적용: checkbox/important/status/result panel의 시각 상태(색/경계/opacity)와 one-line density 규칙 반영.
     - Failure Signal: `important/completed/error/info` 의미 충돌, 2줄 row 발생, focus-visible 가시성 저하.
     - Rollback Point: 컴포넌트 상태 스타일 커밋만 롤백(`fix:` 커밋 1개).
  4. **Phase 4 - QA gates**
     - 적용: 불변 게이트(JS 무변경, ID/type 불변) + 시각 회귀(320/360/400+, zoom 200%) + CI 게이트 실행.
     - Failure Signal: 불변 게이트 실패, Playwright 회귀 스냅샷 diff 임계 초과, `bun run ci` 실패.
     - Rollback Point: QA 보강/증적 커밋만 롤백(`test:` 커밋 1개) 후 Phase 1~3 기준선 재검증.

  **Risk Matrix (Visual-only)**:

  | Risk | Failure Signal | Trigger Point | Rollback Action |
  |------|----------------|---------------|-----------------|
  | 토큰 오염(상태색 확산) | 일반 버튼/카드/입력에 `--nm-state-*` 적용 탐지 | Phase 1 종료 점검 | token 커밋 즉시 revert, 상태색 적용 범위 재고정 |
  | 레이아웃 붕괴(폭 밴드) | 320/360/400+ 중 1개라도 수평 overflow 발생 | Phase 2 검증 | layout 커밋만 revert 후 spacing token 조정 |
  | 밀도/접근성 충돌 | row 2줄화, focus-visible 식별 실패, 대비 임계 미달 | Phase 3 검증 | component state 커밋 revert 후 one-line/focus 규칙 재적용 |
  | 회귀 게이트 불통과 | invariant gate/`bun run ci` 실패 | Phase 4 게이트 | QA 관련 `test:` 커밋 rollback, 마지막 통과 스냅샷 기준선으로 복귀 |

  **Rollback Guide (Safe Revert, 시각 전용)**:
  - 변경 단위는 시각 블록별 커밋으로 분리하고, `extension/sidepanel.js`/API/native host 계약 변경 커밋은 생성하지 않는다.
  - 롤백은 `git revert <phase-commit>` 방식으로 수행하며, 여러 단계 실패 시 역순(Phase 4 -> 3 -> 2 -> 1)으로 적용한다.
  - 롤백 후 필수 재검증: JS immutability, DOM ID/type invariant, width-band overflow, `bun run ci`.
  - Visual-only 안전선: 텍스트 카피/DOM ID/컨트롤 타입/이벤트 바인딩/payload 계약은 롤백 전후 동일해야 한다.

  **Commit Policy Alignment (한글 + 타입 prefix)**:
  - 커밋 메시지는 한글로 작성하고 prefix는 `feat:`, `fix:`, `test:`, `chore:`만 사용한다.
  - 로직/계약 변경 금지 원칙에 따라 visual-only 변경은 `extension/sidepanel.html` 및 문서/증적 파일 중심으로 분리 커밋한다.
  - 권장 커밋 순서: `chore(토큰)` -> `feat(레이아웃)` -> `fix(컴포넌트 상태 보정)` -> `test(QA/게이트 문서화)`.
  - PR 단계에서 `.github/PULL_REQUEST_TEMPLATE.md`의 `위험/롤백` 섹션에 단계별 Rollback 포인트를 그대로 기입한다.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: 롤백 가능성 문서 검증
    Tool: Bash
    Preconditions: 계획 파일 최신
    Steps:
      1. grep -q "Rollback" .sisyphus/plans/chrome-sidepanel-neutral-minimal-grid-todo-plan.md
      2. grep -q "visual-only" .sisyphus/plans/chrome-sidepanel-neutral-minimal-grid-todo-plan.md
    Expected Result: visual-only 롤백 전략 존재
    Evidence: .sisyphus/evidence/task-8-rollback-check.txt
  ```

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1-2 | `chore: 사이드패널 시각 전용 범위와 토큰 체계 정리` | `extension/sidepanel.html` + docs | invariant checks + `bun run ci` |
| 3-5 | `feat: neutral minimal grid 시각 레이아웃 및 row 밀도 적용` | `extension/sidepanel.html` | Playwright visual QA + `bun run ci` |
| 6-7 | `fix: 접근성/저모션/시각 회귀 기준 보강` | `extension/sidepanel.html` + tests/evidence | invariant checks + `bun run ci` |
| 8 | `test: visual-only 롤백 및 검증 게이트 문서화` | plan/docs | checklist verification |

---

## Success Criteria

### Verification Commands
```bash
git diff --name-only -- extension/sidepanel.js   # Expected: no output
bun run test                                     # Expected: pass
bun run coverage                                 # Expected: pass thresholds
bun run ci                                       # Expected: pass all checks
```

### Final Checklist
- [x] 시각 전용 변경만 포함된다.
- [x] `extension/sidepanel.js` 변경 없음.
- [x] 기존 핵심 id/컨트롤 타입 보존.
- [x] one-line task density + 상태색 제한 + 저모션 규칙 반영.
- [x] 폭 320/360/400 + 줌 200% 시각 안정성 검증.

---

## Defaults Applied

- 기본 구현 범위는 `extension/sidepanel.html` 스타일 계층으로 제한한다.
- 텍스트 카피는 기존 문구를 유지한다(시각 계층/타이포만 조정).
- JS 없이 가능한 CSS 기반 시각 상태만 허용한다.

## Auto-Resolved

- "구조 변경 허용 여부"는 로직 리스크 최소화를 위해 보수적으로 해석: ID/타입/핵심 DOM 제어점 불변으로 고정.
- "외부 폰트 도입 여부"는 기본적으로 미도입(local-safe 스택 유지)으로 처리.

## Decisions Needed

- 없음 (사용자 지시 "로직 비변경 + 시각 전용"으로 명확함)
