# Chrome Extension 사용자 설명서 (초안)

이 문서는 Outlook 로컬 업무 자동화 앱(Chrome Extension + Local Host)을 실제 사용자 관점에서 사용하는 방법을 정리한 안내서입니다.

## 1. 이 문서의 범위

- 대상: Outlook 메일을 동기화하고 근거(Evidence) 기반으로 업무를 관리하려는 사용자
- 범위: 로그인 자동완료, 동기화, 메일/첨부 조회, 기본 문제 해결
- 참고: 본 저장소는 `mail-agent-core` 중심이며, 실제 확장 UI/배포는 연동 환경에 따라 다를 수 있습니다.

## 2. 시작 전 준비

- Chrome 브라우저 최신 버전
- Microsoft 365/Outlook 계정
- 로컬 실행 환경(확장 앱 + Native Host) 설치 및 실행

## 3. 첫 사용 순서

1. 앱 실행 후 로그인 상태를 확인합니다.
2. 로그인 버튼을 눌러 Microsoft 계정 인증을 진행합니다.
3. 인증 완료 후 상태가 signed-in으로 바뀌는지 확인합니다.
4. 초기 동기화(initial sync)를 실행합니다.
   - 기본 권장: `mail_folder=inbox`, `days_back=30`
5. 동기화 완료 후 메일/첨부 목록과 근거 링크가 보이는지 확인합니다.

## 4. 주요 기능 사용법

## 4.1 로그인 및 상태 확인

- 로그인 시작 전에 `scripts/setup-macos.sh` 실행으로 `native-host/config.json`을 설정합니다.
- "로그인 시작" 버튼을 눌러 로그인 URL을 발급받고 브라우저에서 엽니다.
- 로그인 후 콜백 URL 수신 시 확장이 자동으로 "로그인 완료"를 수행합니다(최대 5분 대기).
- 자동 완료가 지연되면 `로그인 상태 확인`에서 `pending_callback_received` 힌트를 먼저 확인합니다.
- `pending_callback_received=true`면 callback URL 전체 또는 code만 입력 후 "로그인 완료"를 수동 실행할 수 있습니다.
- "로그인 상태 확인" 버튼으로 `signed_in`/`account`/`pending_callback_received` 상태를 확인합니다.

로그인 실패 또는 세션 만료 시 "로그인 시작"부터 다시 수행하세요.

## 4.2 메일 동기화

- 초기 동기화: `graph_mail_sync.initial_sync`
  - 최근 N일 기준으로 메일/첨부를 로컬에 반영
- 변경 동기화: `graph_mail_sync.delta_sync`
  - 신규/변경/삭제만 반영

일반적으로 첫 실행 시 초기 동기화를 1회 수행한 뒤, 이후에는 delta sync를 주기적으로 실행합니다.

- 사이드패널의 `자동 동기화 시작`으로 주기 실행(분 단위)을 켜고, 필요 시 `자동 동기화 중지`로 중단합니다.

## 4.3 목록 기반 조회

- 메시지 목록: `mail_store.list_messages`로 최근 메일 목록을 가져오고 선택합니다.
- 스레드 목록: `mail_store.list_threads`로 최근 스레드 목록을 가져오고 선택합니다.
- 목록에서 선택하면 `get_message`/`get_thread` 입력값이 자동 채워집니다.

## 4.4 첨부 다운로드

- 첨부 다운로드: `graph_mail_sync.download_attachment` (graph_message_id/graph_attachment_id/message_pk 필요)
- 첨부 목록 조회: `mail_store.list_attachments` (message_pk 기준)

권장 순서: 메시지 선택 -> `list_attachments` -> 첨부 선택 -> `download_attachment`.

첨부 파일은 로컬 경로에 저장되며, 동일 파일은 sha256 기준으로 중복 저장을 줄입니다.

## 4.5 메일 조회

- 단건 조회: `mail_store.get_message`
- 스레드 조회: `mail_store.get_thread`

업무 확인 시 스레드 조회를 우선 사용하면 문맥 파악이 빠릅니다.

## 4.6 운영/복구

- 상태/로그 확인: `system.health`
- 세션 초기화(인증만): `system.reset_session` (`clear_mailbox=false`)
- 세션 초기화(인증+메일 캐시): `system.reset_session` (`clear_mailbox=true`)

