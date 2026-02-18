# UI String Inventory - Task 2

작성일: 2026-02-18  
범위: `extension/sidepanel.html`, `extension/sidepanel.js`, `src/domain/mcp.ts`, `src/domain/evidence.ts`, `src/domain/deep-link.ts`, `src/domain/deep-link-workflow.ts`, `tests/mcp.test.ts`, `tests/evidence.test.ts`, `tests/deep-link.test.ts`

## 분류 원칙

- 표시 문자열(라벨/placeholder/상태/오류/가이던스)은 번역 대상(Translatable)이다.
- 계약 토큰(`action`, `error_code`, enum/value key, payload key)은 비번역 대상(Non-Translatable)이다.
- 리스크 기준:
  - High: 계약/테스트 결합이 강해 번역 시 회귀 가능성이 큼
  - Medium: 사용자 가시 영향은 크나 계약 오염 위험은 낮음
  - Low: 표시 영향 제한적, 결합도 낮음

## A. Translatable Display Strings

| file path | string source type | risk | test-coupling impact | notes |
|---|---|---|---|---|
| `extension/sidepanel.html` | HTML label/placeholder | Medium | `tests/i18n-contract.test.ts`가 일부 옵션/placeholder 원문을 고정(`manual`, `open`, `mail_folder`, `message_pk`) | 번역 대상: 섹션 타이틀(인증/메일 동기화/메일 조회/첨부 다운로드/자동 동기화/운영/복구/결과), 버튼 라벨, 한글 placeholder |
| `extension/sidepanel.html` | HTML label/placeholder | High | 상태 기본 문구가 `sidepanel.js` 런타임 업데이트와 결합 | 번역 후보(영문 잔존): `Outlook Local Work Agent`, `Auth status: unknown`, `Auto sync: stopped`, `Autopilot`, `Autopilot: unknown`, `Autopilot hint: unknown - started=0 ...` |
| `extension/sidepanel.js` | JS runtime status/error | High | `tests/i18n-contract.test.ts`는 계약 토큰만 고정하지만, `tests/mcp.test.ts`의 `error_message` 기대값과 간접 결합 | 번역 대상(상태): `Loaded at: ...`, `Login URL: ...`, `Auth status: signed_in=...`, `Query: ... 완료`, `Sync: ... 완료`, `Attachment: ... 완료`, `System: ... 완료`, `Workflow: ... 완료` |
| `extension/sidepanel.js` | JS runtime status/error | High | 런타임 오류는 `src/domain/mcp.ts` 오류 메시지 노출과 결합 | 번역 대상(오류): `Auth status error: ...`, `Query error: ...`, `Sync error: ...`, `Attachment error: ...`, `Auto sync error: ...`, `System error: ...`, `Autopilot error: ...`, `Workflow error: ...` |
| `extension/sidepanel.js` | JS runtime status/error | Medium | 자동완료 플로우 텍스트는 테스트 직접 고정 없음 | 번역 대상(가이던스): `callback URL 또는 code를 붙여넣고 ...`, `자동완료 대기/재시도`, `code를 입력하세요`, `start_login을 먼저 실행하세요`, `URL의 state가 현재 로그인 세션과 다릅니다` |
| `extension/sidepanel.js` | JS runtime status/error | Medium | UI 집계 문자열만 변경, 계약값 불변 필요 | 번역 대상(포맷): `(no subject)`, `msgs`, `bytes`, `Auto sync: running every ... minute(s)`, `Autopilot tick 완료: evidences=... todos=... attachments=...` |
| `src/domain/mcp.ts` | domain error/guidance | High | `tests/mcp.test.ts`가 `error_message.toContain(...)` 다수 사용 | 번역 대상: 인증/파싱/정책/동기화 오류 메시지 전반(예: `로그인이 필요합니다.`, `mail_folder 가 누락되었습니다.`, `manual 모드에서는 resume 할 수 없습니다.`) |
| `src/domain/mcp.ts` | domain error/guidance | High | codex parser/auto-flow 문자열을 테스트가 부분 고정 | 번역 대상: codex 출력 검증 메시지(`JSON 객체여야`, `필드가 필요합니다`, `알 수 없는 필드`, `0 이상 1 이하`) |
| `src/domain/mcp.ts` | domain error/guidance | Medium | UI 기본값 문자열이 테스트와 약결합 | 번역 대상: 기본 도메인 표시 문자열(`무제 메일`, `unknown`, `동기화 메시지 N`, `샘플 본문 N`, `[AUTO] ...`) |
| `src/domain/evidence.ts` | domain error/guidance | Medium | `tests/evidence.test.ts`가 path 중심 + 일부 message 포함 검증 | 번역 대상: validation 메시지 전부(`...객체여야 합니다`, `필수입니다`, `빈 값일 수 없습니다`, `ISO-8601 형식`, `알 수 없는 키`) |
| `src/domain/deep-link.ts` | domain error/guidance | Medium | `tests/deep-link.test.ts`가 `toThrow("...")`로 정확 문자열 결합 | 번역 대상: 예외 메시지(`webLink 는 빈 값일 수 없습니다.`, `webLink 는 절대 URL 이어야 합니다.`) |
| `src/domain/deep-link-workflow.ts` | domain error/guidance | Medium | `tests/deep-link.test.ts`가 `plan.guidance.toContain(...)` 결합 | 번역 대상: fallback guidance 4종(누락 링크, 잘못된 링크, malformed 링크, normal 안내) |

