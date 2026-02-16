# Outlook 로컬 업무 자동화 에이전트 — Specs v0.2
- 작성일: 2026-02-16
- 이 문서는 PRD v0.2를 구현하기 위한 **개발 스펙(1,2,3)** 입니다.
- 범위: Evidence Schema / MCP Tools / Deep Link 규격 / (추가) Graph Sync 스펙

---

## 변경 요약(v0.1 → v0.2)
- mail_store가 “DOM 수집 결과 조회” 중심에서 **Graph 동기화(초기+Delta) + 로컬 스토어 조회** 중심으로 변경
- message 모델에 Graph 고유 필드(conversationId, webLink 등) 반영

---

## 1) Evidence 스키마 (JSON Schema)
> v0.1 스키마 유지(핵심 변경 없음). 단, email source의 경우 Graph message id(message_pk 매핑)와 webLink 활용을 전제로 함.

### 1.1 JSON Schema (Draft 2020-12)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://local.mailagent/schemas/evidence.json",
  "title": "Evidence",
  "type": "object",
  "required": ["evidence_id", "source", "locator", "snippet", "confidence", "created_at"],
  "properties": {
    "evidence_id": {
      "type": "string",
      "description": "고유 Evidence ID (ULID/UUID 권장)"
    },
    "source": {
      "type": "object",
      "required": ["kind", "id"],
      "properties": {
        "kind": { "type": "string", "enum": ["email", "attachment"] },
        "id": {
          "type": "string",
          "description": "email이면 message_pk(내부), attachment면 attachment_pk(내부)"
        },
        "thread_pk": { "type": "string", "description": "선택: 스레드 컨텍스트" }
      }
    },
    "locator": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": { "type": "string", "enum": ["outlook_quote", "pdf", "pptx", "docx", "xlsx", "image"] },
        "page": { "type": "integer", "minimum": 1, "description": "PDF 페이지(1-indexed)" },
        "slide": { "type": "integer", "minimum": 1, "description": "PPT 슬라이드 번호(1-indexed)" },
        "sheet": { "type": "string", "description": "엑셀 시트명" },
        "range": { "type": "string", "description": "엑셀 범위(A1 notation)" },
        "paragraph_index": { "type": "integer", "minimum": 0, "description": "DOCX 문단 인덱스(0-indexed)" },
        "bbox": {
          "type": "array",
          "items": { "type": "number" },
          "minItems": 4,
          "maxItems": 4,
          "description": "정규화 좌표 [x1,y1,x2,y2] (0~1)"
        },
        "text_quote": { "type": "string", "minLength": 1, "maxLength": 280 },
        "text_hash": { "type": "string" },
        "anchor": { "type": "string", "description": "확장용 앵커(예: span_id)" }
      },
      "additionalProperties": false
    },
    "snippet": { "type": "string" },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "created_at": { "type": "string", "format": "date-time" },
    "debug": { "type": "object" }
  },
  "additionalProperties": false
}
```

---

## 2) MCP Tools 스펙

### 2.1 공통 규약
- 모든 응답은 `ok`(boolean)와 오류 정보를 포함할 수 있음: `error_code`, `error_message`, `retryable`
- 시간: ISO-8601(date-time)
- ID: ULID/UUID 문자열

---

### 2.2 auth_store (Graph 인증/토큰)
> Native Host가 OAuth2 Authorization Code + PKCE를 수행하고 토큰을 보관(권장)

#### 2.2.1 start_login
- 목적: 로그인 URL 생성 + 로컬 루프백 콜백 대기 시작
- 입력:
```json
{ "scopes": ["Mail.Read", "User.Read", "offline_access", "openid", "profile"] }
```
- 출력:
```json
{ "ok": true, "login_url": "…", "callback_url": "http://127.0.0.1:PORT/callback" }
```

#### 2.2.2 complete_login
- 목적: 콜백으로 받은 code를 토큰으로 교환(호스트 내부 처리)
- 입력:
```json
{ "code": "…", "state": "…", "code_verifier": "…" }
```
- 출력:
```json
{ "ok": true, "account": { "email": "me@…", "tenant": "…" } }
```

#### 2.2.3 auth_status
- 입력: `{}`
- 출력: `{"ok":true,"signed_in":true,"account":{...}}`

---

### 2.3 graph_mail_sync (Graph 동기화)
#### 2.3.1 initial_sync
- 목적: 초기 백필(예: 최근 N일, 특정 폴더)
- 입력:
```json
{
  "mail_folder": "inbox",
  "days_back": 30,
  "select": ["id","conversationId","subject","from","toRecipients","ccRecipients","receivedDateTime","sentDateTime","body","bodyPreview","hasAttachments","isRead","internetMessageId","webLink"]
}
```
- 출력:
```json
{ "ok": true, "synced_messages": 123, "synced_attachments": 12 }
```

#### 2.3.2 delta_sync
- 목적: 변경 추적(Delta)로 신규/수정/삭제 반영 + deltaLink 저장
- 입력:
```json
{ "mail_folder": "inbox" }
```
- 출력:
```json
{ "ok": true, "changes": {"added": 5, "updated": 3, "deleted": 1}, "new_delta_link_saved": true }
```

#### 2.3.3 download_attachment
- 목적: 첨부 원본 다운로드(권장: `/$value`)
- 입력:
```json
{ "graph_message_id": "…", "graph_attachment_id": "…", "message_pk": "msg_…" }
```
- 출력:
```json
{ "ok": true, "attachment_pk": "att_…", "sha256": "…", "relative_path": "attachments/…", "size_bytes": 123456 }
```

---

### 2.4 mail_store (로컬 스토어 조회)
#### 2.4.1 get_message
- 입력: `{"message_pk":"msg_..."}`
- 출력(예시):
```json
{
  "ok": true,
  "message": {
    "message_pk": "msg_...",
    "provider_message_id": "GRAPH_MESSAGE_ID",
    "provider_thread_id": "conversationId",
    "internet_message_id": "<…>",
    "web_link": "https://outlook.office.com/…",
    "subject": "…",
    "from": "…",
    "to": ["…"],
    "cc": ["…"],
    "received_at": "…",
    "body_text": "…",
    "has_attachments": true,
    "attachments": ["att_1", "att_2"]
  }
}
```

#### 2.4.2 get_thread
- 입력: `{"thread_pk":"th_...","depth":50}`
- 출력: 메시지 목록(time-ordered)

---

### 2.5 attachment_store (파일 저장/열기)
> v0.1 유지. 단, source는 Graph 다운로드 결과 파일 경로를 사용.

---

### 2.6 work_store / contact_store / document_intelligence
> v0.1 유지(근거 필수). 단, “메일 근거”의 링크는 `web_link`를 사용.

---

## 3) Deep Link 규격 (근거 클릭 → 출처 위치로 이동)

### 3.1 기본 원칙
- 첨부: **로컬 뷰어**가 최종 진입점(정확한 점프/하이라이트 보장)
- 메일: Graph `webLink`로 Outlook 메시지 오픈 + 확장프로그램이 quote 기반 하이라이트 시도
- 링크는 DB에 영구 저장보다 **locator로부터 런타임 생성** 권장

### 3.2 로컬 뷰어 URL 규격(권장)
- `http://127.0.0.1:<PORT>/viewer/<type>/<attachment_pk>?…&t=<token>`
- (PDF) `?page=3&hl=<quote>`
- (XLSX) `?sheet=Sheet1&range=B12:C20`
- (PPTX) `?slide=5&hl=<quote>`
- (DOCX) `?p=42&hl=<quote>`
- (IMAGE) `?bbox=0.12,0.33,0.78,0.41`

### 3.3 Outlook 메일 링크
- `message.web_link`를 새 탭/팝아웃으로 오픈
- content script가 본문에서 `text_quote`를 찾아 하이라이트
- 실패 시 폴백: 근처 위치 + “근거 탐색 실패” + 재인덱싱/재추출

---

## 부록 A) 에러 코드 제안(공통)
- `E_AUTH_REQUIRED` 로그인 필요
- `E_AUTH_FAILED` 인증 실패/갱신 실패
- `E_GRAPH_THROTTLED` Graph rate limit
- `E_NOT_FOUND` message/attachment/work 없음
- `E_PARSE_FAILED` 문서 파싱 실패
- `E_VIEWER_UNAVAILABLE` 로컬 뷰어 구동 실패
- `E_POLICY_DENIED` 정책 위반(경로/확장자/크기)
