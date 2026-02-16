# 상세 계획서 (Detailed Plan) v0.2 — Outlook 로컬 업무 자동화 에이전트
- 기준 문서: PRD v0.2 / Specs v0.2
- 작성일: 2026-02-16
- 목적: Graph 기반 동기화로 전환한 뒤, 개발 착수 가능한 수준으로 구체화(구성요소/기술스택/모듈/백로그/검증 기준)

---

## 변경 요약(v0.1 → v0.2)
- Outlook ingest를 **DOM 파싱(Content Script)**에서 **Graph API(초기+Delta Sync)**로 교체
- Content Script는 “근거 하이라이트/컨텍스트 연결” 중심으로 축소
- 백로그(Epic B)를 Graph Auth/Sync 중심으로 재구성

---

## 0) 목표 요약
- Graph로 Outlook 메일/첨부를 안정적으로 동기화하여 로컬 저장
- 첨부 분석 결과로 Evidence 포함 투두 생성/갱신
- 검색/감사/타임라인으로 “과거 논점/증거 회수”를 빠르게

---

## 1) 기술 스택(권장)
### 1.1 Chrome Extension(프론트)
- TypeScript + React
- MV3 + Side Panel
- 빌드: Plasmo(권장) 또는 WXT
- 상태: Zustand + React Query
- 대시보드: Recharts/ECharts
- 인증 UI: “로그인/동기화 상태” 표시(인증 자체는 Host가 담당)

### 1.2 Native Host(로컬)
- Python 3.11+
- FastAPI(로컬 API/뷰어)
- SQLite + FTS5(정본 DB + 검색)
- Microsoft Graph:
  - OAuth2 Auth Code + PKCE(로컬 루프백)
  - 초기 동기화 + Delta Sync
  - 첨부 다운로드는 `/$value` 사용(권장)
- Codex CLI 오케스트레이션 + MCP 스킬 서버

### 1.3 문서 파싱(로컬)
- PDF: PyMuPDF
- XLSX: openpyxl
- DOCX: python-docx
- PPTX: python-pptx(텍스트 우선, 렌더는 2차)
- 이미지: Pillow (+ 옵션 OCR/비전 fallback)

---

## 2) 모듈 설계(갱신)
### 2.1 Extension
- **Side Panel UI**
  - Dashboard / Todos / Search / Settings
- **Content Script(Outlook 탭)**
  - (A) 메일 Deep Link 오픈 후 quote 하이라이트
  - (B) 현재 열람 중인 메일 컨텍스트를 Side Panel에 전달(선택)
- **Background SW**
  - Native Host와 메시징
  - 로컬 API 프록시/알림

### 2.2 Native Host
- **Auth Manager**
  - PKCE 생성/검증, 토큰 저장/갱신, 계정 상태 제공
- **Graph Sync Engine**
  - initial_sync(백필)
  - delta_sync(주기적/수동 트리거)
  - 메시지/첨부 upsert + 삭제 반영
- **Attachment Pipeline**
  - download_attachment(/$value) → save_attachment(sha256 dedupe)
  - extraction cache/FTS 인덱싱
- **Local API/Viewer**
  - work/search/timeline endpoint
  - /viewer/pdf|xlsx|pptx|docx|image deep link
- **MCP Skill Server**
  - auth_store, graph_mail_sync, mail_store, attachment_store, document_intelligence, work_store, contact_store
- **Agent Orchestrator**
  - 이벤트 기반 실행(새 메일/새 첨부/사용자 분석 요청)

---

## 3) 백로그(의존성 순서) — Graph 전환 반영
### Epic A: 기반/부팅
- A1. Extension MV3 스캐폴딩 + Side Panel 라우팅
- A2. Native host 설치/실행 + token handshake
- A3. SQLite 스키마/마이그레이션 + 기본 CRUD API

### Epic B: Graph 인증/동기화(핵심)
- B1. Entra App Registration 가이드/설정(클라이언트ID/리다이렉트/스코프)
- B2. PKCE 로그인(로컬 루프백) + 토큰 저장/갱신
- B3. 초기 동기화(initial_sync): Inbox 최근 N일
- B4. Delta Sync: 변경 추적 + deltaLink 저장
- B5. 첨부 목록/다운로드(/$value) + 로컬 저장 연결
- B6. conversationId → thread 연결 + webLink 저장

### Epic C: 첨부 뷰어/딥링크
- C1. 로컬 뷰어 skeleton(PDF/이미지)
- C2. PDF page jump + quote/bbox 하이라이트
- C3. XLSX sheet/range jump(최소)
- C4. Deep Link 규격 적용 + 실패 폴백

### Epic D: document_intelligence
- D1. PDF 텍스트 추출 + page evidence
- D2. XLSX 추출(sheet/range evidence)
- D3. DOCX/PPTX 텍스트 추출(초기)
- D4. 캐시/재인덱싱

### Epic E: Agent 오케스트레이션
- E1. codex exec --json 실행 + MCP 연결
- E2. propose_todos_from_context → work_store 반영
- E3. Review-first 플로우(제안/승인/커밋)
- E4. agent_trace 기록 + 타임라인 UI

### Epic F: 검색/대시보드
- F1. FTS 인덱스 + 검색 API(메일/첨부/업무)
- F2. Search UI + 결과에서 근거로 이동
- F3. Dashboard KPI + 드릴다운

---

## 4) 수용기준(핵심 시나리오)
### 4.1 “엑셀+PDF 검토 요청”
- Graph sync로 메일/첨부를 가져와 로컬 저장
- 투두가 생성되고, 각 투두에 Evidence ≥ 1
- Evidence 클릭 시:
  - PDF: page jump
  - XLSX: sheet/range jump

### 4.2 “회신 후 리플라이”
- 동일 conversationId로 기존 업무에 연결
- 변경은 work_event/agent_trace에 기록
- 신규 요청은 신규 투두 또는 업데이트로 반영(중복 방지)

### 4.3 “1년 전 자료 찾기”
- contact+키워드로 검색 시 관련 메일/첨부/업무가 노출
- 검색 결과에서 근거 링크로 즉시 이동 가능

---

## 5) 리스크/대응(갱신)
- Graph 권한/테넌트 제한: 최소 스코프, 관리자 가이드, 권한 부족 UX
- 토큰 갱신 실패: 상태 표시 + 재로그인
- throttling: delta + 백오프 + 동기화 범위 제한
- Deep link 하이라이트 실패: quote 후보/해시 재시도 + 폴백/재인덱싱
