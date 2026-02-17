# Chrome Extension 설치 가이드 (초안)

이 문서는 Outlook 로컬 업무 자동화 앱 사용을 위한 설치 절차를 정리한 가이드입니다.

## 1. 범위

- 이 저장소(`mail-agent-core`)는 코어 로직/검증 중심입니다.
- Chrome Extension 로드용 최소 패키지는 `extension/` 경로에 포함되어 있습니다.

## 2. 사전 준비

- Chrome 최신 버전
- Microsoft 365/Outlook 계정
- macOS/Linux/Windows 중 하나의 로컬 실행 환경
- (개발/검증용) Bun 1.3+ 및 Git
- Node.js 20+

## 3. 운영 사용자 설치(현재 저장소 기준)

필수 준비물:

- 이 저장소 로컬 경로
- Chrome 확장 ID

설치 순서:

1. Chrome에서 `chrome://extensions`를 엽니다.
2. 우측 상단 "개발자 모드"를 켭니다.
3. "압축해제된 확장 프로그램 로드"로 `<repo>/extension` 디렉터리를 등록합니다.
4. 확장 카드에서 ID를 복사합니다.
5. 터미널에서 `<repo>/scripts/install-native-host-macos.sh <확장ID>`를 실행합니다.
6. Chrome 확장을 새로고침한 뒤 사이드패널에서 "로그인 상태 확인" 버튼을 누릅니다.

## 4. 개발/검증 설치(현재 저장소 기준)

```bash
git clone https://github.com/Themath93/mail-agent-core.git
cd mail-agent-core
bun install
bun run ci
```

검증이 통과하면 코어 모듈 테스트/타입/커버리지 환경이 준비된 상태입니다.

## 5. 설치 후 기본 점검

- 사이드패널에서 `Auth status: signed_in=false email=-` 표시 확인
- Native Host 등록 파일 확인: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.themath93.mail_agent_core.host.json`

## 6. 로그인 상태 시뮬레이션

`native-host/state.json` 값을 수정하면 로그인 상태 응답을 확인할 수 있습니다.

```json
{
  "signed_in": true,
  "account": {
    "email": "me@example.com",
    "tenant": "default"
  }
}
```

저장 후 확장 새로고침 뒤 "로그인 상태 확인"을 다시 실행합니다.

## 7. 자주 발생하는 설치 이슈

- 확장 로드 실패
  - 확장 디렉터리 경로를 다시 선택하고, 권한 경고가 있으면 허용
- `Auth status error: Specified native messaging host not found`
  - 설치 스크립트를 다시 실행하고 확장 ID가 맞는지 확인
- 동기화 실패
  - 현재 단계에서는 Native Messaging 연결 및 auth status 확인까지만 지원

## 8. 다음 문서

- 사용 방법: `docs/chrome-extension-user-guide.md`
