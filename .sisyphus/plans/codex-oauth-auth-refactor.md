# Codex OAuth Auth Refactor Plan

## TL;DR

> **Quick Summary**: Replace env-driven Codex authentication with an OpenCode-like OAuth sign-in flow (browser sign-in + callback completion semantics) while preserving existing autopilot safety/mode contracts and status compatibility.
>
> **Deliverables**:
> - New Codex OAuth MCP actions and host/runtime wiring
> - OAuth-only auth policy for Codex execution path
> - Contract-preserving status/telemetry updates and redaction guarantees
> - TDD-backed tests, rollout/rollback runbook, and CI release evidence
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: Task 1 -> Task 3 -> Task 4 -> Task 6 -> Task 11 -> Task 12

---

## Context

### Original Request
- "opencode 방식과 같이 oauth 로 인증할 수 있는 구조로 리팩토링 계획세워"

### Interview Summary
**Key Discussions**:
- User wants OpenCode-like OAuth UX for Codex auth, not env-key-only auth.
- User selected target policy: **OAuth only**.
- User selected test strategy: **TDD**.

**Research Findings**:
- Current Codex auth/runtime gate is in `native-host/host.mjs` via `buildCodexExecRuntimeContract`, `resolveCodexExecAuth`, `analyzeAutopilotCandidateAttempt`, and `runAutopilotTick`.
- Existing OAuth callback flow already exists for Graph auth and is reusable (`native-host/callback-listener.mjs`, `auth_store.start_login` flow, sidepanel auto-complete/manual fallback UX).
- External Codex docs support interactive browser/device auth and cached login reuse; non-interactive runbooks must be version-pinned.

### Metis Review
**Identified Gaps** (addressed):
- CI/headless behavior ambiguity under OAuth-only policy -> define explicit OAuth-only noninteractive contract and failure handling.
- Status contract drift risk -> freeze compatibility fields and add contract tests before refactor.
- Scope creep risk (multi-account/provider abstraction) -> lock out of scope for v1.
- Token leakage risk -> require redaction tests across logs/status/IPC artifacts.

---

## Work Objectives

### Core Objective
Deliver an OAuth-only Codex authentication architecture that provides OpenCode-like sign-in UX while preserving current autopilot execution safety and backward-compatible status contracts.

### Concrete Deliverables
- OAuth-capable Codex auth MCP actions: `codex_auth.start_login`, `codex_auth.complete_login_auto`, `codex_auth.complete_login`, `codex_auth.auth_status`, `codex_auth.logout`.
- Host-side OAuth broker state model and callback integration for Codex auth.
- Codex runtime auth resolver migrated to OAuth session-based source (env fallback removed from target contract).
- Updated sidepanel auth UX for Codex provider with auto-complete + manual fallback patterns.
- Runbook and operational docs for OAuth-only rollout and rollback.

### Definition of Done
- [x] `bun run ci` passes with coverage threshold >=85%
- [x] `bun run test:i18n-contract` passes
- [x] `bun run test:e2e` passes
- [x] `autopilot.status` preserves existing required fields and exposes Codex OAuth auth state without leaking sensitive values
- [x] Codex auth path no longer depends on env fallback in runtime policy

### Must Have
- OAuth-only policy enforced for Codex runtime auth path.
- OpenCode-like user flow (browser sign-in, callback completion semantics, auto/manual completion options).
- Full compatibility with `manual/review_first/full_auto/degraded` mode semantics.
- TDD workflow with explicit RED-GREEN-REFACTOR per task.

### Must NOT Have (Guardrails)
- No changes to Graph OAuth business behavior beyond reusable abstractions.
- No raw token/key exposure in logs, status, health, or telemetry outputs.
- No scope expansion into multi-account, multi-provider abstraction, or unrelated UI redesign.
- No weakening of CI/coverage gates.

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan are verifiable without manual human testing. Every acceptance criterion uses commands or tool-executed checks.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: TDD
- **Framework**: Vitest (`bun run test`), Playwright (`bun run test:e2e`)

### If TDD Enabled

