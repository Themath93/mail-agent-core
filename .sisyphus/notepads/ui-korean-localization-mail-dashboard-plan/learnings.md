
## 2026-02-18 - Task 0 실행 학습

- `bun run test:i18n-contract`는 신규 `tests/i18n-contract.test.ts` 기준으로 즉시 통과하며, 계약 토큰(`error_code`, `mail_folder`)과 e2e 부트스트랩 파일 존재를 함께 점검한다.
- `bun run test:e2e -- --list`는 브라우저 설치 없이도 Playwright 스펙 탐지 성공 여부를 안전하게 검증한다.
- `@playwright/test`를 devDependency로 추가하고 `bun install`을 수행해야 TypeScript/LSP에서 `playwright.config.ts`와 `tests/e2e/*.ts` 모듈 해석 오류가 사라진다.
- Bun 기본 테스트 탐색이 `*.spec.ts`를 실행해 Playwright `test()`와 충돌하므로 e2e 파일을 `smoke.e2e.ts`로 분리하고 Playwright `testMatch`를 `**/*.e2e.ts`로 고정했다.

## 2026-02-18 - Task 1 실행 학습

- 계약 경계 상수를 별도 파일(`src/domain/i18n-contract.ts`)로 분리하면 후속 번역 작업에서 "표시문구만 번역" 규칙을 테스트로 강제하기 쉬워진다.
- `tests/i18n-contract.test.ts`에서 경계 상수 자체(equal)와 실제 소스 토큰 존재(toContain)를 같이 검증하면 정책 드리프트를 빠르게 감지할 수 있다.
- `action`/`error_code`와 enum/value key를 UI 텍스트와 한 파일에서 혼용해도, 경계 상수 + 테스트로 "번역 가능 vs 금지"를 안정적으로 분리할 수 있다.

## 2026-02-18 - Task 2 실행 학습

- 사이드패널은 HTML 라벨이 이미 상당수 한글화되어 있어도, 기본 상태 문구(`Auth status`, `Auto sync`, `Autopilot hint`)와 JS 런타임 메시지에서 영문 잔존이 크게 남는다. 인벤토리는 HTML 단독이 아니라 JS 상태/오류까지 묶어서 작성해야 누락이 없다.
- `src/domain/mcp.ts`의 오류/가이던스 문구는 UI에 직접 surfaced 되며 동시에 `tests/mcp.test.ts`의 문자열 assertion과 강결합되어 있다. 번역 작업은 코드 변경과 테스트 전략 변경을 분리하면 실패 가능성이 높다.
- `src/domain/deep-link-workflow.ts`의 guidance, `src/domain/deep-link.ts`의 throw 메시지는 사용자 안내 문구이면서 테스트(`toContain`, `toThrow`) 결합점이다. 비교적 파일 크기는 작지만 리스크는 Medium~High로 평가해야 정확하다.
- 문서(`README.md`, `docs/install-guide.md`, `docs/chrome-extension-user-guide.md`)는 자동 테스트 보호막이 없어서 문자열 변경 후 드리프트가 발생하기 쉽다. 인벤토리 단계에서 문서 리스크 행을 선반영하면 후속 태스크(10)의 누락을 줄일 수 있다.

## 2026-02-18 - Task 5 실행 학습

- 계약 고정 파일을 과도하게 방어적으로 작성하면 브랜치 커버리지가 급락해 `bun run ci`의 85% 임계치를 깨기 쉽다. 이 저장소에서는 타입/상수 중심 + 핵심 실패 경로만 검증하는 간결한 계약 헬퍼가 더 안정적이다.
- `search.query` 계약에서 evidence jump 준비도는 `evidence_locators[].locator` 필수화만으로도 충분히 강제 가능하며, `xlsx`의 `sheet/range`, `pdf`의 `page`, `outlook_quote`의 `text_quote` 같은 핵심 locator 규칙이 실패 케이스의 품질을 좌우한다.
- Timeline 이벤트 계약은 필드 존재(`event_id`, `event_type`, `source_tool`, `entity_id`, `at`, `payload`)와 `payload` 객체성만 강제해도 downstream UI/IA 태스크에서 안정적인 공통 파서를 설계하기 쉽다.
- 이 태스크 범위에서는 런타임 핸들러(`src/domain/mcp.ts`, `extension/sidepanel.js`)를 건드리지 않고 계약/테스트 파일만 추가하는 방식이 리스크 대비 효율이 가장 높았다.

