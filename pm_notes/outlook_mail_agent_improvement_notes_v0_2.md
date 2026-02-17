# 개선/보완 항목 목록 (Change Log 후보) v0.2
- 작성일: 2026-02-16
- 기록 시각: 2026-02-16 07:05:44
- 원칙: PRD/Specs/상세계획서(v0.2)는 “Graph 전환”을 반영해 갱신되었으며, 본 문서는 지속적인 리스크/보완점을 누적 관리한다.

---

## 0) 주요 결정 사항(이번 변경)
- Outlook 수집을 DOM 파싱에서 **Microsoft Graph API(초기+Delta Sync)**로 전환

---

## 1) 인증/권한/조직 정책 리스크
- 조직(테넌트) 정책에 따라 Mail.Read 등이 제한될 수 있음
- 관리자 컨센트/승인 UX 및 가이드 필요
- 토큰 만료/갱신 실패 시 복구 플로우(재로그인) 필수

---

## 2) Graph throttling(레이트리밋) 대응
- 초기 동기화 범위 제한(최근 N일)
- Delta Sync 기본, 재시도/백오프
- 첨부 다운로드는 큐잉/배치로 분산

---

## 3) 첨부 분석 100% 불가 → 보완 전략
- Evidence 필수 + 근거 부족/신뢰 낮음은 검토 필요 큐로
- 스캔 문서/이미지는 OCR/비전 fallback
- sha256 캐시 + 재인덱싱 버튼

---

## 4) 사고 과정/툴 호출/결정 기록(타임라인)
- work_event + agent_trace로 “왜/무엇/근거/결과”를 남기고 검색 가능해야 함
- 분쟁/책임 추적/논점 회수에 직접적으로 기여

---

## 5) 검색/인덱싱(과거 자료 회수)
- SQLite FTS5로 메일/추출 텍스트/요약/첨부 메타를 통합 인덱싱
- 검색 결과에서 근거 링크로 즉시 이동(검증 속도)

---

## 6) Deep Link 실패 대응
- Outlook 메일은 webLink + quote 하이라이트(재시도/폴백)
- 첨부는 로컬 뷰어가 표준(페이지/셀/슬라이드/문단/bbox)

---

## 7) 작업 로그 (2026-02-17)
- Task 09: `graph_mail_sync.download_attachment` 정합성 마감
- 첨부 dedupe/lookup key를 `graph_message_id::graph_attachment_id`로 통일
- 중복 요청은 기존 `attachment_pk`/`sha256`/`relative_path`를 재사용하고 경로/메타 불일치 시 즉시 실패
- 실패 케이스를 명시적으로 분리: message mismatch, attachment missing, sha mismatch
- MCP 스펙 문서 예시의 성공 응답 포맷을 코드(`{ ok: true, data: ... }`)와 정합화