Each implementation task follows RED-GREEN-REFACTOR:
1. **RED**: Add failing test for intended contract change.
2. **GREEN**: Implement minimum code to pass.
3. **REFACTOR**: Improve structure while keeping tests green.

### Agent-Executed QA Scenarios (MANDATORY - ALL tasks)

Common verification tools:
- Frontend/UI flows: Playwright (`bun run test:e2e`)
- Runtime/API/tool contracts: Vitest (`bun run test`, targeted test filters)
- CLI/release gates: Bash commands (`bun run ci`, `bun run build`)

Evidence location:
- `.sisyphus/evidence/task-{N}-*.txt` for command outputs
- `.sisyphus/evidence/task-{N}-*.png` for UI screenshots when needed

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Freeze current auth/status contracts with characterization tests
├── Task 2: Define OAuth broker state/config contracts (design-first)
└── Task 9: Define OAuth-only CI/headless policy and failure matrix

Wave 2 (After Wave 1):
├── Task 3: Implement codex_auth.start_login + callback wiring
├── Task 4: Implement complete_login_auto/manual + auth_status + logout
└── Task 6: Refactor runtime auth resolver to OAuth session source

Wave 3 (After Wave 2):
├── Task 5: Sidepanel Codex OAuth UX integration
├── Task 7: Preserve status compatibility + expose codex auth status
└── Task 8: Redaction/security hardening for OAuth artifacts

Wave 4 (After Wave 3):
├── Task 10: Update runbook/docs for OAuth-only operations
└── Task 11: Add integration/e2e and negative-path reliability tests

Wave 5 (After Wave 4):
└── Task 12: Final CI gate + release evidence + rollback validation
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 6, 7 | 2, 9 |
| 2 | None | 3, 4 | 1, 9 |
| 3 | 1, 2 | 4, 6 | 6 |
| 4 | 2, 3 | 5, 7 | 6 |
| 5 | 4 | 11 | 7, 8 |
| 6 | 1, 3 | 7, 11 | 4 |
| 7 | 1, 4, 6 | 11 | 5, 8 |
| 8 | 4, 6 | 11, 12 | 5, 7 |
| 9 | None | 10, 12 | 1, 2 |
| 10 | 9 | 12 | 11 |
| 11 | 5, 6, 7, 8 | 12 | 10 |
| 12 | 10, 11 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1,2,9 | `task(category="deep", load_skills=["git-master"], run_in_background=false)` |
| 2 | 3,4,6 | parallel dispatch after Wave 1 |
| 3 | 5,7,8 | parallel dispatch after Wave 2 |
| 4 | 10,11 | parallel dispatch after Wave 3 |
| 5 | 12 | final sequential integration gate |

---

## TODOs

