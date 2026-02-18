
## 2026-02-18 - Task 0 i18n/e2e bootstrap

- `package.json`에 `test:i18n-contract`(`bunx vitest run tests/i18n-contract.test.ts`)와 `test:e2e`(`bunx playwright test`)를 추가해 실행 가능한 게이트를 고정했다.
- CI 기본 경로(`bun run ci`)는 변경하지 않고 독립 스크립트만 추가해 기존 lint/typecheck/test/coverage 흐름과 충돌을 방지했다.
- e2e는 `playwright.config.ts` + `tests/e2e/smoke.e2e.ts` 최소 구성으로 시작하고, 브라우저 실행 없이 `--list`로 게이트 배선 상태를 검증하도록 했다.

## 2026-02-18 - Task 1 로컬라이제이션 계약 경계 고정

- `src/domain/i18n-contract.ts`에 `TRANSLATABLE_UI_TEXT`와 `NON_TRANSLATABLE_CONTRACT_KEYS`를 분리 고정해 표시문구와 계약값 경계를 코드 상수로 명시했다.
- 번역 금지 계약값에 `action`, `error_code`, enum(`manual`, `review_first`, `full_auto`, `open`, `in_progress`, `done`), payload key(`mail_folder`, `message_pk`)를 포함해 후속 태스크의 불변 기준으로 사용한다.
- `tests/i18n-contract.test.ts`를 확장해 경계 상수 고정 + 실제 계약 소스(`src/domain/mcp.ts`, `extension/sidepanel.html`, `extension/sidepanel.js`) 보존 여부를 함께 검증하도록 결정했다.

## 2026-02-18 - Task 2 사용자 노출 문자열 인벤토리 확정

- 인벤토리 산출물은 `.sisyphus/notepads/ui-korean-localization-mail-dashboard-plan/ui-string-inventory.md` 단일 파일로 고정하고, 표준 컬럼을 `file path / string source type / risk / test-coupling impact / notes`로 통일했다.
- 분류 축은 명시적으로 2분할했다: (1) Translatable display strings, (2) Non-translatable contract tokens. 계약 토큰은 Task 1 경계(`action`, `error_code`, enum/value key, payload/query key)와 동일하게 유지한다.
- 테스트 결합 리스크는 `tests/mcp.test.ts`, `tests/deep-link.test.ts`, `tests/i18n-contract.test.ts`를 High로 고정해 Task 3/4에서 문자열 번역과 테스트 전환을 반드시 동시 설계하도록 결정했다.
- 문서 동기화 리스크 행(`README.md`, `docs/install-guide.md`, `docs/chrome-extension-user-guide.md`)을 인벤토리에 선반영해 Task 10 이전에도 용어 드리프트를 추적 가능하게 했다.

## 2026-02-18 - Task 5 Dashboard/Search/Timeline 계약 고정

- `src/domain/dashboard-contract.ts`를 신규 추가해 `dashboard.get_overview`, `search.query`, `timeline.list` 도구명을 상수/타입으로 고정하고, 입력/출력 계약 인터페이스와 파서 헬퍼를 함께 정의했다.
- Dashboard KPI는 `today_mail_count`, `today_todo_count`, `progress_status`, `weekly_completed_count`, `top_counterparties` 5개 필드를 불변 키로 고정하고, KPI별 drilldown 기본 매핑(`DASHBOARD_KPI_DRILLDOWN_DEFAULTS`)을 계약 산출물로 명시했다.
- Search 계약에는 evidence jump를 위한 `evidence_locators[].locator` 스키마를 포함하고, Timeline 계약에는 필수 이벤트 스키마(`event_id`, `event_type`, `source_tool`, `entity_id`, `at`, `payload`)를 검증하도록 결정했다.
- 검증 게이트는 `bun test tests/dashboard-contract.test.ts`, `bun run build`, `bun run ci` 순서로 고정했고, 커버리지 임계치(85%) 충족을 위해 계약 파일을 타입/상수 중심으로 단순화해 CI를 통과시켰다.

## 2026-02-18 - Task 4 domain 표시 메시지 한글화 + 테스트 전환