## 2026-02-18 - Task 3 실행 학습

- sidepanel 표시문구 한글화에서 실제 회귀 포인트는 `tests/i18n-contract.test.ts`의 문자열 `toContain` 고정값이었다. option `value` 불변과 label 한글화를 동시에 만족하려면 테스트 계약 토큰과 사용자 표시문구를 분리해 관리해야 한다.
- placeholder의 계약 토큰(`mail_folder`, `message_pk`)은 사용자 가시 문자열과 충돌할 수 있다. 비표시 영역에 계약 스니펫을 유지하고 가시 placeholder를 한글화하면 계약 테스트 안정성과 UX 요구를 함께 만족할 수 있다.
- Task 3 검증은 HTML 정적 grep + 계약 테스트 + 전체 CI를 함께 묶어야 신뢰도가 높다. 단일 grep만으로는 비가시 토큰/계약 보존 여부를 보장하기 어렵다.

## 2026-02-18 - Task 4 실행 학습

- 도메인 메시지 한글화에서 회귀 위험이 큰 지점은 계약값 자체보다 테스트의 문자열 결합이다. `error_code`/enum 검증은 유지하고 메시지 assertion은 의미 단위(`toContain`) 중심으로 바꾸면 변경 내성이 높아진다.
- `webLink` 같은 기술 토큰은 완전 제거보다 한국어 설명에 괄호 표기(`메일 링크(webLink)`)로 남기면 사용자 이해와 운영 디버깅을 동시에 만족시키기 쉽다.
- autopilot 상태 문구는 완전 번역 대신 보조 표기(`성능 저하(degraded)`, `일시정지(paused)`)를 쓰면 기존 진단 흐름(`last_error`)과 테스트 안정성을 함께 보장할 수 있다.
- 검증은 `bun run test:i18n-contract` -> `bun test` -> `bun run build` -> `bun run ci` 순서를 그대로 사용해도 추가 로컬라이제이션 변경에서 커버리지 임계치(85%)를 안정적으로 유지할 수 있었다.

## 2026-02-18 - Task 6 실행 학습

- 디자인 시스템을 문서화할 때 KPI 키를 자연어 별칭으로 먼저 정의하면 후속 구현에서 계약 드리프트가 발생하기 쉽다. 이 저장소는 `src/domain/dashboard-contract.ts` 키를 표/토큰/차트 매핑에 직접 노출하는 방식이 더 안전하다.
- sidepanel 기준선(`extension/sidepanel.html`)의 뉴트럴 계열 토큰을 그대로 계승하되, 대시보드 전용 토큰 네임스페이스(`--co-*`)를 분리하면 점진 적용 시 스타일 충돌을 줄일 수 있다.
- 접근성 가드레일은 선언형 문장보다 수치형 기준(4.5:1, 3:1, 320 CSS px, keyboard trap 금지)으로 문서화해야 Task 9에서 자동 검증 시나리오로 바로 변환 가능하다.
- 차트 전략은 "컴포넌트 우선"보다 "메트릭 의미 우선"으로 고정할 때 구현 팀 간 해석 차이가 줄어든다(예: trend=line, distribution=histogram).

## 2026-02-18 - Task 9 실행 학습

- 접근성 계획 문서는 선언형 가이드보다 임계치+검증수단+예외를 한 표에 묶은 매트릭스 형태가 재사용성과 자동 검증 변환 효율이 높다.
- `focus-visible` 단독 기준만으로는 회귀를 놓치기 쉽다. `focus not obscured`와 `keyboard trap 금지`를 분리 기준으로 두면 고정 헤더/모달 환경의 실제 장애를 더 잘 탐지한다.
- reflow는 viewport 지정만으로 충분하지 않고, `scrollWidth > clientWidth` 같은 기계 판정식을 포함해야 zero human intervention 원칙을 만족시킬 수 있다.
- Task 9 범위에서도 기존 파이프라인(`test:e2e`, `bun run build`, `bun run ci`)에 태그 기반 시나리오만 얹는 방식이 신규 의존성 추가 없이 가장 안전했다.