- [x] 1. Freeze Current Contracts with Characterization Tests

  **What to do**:
  - RED: Add failing characterization tests that lock current status/auth/mode contracts.
  - GREEN: Ensure existing behavior is codified before refactor.
  - REFACTOR: Group tests by contract area (auth errors, status payload, mode policy).

  **Must NOT do**:
  - Do not change runtime logic in this task.

  **Recommended Agent Profile**:
  - **Category**: `deep` (critical behavior freeze before architecture changes)
  - **Skills**: `git-master`
  - **Skills Evaluated but Omitted**: `playwright` (no browser interaction required yet)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 9)
  - **Blocks**: 3, 6, 7
  - **Blocked By**: None

  **References**:
  - `native-host/host.mjs` - current runtime auth resolution and status assembly.
  - `src/domain/mcp.ts` - tool-level auth guard and mode policy contracts.
  - `tests/mcp.test.ts` - existing auth/tick tests to extend.
  - `tests/native-host-codex-adapter.test.ts` - runtime contract test style.
  - `tests/codex-redaction.test.ts` - sensitive-data exposure constraints.

  **Acceptance Criteria**:
  - [x] New characterization tests exist for current `E_CODEX_AUTH_REQUIRED` and mode-policy behavior.
  - [x] `bun test tests/mcp.test.ts` passes.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Contract freeze before refactor
    Tool: Bash (bun test)
    Preconditions: Test environment installed
    Steps:
      1. Run: bun test tests/mcp.test.ts -t "codex auth|autopilot.status|mode"
      2. Assert: exit code 0
      3. Assert: no snapshot/contract regression failures
    Expected Result: Baseline contracts are green and frozen
    Evidence: .sisyphus/evidence/task-1-contract-freeze.txt

  Scenario: Redaction contract remains intact
    Tool: Bash (bun test)
    Preconditions: Same environment
    Steps:
      1. Run: bun test tests/codex-redaction.test.ts
      2. Assert: exit code 0
      3. Assert: no raw token leakage assertion failures
    Expected Result: Security baseline is preserved
    Evidence: .sisyphus/evidence/task-1-redaction-baseline.txt
  ```

  **Commit**: YES
  - Message: `test(auth): oauth 리팩토링 전 계약 고정 테스트 추가`

- [x] 2. Define OAuth Broker State and Config Contracts

  **What to do**:
  - RED: Add failing type/contract tests for Codex OAuth session state and config schema.
  - GREEN: Define host state/config structures for Codex OAuth broker.
  - REFACTOR: Normalize naming to align with existing Graph auth patterns.

  **Must NOT do**:
  - Do not implement full runtime behavior yet.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `git-master`
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` (not design-focused)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 9)
  - **Blocks**: 3, 4
  - **Blocked By**: None

  **References**:
  - `native-host/host.mjs` - `normalizeState`, `normalizeConfig`, existing auth state model.
  - `native-host/callback-listener.mjs` - pending callback payload pattern.
  - `tests/storage.test.ts` - state persistence test style.

  **Acceptance Criteria**:
  - [x] Codex OAuth state/config contracts are defined and validated by tests.
  - [x] `bun run build` passes.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Config normalization for OAuth fields
    Tool: Bash
    Steps:
      1. Run: bun test tests/native-host-codex-adapter.test.ts -t "runtime contract|sanitize"
      2. Assert: exit code 0
      3. Assert: OAuth config fields normalize safely
    Expected Result: Contract fields are stable and sanitized
    Evidence: .sisyphus/evidence/task-2-config-contract.txt
  ```

  **Commit**: YES
  - Message: `feat(auth): codex oauth broker 상태/설정 계약 추가`

- [x] 3. Implement `codex_auth.start_login` with Browser Callback Wiring

  **What to do**:
  - RED: Add failing tests for new start-login action and callback listener startup.
  - GREEN: Implement Codex OAuth login URL issuance and callback listener bootstrap.
  - REFACTOR: Share reusable callback utilities with Graph auth without behavior regression.

  **Must NOT do**:
  - Do not alter Graph auth business outputs.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: 4, 6
  - **Blocked By**: 1, 2

  **References**:
  - `native-host/host.mjs` - `handleStartLogin`, callback preflight helpers.
  - `native-host/callback-listener.mjs` - callback write semantics.
  - `src/domain/mcp.ts` - tool name/input/output contracts.
  - `tests/mcp.test.ts` - existing start_login coverage patterns.

  **Acceptance Criteria**:
  - [x] New `codex_auth.start_login` returns login URL + callback URL contract.
  - [x] Callback listener startup failure maps to deterministic error code.
  - [x] `bun test tests/mcp.test.ts -t "codex_auth.start_login"` passes.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Start Codex OAuth login succeeds
    Tool: Bash
    Steps:
      1. Run: bun test tests/mcp.test.ts -t "codex_auth.start_login"
      2. Assert: action output has login_url and callback_url
      3. Assert: issued session state persisted in test context
    Expected Result: OAuth start contract behaves like Graph pattern
    Evidence: .sisyphus/evidence/task-3-start-login.txt

  Scenario: Callback listener preflight failure path
    Tool: Bash
    Steps:
      1. Run targeted negative test for callback port conflict
      2. Assert: deterministic retryable error mapping
    Expected Result: Failure is explicit and test-covered
    Evidence: .sisyphus/evidence/task-3-listener-failure.txt
  ```

  **Commit**: YES
  - Message: `feat(auth): codex oauth 시작/콜백 리스너 경로 구현`