## 4.7 Evidence/Todo 최소 연계

- Evidence 생성: `workflow.create_evidence` (message_pk/snippet/confidence)
- Todo 생성/갱신: `workflow.upsert_todo` (title/status/evidence_id)
- 워크플로 목록 확인: `workflow.list`

## 4.8 Codex 자동화 롤아웃 Runbook (Shadow -> Full Authority)

### 운영 모드/단계 매핑

- 단계 0 `disabled`: codex-exec 비활성 상태. 운영 모드는 `manual` 유지(자동 write 금지).
- 단계 1 `shadow`: codex-exec 활성 + `review_first` 유지. 제안은 생성하되 write는 하지 않음.
- 단계 2 `constrained full_auto`: `full_auto`로 승격하되 입력 상한(`max_messages_per_tick`, `max_attachments_per_tick`)을 보수적으로 제한.
- 단계 3 `full authority`: `full_auto`에서 운영 상한을 표준값으로 복원.
- 예외 상태 `degraded`: 오류 누적으로 강등된 상태. 승격 금지, 롤백/원인 제거 우선.

### 단계별 실행 절차

1. 단계 0 (`disabled`)
   - `autopilot.pause`
   - `autopilot.set_mode` -> `mode=manual`
   - `autopilot.status`에서 `mode=manual`, `paused=true` 확인
2. 단계 1 (`shadow`)
   - `autopilot.set_mode` -> `mode=review_first`
   - `autopilot.resume`
   - `autopilot.tick` 20회 이상 실행(또는 24시간 운영) 후 `autopilot.status` + tick 응답을 저장
3. 단계 2 (`constrained full_auto`)
   - `autopilot.set_mode` -> `mode=full_auto`
   - `autopilot.tick` 실행 시 `max_messages_per_tick=10`, `max_attachments_per_tick=3`로 시작
   - 30 tick 또는 24시간 동안 write 정합성/오류율 확인
4. 단계 3 (`full authority`)
   - 같은 `mode=full_auto`에서 운영 상한을 표준치(기본 30/10 또는 팀 표준)로 복원
   - 승격 직후 1시간은 10분 간격으로 `autopilot.status`/`workflow.list` 재확인

### 승격 게이트(측정 기준)

아래 기준은 각 단계에서 다음 단계로 올리기 전 반드시 모두 충족해야 합니다.

| 게이트 | 측정 방법 | 통과 기준 |
| --- | --- | --- |
| Codex 실행 유효성 | `autopilot.status.codex_stage_metrics` | `started >= 20`, `fail = 0`, `schema_fail = 0`, `timeout = 0` |
| 상태 안정성 | `autopilot.status.status` | `degraded`가 0회, `retrying` 연속 3회 미만 |
| Shadow 정합성 | 동일 후보를 `review_first`와 `full_auto`에서 비교 | 제안 대비 실제 write 개수 차이 0건 |
| Write 무결성 | `autopilot.tick` 결과 + `workflow.list` | tick의 `auto_evidence_created`/`auto_todo_created`와 실제 생성 건수 불일치 0건 |
| 텔레메트리 완전성 | tick 결과의 `run_correlation` 샘플 점검 | `attempt`, `duration_ms`, `failure_kind`, `fallback_used` 누락률 0% |

운영 메모:
- 상태/로그 공유 시 토큰/원문 첨부 본문은 제외하고, redaction된 오류 요약과 allowlist 메타데이터(`message_pk`, `internet_message_id`, `received_at`, `has_attachments`, `attempt`, `max_attempts`)만 전달합니다.
- OCR은 기본 비활성(비-OCR 경로)입니다. 이미지/비텍스트 첨부는 계속 `requires_user_confirmation` 리뷰 경로로 처리합니다.

### 2분 내 롤백 스위치(실행 템플릿)

아래 순서를 그대로 실행하면 2분 내 자동 write 차단이 가능합니다.

1. 0~30초: 즉시 차단
   - `autopilot.pause`
   - 성공 응답(`ok=true`) 확인
2. 30~60초: 강제 수동 전환
   - `autopilot.set_mode` -> `mode=manual`
   - `autopilot.status`에서 `mode=manual`, `paused=true` 확인
3. 60~90초: 장애 원인 캡처
   - `autopilot.status`의 `status`, `last_error`, `codex_last_failure_reason`, `codex_stage_metrics` 기록
