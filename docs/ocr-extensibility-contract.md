# OCR 확장 인터페이스 계약서 (구현 제외)

이 문서는 현재 첨부 분석 파이프라인에 OCR 기능을 즉시 도입하지 않고, 향후 확장 시 준수해야 할 입력/출력/오류/보안 경계를 정의한다.

## 1. 범위와 기본 동작

- 본 계약은 향후 OCR 플러그인(로컬 엔진 또는 외부 서비스 어댑터)의 경계만 정의한다.
- 현재 기본 동작은 **비-OCR 경로 유지**이며, 텍스트 추출 가능한 첨부만 기존 방식으로 병합한다.
- 이미지/비텍스트 첨부는 계속 `requires_user_confirmation` 경로로 라우팅한다.
- `src/domain/mcp.ts`의 현재 후보 생성/리뷰 라우팅/실패 분류 의미를 변경하지 않는다.

## 2. 입력 계약 (Input Payload)

OCR 어댑터는 아래 구조를 입력으로 받는다.

```json
{
  "schema_version": "ocr_candidate.v1",
  "candidate": {
    "message_pk": "string",
    "internet_message_id": "string",
    "received_at": "ISO8601",
    "subject": "string",
    "from": "string",
    "has_attachments": true
  },
  "attachment": {
    "attachment_pk": "string",
    "graph_attachment_id": "string",
    "relative_path": "string",
    "file_name": "string|null",
    "content_type": "string|null",
    "size_bytes": 0,
    "sha256": "string"
  },
  "extraction_context": {
    "run_id": "string",
    "mode": "review_first|full_auto|manual",
    "attempt": 1,
    "max_attempts": 2,
    "text_limit_chars": 1800,
    "redaction_profile": "task6-default",
    "metadata_allowlist": [
      "message_pk",
      "internet_message_id",
      "received_at",
      "has_attachments",
      "attempt",
      "max_attempts"
    ]
  }
}
```

입력 필수 규칙:

- `attachment.relative_path`, `attachment.sha256`, `attachment.size_bytes`는 필수이며 누락 시 즉시 오류로 처리한다.
- `metadata_allowlist` 외 메타데이터는 OCR 어댑터로 전달하지 않는다.
- 본문/첨부 원문 바이너리는 로그에 기록하지 않는다.

## 3. 출력 계약 (Output/Result)

OCR 어댑터는 아래 두 결과 중 하나를 반환한다.

### 3.1 텍스트 추출 성공

```json
{
  "ok": true,
  "result_type": "extracted_text",
  "text": "string",
  "char_count": 0,
  "truncated": false,
  "confidence": 0.0,
  "requires_user_confirmation": false,
  "telemetry": {
    "duration_ms": 0,
    "engine": "string",
    "engine_version": "string"
  }
}
```

### 3.2 검토 필요

```json
{
  "ok": true,
  "result_type": "requires_confirmation",
  "reason": "low_confidence|non_text_detected|policy_blocked|quality_insufficient",
  "review_hint": "string",
  "requires_user_confirmation": true,
  "telemetry": {
    "duration_ms": 0,
    "engine": "string",
    "engine_version": "string"
  }
}
```

출력 필수 규칙:

- `requires_user_confirmation=true`면 자동 write 경로로 승격하지 않는다.
- `text`는 계약된 길이 제한을 적용하고, 제한 시 `truncated=true`를 반드시 설정한다.
- OCR 결과가 비어 있거나 신뢰도 기준 미달이면 `requires_confirmation`으로 반환한다.

## 4. 오류 분류 계약 (Error Taxonomy)

OCR 어댑터 오류는 다음 3개 클래스로만 표준화한다.

### 4.1 retryable

- 예: 일시적 timeout, 일시적 I/O, 일시적 프로세스 종료
- 기대 동작: 재시도 횟수(`max_attempts`) 내 재시도 후, 소진 시 기존 `codex_retriable_exhausted` 경로를 따른다.

### 4.2 terminal

- 예: 손상 파일, 암호화 파일, 지원 불가 포맷, 스키마 불일치
- 기대 동작: 즉시 실패 분류하고 기존 fail-closed 규칙을 따른다.

### 4.3 review_route

- 예: 품질 부족, 민감정보 정책 위반 가능성, 신뢰도 임계치 미달
- 기대 동작: 오류로 간주하지 않고 `requires_user_confirmation` 검토 경로로 라우팅한다.

## 5. 보안 경계

- Task 6의 레드랙션 정책을 그대로 유지한다. 민감값(토큰/키/비밀)은 로그/상태/헬스 응답에 노출하지 않는다.
- OCR 요청 아티팩트의 메타데이터는 allowlist 기반으로만 전달한다.
- `file_name`, `subject`, `from` 등 사용자 노출 텍스트는 로그 저장 전에 레드랙션 필터를 통과해야 한다.
- 원본 첨부 바이너리 또는 전체 추출 텍스트를 상태 API에 직접 싣지 않는다.

## 6. 비-OCR 기본 경로 안정성 선언

- OCR 어댑터가 연결되지 않았거나 비활성화된 경우 현재 비-OCR 경로가 기본이며, 이 경로가 정식 운영 기준이다.
- OCR 관련 설정/플래그가 없더라도 `bun run build`, `bun test`는 통과해야 한다.
- OCR 미구현 상태에서 기존 첨부 텍스트 추출(지원 텍스트 포맷)과 이미지 리뷰 라우팅 동작은 회귀 없이 유지되어야 한다.

## 7. 향후 마이그레이션 체크리스트 (실행 가능/측정 가능)

1. 경계 계약 테스트
   - 입력/출력/오류 스키마에 대한 단위 테스트를 추가하고, 필수 필드 누락 시 실패를 확인한다.
2. 보안 검증
   - `system.health`/status/log 노출면에서 OCR 결과 관련 민감 텍스트 레드랙션 테스트를 통과한다.
3. 성능 예산
   - 첨부 1건 OCR 처리 `p95`와 tick 전체 `p95` 목표를 정의하고 회귀 임계치를 CI에 반영한다.
4. 실패 정책 회귀
   - `retryable/terminal/review_route` 분류가 기존 모드 정책(`review_first`, `full_auto`, `degraded`)과 충돌하지 않음을 검증한다.
5. 의존성 검증
   - OCR 미사용 기본 빌드/테스트 경로에서 OCR 엔진 또는 외부 OCR 서비스 의존성이 필수가 아님을 검증한다.
6. 운영 가이드 업데이트
   - 사용자 안내서(`docs/chrome-extension-user-guide.md`)와 롤아웃 문서에 OCR 온/오프 기준과 롤백 조건을 명시한다.

## 8. 비범위(Non-Goals)

- OCR 라이브러리 도입
- OCR 서비스 API 연동
- `native-host/host.mjs` 및 `src/domain/mcp.ts` 런타임 로직 변경