- [x] 4. Implement `complete_login_auto`, `complete_login`, `auth_status`, and `logout`

  **What to do**:
  - RED: Add failing tests for auto-complete, manual callback code, status hints, and logout invalidation.
  - GREEN: Implement actions and state transitions.
  - REFACTOR: Align error semantics with existing auth actions.

  **Must NOT do**:
  - Do not expose token material in outputs.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: 5, 7, 8
  - **Blocked By**: 2, 3

  **References**:
  - `native-host/host.mjs` - `handleCompleteLoginAuto`, `handleAuthStatus`, token persistence points.
  - `src/domain/mcp.ts` - auth status and error response contracts.
  - `tests/mcp.test.ts` - auto/manual completion tests to mirror.

  **Acceptance Criteria**:
  - [x] `codex_auth.complete_login_auto` supports pending callback semantics.
  - [x] `codex_auth.complete_login` supports manual callback/code fallback.
  - [x] `codex_auth.auth_status` exposes pending callback hints and signed-in state.
  - [x] `codex_auth.logout` invalidates active Codex session.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Auto complete with pending callback
    Tool: Bash
    Steps:
      1. Run: bun test tests/mcp.test.ts -t "codex_auth.complete_login_auto"
      2. Assert: pending callback true path transitions to signed_in
      3. Assert: no token raw values in response payload
    Expected Result: Auto-complete flow succeeds with secure output
    Evidence: .sisyphus/evidence/task-4-auto-complete.txt

  Scenario: Manual fallback when callback not auto-detected
    Tool: Bash
    Steps:
      1. Run: bun test tests/mcp.test.ts -t "codex_auth.complete_login"
      2. Assert: callback URL/code input is accepted
      3. Assert: invalid state returns deterministic error
    Expected Result: Manual path is reliable and validated
    Evidence: .sisyphus/evidence/task-4-manual-complete.txt
  ```

  **Commit**: YES
  - Message: `feat(auth): codex oauth 완료/상태/로그아웃 액션 구현`

- [x] 5. Integrate Sidepanel Codex OAuth UX

  **What to do**:
  - RED: Add failing UI contract tests for Codex sign-in buttons and status rendering.
  - GREEN: Add provider-aware Codex auth actions in sidepanel.
  - REFACTOR: Reuse Graph auto-complete/manual utilities where safe.

  **Must NOT do**:
  - Do not redesign unrelated visual layout.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `frontend-ui-ux`, `git-master`
  - **Skills Evaluated but Omitted**: `ui-ux-pro-max` (not redesigning visual system)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 8)
  - **Blocks**: 11
  - **Blocked By**: 4

  **References**:
  - `extension/sidepanel.js` - Graph auth flow helpers and status updater patterns.
  - `extension/sidepanel.html` - auth controls and labels.
  - `docs/chrome-extension-user-guide.md` - user-visible auth guidance contract.

  **Acceptance Criteria**:
  - [x] Sidepanel exposes Codex OAuth sign-in/status/logout controls.
  - [x] Auto-complete/manual fallback UX mirrors Graph flow behavior.
  - [x] `bun run test:e2e` includes Codex auth smoke.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Sidepanel shows Codex OAuth status
    Tool: Playwright
    Preconditions: Extension test harness running
    Steps:
      1. Open sidepanel page
      2. Wait for codex auth status element
      3. Assert text reflects signed-out state before login
      4. Trigger start login action
      5. Assert pending callback hint appears
    Expected Result: UI surfaces codex auth state transitions
    Evidence: .sisyphus/evidence/task-5-sidepanel-status.png

  Scenario: Manual callback fallback input path
    Tool: Playwright
    Steps:
      1. Fill callback input with test callback URL
      2. Click complete login button
      3. Assert result toast shows success/failure deterministically
    Expected Result: Manual completion path is wired
    Evidence: .sisyphus/evidence/task-5-manual-fallback.png
  ```

  **Commit**: YES
  - Message: `feat(sidepanel): codex oauth 인증 UX 연동`

