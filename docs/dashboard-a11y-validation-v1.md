# Dashboard A11y Validation v1

- 작성일: 2026-02-18
- 목적: Task 9 `접근성/저모션/반응형 검증 계획`을 실행 가능한 자동 검증 패키지로 고정
- 입력 기준: `docs/dashboard-design-system-v1.md`, `src/domain/dashboard-contract.ts`, `.sisyphus/plans/ui-korean-localization-mail-dashboard-plan.md`
- 실행 원칙: Zero Human Intervention (명령 기반 재현 가능)

## 1) Scope and Gate

- 검증 범위: Dashboard/Search/Timeline 핵심 상호작용 화면(데스크톱 tri-pane + sidepanel single-column)
- 최소 게이트: `bun run test:e2e` + `bun run build` + `bun run ci`
- CI 정렬: 접근성 시나리오는 `test:e2e` 태그(`@a11y`, `@keyboard`, `@reduced-motion`, `@ko-layout`)로 실행되며 최종 게이트는 `bun run ci` 통과를 필수로 한다.

## 2) Strict Validation Matrix (Must/Should/Test Method)

| Domain | Rule Type | Threshold | Test Method | Pass Criteria | Fail Criteria | Acceptable Exceptions |
|---|---|---|---|---|---|---|
| Text Contrast | MUST | 일반 텍스트 `4.5:1` 이상, 큰 텍스트 `3:1` 이상 | Playwright + `getComputedStyle` 색상 추출 + 명암비 계산 유틸 | 샘플링 대상 전 항목 임계치 이상 | 단일 항목이라도 임계치 미달 | 로고/브랜드 장식 텍스트(정보 전달 비핵심, 인터랙션 없음) |
| Non-text Contrast | MUST | 아이콘/경계/포커스 인디케이터 `3:1` 이상 | Playwright 스크린샷 + 토큰 매핑 확인(`--co-border-focus` 등) + 계산 유틸 | 인터랙티브 컴포넌트 상태 표시가 3:1 이상 | 포커스 링/아이콘/경계 중 하나라도 3:1 미만 | 비활성 장식 분리선(정보/상태 전달 없음) |
| Focus Visible | MUST | 모든 인터랙션 요소 `:focus-visible` 표시, outline 제거 금지 | Playwright `Tab` 순회 + bounding box/스타일 검사 | 모든 focusable 요소에서 가시적 focus indicator 탐지 | focus indicator 미표시/`outline: none` 단독 사용 | 없음 |
| Focus Not Obscured | MUST | 포커스 대상이 고정 헤더/패널에 가려지지 않음(WCAG 2.4.11 취지) | Playwright `Tab` 이동 시 `scrollIntoView` 결과와 viewport 교차 확인 | 활성 요소의 가시 영역 비율 >= 90% | 포커스 요소가 10% 초과 가려짐 | 가상 키보드/OS 오버레이로 인한 일시적 가림(재시도 1회 후 제외) |
| Keyboard-only Flow | MUST | Tab/Shift+Tab/Enter/Space/Escape만으로 핵심 시나리오 완료 | Playwright 키보드 이벤트만 사용해 end-to-end 플로우 수행 | 마우스 없이 KPI -> drilldown(`search.query`/`timeline.list`) -> evidence jump 진입 성공 | 클릭 의존 단계 발생, 논리 순서 불일치, 조작 불가 | read-only 차트 tooltip hover 정보(대체 텍스트 존재 시) |
| Keyboard Trap Prohibition | MUST | keyboard trap 금지 (언제나 탈출 가능) | Playwright에서 모달/드롭다운/패널 진입 후 `Tab`/`Escape` 반복 검증 | 포커스 순환 또는 컨텍스트 이탈이 의도대로 동작 | 포커스가 특정 영역에 고정되어 탈출 불가 | 보안상 의도된 포커스 제한 컴포넌트(명시 문서 필요) |
| Reduced Motion | MUST | `prefers-reduced-motion: reduce`에서 비필수 모션 제거, 전환 0.01ms 수준 | Playwright context의 reducedMotion 설정 + 스타일 스냅샷 비교 | 애니메이션/전환 실질 비활성화, 정보 손실 없음 | 동작 지연/깜박임/지속 모션 잔존 | 데이터 시각화 즉시 상태전환(페이드 없음) |
| Reflow | MUST | `320 CSS px`에서 가로 스크롤 없이 핵심 정보 접근 가능 | Playwright viewport `320x720` + `document.scrollingElement.scrollWidth` 검사 | 문서 가로 스크롤 없음, KPI/검색/타임라인 접근 성공 | `scrollWidth > clientWidth` 또는 핵심 CTA 접근 불가 | 코드 블록/긴 불변 ID 문자열의 단어 단위 예외(수평 스크롤이 컴포넌트 내부에 한정될 때) |
| Keyboard Order | SHOULD | 시각 순서와 Tab 순서 불일치 0건 권장 | Playwright 순회 로그와 DOM order 비교 | 불일치 없음 또는 보조기기 친화적 의도 설명 존재 | 비의도 순서 역전 발생 | skip-link 우선 포커스 등 접근성 향상 목적 |
| Live Region Announce | SHOULD | 오류/성공 상태를 `aria-live` 또는 `role="alert"`로 전달 | Playwright + 접근성 스냅샷 트리 확인 | 상태 메시지 노드가 live region 규칙 충족 | 상태 변화가 스크린리더에 전달되지 않음 | 비동기 상태가 아닌 정적 도움말 |

