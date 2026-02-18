# Dashboard IA & Screen Spec v1

- 작성일: 2026-02-18
- 범위: Dashboard/Todos/Search/Settings IA 및 화면 구성 명세 (구현 코드 제외)
- 입력 기준: `src/domain/dashboard-contract.ts`, `docs/dashboard-design-system-v1.md`, `pm_notes/outlook_mail_agent_prd_v0_2.md`, `pm_notes/outlook_mail_agent_detailed_plan_v0_2.md`, `extension/sidepanel.html`

## 1) 목적

- Dashboard KPI -> drilldown -> Evidence jump 흐름을 계약 키 기준으로 고정한다.
- Desktop tri-pane과 sidepanel single-column의 정보구조를 동일 계약 위에서 다르게 배치한다.
- Task 8(MCP/Storage/Index)와 Task 11(통합 QA)이 바로 참조 가능한 화면/이벤트 단위 산출물을 제공한다.

## 2) Global IA

### 2.1 Top-level navigation

1. Dashboard
2. Todos
3. Search
4. Settings

### 2.2 공통 상태/필터 컨텍스트

- date window: `today` | `current_week` | `last_7_days`
- todo status: `open` | `in_progress` | `done`
- query scope: `all` | `mail` | `attachment` | `work_item` | `timeline_event`
- sort: `relevance` | `newest` | `oldest`

공통 원칙:
- 화면 라벨은 한글, 계약 토큰은 payload/value에서 영문 불변 유지.
- 상단 전역 필터 변경은 Dashboard card drilldown, Search query, Timeline stream 모두에 동일 반영.

## 3) Desktop IA (>= 1280) - Tri-pane

열 구성:
- Left pane: KPI/요약/탭 진입 네비게이션
- Center pane: Search 결과 또는 Timeline stream (현재 선택된 작업 컨텍스트)
- Right pane: Evidence rail (원문 근거, locator, deep-link action)

정보 흐름:
1. Left KPI card 클릭 -> `search.query` 또는 `timeline.list` payload 생성
2. Center에서 결과 목록 렌더
3. 결과 아이템의 `available_actions`에서 `jump_evidence` 선택
4. Right evidence rail에 `evidence_locators` 펼침
5. `Evidence jump` 실행(`open_source`/`jump_evidence`/`open_timeline`)

## 4) Sidepanel IA - Single-column

기본 원칙:
- `extension/sidepanel.html` 운영 콘솔을 대체하지 않고, 정보 탐색 순서를 단일열 progressive disclosure로 정의.
- 순서: KPI 요약 -> Search quick input -> Timeline compact list -> Evidence drawer -> Settings quick actions

단일열 섹션:
1. KPI strip(5개 핵심 KPI)
2. Quick Search (`query`, `scope`, `date_window`)
3. Result list (최대 10, 더보기로 pagination)
4. Timeline mini stream (최신 20)
5. Evidence bottom drawer (collapsed default)
6. Settings(로그인/동기화/자동화 상태)

## 5) Screen Composition Specs

### 5.1 Dashboard

필수 카드:
- `today_mail_count`
- `today_todo_count`
- `progress_status`
- `weekly_completed_count`
- `top_counterparties`

카드 공통 구조:
- 헤더: KPI 이름 + date window 뱃지
- 본문: 현재 값 + 비교값(전일/전주) + 상태 라벨
- 푸터: "드릴다운" 액션(클릭 시 계약 payload 전개)

KPI -> drilldown target/payload 매핑(계약 고정):

| KPI key | target_tool | payload baseline | binding/확장 |
|---|---|---|---|
| `today_mail_count` | `search.query` | `{ date_window: "today", limit: 50 }` | 필요 시 `scope: "mail"` 우선 |
| `today_todo_count` | `search.query` | `{ scope: "work_item", date_window: "today", limit: 50 }` | status pill 클릭 시 `statuses` 추가 |
| `progress_status` | `timeline.list` | `{ date_window: "today", event_types: ["status_changed"], limit: 100 }` | segment 클릭 시 `entity_id` 또는 기간 필터 추가 |
| `weekly_completed_count` | `search.query` | `{ scope: "work_item", date_window: "current_week", statuses: ["done"], limit: 50 }` | 완료율 drilldown에서 `sort: "newest"` 권장 |
| `top_counterparties` | `search.query` | `{ scope: "all", date_window: "last_7_days", limit: 100, bindings: [{ token: "counterparty_id", target_field: "counterparty_ids" }] }` | row 클릭값을 `counterparty_ids[]`로 바인딩 |

### 5.2 Todos

리스트 레이아웃:
- 열: 제목, 상태(`open/in_progress/done`), 마감/업데이트 시각, 근거 수
- 행 액션: 상세 열기, Timeline 열기, Evidence jump

상세 레이아웃:
- 요약(상태/담당 상대/마감)
- 연결 증거 목록(`evidence_id`, `source_kind`, `source_id`, `locator`)
- 변경 이력 Timeline(해당 `entity_id` 중심)