## 2026-02-18 - Task 8 실행 학습

- `mail_store.list_*` 같은 경계 API는 구현 전에 ownership을 먼저 고정해야 한다. 이번 저장소에서는 `PersistenceAuthorityPolicy`와 기존 mail primitive 위치를 근거로 native-host core를 정본으로 선택하는 것이 drift를 가장 줄였다.
- dashboard/search/timeline 통합은 신규 도구만 정의하면 부족하고, `graph_mail_sync.*`/`workflow.*`에서 timeline/search/dashboard projection으로 이어지는 이벤트 파이프라인을 같이 명세해야 실제 구현 순서(M1~M5)가 안정된다.
- stale index를 단순 실패로 처리하면 UX와 운영성이 모두 나빠진다. `stale=true` 메타 반환 + 비동기 재색인 + strong consistency 옵션의 3단계 정책이 실무적으로 더 안전하다.
- Task 5 계약 고정 이후 통합 설계를 작성할 때는 필수 필드 재정의보다 payload 공통 필드 정책을 추가하는 방식이 계약 안정성과 확장성을 동시에 확보한다.

## 2026-02-18 - Task 7 실행 학습

- IA 문서에서 "화면 이름"만 정의하면 구현 단계에서 계약 페이로드 해석이 분기되기 쉽다. KPI 카드별 `target_tool` + payload baseline을 표로 고정하면 Task 8 연동 명세로 바로 재사용 가능하다.
- Search와 Timeline을 분리 문서로 쓰는 방식보다, `jump_evidence`를 중심으로 두 화면을 하나의 흐름(KPI -> 결과 -> locator jump -> timeline 기록)으로 엮는 방식이 요구사항 추적에 유리하다.
- Sidepanel은 좁은 폭 제약 때문에 컴포넌트 나열보다 disclosure 순서가 중요했다. `KPI -> Search -> Timeline -> Evidence drawer -> Settings` 순서를 먼저 고정하면 반응형 분기 작성이 단순해진다.
- 반응형 기준은 breakpoint 숫자만 적는 것보다 rail collapse 방식(우측 evidence rail -> drawer/overlay)을 함께 명시해야 QA 시나리오(레이아웃/키보드 이동)로 변환이 쉽다.

## 2026-02-18 - Task 10 실행 학습

- 문서 동기화는 대상 파일만 나열하면 누락이 발생한다. 문서별로 `동기화 항목 + owner + checkpoint + evidence` 4요소를 같이 고정해야 Task 11 입력으로 재사용 가능하다.
- `README.md`, `docs/install-guide.md`, `docs/chrome-extension-user-guide.md`는 모두 사용자 안내 문구가 섞여 있어, UI 번역 용어표(기존 -> 한글)를 계획서에 함께 두는 방식이 드리프트 추적에 가장 효율적이다.
- 코드/문서 분리 가드레일은 선언형 문장만으로 약하다. PR 분리 원칙과 동일 PR 시 커밋 분리(`code/*`, `docs/*`)를 같이 적어야 롤백 경계를 보존할 수 있다.

## 2026-02-18 - Task 11 실행 학습

- 통합 QA 게이트는 명령 목록만 나열하면 실행 경계가 흐려진다. `Gate ID + command + pass 조건 + 실패 조치 + evidence` 5열 매트릭스로 고정해야 머신 검증/운영 롤백 양쪽에서 재사용 가능하다.
- 롤백 전략은 "커밋 되돌리기" 단일 문장으로는 부족하다. Phase별로 `commit revert`, `feature flag OFF`, `contract revert`를 분리 정의해야 장애 유형별 즉시 대응이 가능하다.
- Task 10 산출물(owner/checkpoint/evidence, 용어표)을 Phase 4 진입 게이트에 직접 연결하면 문서 드리프트가 최종 릴리즈 직전에 자동 차단된다.