## 3) Playwright Scenario Templates

아래 템플릿은 `tests/e2e/` 하위에 추가 가능한 스펙 골격이다.

### 3.1 a11y-contrast.e2e.ts (`@a11y`)

```ts
import { test, expect } from "@playwright/test";

test("@a11y 텍스트/비텍스트 대비 임계치", async ({ page }) => {
  await page.goto("/");
  // TODO: 검증 대상 selector 목록을 대시보드 컴포넌트에 맞게 확정
  // 1) foreground/background 색 추출
  // 2) contrast ratio 계산
  // 3) text 4.5:1 / large 3:1 / non-text 3:1 assert
  expect(true).toBeTruthy();
});
```

### 3.2 a11y-focus-keyboard.e2e.ts (`@a11y @keyboard`)

```ts
import { test, expect } from "@playwright/test";

test("@keyboard focus-visible, focus-not-obscured, trap 금지", async ({ page }) => {
  await page.goto("/");
  // Tab 순회로 focus-visible 탐지
  // 고정 레이아웃에서 focus 가림 여부 확인
  // 모달/드롭다운 진입 후 Escape/Shift+Tab으로 탈출 가능성 검증
  expect(true).toBeTruthy();
});
```

### 3.3 a11y-reduced-motion.e2e.ts (`@a11y @reduced-motion`)

```ts
import { test, expect } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("@reduced-motion 비필수 모션 제거", async ({ page }) => {
  await page.goto("/");
  // transition/animation duration 축소 확인
  // 상태 전환 시 정보 손실 없는지 확인
  expect(true).toBeTruthy();
});
```

### 3.4 a11y-reflow-320.e2e.ts (`@a11y @ko-layout`)

```ts
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 320, height: 720 } });

test("@ko-layout 320 CSS px reflow", async ({ page }) => {
  await page.goto("/");
  const hasHorizontalOverflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return root.scrollWidth > root.clientWidth;
  });
  expect(hasHorizontalOverflow).toBeFalsy();
});
```

## 4) Evidence Artifact Spec

| Artifact | Producer | Contents | Pass/Fail Anchor |
|---|---|---|---|
| `.sisyphus/evidence/task-9-a11y-thresholds.txt` | Bash grep | `4.5:1`, `focus-visible`, `320 CSS px`, `keyboard trap` 키워드 존재 로그 | 기준 문서 수치 존재 |
| `.sisyphus/evidence/task-9-playwright-tags.txt` | Bash | `test:e2e` 실행 명령과 태그 전략(`@a11y`, `@keyboard`, `@reduced-motion`, `@ko-layout`) | 실행 배선 확인 |
| `.sisyphus/evidence/task-9-build.txt` | Bash | `bun run build` 출력 요약 | 빌드 성공 |
| `.sisyphus/evidence/task-9-ci.txt` | Bash | `bun run ci` 출력 요약 | CI 성공 |

## 5) Execution Order (Automation)

1. `bun run test:e2e -- --grep "@a11y|@keyboard|@reduced-motion|@ko-layout"`
2. `bun run build`
3. `bun run ci`

실행 정책:
- 하나라도 실패하면 Task 9 완료 처리 금지
- 실패 로그는 동일 artifact 경로에 append하고 원인/복구 포인트를 기록

## 6) Contract Alignment Guard

- KPI drilldown 경로는 `src/domain/dashboard-contract.ts`의 `search.query`, `timeline.list`를 기준으로 검증 시나리오를 작성한다.
- 검증 문서/테스트에서 계약 키(`today_mail_count`, `today_todo_count`, `progress_status`, `weekly_completed_count`, `top_counterparties`)는 번역하지 않는다.
- 본 문서는 계획/검증 패키지 산출물이며, 런타임 UI 코드 변경 없이 적용 가능해야 한다.