Todos -> Search/Timeline 연계:
- 상태 클릭 -> `search.query.filters.statuses`
- 타임라인 버튼 -> `timeline.list({ entity_id, include_payload: true })`

### 5.3 Search

입력 패널:
- 필수: `query`
- 선택: `scope`, `filters.date_window`, `filters.statuses`, `filters.counterparty_ids`, `filters.has_evidence`, `sort`, `limit`

결과 카드 레이아웃 (`SearchQueryResultItem` 기준):
- Header: `title`, `source_type`, `occurred_at`, `score`
- Body: `snippet`
- Footer: action chips (`open_source`, `jump_evidence`, `open_timeline`)
- Evidence locator preview: `evidence_locators` 첫 1~2개 축약 표시

Evidence jump affordance:
- `jump_evidence` 액션은 evidence drawer를 열고 locator 후보를 명시적으로 선택하게 한다.
- locator 표시 필드:
  - 공통: `evidence_id`, `source_kind`, `source_id`
  - 타입별: `page`(pdf), `slide`(pptx), `sheet/range`(xlsx), `paragraph_index`(docx), `bbox`/`anchor`, `text_quote`
- 선택 즉시 deep link 호출 실패 시 폴백(`open_source`)을 같은 위치에 제공한다.

### 5.4 Timeline

stream 레이아웃:
- 그룹: 날짜(day) -> 이벤트 카드
- 카드 헤더: `event_type`, `at`, `source_tool`
- 카드 본문: `entity_id` + payload summary
- 카드 액션: "관련 검색", "근거 열기", "원문 컨텍스트"

이벤트 스키마 표시(필수 필드 고정):
- `event_id`
- `event_type` (`message_synced`, `attachment_synced`, `evidence_created`, `todo_created`, `todo_updated`, `status_changed`, `deep_link_opened`)
- `source_tool`
- `entity_id`
- `at`
- `payload`

Timeline -> Search/Evidence 연계:
- 이벤트 클릭 -> `search.query` with `filters.event_types` + `entity_id` 맥락 쿼리
- `deep_link_opened` 이벤트는 관련 `Evidence jump` 기록을 우선 노출

### 5.5 Settings

섹션:
1. 인증 상태/로그인 관리
2. 동기화 범위(`mail_folder`, 기간, 자동 동기화 간격)
3. 자동화 모드(`manual`, `review_first`, `full_auto`)
4. 운영/복구(헬스체크, 세션 리셋)

IA 역할:
- Settings는 탐색 허브가 아니라 상태/제어 패널이다.
- Dashboard/Search/Timeline의 데이터 표현 계약은 Settings 변경과 독립 유지.

## 6) KPI -> Drilldown -> Evidence jump Flow Specs

### 6.1 표준 플로우

1. KPI 카드 선택
2. `DashboardKpiDrilldowns[kpi_key]`에서 `target_tool`/`payload` 로드
3. payload에 사용자 필터 merge (`from`, `to`, `statuses`, `counterparty_ids`, `event_types`)
4. 결과 렌더링(Search list 또는 Timeline stream)
5. 결과 액션 `jump_evidence` 선택
6. `EvidenceJumpReference.locator` 기반 deep link 실행
7. 성공/실패 이벤트를 Timeline에 `deep_link_opened`로 기록

### 6.2 실패 처리

- locator 불충분/실패: 대체 액션 `open_source` 노출
- 결과 0건: 동일 payload 유지 + 필터 완화 제안(`date_window` 확장)
- 권한/동기화 지연: Settings 빠른 이동 CTA 제공

## 7) Responsive Branches

### 7.1 `>= 1280px`

- 3열 tri-pane 고정(Left 320 / Center fluid / Right 360 권장)
- Evidence rail 항상 표시
- Timeline과 Search는 center pane에서 탭 전환

### 7.2 `768px ~ 1279px`

- 2열(Left + Center)로 축소
- Right evidence rail은 drawer/overlay로 collapse
- KPI 상세 테이블(`top_counterparties`)은 condensed row 사용

### 7.3 `<= 767px`

- 1열 스택
- 전역 필터 상단 고정
- Search 결과에서 Timeline은 인라인 섹션으로 접기/펼치기
- Evidence는 full-width bottom sheet

### 7.4 Sidepanel width behavior

- 기본 폭 320~420px 단일열 유지
- 360px 미만: KPI를 2열 미니 카드 -> 1열 순차 전환
- 400px 이상: quick actions(검색/타임라인/근거)를 한 행에 최대 2개 배치
- 모든 폭에서 horizontal scroll 금지

## 8) 구현 인계 체크리스트 (Task 8/9 입력)

- Dashboard/Todos/Search/Settings IA가 동일 계약 키(`dashboard-contract`)로 연결되는가
- KPI 5종이 각각 고정 `target_tool`/`payload`와 1:1 매핑되는가
- Search 결과에서 `Evidence jump` affordance와 locator 타입별 UI가 정의되었는가
- Timeline stream이 이벤트 스키마 6필드를 누락 없이 표시/전달하는가
- 반응형 분기(`>=1280`, `768-1279`, `<=767`, sidepanel 폭 규칙)가 명시되었는가