- [x] 6. Refactor Runtime Auth Resolver to OAuth-Only

  **What to do**:
  - RED: Add failing tests proving env fallback is no longer accepted under OAuth-only contract.
  - GREEN: Update runtime resolver to consume OAuth session source and reject env fallback.
  - REFACTOR: Keep codex exec enablement and mode policy behavior unchanged.

  **Must NOT do**:
  - Do not change `manual/review_first/full_auto/degraded` semantics.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4 after Task 3 starts)
  - **Blocks**: 7, 11
  - **Blocked By**: 1, 3

  **References**:
  - `native-host/host.mjs` - `resolveCodexExecAuth`, `runAutopilotTick` auth branch.
  - `src/domain/mcp.ts` - `requireCodexAuthContext` parity expectations.
  - `tests/native-host-codex-adapter.test.ts` - runtime contract and fallback tests.
  - `tests/mcp.test.ts` - auth-required error behavior tests.

  **Acceptance Criteria**:
  - [x] OAuth session is required for codex exec auth path.
  - [x] Env fallback path returns policy denial/auth-required error under OAuth-only contract.
  - [x] `bun test tests/native-host-codex-adapter.test.ts` passes.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: OAuth session missing under OAuth-only policy
    Tool: Bash
    Steps:
      1. Run targeted test with codex_exec_enabled=true and no oauth session
      2. Assert error_code is E_CODEX_AUTH_REQUIRED (or policy-mapped equivalent)
      3. Assert Graph auth state is unchanged
    Expected Result: Missing OAuth session fails closed
    Evidence: .sisyphus/evidence/task-6-oauth-required.txt

  Scenario: Legacy env fallback denied
    Tool: Bash
    Steps:
      1. Run targeted test with env key present but oauth session absent
      2. Assert runtime does not accept env fallback
      3. Assert run_correlation marks analysis not executed
    Expected Result: OAuth-only contract enforced
    Evidence: .sisyphus/evidence/task-6-env-denied.txt
  ```

  **Commit**: YES
  - Message: `feat(auth): codex 실행 인증을 oauth 전용으로 전환`

- [x] 7. Preserve Status Compatibility and Add Codex Auth State Exposure

  **What to do**:
  - RED: Add failing status contract tests for new Codex auth state fields and legacy fields.
  - GREEN: Extend status payload with Codex auth state while preserving existing keys.
  - REFACTOR: Keep schema stable and sanitize all auth-sensitive values.

  **Must NOT do**:
  - Do not rename/remove existing status fields consumed by extension.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 11
  - **Blocked By**: 1, 4, 6

  **References**:
  - `native-host/host.mjs` - `getAutopilotStatus`, `sanitizeCodexExecContractForStatus`.
  - `src/domain/mcp.ts` - output type contracts.
  - `tests/i18n-contract.test.ts` - machine-token stability expectations.
  - `tests/dashboard-contract.test.ts` - dashboard contract coupling.

  **Acceptance Criteria**:
  - [x] Existing status keys remain backward compatible.
  - [x] New codex auth state fields are documented and tested.
  - [x] `bun run test:i18n-contract` passes.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Status payload compatibility
    Tool: Bash
    Steps:
      1. Run: bun test tests/dashboard-contract.test.ts
      2. Assert: legacy keys still present
      3. Assert: codex auth state fields added with stable types
    Expected Result: Consumers do not break
    Evidence: .sisyphus/evidence/task-7-status-contract.txt
  ```

  **Commit**: YES
  - Message: `feat(status): codex oauth 인증 상태 노출 및 계약 호환 유지`