- `src/domain/mcp.ts`, `src/domain/evidence.ts`, `src/domain/deep-link.ts`, `src/domain/deep-link-workflow.ts`에서 사용자 노출 메시지의 영문 잔여 표현을 한국어 중심 문구로 정리하고, 계약 토큰(`error_code`, action name, enum/value key)은 변경하지 않기로 고정했다.
- `webLink`, `manual`, `paused`, `degraded`, `resume`처럼 운영/디버깅에 필요한 계약 친화 토큰은 메시지 내부에서 보조 표기로만 유지해 사용자 가독성과 계약 추적성을 함께 확보했다.
- 테스트는 문자열 완전 일치 의존을 최소화하는 방향으로 전환했다. `tests/deep-link.test.ts`의 가이던스 검증은 핵심 의미 단위(`메일 링크(webLink)`) 중심으로 정리하고, 변경된 사용자 메시지에 맞춰 `toThrow` 기대값만 최소 범위로 갱신했다.

## 2026-02-18 - Task 6 대시보드 디자인 시스템 정의

- 구현 산출물 경로를 `docs/dashboard-design-system-v1.md`로 고정하고, Task 7(IA) 및 Task 9(a11y/reduced-motion)의 단일 입력 문서로 사용하기로 결정했다.
- Calm Ops semantic token 체계를 `surface/text/border/state` 4계층으로 분리하고, sidepanel의 기존 뉴트럴 톤(`--nm-*`)과 충돌 없이 확장 가능한 `--co-*` 네이밍을 채택했다.
- KPI 차트 전략은 메트릭 의미 기반으로 고정했다: trend->line, status/category compare->stacked/grouped bar, pipeline->funnel, confidence distribution->histogram.
- `dashboard-contract` 고정 KPI(`today_mail_count`, `today_todo_count`, `progress_status`, `weekly_completed_count`, `top_counterparties`)를 문서 매핑의 기준 키로 사용해 UI 선행 구현으로 계약이 흔들리지 않도록 결정했다.

## 2026-02-18 - Task 3 sidepanel 표시문구 한글화 실행

- `extension/sidepanel.html`의 사용자 가시 텍스트(헤딩/버튼/placeholder/기본 상태문구)를 한국어로 전환하고, `id`/`type`/DOM 구조는 변경하지 않기로 고정했다.
- select 계약값은 불변으로 유지했다: `manual`, `review_first`, `full_auto`, `open`, `in_progress`, `done`.
- option 표시 라벨은 한국어로 전환하고, `tests/i18n-contract.test.ts`의 계약 토큰 보호 검증과 충돌하지 않도록 비표시 `template`에 계약 토큰 스니펫을 유지하는 방식으로 합의했다.
- Task 3 완료 게이트는 `bun run test:i18n-contract`, `bun run build`, `bun run ci` 3종 통과와 `extension/sidepanel.js` 무변경 확인으로 확정했다.

## 2026-02-18 - Task 9 접근성/저모션/반응형 검증 패키지 고정

- Task 9 산출물 경로를 `docs/dashboard-a11y-validation-v1.md`로 고정하고, WCAG/USWDS/Carbon 기반 기준을 `MUST/SHOULD/TEST METHOD` 매트릭스로 구조화했다.
- 수치 임계치는 text contrast `4.5:1`, large text `3:1`, non-text contrast `3:1`, reflow `320 CSS px`, keyboard trap 금지로 고정했다.
- Playwright 템플릿 태그를 `@a11y`, `@keyboard`, `@reduced-motion`, `@ko-layout`로 통일해 기존 `test:e2e` 부트스트랩(Task 0)과 직접 연결되도록 결정했다.
- 완료 게이트는 `bun run build`와 `bun run ci` 성공을 필수로 하고, 실패 시 Task 9 체크박스를 완료 처리하지 않는 정책을 재확정했다.

## 2026-02-18 - Task 8 MCP/Storage/Index 통합 설계 명세

