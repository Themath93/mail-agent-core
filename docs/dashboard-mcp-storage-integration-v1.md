# Dashboard MCP/Storage/Index Integration v1

## 1. 목적/범위

- Task 8 산출물로 `dashboard.get_overview`, `search.query`, `timeline.list`를 기존 MCP 런타임(`src/domain/mcp.ts`)에 연결하기 위한 통합 설계 명세를 고정한다.
- 구현 코드는 포함하지 않는다. 본 문서는 계약/스토리지/인덱스/동기화/복구 정책의 source-of-truth를 정의한다.
- Task 5에서 고정된 계약 키/토큰을 그대로 사용하며, 번역 금지 계약값 정책을 유지한다.

## 2. 기준선 (현행 시스템)

- MCP 도구 실행 진입점: `invokeMcpTool` / `invokeMcpToolByName` + `MCP_TOOL_HANDLERS` (`src/domain/mcp.ts`).
- 상태 저장 추상화: `createStateStorageAdapter`, `createMcpStorage`, `MCP_STORAGE_KEYS` (`src/storage/interface.ts`).
- 대시보드 계약 고정: `dashboard.get_overview`, `search.query`, `timeline.list` 및 `TimelineEvent` 필수 필드 (`src/domain/dashboard-contract.ts`).
- 상세 계획 정합 요구: Graph sync 기반 로컬 저장 + 검색/타임라인/대시보드 연결 (`pm_notes/outlook_mail_agent_detailed_plan_v0_2.md`, Epic F).

## 3. Source-of-Truth 결정 (`mail_store.list_*`)

### 3.1 소유권 결정

- **최종 소유권(Authority): native-host core (`src/domain/mcp.ts` + `src/storage/interface.ts`)**
- Extension은 조회/표시 전용 클라이언트로 동작하고, `mail_store.list_*` 데이터의 정본을 보유하지 않는다.
- 외부 native-host wrapper/transport는 실행 경계일 뿐이며, 데이터 의미적 정본은 core 런타임/스토리지 계층이다.

### 3.2 결정 근거

- 기존 `PersistenceAuthorityPolicy.phase_1.source_of_truth`가 `native-host/state.json`으로 이미 고정되어 있다.
- 현재 mail primitive(`mail_store.get_message`, `mail_store.get_thread`)가 core 상태(Map) 기반으로 구성되어 있어 list 계열도 동일 권한 경계로 유지해야 drift가 줄어든다.
- Extension 로컬 캐시를 정본으로 허용하면 Graph sync/워크플로우 이벤트와 정합성 보장이 어려워진다.

### 3.3 동기화 정책

- `graph_mail_sync.initial_sync`/`graph_mail_sync.delta_sync`/`graph_mail_sync.download_attachment` 및 workflow 계열 도구가 **canonical store**를 갱신한다.
- `mail_store.list_messages`/`mail_store.list_threads`는 canonical store + projection index를 읽는다.
- projection이 stale이면 list 도구는 다음 순서로 처리한다.
  1. 현재 projection으로 즉시 응답(지연 최소화)
  2. 응답 payload에 `stale=true`, `index_lag_ms`, `checkpoint` 포함
  3. 백그라운드 재색인 예약
- 정합성 우선 호출(예: dashboard 집계 직전)에서는 `consistency="strong"` 옵션으로 on-demand 재계산 후 응답한다.

## 4. 신규 도구 통합 아키텍처 (설계)

## 4.1 MCP ToolName 확장

- Dashboard/Search/Timeline 도구를 `McpToolName`, `MCP_TOOL_NAMES`, `McpToolInput`, `McpToolOutput`, `MCP_TOOL_HANDLERS`에 등록한다.
- 메일 list 계열을 함께 도입한다.
  - `mail_store.list_messages`
  - `mail_store.list_threads`
  - `dashboard.get_overview`
  - `search.query`
  - `timeline.list`

## 4.2 Handler 레이어 분리

- `mcp.ts` 내부에 아래 핸들러 그룹(또는 동등한 모듈 분리)을 둔다.
  - `handleMailListMessages`
  - `handleMailListThreads`
  - `handleDashboardGetOverview`
  - `handleSearchQuery`
  - `handleTimelineList`
- 각 핸들러는 공통 파이프라인을 따른다.
  1. 계약 파서 검증(`dashboard-contract` 파서 재사용)
  2. auth/context 검증
  3. projection/index 조회
  4. stale 여부 판단 및 재색인 트리거
  5. 계약 출력 직렬화

## 4.3 기존 primitive 연결 경로

- `graph_mail_sync.*` -> mail canonical 갱신 + timeline event 생성 + search/doc index 갱신 큐 적재
- `workflow.create_evidence`/`workflow.upsert_todo` -> timeline event 생성 + work_item/evidence 검색 인덱스 갱신
- `mail_store.get_message`/`mail_store.get_thread` -> detail 조회 primitive 유지
- `mail_store.list_*` -> dashboard/search의 공통 메일 집계 입력
- `dashboard.get_overview` -> `mail_store.list_*` + workflow 상태 projection + timeline 요약 projection
- `search.query` -> unified search index(메일/첨부/work_item/timeline_event)
- `timeline.list` -> timeline event log/index

## 5. Storage/Index 스키마 확장 맵

## 5.1 Storage Key 확장 (`src/storage/interface.ts`)

