# Full Auto Mode Implementation Plan

## TL;DR

> **Quick Summary**: Build a host-owned autonomous pipeline so AI continuously runs `delta_sync -> analyze -> evidence/todo persist -> attachment save` without human clicks. Human actions remain limited to initial setup, first sync, and error recovery.
>
> **Deliverables**:
> - Host-side autopilot state machine and control actions
> - Deterministic/idempotent evidence-todo persistence path
> - Sidepanel converted to control plane (mode/status/kill-switch)
> - Typed MCP contract parity between runtime and domain layer
> - Automated QA scenarios for full-auto, review-first, degraded mode
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 -> Task 3 -> Task 4 -> Task 6 -> Task 8

---

## Context

### Original Request
완전자동 모드를 위한 상세 구현계획. 사람은 초기 연동/초기 동기화/에러 해결만 담당하고, 이후 메일 수집/확인/분석/DB 연동/Todo 생성/첨부 저장은 AI가 자동 수행.

### Interview Summary
**Key Discussions**:
- Current login and sync automation exists, but Evidence/Todo is still manually button-driven.
- User expectation is Codex/AI-driven autonomous todo pipeline, not manual UI operations.
- Plan must be one integrated implementation plan with explicit safety and rollback.

**Research Findings**:
- Manual workflow calls are wired in `extension/sidepanel.js` (`createEvidence`, `upsertTodo`).
- Runtime handlers exist in `native-host/host.mjs`, but no automatic trigger path for workflow persistence.
- `src/domain/mcp.ts` has contract gap vs runtime actions; typed autopilot surface is missing.

### Metis Review
**Identified Gaps (addressed in this plan)**:
- Missing state ownership and state machine definition -> added explicit autopilot FSM and persistence model.
- Missing idempotency and duplicate guardrails -> added deterministic keys + retry-safe upsert requirements.
- Missing rollout boundaries -> added review-first to full-auto gated rollout and kill-switch SLA.
- Missing agent-executable acceptance criteria -> each task includes detailed autonomous QA scenarios.

---

## Work Objectives

### Core Objective
Establish a production-safe full-auto pipeline where the host orchestrates mail ingestion, AI analysis, evidence/todo persistence, and attachment storage autonomously with deterministic behavior and bounded risk.

### Concrete Deliverables
- New host actions: `autopilot.set_mode`, `autopilot.tick`, `autopilot.pause`, `autopilot.resume`, `autopilot.status`.
- New persistent `autopilot` state block in host state.
- Idempotent evidence/todo persistence semantics and duplicate prevention.
- Sidepanel supervisory controls for mode/status/kill-switch and degraded visibility.
- Contract parity and tests in `src/domain/mcp.ts` + `tests/mcp.test.ts`.

### Definition of Done
- [ ] Full-auto mode runs 100+ ticks without duplicate todo/evidence for same source.
- [ ] Kill-switch pauses new side-effects within one tick window.
- [ ] Review-first mode blocks writes while still producing review candidates.
- [ ] `bun run ci` passes with coverage >= 85%.

### Must Have
- Host-owned orchestration state machine with bounded retries and degraded mode.
- Deterministic idempotency keys for evidence/todo writes.
- Human-free operational verification scenarios (no manual check steps).

### Must NOT Have (Guardrails)
- No hidden autonomous writes when mode is `review_first` or `paused`.
- No unbounded loops/retries.
- No scope creep into multi-account/cross-provider support in this plan.
- No automatic destructive mailbox actions (delete/move/send) in this phase.

### Autonomy Policy (Defaults Applied)
- **Source of truth**: host-persisted `state.autopilot` in `native-host/state.json` (single-writer model).
- **Human-only responsibilities**: initial setup, first sync bootstrap, and error recovery actions.
- **Degraded mode behavior**: stop all write-side effects (`evidence`, `todo`, `attachment save`) and run read-only diagnosis until manual resume.
- **Safety budgets**:
  - max pipeline cycles per hour: 120
  - max messages analyzed per tick: 30
  - max attachments saved per tick: 10
  - max attachment size in auto mode: 25MB