- [x] 8. Enforce Redaction and Token Handling Security for OAuth Path

  **What to do**:
  - RED: Add failing tests for token leakage in logs/status/health and callback artifacts.
  - GREEN: Harden redaction and allowlist policies for new OAuth fields.
  - REFACTOR: Keep security helpers centralized.

  **Must NOT do**:
  - Do not store raw access/refresh token values in status payloads.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 11, 12
  - **Blocked By**: 4, 6

  **References**:
  - `native-host/host.mjs` - `redactSensitiveText`, log/status sanitization paths.
  - `tests/codex-redaction.test.ts` - current redaction assertions to expand.

  **Acceptance Criteria**:
  - [x] Redaction tests cover OAuth token-like artifacts.
  - [x] `system.health` and `autopilot.status` expose no raw secrets.
  - [x] `bun test tests/codex-redaction.test.ts` passes.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: OAuth token leakage prevention
    Tool: Bash
    Steps:
      1. Run: bun test tests/codex-redaction.test.ts -t "oauth|token|status|health"
      2. Assert: all redaction assertions pass
      3. Assert: no raw token fragments appear in captured output fixtures
    Expected Result: OAuth path meets redaction policy
    Evidence: .sisyphus/evidence/task-8-redaction.txt
  ```

  **Commit**: YES
  - Message: `fix(security): codex oauth 경로 레드랙션/허용목록 강화`

- [x] 9. Define OAuth-Only CI/Headless Policy and Failure Matrix

  **What to do**:
  - RED: Add failing tests/doc checks for CI/headless behavior under OAuth-only policy.
  - GREEN: Define deterministic policy: no env fallback; require OAuth-capable session bootstrap or fail with clear error.
  - REFACTOR: Align error codes/messages with existing operational contracts.

  **Must NOT do**:
  - Do not silently downgrade to env fallback.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 10, 12
  - **Blocked By**: None

  **References**:
  - `docs/chrome-extension-user-guide.md` - operational policy communication.
  - `docs/ocr-extensibility-contract.md` - style for policy contracts.
  - `native-host/host.mjs` - runtime context checks and auth errors.

  **Acceptance Criteria**:
  - [x] CI/headless OAuth-only behavior matrix documented and test-covered.
  - [x] Error mapping for unsupported runtime context is deterministic.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: CI runtime without OAuth bootstrap
    Tool: Bash
    Steps:
      1. Run targeted test simulating CI=true and missing oauth session
      2. Assert expected auth-required/policy error code
      3. Assert no synthetic silent bypass
    Expected Result: OAuth-only policy is explicit and enforced
    Evidence: .sisyphus/evidence/task-9-ci-policy.txt
  ```

  **Commit**: YES
  - Message: `docs(auth): oauth-only ci/headless 정책 및 실패 매트릭스 정의`

- [x] 10. Update Runbook and Operator Guides for Codex OAuth Flow

  **What to do**:
  - Update runbook with OAuth sign-in steps, callback troubleshooting, and rollback actions.
  - Document deprecation of env-based Codex auth path.

  **Must NOT do**:
  - Do not leave old env fallback guidance as active path.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: 12
  - **Blocked By**: 9

  **References**:
  - `docs/chrome-extension-user-guide.md` - primary operator playbook.
  - `docs/install-guide.md` - setup/troubleshooting alignment.
  - `README.md` - top-level auth expectations.

  **Acceptance Criteria**:
  - [x] OAuth sign-in and failure recovery steps are documented end-to-end.
  - [x] Rollback steps are executable in <=2 minutes.
  - [x] `bun run build` passes after docs updates.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Runbook command validation
    Tool: Bash
    Steps:
      1. Run: bun run build
      2. Assert: exit code 0
      3. Validate documented commands against implemented MCP actions in tests
    Expected Result: Runbook matches actual runtime/tooling
    Evidence: .sisyphus/evidence/task-10-runbook-validation.txt
  ```

  **Commit**: YES
  - Message: `docs(runbook): codex oauth 인증 운영 가이드 업데이트`

- [x] 11. Add Reliability Matrix Tests (Happy/Negative/Timeout/Callback Failures)

  **What to do**:
  - RED: Add failing tests for browser fail, callback timeout, invalid state, denied consent, stale session, logout race.
  - GREEN: Implement minimum fixes until all reliability tests pass.
  - REFACTOR: Consolidate shared fixtures/utilities.

  **Must NOT do**:
  - Do not skip negative-path scenarios.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 10)
  - **Blocks**: 12
  - **Blocked By**: 5, 6, 7, 8

  **References**:
  - `tests/mcp.test.ts` - auth flow and autopilot integration tests.
  - `tests/native-host-codex-adapter.test.ts` - runtime failure mapping tests.
  - `tests/e2e/smoke.e2e.ts` - e2e entry point.

  **Acceptance Criteria**:
  - [x] Reliability matrix tests cover happy path + at least 6 negative cases.
  - [x] `bun test` passes.
  - [x] `bun run test:e2e` passes.

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: OAuth failure matrix
    Tool: Bash
    Steps:
      1. Run: bun test tests/mcp.test.ts -t "codex_auth|callback|timeout|invalid state|logout"
      2. Assert: exit code 0
      3. Assert: each failure path maps to deterministic error/review behavior
    Expected Result: Reliability matrix is fully covered
    Evidence: .sisyphus/evidence/task-11-failure-matrix.txt

  Scenario: End-to-end smoke
    Tool: Bash
    Steps:
      1. Run: bun run test:e2e
      2. Assert: exit code 0
      3. Assert: smoke scenario count >0 and all pass
    Expected Result: UI wiring remains operational
    Evidence: .sisyphus/evidence/task-11-e2e-smoke.txt
  ```

  **Commit**: YES
  - Message: `test(auth): codex oauth 신뢰성 매트릭스 테스트 보강`