- `MCP_STORAGE_KEYS.mail`
  - `listProjectionMessages: "mail.listProjectionMessages"`
  - `listProjectionThreads: "mail.listProjectionThreads"`
  - `projectionCheckpoint: "mail.projectionCheckpoint"`
- `MCP_STORAGE_KEYS.timeline`
  - `events: "timeline.events"`
  - `cursorBySourceTool: "timeline.cursorBySourceTool"`
  - `checkpoint: "timeline.checkpoint"`
- `MCP_STORAGE_KEYS.search`
  - `documents: "search.documents"`
  - `invertedIndex: "search.invertedIndex"`
  - `checkpoint: "search.checkpoint"`
- `MCP_STORAGE_KEYS.dashboard`
  - `overviewSnapshot: "dashboard.overviewSnapshot"`
  - `overviewCheckpoint: "dashboard.overviewCheckpoint"`

## 5.2 인덱스 엔터티

- `mail.listProjectionMessages`: list 정렬/필터에 필요한 최소 필드 뷰(메시지 원문 중복 저장 금지)
- `mail.listProjectionThreads`: thread 단위 요약 뷰(최근 메시지 시각, 참여자, 미처리 todo 수)
- `timeline.events`: append-only 이벤트 로그
- `search.documents`: source_type별 문서 스냅샷
- `search.invertedIndex`: 토큰 -> document reference 맵
- `dashboard.overviewSnapshot`: KPI 계산 캐시

## 5.3 마이그레이션 순서

1. **M1 계약 고정**: 신규 ToolName/입출력 타입 선언(런타임 미연결)
2. **M2 스토리지 키 추가**: `MCP_STORAGE_KEYS`/adapter/read API 확장
3. **M3 이벤트 파이프라인 도입**: 기존 primitive 실행 후 이벤트/인덱스 갱신 훅 삽입
4. **M4 조회 도구 연결**: `mail_store.list_*`, `dashboard.get_overview`, `search.query`, `timeline.list` 핸들러 연결
5. **M5 백필/재색인**: 기존 상태(Map) -> projection/index 재구성 1회 작업 + checkpoint 저장

## 6. Timeline 이벤트 모델 및 파이프라인

## 6.1 공통 이벤트 스키마 (필수)

- `event_id`: 전역 유일 ID (`evt_<timestamp>_<hash>`)
- `event_type`: `TimelineEventType`
- `source_tool`: `TimelineSourceTool`
- `entity_id`: 메시지/스레드/투두/첨부 등 주 엔터티 ID
- `at`: ISO-8601 UTC
- `payload`: 이벤트별 상세 객체

## 6.2 payload 필수 공통 필드

- `schema_version`: `timeline_event.v1`
- `correlation_id`: 동일 사용자 액션/배치 추적 ID
- `run_id`: sync/autopilot 실행 단위 ID (없으면 `null` 허용)
- `entity_kind`: `message | thread | attachment | evidence | todo | dashboard | search`
- `mutation`: `created | updated | deleted | viewed | queried`

## 6.3 이벤트 생성 파이프라인

1. Tool handler 성공/실패 결과 수신
2. Event normalizer가 `event_type/source_tool/entity_id` 결정
3. payload 공통 필드 + 도메인 필드 채움
4. `timeline.events` append
5. `search.documents` 및 `dashboard.overviewSnapshot` 갱신 큐 enqueue
6. checkpoint 업데이트

## 7. 실패 모드 및 복구/정합화 전략

## 7.1 Contract Drift (`dashboard-contract` vs handler)

- 증상: 파서는 통과하나 핸들러 출력이 계약 필드 누락/오염.
- 탐지: 계약 파서 재검증 + `bun run ci` 테스트 게이트.
- 복구: 핸들러 출력을 계약 파서에 통과시키는 post-serialize validation 강제, 실패 시 `E_PARSE_FAILED` + safe fallback 응답.

## 7.2 Stale Index (projection lag)

- 증상: 최신 sync 반영 전 `search.query`/`dashboard.get_overview` 값 지연.
- 탐지: `checkpoint` timestamp와 canonical 최신 `received_at`/mutation 시각 비교.
- 복구: `stale=true` 메타 반환 + 비동기 재색인 + 임계치 초과 시 strong consistency 재계산.

## 7.3 Partial Sync (중간 실패)

- 증상: 메시지 upsert 성공, 인덱스 갱신 실패 또는 이벤트 로그 누락.
- 탐지: write-ahead `sync_journal`(메모리/스토리지)와 checkpoint 불일치.
- 복구: idempotent 재적용(동일 `correlation_id`/`event_id` dedupe), 실패 배치는 재시도 큐로 이동.

## 7.4 Reconciliation Job

- 트리거: 앱 시작 시, 수동 `maintenance.reconcile`(향후), checkpoint 불일치 감지 시.
- 수행:
  1. canonical mail/workflow 상태 스냅샷 로드
  2. projection/index 전량 재생성
  3. 고아 이벤트/문서 정리
  4. checkpoint 재서명
- 결과: `timeline`에 `status_changed` 또는 전용 유지보수 이벤트 기록.

## 8. 구현 가드레일 (Task 8 범위)

- 본 문서는 설계 명세이며 런타임 로직 변경을 포함하지 않는다.
- 기존 계약 토큰(`action`, `error_code`, enum/value key) 불변.
- 신규 의존성 추가 금지.
- Task 11 통합 QA 게이트 입력으로 사용한다.