- **Retry policy**: 5 attempts per stage, exponential backoff with jitter; then degraded mode.
- **Autonomy level (v1)**: deterministic extraction + policy-gated AI enrichment, not unconstrained generative planning.

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan are verifiable without manual actions.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: `vitest` via `bun test` / `bun run ci`

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

Tool selection:
- Backend/API logic: Bash (`bun test`, scripted node/bun runners)
- CLI/native host process behaviors: Bash + JSON fixtures
- UI behavior verification: Playwright on sidepanel controls where needed

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Foundations):
- Task 1: Autopilot state schema and FSM
- Task 2: MCP contract surface alignment

Wave 2 (Core Pipeline):
- Task 3: Host orchestration actions and tick engine
- Task 4: Idempotent evidence/todo persistence
- Task 5: Attachment auto-save policy and dedupe

Wave 3 (Control + Hardening):
- Task 6: Sidepanel control-plane conversion
- Task 7: Observability/degraded mode and kill-switch
- Task 8: End-to-end autonomous test suite + CI gate

Critical Path: 1 -> 3 -> 4 -> 6 -> 8

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | 3,4,7 | 2 |
| 2 | None | 3,8 | 1 |
| 3 | 1,2 | 4,5,6,7 | 5 (partial) |
| 4 | 1,3 | 8 | 5 |
| 5 | 3 | 8 | 4 |
| 6 | 3 | 8 | 7 |
| 7 | 1,3 | 8 | 6 |
| 8 | 2,4,5,6,7 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1,2 | `task(category="deep", load_skills=["git-master"], run_in_background=false)` |
| 2 | 3,4,5 | `task(category="unspecified-high", load_skills=["git-master"], run_in_background=false)` |
| 3 | 6,7,8 | `task(category="unspecified-high", load_skills=["git-master"], run_in_background=false)` |

---

## TODOs

- [ ] 1. Define autopilot state schema and state machine

  **What to do**:
  - Add persistent `autopilot` block in host state shape (`mode`, `status`, `cursor`, `in_flight_run_id`, `retry_queue`, `last_error`, `metrics`).
  - Declare host-owned single-writer semantics: only host runtime mutates `state.autopilot`.
  - Define allowed transitions: `idle -> syncing -> analyzing -> persisting -> idle`, plus `retrying`, `degraded`, `paused`.
  - Enforce invalid transition rejection with explicit error.

  **Must NOT do**:
  - Do not mix UI state with host runtime state.
  - Do not allow implicit mode changes without action calls.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: state-machine and persistence design across runtime.
  - **Skills**: `git-master`
    - `git-master`: keeps contract changes atomic with test updates.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: 3,4,7
  - **Blocked By**: None

  **References**:
  - `native-host/host.mjs:30` - persistent state defaults and normalization entry.
  - `native-host/host.mjs:1651` - central action dispatch point.
  - `src/domain/mcp.ts:228` - runtime state typing baseline.

  **Acceptance Criteria**:
  - Scenario: FSM transition validity
    - Tool: Bash
    - Steps:
      1. Run `bun test tests/mcp.test.ts -t "state machine"` (new tests).
      2. Execute invalid transition fixture.
      3. Assert error code indicates transition violation.
    - Expected Result: only defined transitions accepted.
    - Evidence: terminal output capture.

- [ ] 2. Add typed MCP/autopilot contract parity

  **What to do**:
  - Extend `src/domain/mcp.ts` with workflow+autopilot action names and input/output types.
  - Ensure handler surface matches host action dispatcher exactly.
  - Add contract parity tests.

  **Must NOT do**:
  - Do not leave host-only actions untyped.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 3,8
  - **Blocked By**: None

  **References**:
  - `src/domain/mcp.ts:53` - existing action-name union.
  - `src/domain/mcp.ts:1316` - handler mapping.
  - `native-host/host.mjs:1708` - workflow action runtime handlers.

  **Acceptance Criteria**:
  - Scenario: contract parity test
    - Tool: Bash
    - Steps:
      1. Run `bun test tests/mcp.test.ts -t "invokeMcpToolByName"`.
      2. Assert all runtime-exposed autopilot/workflow actions are typed and invokable.
    - Expected Result: no missing tool cases.
    - Evidence: test output.

