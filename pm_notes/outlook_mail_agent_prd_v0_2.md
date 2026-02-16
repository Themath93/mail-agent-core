# Outlook 메일 기반 로컬 업무 자동화 에이전트 (PRD) v0.2
- 작성일: 2026-02-16
- 범위: 개인(나 중심) / 로컬 전용(저장/처리) / **Chrome Extension + Native Host + Codex CLI Agent + MCP Skills**
- 핵심 키워드: **Outlook(Graph API) 이메일 + 첨부 분석 → 근거 기반 투두 생성/업데이트 → 진행/감사/검색 → (향후) 마인드맵**

---

## 변경 요약(v0.1 → v0.2)
- **Outlook 메일 수집 방식**을 **Outlook Web DOM 파싱(Content Script)**에서 **Microsoft Graph API 기반 동기화(OAuth2 PKCE + Delta Sync)**로 전환
- Content Script는 **수집(ingest)**이 아니라 **(1) 근거 하이라이트, (2) 현재 메일 컨텍스트 연결, (3) UX 보조** 역할로 축소

---

## 0. 한 줄 요약
Outlook 메일과 첨부(PDF·XLSX·PPTX·DOCX·이미지)를 **Microsoft Graph로 안정적으로 동기화**해 로컬에서 분석하고, **Evidence(근거) 포함 투두**를 자동 생성·갱신하며, 클릭 한 번으로 **근거 위치로 즉시 이동**할 수 있는 개인용 업무 자동화 시스템.

---

## 1. 배경과 문제 정의
### 1.1 현재 문제
- 메일 본문만으로는 업무 요구사항이 완결되지 않고, **첨부파일**에 핵심 정보가 포함되는 경우가 많음
- 과거 자료(1년 전 등)를 찾는 데 시간이 많이 들고 비용이 큼
- AI가 만든 투두의 신뢰성을 위해 **근거 기반 검증**이 필요

### 1.2 목표 사용자(1차)
- 개인 사용자(“나” 중심)로 Outlook에서 업무 요청/승인/자료 수신을 반복하는 사용자

### 1.3 핵심 성공 기준(Outcome)
- 자동 분석으로 정리 시간 단축
- **근거 링크(Deep Link)**로 검증 시간 단축
- 스레드 흐름에 따라 업무 상태 자동 최신화
- 과거 논점/증거를 빠르게 회수(검색/타임라인)

---

## 2. 제품 목표와 비목표
### 2.1 제품 목표(Goals)
1) Outlook 데이터를 **Graph API로 안정적으로 동기화**해 로컬 DB에 저장  
2) 첨부파일까지 포함해 요약/핵심사실/액션아이템을 추출  
3) 투두(업무)를 자동 생성/업데이트하고 진행 상태를 관리  
4) 모든 핵심 주장(요구사항/마감/금액 등)에 대해 **근거(Evidence)**를 저장  
5) 근거 클릭 시 **출처/위치로 즉시 이동(메일/첨부)**  
6) “나 중심” 관련자(상대방 등) 관계를 축적(향후 마인드맵 확장 대비)

### 2.2 비목표(Non-goals) — MVP에서는 하지 않음
- 팀 협업(공유/권한/멀티유저)
- 서버/클라우드 DB 저장(완전 로컬 저장 원칙)
- 이메일 자동 발송(초안 생성은 가능하더라도 발송은 사용자 승인)
- 마인드맵 UI(데이터 축적은 하되 UI는 후순위)

---

## 3. 핵심 사용자 여정(User Journey)
### 3.1 신규 메일 수신 → 투두 생성
1) Graph Delta Sync가 신규 메일/변경 사항을 로컬에 반영  
2) 첨부가 있으면 로컬에 저장(중복 제거)  
3) Agent(Codex CLI)가 메일+첨부 분석  
4) WorkItem 생성(또는 기존 WorkItem 업데이트)  
5) 투두 카드에 “근거 칩” 표시(PDF p.3, Excel B12:C20, Email 등)

### 3.2 스레드 후속 메일 도착 → 투두 업데이트
- 같은 conversationId(스레드)에 답장/추가자료가 오면
  - 기존 WorkItem에 링크
  - 상태/마감/요구사항 변경 시 업데이트 + 변경 이력 기록

### 3.3 근거 클릭 → 즉시 이동(Deep Link)
- 메일 근거: Graph의 webLink로 Outlook 메시지 오픈 + quote 기반 하이라이트 시도  
- 첨부 근거: 로컬 뷰어(127.0.0.1)에서 페이지/셀/슬라이드/문단/영역으로 점프 + 하이라이트  

---

## 4. 시스템 구성(아키텍처)
### 4.1 구성 요소
1) **Chrome Extension**
- Side Panel UI(대시보드/투두/검색/설정)
- Outlook 탭에서 근거 하이라이트(메일 본문 내 quote 탐색)
- Native Host 제어(동기화/분석/열기)

2) **Native Host(로컬 프로세스)**
- Graph OAuth2 PKCE 로그인 플로우(로컬 루프백) + 토큰 저장/갱신
- Graph Delta Sync(메일/폴더) + 첨부 다운로드(/$value)
- 로컬 DB(SQLite+FTS) 정본 + 파일 저장소
- 로컬 뷰어/로컬 API(FastAPI)
- MCP 서버(스킬) 제공 + Codex 오케스트레이션

3) **Codex CLI Agent**
- MCP 툴 호출 기반 “조회→판단→실행” 루프
- 이미지 입력(스캔 문서/이미지 근거) fallback 지원