### A-1. 파일별 주요 번역 문자열 묶음(추출 결과)

- `extension/sidepanel.html`
  - 헤더/섹션: `Outlook Local Work Agent`, `인증`, `메일 동기화`, `메일 조회`, `첨부 다운로드`, `자동 동기화`, `Autopilot`, `운영/복구`, `Evidence/Todo`, `결과`
  - 상태 기본값: `Auth status: unknown`, `Auto sync: stopped`, `Autopilot: unknown`, `Autopilot hint: unknown - started=0 success=0 fail=0 timeout=0 schema_fail=0`
  - 입력 보조문구: `인가 코드 또는 callback URL`, `mail_folder`, `limit`, `message_pk 또는 message_id`, `thread_pk 또는 thread_id`, `graph_message_id`, `graph_attachment_id`, `message_pk`, `snippet`, `todo_id(optional)`, `todo title`, `evidence_id(optional)`
- `extension/sidepanel.js`
  - auth/status 계열: `Loaded at: ...`, `Auth status: ...`, `Auth status error: ...`, `Login URL: ...`
  - query/sync/attachment/system/workflow 계열: `Query: ... 완료`, `Query error: ...`, `Sync: ... 완료`, `Attachment: ... 완료`, `System: ... 완료`, `Workflow: ... 완료`
  - autopilot 계열: `Autopilot hint: degraded/retrying/failure observed/awaiting codex success/healthy`, `Autopilot: mode=... status=... paused=...`, `Autopilot tick 완료: ...`
- `src/domain/mcp.ts`
  - 인증/권한: `로그인이 필요합니다.`, `refresh token이 만료되어 재로그인이 필요합니다.`, `인증 갱신에 실패했습니다.`
  - 파싱/입력: `...가 누락되었습니다`, `...는 양의 정수여야 합니다`, `...형식이 올바르지 않습니다`
  - codex: `codex 출력은 단일 JSON 객체여야 합니다.`, `proposal.* 필드가 필요합니다.`, `알 수 없는 필드`, `지원되지 않는 schema_version`
  - 정책/상태: `manual 모드에서는 resume 할 수 없습니다.`, `autopilot 이 degraded/paused 상태입니다.`
- `src/domain/evidence.ts`
  - validation 전반: `source/locator/root ... 객체여야 합니다`, `필수입니다`, `빈 값일 수 없습니다`, `...타입은 ...값이 필요합니다`
- `src/domain/deep-link.ts`, `src/domain/deep-link-workflow.ts`
  - deep link 오류/안내: `webLink ...`, `메일 webLink 가 비어있어 ...`, `메일 링크 형식이 유효하지 않아 ...`, `이메일 deep link 형식이 올바르지 않습니다 ...`

## B. Non-Translatable Contract Tokens