- [ ] 3. Implement host-owned autopilot tick engine

  **What to do**:
  - Add `autopilot.tick` orchestration action in host dispatcher.
  - Tick flow executes bounded stages: auth-check, delta-sync, candidate selection, analyze, persist.
  - Add concurrency lock via `in_flight_run_id`.

  **Must NOT do**:
  - Do not allow overlapping ticks.
  - Do not run unbounded per-tick message count.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: 4,5,6,7
  - **Blocked By**: 1,2

  **References**:
  - `native-host/host.mjs:602` - current delta sync behavior.
  - `extension/sidepanel.js:747` - current autosync timer to migrate from execution role to trigger-only role.

  **Acceptance Criteria**:
  - Scenario: bounded tick execution
    - Tool: Bash
    - Steps:
      1. Run scripted ticks: `bun run scripts/autopilot-tick-smoke.ts --ticks 50`.
      2. Assert max messages per tick is respected.
      3. Assert no concurrent in-flight runs.
    - Expected Result: deterministic bounded processing.
    - Evidence: generated JSON report in `.sisyphus/evidence/task-3-ticks.json`.

- [ ] 4. Make evidence/todo persistence idempotent and duplicate-safe

  **What to do**:
  - Add deterministic idempotency keys for evidence and todo writes.
  - Key schema defaults:
    - `evidence_key = sha1(message_pk + normalized_snippet + locator_type)`
    - `todo_key = sha1(title_normalized + evidence_key + workflow_namespace)`
  - Upsert by deterministic keys rather than timestamp-generated identifiers.
  - Return `created|updated|skipped_duplicate` semantic flags.

  **Must NOT do**:
  - Do not break existing manual action compatibility.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 5)
  - **Blocks**: 8
  - **Blocked By**: 1,3

  **References**:
  - `native-host/host.mjs:1545` - current timestamp-driven evidence id generation.
  - `native-host/host.mjs:1586` - current todo id generation.
  - `tests/mcp.test.ts:516` - existing sync idempotency test style to mirror.

  **Acceptance Criteria**:
  - Scenario: retry duplicate prevention
    - Tool: Bash
    - Steps:
      1. Run `bun test tests/mcp.test.ts -t "idempotency"` (new tests).
      2. Replay same candidate payload three times.
      3. Assert one evidence and one todo record remain.
    - Expected Result: duplicate-free persistence.
    - Evidence: test output + state snapshot.

- [ ] 5. Automate attachment save policy with dedupe and guardrails

  **What to do**:
  - Integrate attachment-save stage into autopilot pipeline.
  - Enforce type/size limits and skip policy logging.
  - Reuse existing sha/content dedupe and avoid re-downloading.

  **Must NOT do**:
  - Do not download unsupported/blocked attachments.
  - Do not save same attachment repeatedly.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 8
  - **Blocked By**: 3

  **References**:
  - `native-host/host.mjs:1238` - attachment write path.
  - `native-host/host.mjs:1213` - attachment lookup key pattern.

  **Acceptance Criteria**:
  - Scenario: attachment dedupe under repeated ticks
    - Tool: Bash
    - Steps:
      1. Run repeated tick simulation with same attachment source.
      2. Assert one physical file write and repeated skips thereafter.
    - Expected Result: dedupe maintained, no redundant storage.
    - Evidence: file count + log output.

