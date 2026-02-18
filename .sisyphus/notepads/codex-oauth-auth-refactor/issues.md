# Issues

- 2026-02-18: `.sisyphus/plans/codex-oauth-auth-refactor.md` 파일이 현재 워크스페이스에 존재하지 않아 Task 6 체크박스를 해당 원본 계획서에 직접 반영할 수 없었다.
- 2026-02-18: `tests/mcp.test.ts`는 길고 중복 시나리오가 많아 OAuth-only 전환 이후에도 일부 구간이 env 전제 시나리오를 포함할 가능성이 있어 후속 범위에서 정리 검증이 필요하다.
- 2026-02-18: prior report 정정 필요 — "plan 파일 없음"을 확정적으로 기록한 기존 문장은 잘못된 주장으로 분류하고, 북키핑 단계에서는 파일 존재/경로 검증 로그를 필수 증적으로 남겨야 한다.
- 2026-02-18: 현재 워크스페이스에서는 `ls .sisyphus/plans/codex-oauth-auth-refactor.md`가 `No such file or directory`를 반환해 Task 6 체크박스 직접 수정이 차단된다.
- 2026-02-18: OAuth-only 가드 전환 후 `tests/mcp.test.ts`의 autopilot 성공 시나리오 다수가 env fixture(`mode="env" + api_key_present`)에 의존해 `E_CODEX_AUTH_REQUIRED`로 연쇄 실패했으며, helper normalization이 없으면 동일 회귀가 반복된다.
- 2026-02-18: 사용자 제공 절대 경로(`/Users/byungwoyoon/Desktop/Projects/mail-agent-core/.sisyphus/plans/codex-oauth-auth-refactor.md`)도 현재 read/ls 기준 파일이 없어 체크박스 북키핑을 적용할 대상 원본이 부재하다.
- 2026-02-18: Playwright MCP(`skill_mcp`의 `browser_navigate`)는 `file://` 프로토콜 접근을 차단해 sidepanel HTML 직접 탐색 검증이 불가했고, 동일 범위 검증은 `bun run test:e2e`의 Playwright 테스트로 대체했다.
- 2026-02-18: `autopilot.status` Codex auth 상태 계약 추가 과정에서 `src/domain/mcp.ts`와 `native-host/host.mjs`의 출력 동기화가 필요해, 한쪽만 수정하면 i18n/계약 테스트가 즉시 회귀한다(양쪽 동시 반영 필요).
- 2026-02-18: Task 8 RED 단계에서 `autopilot.last_error`의 `oauth_session_id=<value>`가 그대로 `autopilot.status`/`system.health`에 노출되는 누출이 재현되었고, 기존 키워드(`token|secret|authorization`)만으로는 session id 계열 artifact를 가리지 못했다.
- 2026-02-18: Task 5 북키핑 재검증에서 신규 기능 갭은 발견되지 않았고, `bun run test:e2e` 1 passed로 회귀 이슈 없이 acceptance 충족이 확인되었다.
- 2026-02-18: Task 6 재검증 시 런타임 계약 상 `env_fallback` 플래그/메타는 상태 호환용으로만 남아 있어, 후속 문서(Task 10)에서 "실행 인증 소스는 OAuth-only"를 명시해 오해 가능성을 줄일 필요가 있다.
- 2026-02-18: 최종 게이트 증적 파일은 생성됐지만 `.sisyphus/evidence/`에 Task 09 산출물과 혼재되어 있어, 후속 운영에서는 task 번호별 evidence index를 문서화하지 않으면 추적 비용이 커질 수 있다.
- 2026-02-18: Task 10 검증에서 markdown 파일(`.md`)은 현재 워크스페이스 LSP 서버가 연결되지 않아 `lsp_diagnostics`를 코드처럼 정적 진단할 수 없었고, 문서 검증은 `bun run build`와 수동 내용 정합성 점검으로 대체했다.
- 2026-02-18: Task 11 e2e reliability matrix는 sidepanel auto-complete의 5분 타임아웃 상수(`AUTO_COMPLETE_TIMEOUT_MS`) 때문에 실제 wall-clock timeout을 직접 대기 검증하기 어려워, 회귀 방지를 위해 unit 레이어의 `E_NOT_FOUND(retryable)` timeout equivalent 계약과 UI 수동 복구 분기를 조합해 커버했다.
