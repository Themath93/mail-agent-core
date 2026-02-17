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
- Entra App Registration의 `client_id`

설치 순서:

1. Chrome에서 `chrome://extensions`를 엽니다.
2. 우측 상단 "개발자 모드"를 켭니다.
3. "압축해제된 확장 프로그램 로드"로 `<repo>/extension` 디렉터리를 등록합니다.
4. 확장 카드에서 ID를 복사합니다.
5. 터미널에서 `<repo>/scripts/setup-macos.sh`를 실행하고 안내에 따라 확장 ID/client_id/tenant를 입력합니다.
6. Entra App Redirect URI에 `native-host/config.json`의 `redirect_uri`를 등록합니다.
7. Chrome 확장을 새로고침한 뒤 사이드패널에서 "로그인 시작"을 누릅니다.
8. 브라우저 로그인 완료 후 콜백을 자동 감지하면 로그인 완료가 자동 처리됩니다.
9. "로그인 상태 확인"으로 `signed_in=true`를 확인합니다.

## 4. 개발/검증 설치(현재 저장소 기준)

```bash
git clone https://github.com/Themath93/mail-agent-core.git
cd mail-agent-core
bun install
bun run ci
```

검증이 통과하면 코어 모듈 테스트/타입/커버리지 환경이 준비된 상태입니다.

## 5. 설치 후 기본 점검

- 사이드패널에서 `Auth status: signed_in=true email=<계정>` 표시 확인
- Native Host 등록 파일 확인: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.themath93.mail_agent_core.host.json`
- 설정 파일 확인: `native-host/config.json`의 `client_id`가 비어있지 않은지 확인
- 메일 기능 점검: `initial_sync` → `delta_sync` → `get_message/get_thread` 동작 확인

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

## 7. 로그인 완료가 실패할 때

- `Auth status error: 자동 완료 대기 중인 callback code가 없습니다.`
  - 로그인 창에서 인증을 완료했는지 확인하고 2~3초 기다린 뒤 상태를 다시 확인하세요.
- `Auth status error: state 값이 일치하지 않습니다.`
  - 기존 로그인 흐름을 중단하고 "로그인 시작"을 새로 실행하세요.
- `Auth status error: 토큰 교환 실패: ...`
  - Entra App의 Redirect URI와 `native-host/config.json`의 `redirect_uri`가 완전히 같은지 확인하세요.

## 8. 자주 발생하는 설치 이슈

- 확장 로드 실패
  - 확장 디렉터리 경로를 다시 선택하고, 권한 경고가 있으면 허용
- `Auth status error: Specified native messaging host not found`
  - 설치 스크립트를 다시 실행하고 확장 ID가 맞는지 확인
- `Auth status error: Native host has exited.`
  - 스크립트를 다시 실행해 launcher가 최신 Node 경로를 가리키는지 확인
- `AADSTS900144: ... client_id`
  - `native-host/config.json`의 `client_id` 값이 비어있는지 확인
- 동기화 실패
  - 로그인 상태가 `signed_in=true`인지 확인 후 `initial_sync`를 먼저 실행

## 9. 다음 문서

- 사용 방법: `docs/chrome-extension-user-guide.md`