4. 90~120초: 무결성 확인
   - `workflow.list` 재조회
   - 장애 인지 시점 이후 예상 외 신규 evidence/todo가 0건인지 확인

롤백 해제 조건:
- `last_error`와 `codex_last_failure_reason`의 원인 제거가 확인되고,
- 단계 1(`shadow`, `review_first`) 게이트를 다시 충족한 경우에만 `full_auto` 재승격합니다.

## 4.9 OCR 확장 경계(준비 상태)

- 현재 기본 경로는 **비-OCR 경로 유지**입니다. 이미지/비텍스트 첨부는 기존처럼 `requires_user_confirmation` 리뷰 경로로 처리됩니다.
- OCR 엔진/서비스는 현재 릴리즈에 포함되지 않으며, 운영자가 별도 OCR 설정을 할 항목도 없습니다.
- 향후 OCR 확장 시에도 기존 `review_first`/`full_auto` 모드 게이트와 실패 분류(`retryable`/`terminal`) 규칙을 그대로 따라야 합니다.
- 상세 인터페이스 계약은 `docs/ocr-extensibility-contract.md`를 기준으로 검토합니다.

## 5. 자주 발생하는 문제와 대응

### 오류 코드 해석 매트릭스 (운영자용)

| 오류 코드 | 증상 | 가능 원인 | 운영자 조치 |
| --- | --- | --- | --- |
| `E_AUTH_REQUIRED` | 대부분의 API가 즉시 실패 | 로그인 정보 없음/만료 | `로그인 시작` -> `로그인 완료` -> `로그인 상태 확인` 순서로 재인증 |
| `E_AUTH_FAILED` | 로그인 완료 단계에서 실패 | code/state 불일치, 만료된 세션 | 세션 폐기 후 로그인 재시작. `state 값이 일치하지 않습니다`면 기존 입력 폐기 |
| `E_GRAPH_THROTTLED` | sync/tick 지연, 간헐 실패 | Graph API 제한 도달 | 1~5분 간격으로 재시도, 자동 동기화 주기 상향 |
| `E_NOT_FOUND` | 로그인 자동완료/조회 대상 미발견 | callback 미수신 또는 식별자 불일치 | 로그인은 `pending_callback_received` 확인 후 수동 완료, 조회는 재동기화 후 식별자 재선택 |
| `E_PARSE_FAILED` | 요청 직후 파싱 오류 | 입력 형식 오류 | 필수 필드 형식 점검 후 재요청 |
| `E_POLICY_DENIED` | 자동 처리 거부, review로 우회 | 정책 위반(허용되지 않은 자동 write/모드 제약) | `autopilot.status` 확인 후 `manual` 또는 `review_first`로 낮추고 정책 충족 후 재시도 |
| `E_CODEX_TIMEOUT` (`E_CODEX_*`) | `retrying` 증가, timeout 카운터 증가 | codex 실행 시간 초과/부하 | 즉시 `autopilot.pause`, 입력 상한 축소(10/3), 원인 제거 후 shadow 재검증 |
| `E_CODEX_SCHEMA_INVALID` (`E_CODEX_*`) | schema_fail 증가, `degraded` 전이 가능 | codex 출력 스키마 불일치/파싱 불가 | 자동 승격 중지, `review_first` 유지, 샘플 payload/출력 비교 후 수정 전까지 full_auto 금지 |
| `E_CODEX_EXEC_FAILED` (`E_CODEX_*`) | fail 증가, `last_error` 반복 | codex 프로세스 비정상 종료(spawn/exit/signal) | 롤백 스위치 실행(2분 템플릿), 런타임 복구 후 단계 1부터 재승격 |

## 6. 운영 권장사항

- 하루 시작 시 1회 초기 상태 확인 + delta sync 수행
- 대량 동기화 직후에는 첨부 분석/조회 작업을 분리해서 실행
- 인증 만료가 잦으면 로그아웃 후 로그인 시작을 다시 수행

## 7. 보안/데이터 안내

- 메일/첨부 데이터는 기본적으로 로컬 저장 원칙을 따릅니다.
- 계정/토큰 관련 정보는 로컬 환경에서만 사용되며, 외부 공유 전에 민감정보를 반드시 제거하세요.
