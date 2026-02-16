# 기여 가이드

## 브랜치

- `main`은 운영 브랜치입니다.
- 기능은 반드시 `feat/`, `fix/`, `chore/` 접두사의 새 브랜치에서 개발합니다.
- PR은 항상 `main` 대상만 생성합니다.

## PR 규칙

- PR 제목 형식: `v<major>.<minor>.<patch> | <요약>`
  - 예: `v0.3.0 | Deep Link 폴백 복구 플로우 추가`
- 본문은 `.github/PULL_REQUEST_TEMPLATE.md`를 기준으로 작성합니다.
  - 본문은 `개요`, `검증`, `핵심 체크`, `위험/롤백` 항목을 모두 채웁니다.
- PR은 `.github/scripts/validate-pr-body.mjs` 규칙을 반드시 통과해야 합니다.
- 본문에는 변경 개요, 테스트/커버리지, 영향 범위, 롤백 포인트를 꼭 포함합니다.

## 커밋 규칙

- 한글 커밋 메시지를 사용합니다.
- 커밋 메시지 형식은 한 줄 요약 + `.github/commit_template.md` 본문 항목으로 작성합니다.
- 작은 단위 커밋을 선호하고, 되돌리기 쉬운 단위로 분리합니다.
- 형식 예시:
  - `feat: 메일 deep link 폴백 처리`
  - `fix: 문서 템플릿 체크 스크립트 강화`
  - `revert: 직전 deep link 회귀 수정`

### 커밋 템플릿 사용

- 로컬에서 아래 명령을 한 번만 실행하면 CI/리뷰용 메시지 규칙을 맞추기 쉬워집니다.
  - `.github/commit_template.md`

```bash
git config commit.template .github/commit_template.md
```

### 추가 예시

- `feat: 이메일 deep link 재인덱싱 플로우 추가`
- `fix: PR 체크리스트 검증 로직 개선`