| file path | string source type | risk | test-coupling impact | notes |
|---|---|---|---|---|
| `extension/sidepanel.html` | test-coupled assertion | High | `tests/i18n-contract.test.ts`가 exact token 포함 여부를 검사 | 비번역 토큰: `<option value="manual">manual</option>`, `review_first`, `full_auto`, `open`, `in_progress`, `done`, placeholder `mail_folder`, `message_pk` |
| `extension/sidepanel.js` | JS runtime status/error | High | `tests/i18n-contract.test.ts`가 `response.error_code`, `mail_folder:`, `message_pk:`, `{ action, ...payload }`를 고정 | 비번역 토큰: native action name, payload key, error_code field 참조 |
| `src/domain/mcp.ts` | domain error/guidance | High | `tests/mcp.test.ts`가 enum/code/action 계약을 광범위 검증 | 비번역 토큰: `McpErrorCode` 값군, `McpToolName`/`MCP_TOOL_NAMES`, status enum(`open/in_progress/done`), mode enum(`manual/review_first/full_auto`), payload key(`mail_folder`, `message_pk`, `graph_message_id` 등), schema key(`schema_version`, `proposal`) |
| `src/domain/evidence.ts` | domain error/guidance | Medium | `tests/evidence.test.ts`가 path 기반(`source.kind`, `locator.type`) 검사 | 비번역 토큰: evidence 필드 키(`evidence_id`, `source`, `locator`, `snippet`, `confidence`, `created_at`) 및 locator type enum(`outlook_quote`, `pdf`, `pptx`, `docx`, `xlsx`, `image`) |
| `src/domain/deep-link.ts` | domain error/guidance | Medium | `tests/deep-link.test.ts`가 fallback reason 문자열과 query key 고정 | 비번역 토큰: fallback reason(`missing_email_web_link`, `invalid_email_web_link`), query key(`mail_fallback`, `mail_quote`, `page`, `slide`, `sheet`, `range`, `p`, `hl`, `bbox`, `t`) |
| `src/domain/deep-link-workflow.ts` | domain error/guidance | Medium | `tests/deep-link.test.ts`가 mode/recoverySteps 정확값 검증 | 비번역 토큰: navigation mode(`normal`, `fallback_*`), recovery step(`refresh_message_link`, `reindex_message`, `retry_navigation`) |

## C. Test-Coupling Inventory (변경 영향)

| file path | string source type | risk | notes |
|---|---|---|---|
| `tests/mcp.test.ts` | test-coupled assertion | High | `error_message.toContain(...)`, `toBe("...")` 다수. 도메인/사이드패널 메시지 번역 시 테스트 실패 가능성이 가장 큼 |
| `tests/evidence.test.ts` | test-coupled assertion | Medium | message 일부 정확 문자열/부분문자열 기대 (`객체여야`, `ISO-8601 형식`) |
| `tests/deep-link.test.ts` | test-coupled assertion | High | `toThrow("webLink ...")`, `plan.guidance.toContain(...)`, fallback reason/mode 값 결합 |
| `tests/i18n-contract.test.ts` | test-coupled assertion | High | 비번역 계약 토큰 보호용 핵심 테스트. 번역 단계에서 반드시 green 유지 필요 |

## D. Documentation Sync Targets (문서 리스크)

| file path | string source type | risk | test-coupling impact | notes |
|---|---|---|---|---|
| `README.md` | domain error/guidance | Medium | 자동 테스트 결합 없음(문서 검토 프로세스 의존) | UI 용어(`로그인 시작`, `로그인 완료`, `로그인 상태 확인`, `initial_sync`, `delta_sync`)와 실제 화면 용어 동기화 필요 |
| `docs/install-guide.md` | domain error/guidance | Medium | 자동 테스트 결합 없음 | 설치/실행 단계에서 영문 상태 문구(`Auth status`, `Auto sync`, `Autopilot`) 한글 전환 시 스크린샷/문구 동기화 필요 |
| `docs/chrome-extension-user-guide.md` | HTML label/placeholder | High | 자동 테스트 결합 없음, 사용자 혼란 리스크 큼 | 사이드패널 라벨/버튼/오류 문구가 문서 안내와 1:1 매핑되어야 함 |

## E. 실행 주의사항 (Task 3/4 입력)

- 번역 우선순위 High: `extension/sidepanel.js` 상태/오류, `src/domain/mcp.ts` 오류/가이던스, `tests/mcp.test.ts` 결합 지점.
- 계약 토큰은 그대로 유지: `action`, `error_code`, enum/value, payload key, query key.
- 테스트 전환 전략: 문자열 정확 매칭을 코드/키 중심 검증으로 점진 전환하되 `tests/i18n-contract.test.ts`는 보호 테스트로 유지.