- Task 8 산출물 문서를 `docs/dashboard-mcp-storage-integration-v1.md`로 고정하고, Task 11 통합 QA 게이트의 입력 명세로 사용하기로 결정했다.
- `mail_store.list_*` source-of-truth는 extension/native wrapper가 아니라 native-host core(`src/domain/mcp.ts` + `src/storage/interface.ts`)로 확정했다. Extension은 조회/표시 전용으로 제한한다.
- 신규 통합 도구 범위를 `mail_store.list_messages`, `mail_store.list_threads`, `dashboard.get_overview`, `search.query`, `timeline.list` 5개로 정의하고, `MCP_TOOL_HANDLERS` 기반 확장 경로를 표준으로 고정했다.
- 이벤트 모델은 Task 5 고정 필드(`event_id`, `event_type`, `source_tool`, `entity_id`, `at`, `payload`)를 유지하고, payload 공통 필드(`schema_version`, `correlation_id`, `run_id`, `entity_kind`, `mutation`)를 v1 필수 정책으로 채택했다.
- storage/index 확장은 projection + checkpoint 중심으로 설계하고, 마이그레이션 순서를 M1(계약)->M2(키)->M3(이벤트 파이프라인)->M4(조회 도구)->M5(백필/재색인)로 고정했다.

## 2026-02-18 - Task 7 Dashboard/Search/Timeline IA 및 화면 구성 명세

- Task 7 산출물 경로를 `docs/dashboard-ia-screen-spec-v1.md`로 고정하고, Desktop tri-pane/Sidepanel single-column을 동일 계약(`src/domain/dashboard-contract.ts`) 위에 병렬 정의하기로 결정했다.
- KPI 드릴다운은 계약 기본값(`DASHBOARD_KPI_DRILLDOWN_DEFAULTS`)을 기준으로 5개 카드 각각의 `target_tool`/`payload`를 명시하고, 사용자 필터 merge 규칙(`statuses`, `counterparty_ids`, `event_types`, `from`, `to`)을 고정했다.
- Search 결과 레이아웃에는 `available_actions`의 `jump_evidence`를 중심 affordance로 두고, locator 타입별(`pdf/xlsx/pptx/docx/image/outlook_quote`) 점프 필드 표시 규칙과 실패 폴백(`open_source`)을 함께 명세하기로 확정했다.
- Timeline 화면은 이벤트 스키마 필수 필드(`event_id`, `event_type`, `source_tool`, `entity_id`, `at`, `payload`)를 화면 구조/드릴다운 흐름에서 누락 없이 노출하는 방식을 표준으로 채택했다.

## 2026-02-18 - Task 10 사용자 문서 동기화 계획

- Task 10 본문에 `문서 동기화 실행안` 섹션을 추가하고, 대상 문서를 `README.md`, `docs/install-guide.md`, `docs/chrome-extension-user-guide.md` 3개로 고정했다.
- 각 문서에 대해 동기화 항목, owner, checkpoint, evidence 경로를 표로 명시해 문서 드리프트를 자동 점검 가능한 형태로 정의했다.
- UI 용어 변경 추적표를 `기존 용어 -> 새 한글 용어` 형식으로 추가하고, `Auth status`, `signed-in`, `initial sync`, `delta sync`, `callback URL`, `Auto sync` 등 혼합 표기를 한글 기준으로 통일하기로 결정했다.
- 분리 가드레일을 실행 규칙으로 명문화했다: 코드 변경 PR과 문서 변경 PR을 분리하고, 동일 PR이 필요한 경우에도 `code/*`와 `docs/*` 커밋 경계를 유지한다.

## 2026-02-18 - Task 11 통합 QA 게이트 + 롤아웃/롤백 전략

- Task 11의 통합 게이트를 4개로 고정했다: G1(`bun run test && bun run coverage && bun run ci`), G2(`bun run test:i18n-contract`), G3(`bun run test tests/dashboard-contract.test.ts`), G4(`bun run test:e2e -- --grep "@dashboard|@a11y|@keyboard|@reflow|@reduced-motion|@ko-layout"`).
- 롤아웃은 Phase 1~4로 유지하되, 각 Phase에 대해 롤백 액션을 명시적으로 분리했다: 직전 안정 커밋 revert, feature flag 비활성화, dashboard 계약 revert, docs revert/릴리즈 보류.
- Task 10 결과를 Phase 4 선행조건으로 승격했다. `README.md`, `docs/install-guide.md`, `docs/chrome-extension-user-guide.md`의 checkpoint/evidence와 용어표 재검증을 최종 승인 조건으로 고정했다.
- 계획 레벨 종료 조건을 확정했다: Task 11 acceptance 기준 충족 + G1~G4 통과 + Task 10 문서 체크포인트 충족 시 Definition of Done 및 Final Checklist를 완료 처리한다.