- [ ] 6. Convert sidepanel into control-plane UX (not executor)

  **What to do**:
  - Add mode controls (`review_first`, `full_auto`, `paused`) and status panel.
  - Keep manual Evidence/Todo actions as fallback-only tools.
  - Replace periodic delta-only timer trigger with autopilot tick trigger mode.

  **Must NOT do**:
  - Do not remove fallback recovery controls.
  - Do not leave hidden autonomous writes without visible mode/status.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `frontend-ui-ux`, `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: 8
  - **Blocked By**: 3

  **References**:
  - `extension/sidepanel.html:151` - Evidence/Todo UI section.
  - `extension/sidepanel.js:874` - event wiring currently manual-heavy.
  - `extension/sidepanel.js:754` - autosync timer current behavior.

  **Acceptance Criteria**:
  - Scenario: mode switching and visibility
    - Tool: Playwright
    - Steps:
      1. Open sidepanel UI.
      2. Set mode to `full_auto`.
      3. Trigger one tick action.
      4. Assert mode/status indicators update and show in-flight->idle transition.
      5. Toggle kill-switch and assert `paused` status.
    - Expected Result: control-plane accurately reflects runtime state.
    - Evidence: screenshots under `.sisyphus/evidence/task-6-*.png`.

- [ ] 7. Add observability, degraded-mode behavior, and kill-switch SLA

  **What to do**:
  - Emit structured lifecycle events (`run_started`, `stage_failed`, `degraded_entered`, `run_completed`).
  - Define degraded-mode entry/exit rules and manual resume path.
  - Enforce degraded-mode write lock: no `workflow.create_evidence`, `workflow.upsert_todo`, or attachment write until `autopilot.resume` succeeds.
  - Enforce kill-switch to halt new side effects within one tick.

  **Must NOT do**:
  - Do not silently swallow stage failures.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 6)
  - **Blocks**: 8
  - **Blocked By**: 1,3

  **References**:
  - `native-host/host.mjs:1480` - health/status output extension point.
  - `native-host/host.mjs:1487` - logs/history output hook.

  **Acceptance Criteria**:
  - Scenario: degraded mode and pause enforcement
    - Tool: Bash
    - Steps:
      1. Inject staged failures for three consecutive cycles.
      2. Assert mode transitions to `degraded` and write stages stop.
      3. Trigger `autopilot.resume`; assert transition back to `idle` after successful tick.
    - Expected Result: deterministic degraded handling.
    - Evidence: structured event log capture.

- [ ] 8. Build end-to-end autonomous QA and CI gates

  **What to do**:
  - Add scenario tests for review-first, full-auto, duplicate prevention, kill-switch, and recovery.
  - Update CI to run autonomous scenario suite in addition to existing tests.
  - Add rollout promotion gates (`review_first` -> `full_auto`): duplicate rate, retry exhaustion rate, and degraded-entry rate thresholds.
  - Ensure coverage remains >= 85%.

  **Must NOT do**:
  - Do not rely on manual test confirmation.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Final
  - **Blocks**: None
  - **Blocked By**: 2,4,5,6,7

  **References**:
  - `tests/mcp.test.ts` - primary behavior suite extension target.
  - `package.json` - CI command chain (`bun run ci`).

  **Acceptance Criteria**:
  - Scenario: full suite gate
    - Tool: Bash
    - Steps:
      1. Run `bun test tests/mcp.test.ts`.
      2. Run `bun run ci`.
      3. Run rollout metric script: `bun run scripts/autopilot-rollout-gates.ts`.
      4. Parse coverage and rollout output.
    - Expected Result: all pass; coverage >= 85%; promotion gates satisfied.
    - Evidence: CI terminal output artifact.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|-------------|
| 1-2 | `feat: 자동오케스트레이션 상태/계약 기반 추가` | host/mcp core | `bun test tests/mcp.test.ts` |
| 3-5 | `feat: full-auto 파이프라인과 중복방지 로직 구현` | host runtime + persistence | `bun test` |
| 6-7 | `feat: 제어패널 모드/관측/복구 체계 강화` | extension + host status | `bun test` |
| 8 | `test: 완전자동 회귀 시나리오와 CI 게이트 보강` | tests/ci | `bun run ci` |

---

## Success Criteria

### Verification Commands
```bash
bun test tests/mcp.test.ts
bun run ci
```

### Final Checklist
- [ ] Full-auto mode runs without manual Evidence/Todo button dependency
- [ ] No duplicate evidence/todo under retries
- [ ] Kill-switch and degraded mode behave deterministically
- [ ] Review-first and full-auto mode boundaries are enforced
- [ ] CI green and coverage threshold satisfied
