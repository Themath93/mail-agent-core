# Chrome Extension 설치 가이드 (초안)

이 문서는 Outlook 로컬 업무 자동화 앱 사용을 위한 설치 절차를 정리한 가이드입니다.

## 1. 범위

- 이 저장소(`mail-agent-core`)는 코어 로직/검증 중심입니다.
- 실제 Chrome Extension UI 번들 및 Native Host 배포 패키지는 운영 환경에 따라 별도 제공될 수 있습니다.

## 2. 사전 준비

- Chrome 최신 버전
- Microsoft 365/Outlook 계정
- macOS/Linux/Windows 중 하나의 로컬 실행 환경
- (개발/검증용) Bun 1.3+ 및 Git

## 3. 운영 사용자 설치(배포 패키지 기준)

배포 담당자에게 아래 2개를 먼저 받습니다.

- Chrome Extension 패키지(또는 압축 해제된 디렉터리)
- Native Host 실행 패키지

설치 순서:

1. Native Host를 먼저 설치/실행합니다.
2. Chrome에서 `chrome://extensions`를 엽니다.
3. 우측 상단 "개발자 모드"를 켭니다.
4. "압축해제된 확장 프로그램 로드"로 Extension 디렉터리를 등록합니다.
5. 확장 앱을 열고 로그인 상태/호스트 연결 상태를 확인합니다.
6. 초기 동기화(initial sync)를 1회 실행합니다.

## 4. 개발/검증 설치(현재 저장소 기준)

```bash
git clone https://github.com/Themath93/mail-agent-core.git
cd mail-agent-core
bun install
bun run ci
```

검증이 통과하면 코어 모듈 테스트/타입/커버리지 환경이 준비된 상태입니다.

## 5. 설치 후 기본 점검

- 로그인 상태 확인(`auth_store.auth_status`)
- 초기 동기화 실행(`graph_mail_sync.initial_sync`)
- 변경 동기화 실행(`graph_mail_sync.delta_sync`)
- 메일 조회 확인(`mail_store.get_message`, `mail_store.get_thread`)

## 6. 자주 발생하는 설치 이슈

- 확장 로드 실패
  - 확장 디렉터리 경로를 다시 선택하고, 권한 경고가 있으면 허용
- 로그인 진행 불가
  - 계정/브라우저 세션 확인 후 재로그인
- 동기화 실패
  - 로그인 상태 재확인, 잠시 후 재시도

## 7. 다음 문서

- 사용 방법: `docs/chrome-extension-user-guide.md`
