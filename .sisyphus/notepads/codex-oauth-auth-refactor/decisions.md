# Decisions

- 2026-02-18: Task 6 범위에서는 host/domain 공통으로 codex 실행 인증 성공 조건을 OAuth broker authorized 세션 + session id로만 인정하고, env fallback 성공 경로는 허용하지 않는다.
- 2026-02-18: plan 체크박스는 실제 계획 파일이 워크스페이스에 확인될 때만 갱신하며, 파일 부재 시 코드/테스트 증적과 이슈 노트에 차단 사유를 남긴다.
- 2026-02-18: TS2741 대응은 `tests/storage.test.ts` fixture 보강(`codex_auth.oauth_broker` 추가)으로만 처리하고 OAuth-only 런타임 정책/코드 경로는 변경하지 않는다.
- 2026-02-18: 북키핑 보고에는 "이전 plan 파일 부재 주장 정정"을 명시하고, 실제 파일 경로 확인 실패 시에는 체크박스 변경을 강행하지 않는다.
- 2026-02-18: autopilot 회귀 대응은 `tests/mcp.test.ts` 공통 fixture(`createToolContext`)에서 OAuth authorized broker 세션을 기본 주입하고, 의도적 실패 케이스만 unauthorized helper로 분기하는 방식으로 고정한다.
- 2026-02-18: OAuth-only 정책 유지 원칙에 따라 env/opencode 우회 성공 경로를 복원하지 않고, 테스트 precondition만 OAuth 세션 계약으로 이관해 전체 `bun test`를 복구한다.
- 2026-02-18: Task 5 범위에서는 sidepanel에 Codex 전용 OAuth 컨트롤(start/auto/manual/status/logout)을 별도 노출하되, 호출 액션은 기존 `auth_store.*`를 재사용하고 provider payload만 추가해 host/domain 인증 런타임(Task 6 안정화 범위)을 건드리지 않는다.
- 2026-02-18: Codex 상태 문구는 pending callback(`pending_callback_received`)와 signed_in 전이를 명시하고, UI/결과 출력에는 token/session secret을 노출하지 않는 텍스트 포맷을 유지한다.
- 2026-02-18: Task 7에서는 `autopilot.status`의 기존 필드(`codex_exec_contract`, `persistence_authority`, 기존 stage/metrics)를 유지하고, Codex OAuth 노출은 `codex_auth_state` + `codex_auth` alias에 제한하며 `oauth_session_id` 원문은 상태 payload에 포함하지 않는다.
- 2026-02-18: Task 8에서는 redaction 기준을 `SENSITIVE_TEXT_FIELD_PATTERN` 단일 패턴으로 중앙화하고, `oauth_session_id`/`oauth_access_token`/`oauth_session_secret`를 포함한 OAuth artifact를 `redactSensitiveText` 단계에서 통합 마스킹한다.
- 2026-02-18: Task 5는 구현 추가 없이 기존 sidepanel/e2e 증적 재검증 후 계획 체크박스(본 항목 + acceptance 3개)를 완료 처리한다.
- 2026-02-18: Task 6 클로저는 코드 변경 없이 북키핑으로 완료하며, 수용 기준 증적은 `bun test tests/native-host-codex-adapter.test.ts` PASS + `tests/mcp.test.ts`의 OAuth-required/unauthorized 케이스 PASS로 고정한다.
- 2026-02-18: Task 12 최종 게이트는 계획서의 acceptance 6개 + Success Criteria 5개를 동시에 체크 완료하고, 증적 파일(`.sisyphus/evidence/task-12-oauth-release-gate.txt`) 존재를 완료 기준으로 확정한다.
- 2026-02-18: Task 10 범위에서는 Codex 인증 운영 문서를 OAuth-only 활성 정책으로 통일하고, env 기반 경로는 "deprecated/non-active"로 명시하며 복구 가이드는 `codex_auth.auth_status` 중심의 2분 절차로 표준화한다.
- 2026-02-18: Task 11 신뢰성 매트릭스는 런타임 정책 변경 없이 테스트 계층에서 확장하고, 실패 경로는 `E_CODEX_AUTH_REQUIRED`/`E_AUTH_FAILED`/`E_AUTH_REQUIRED`/`E_PARSE_FAILED`/`E_NOT_FOUND(retryable)`의 결정적 매핑을 유지한다.
- 2026-02-18: OAuth-only 정책 보호를 위해 이번 범위에서는 env fallback/opencode 성공 경로를 추가하지 않고, codex auth 실패 케이스는 모두 fail-closed와 수동 복구 안내(콜백 URL 또는 code 재입력)로 수렴시킨다.
