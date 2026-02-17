# Chrome Extension 사용자 설명서 (초안)

이 문서는 Outlook 로컬 업무 자동화 앱(Chrome Extension + Local Host)을 실제 사용자 관점에서 사용하는 방법을 정리한 안내서입니다.

## 1. 이 문서의 범위

- 대상: Outlook 메일을 동기화하고 근거(Evidence) 기반으로 업무를 관리하려는 사용자
- 범위: 로그인 자동완료, 동기화, 메일/첨부 조회, 기본 문제 해결
- 참고: 본 저장소는 `mail-agent-core` 중심이며, 실제 확장 UI/배포는 연동 환경에 따라 다를 수 있습니다.

## 2. 시작 전 준비

- Chrome 브라우저 최신 버전
- Microsoft 365/Outlook 계정
- 로컬 실행 환경(확장 앱 + Native Host) 설치 및 실행

## 3. 첫 사용 순서

1. 앱 실행 후 로그인 상태를 확인합니다.
2. 로그인 버튼을 눌러 Microsoft 계정 인증을 진행합니다.
3. 인증 완료 후 상태가 signed-in으로 바뀌는지 확인합니다.
4. 초기 동기화(initial sync)를 실행합니다.
   - 기본 권장: `mail_folder=inbox`, `days_back=30`
5. 동기화 완료 후 메일/첨부 목록과 근거 링크가 보이는지 확인합니다.

## 4. 주요 기능 사용법

## 4.1 로그인 및 상태 확인

- 로그인 시작 전에 `scripts/setup-macos.sh` 실행으로 `native-host/config.json`을 설정합니다.
- "로그인 시작" 버튼을 눌러 로그인 URL을 발급받고 브라우저에서 엽니다.
- 로그인 후 콜백 URL 수신 시 확장이 자동으로 "로그인 완료"를 수행합니다(최대 5분 대기).
- 자동 완료가 지연되면 `로그인 상태 확인`에서 `pending_callback_received` 힌트를 먼저 확인합니다.
- `pending_callback_received=true`면 callback URL 전체 또는 code만 입력 후 "로그인 완료"를 수동 실행할 수 있습니다.
- "로그인 상태 확인" 버튼으로 `signed_in`/`account`/`pending_callback_received` 상태를 확인합니다.

로그인 실패 또는 세션 만료 시 "로그인 시작"부터 다시 수행하세요.

## 4.2 메일 동기화

- 초기 동기화: `graph_mail_sync.initial_sync`
  - 최근 N일 기준으로 메일/첨부를 로컬에 반영
- 변경 동기화: `graph_mail_sync.delta_sync`
  - 신규/변경/삭제만 반영

일반적으로 첫 실행 시 초기 동기화를 1회 수행한 뒤, 이후에는 delta sync를 주기적으로 실행합니다.

- 사이드패널의 `자동 동기화 시작`으로 주기 실행(분 단위)을 켜고, 필요 시 `자동 동기화 중지`로 중단합니다.

## 4.3 목록 기반 조회

- 메시지 목록: `mail_store.list_messages`로 최근 메일 목록을 가져오고 선택합니다.
- 스레드 목록: `mail_store.list_threads`로 최근 스레드 목록을 가져오고 선택합니다.
- 목록에서 선택하면 `get_message`/`get_thread` 입력값이 자동 채워집니다.

## 4.4 첨부 다운로드

- 첨부 다운로드: `graph_mail_sync.download_attachment` (graph_message_id/graph_attachment_id/message_pk 필요)
- 첨부 목록 조회: `mail_store.list_attachments` (message_pk 기준)

권장 순서: 메시지 선택 -> `list_attachments` -> 첨부 선택 -> `download_attachment`.

첨부 파일은 로컬 경로에 저장되며, 동일 파일은 sha256 기준으로 중복 저장을 줄입니다.

## 4.5 메일 조회

- 단건 조회: `mail_store.get_message`
- 스레드 조회: `mail_store.get_thread`

업무 확인 시 스레드 조회를 우선 사용하면 문맥 파악이 빠릅니다.

## 4.6 운영/복구

- 상태/로그 확인: `system.health`
- 세션 초기화(인증만): `system.reset_session` (`clear_mailbox=false`)
- 세션 초기화(인증+메일 캐시): `system.reset_session` (`clear_mailbox=true`)

## 4.7 Evidence/Todo 최소 연계

- Evidence 생성: `workflow.create_evidence` (message_pk/snippet/confidence)
- Todo 생성/갱신: `workflow.upsert_todo` (title/status/evidence_id)
- 워크플로 목록 확인: `workflow.list`

## 5. 자주 발생하는 문제와 대응

- `E_AUTH_REQUIRED`
  - 원인: 로그인 정보 없음/만료
  - 조치: 로그인 재시도 후 상태 확인
- `E_AUTH_FAILED`
  - 원인: 인증 교환 실패
  - 조치: `state 값이 일치하지 않습니다`가 보이면 기존 세션을 버리고 "로그인 시작"부터 다시 진행
- `E_GRAPH_THROTTLED`
  - 원인: Graph API 호출 제한
  - 조치: 잠시 대기 후 재시도(짧은 간격 반복 호출 지양)
- `E_NOT_FOUND`
  - 원인(로그인): 자동완료 대기 중 callback 미수신
  - 조치(로그인): 2~3초 후 `로그인 상태 확인`으로 `pending_callback_received` 확인, 5분 초과 시 수동 완료로 전환
  - 원인(메일/첨부): 요청한 메시지/스레드/첨부 없음
  - 조치(메일/첨부): 먼저 동기화를 다시 실행하고 식별자를 확인
- `E_PARSE_FAILED`
  - 원인: 입력 형식 또는 데이터 파싱 실패
  - 조치: 입력값 형식 확인 후 재시도

## 6. 운영 권장사항

- 하루 시작 시 1회 초기 상태 확인 + delta sync 수행
- 대량 동기화 직후에는 첨부 분석/조회 작업을 분리해서 실행
- 인증 만료가 잦으면 로그아웃 후 로그인 시작을 다시 수행

## 7. 보안/데이터 안내

- 메일/첨부 데이터는 기본적으로 로컬 저장 원칙을 따릅니다.
- 계정/토큰 관련 정보는 로컬 환경에서만 사용되며, 외부 공유 전에 민감정보를 반드시 제거하세요.