- [x] 12. Final Release Gate, Evidence Capture, and Rollback Validation

  **What to do**:
  - Run full verification pack and capture evidence.
  - Confirm rollout/rollback scripts are actionable.
  - Finalize release readiness report.

  **Must NOT do**:
  - Do not mark release-ready without CI and coverage proof.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (final)
  - **Blocks**: None
  - **Blocked By**: 8, 9, 10, 11

  **References**:
  - `package.json` - canonical verification commands.
  - `.github/workflows/ci.yml` - CI parity expectations.
  - `.sisyphus/evidence/` - evidence artifacts for gate.

  **Acceptance Criteria**:
- [x] `bun run test:i18n-contract` -> PASS
- [x] `bun run build` -> PASS
- [x] `bun test` -> PASS
- [x] `bun run ci` -> PASS
- [x] `bun run test:e2e` -> PASS
- [x] Evidence file exists: `.sisyphus/evidence/task-12-oauth-release-gate.txt`

  **Agent-Executed QA Scenarios**:
  ```text
  Scenario: Full release gate
    Tool: Bash
    Steps:
      1. Run verification commands in order:
         - bun run test:i18n-contract
         - bun run build
         - bun test
         - bun run ci
         - bun run test:e2e
      2. Assert: all exit codes are 0
      3. Persist command outcomes to .sisyphus/evidence/task-12-oauth-release-gate.txt
    Expected Result: Release gate is objectively green
    Evidence: .sisyphus/evidence/task-12-oauth-release-gate.txt
  ```

  **Commit**: YES
  - Message: `chore(release): codex oauth 리팩토링 최종 게이트 및 증적 정리`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `test(auth): oauth 리팩토링 전 계약 고정 테스트 추가` | `tests/mcp.test.ts`, `tests/native-host-codex-adapter.test.ts` | `bun test` |
| 2-4 | `feat(auth): codex oauth 인증 경로 단계 구현` | `native-host/host.mjs`, `src/domain/mcp.ts`, tests | `bun run build && bun test` |
| 5 | `feat(sidepanel): codex oauth 인증 UX 연동` | `extension/sidepanel.js`, `extension/sidepanel.html`, tests | `bun run test:e2e` |
| 6-8 | `fix(auth): oauth-only 정책/보안/상태 계약 안정화` | runtime + tests | `bun test && bun run test:i18n-contract` |
| 9-10 | `docs(auth): oauth-only 운영 정책/가이드 업데이트` | `docs/*` | `bun run build` |
| 11 | `test(auth): oauth 실패 매트릭스 확장` | `tests/*` | `bun test && bun run test:e2e` |
| 12 | `chore(release): oauth 리팩토링 최종 증적` | `.sisyphus/evidence/*`, checklist docs | `bun run ci` |

---

## Success Criteria

### Verification Commands
```bash
bun run test:i18n-contract
bun run build
bun test
bun run ci
bun run test:e2e
```

### Final Checklist
- [x] OAuth-only Codex auth path is implemented and env fallback is not used in runtime policy.
- [x] Existing autopilot mode semantics and status compatibility are preserved.
- [x] Security/redaction assertions pass for all OAuth-related artifacts.
- [x] Runbook includes actionable rollback and troubleshooting.
- [x] All CI gates pass with coverage >=85%.