### 4.2 저장소 원칙(정본 위치)
- **Native Host가 정본 DB(SQLite) 관리**(권장)
- Extension은 UI/캐시 역할

---

## 5. 데이터 모델(요약)
> 세부 스키마/인덱스는 Specs 문서 참고.

### 5.1 이메일(Outlook/Graph)
- email_thread: thread 단위(권장: Graph conversationId를 provider_thread_id로)
- email_message: message 단위(권장: Graph message id를 provider_message_id로)
- 메일 관계: internetMessageId / inReplyTo / references(가능 범위) + conversationId 기반

### 5.2 첨부
- email_attachment: 파일 메타 + 저장 경로(relative_path) + sha256 + (Graph attachment id)
- attachment_extraction: 텍스트/구조/표/렌더 결과 캐시

### 5.3 업무/근거/관계
- work_item / work_event / agent_trace
- evidence / work_evidence_link
- contact / work_contact

---

## 6. 기능 요구사항(Functional Requirements)

### 6.1 Outlook(메일) 수집 — Graph 기반
- FR-01: 사용자가 1회 로그인하면 Graph 접근 토큰을 획득/갱신할 수 있어야 함(OAuth2 PKCE)
- FR-02: 초기 동기화(예: 최근 N일 또는 선택 폴더) 지원
- FR-03: Delta Sync로 신규/변경/삭제를 로컬 DB에 반영
- FR-04: message 주요 필드 저장(id, conversationId, subject, from/to/cc, received/sent, body/preview, hasAttachments, isRead, webLink, internetMessageId 등)
- FR-05: 첨부 메타 동기화 + 원본 다운로드(/$value)로 로컬 저장

### 6.2 첨부 저장(로컬)
- FR-10: 첨부파일을 지정 루트 아래 저장
- FR-11: sha256 기반 중복 제거
- FR-12: DB에는 상대경로+메타만 저장(파일 바이트는 저장하지 않음)
- FR-13: 첨부 열기(OS 기본 앱) 지원(폴백)

### 6.3 문서 이해(Document Intelligence)
- FR-20: PDF/DOCX/XLSX/PPTX/이미지 텍스트/구조/표/셀 범위 추출
- FR-21: 추출 결과 캐시(sha256 기준)
- FR-22: 투두 후보(action candidates) 생성
- FR-23: 투두 후보는 반드시 **근거(Evidence)** 포함(페이지/셀/슬라이드/문단/bbox)

### 6.4 업무 자동 생성/업데이트
- FR-30: work_item 생성/업데이트/상태변경
- FR-31: 중복 방지(스레드(conversationId)+상대+유사 제목)
- FR-32: 사용자 수정 보호(user_override/field_lock)
- FR-33: 모든 변경은 work_event + agent_trace로 기록(actor=agent/user)

### 6.5 근거 링크(Deep Link)
- FR-40: 근거 클릭 → 소스(메일/첨부)로 이동
- FR-41: 첨부 근거는 “정확한 위치 점프 + 하이라이트”(로컬 뷰어)
- FR-42: 메일 근거는 Outlook webLink 오픈 + quote 하이라이트(가능 범위)
- FR-43: 근거 탐색 실패 시 폴백 + 재인덱싱

### 6.6 나 중심 관계(참조)
- FR-50: 메일 참여자를 contact로 생성/갱신(dedupe)
- FR-51: 업무에 상대방(counterparty) 등 role 연결
- FR-52: (선택) 그래프/마인드맵 확장 대비 관계 엣지 저장(데이터만)

---

## 7. UX 요구사항(개인용 MVP)
- Dashboard: 오늘 메일/오늘 투두/진행상태/주간 완료/주요 상대
- Todos: 리스트(근거 칩), 상세(근거/타임라인/링크)
- Search: 과거 메일/첨부/업무를 빠르게 검색 + 근거로 점프
- Settings: 로그인/동기화 범위/저장 루트/자동화 모드/재인덱싱

---

## 8. 비기능 요구사항(NFR)
- 로컬 저장/프라이버시 우선(분석 산출물/첨부는 로컬 보관)
- 신뢰: 근거 필수, 변경 이력/롤백 가능
- 안정성: Delta Sync 기반(풀 스캔 최소화)
- 보안: 토큰/파일 경로 보호, allowlist, localhost 뷰어 토큰

---

## 9. 리스크 및 대응(갱신)
- R-01 **권한/테넌트 정책**: 조직 정책으로 Graph 권한이 제한될 수 있음  
  → 대응: 최소 권한 스코프, 관리자 컨센트 가이드, “권한 부족” UX/가이드
- R-02 **토큰 만료/갱신 실패**  
  → 대응: MSAL/표준 PKCE 구현, 재로그인/상태 표시
- R-03 **Graph rate limit/throttling**  
  → 대응: Delta Sync, 백오프/재시도, 초기 동기화 범위 제한
- R-04 첨부 파싱 실패(스캔/표/차트)  
  → 대응: fallback(OCR/비전), 검토 필요 큐, 재인덱싱

---

## 10. MVP 범위(권장)
- Graph 로그인 + 초기 동기화 + Delta Sync
- 첨부 저장 + sha256 중복 제거 + 로컬 뷰어(PDF/이미지 우선)
- PDF/XLSX 중심 문서 추출 + 투두 생성(근거 필수)
- work_event + agent_trace 타임라인
- 검색(최소: 제목/상대/첨부 파일명/요약) + FTS는 가능하면 포함
