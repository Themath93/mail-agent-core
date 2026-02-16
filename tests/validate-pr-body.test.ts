import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";

type PrBodyValidatorResult = {
	status: number | null;
	stdout: string;
	stderr: string;
};

const runPrBodyValidator = (
	title: string,
	body: string,
): PrBodyValidatorResult => {
	const result = spawnSync(
		"bun",
		["run", ".github/scripts/validate-pr-body.mjs"],
		{
			encoding: "utf8",
			env: {
				...process.env,
				PR_TITLE: title,
				PR_BODY_JSON: body,
			},
		},
	);

	if (result.error) {
		throw result.error;
	}

	return {
		status: result.status,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
};

const validTemplateBodyWithSuffix =
	"## 개요 (2줄 이내)\n" +
	"- 변경 요약: 템플릿 검증 강화\n" +
	"- 변경 이유: PR 규칙 누락을 줄이기 위해\n" +
	"## 검증\n" +
	"- 버전: v0.3.2\n" +
	"- 테스트: bun run ci\n" +
	"- 커버리지: 97\n" +
	"- 실패 시 회귀 가능성: low\n" +
	"## 핵심 체크 (모두 체크)\n" +
	"- [x] `main` 병합 전용 작업인지 확인\n" +
	"- [x] 브랜치에서 시작해 PR로 `main` 대상인지 확인\n" +
	"- [x] 커밋 메시지(한글) 및 롤백 포인트 명시\n" +
	"## 위험/롤백\n" +
	"- 영향 범위: 제한적\n" +
	"- 롤백 전략: revert\n";

describe("PR 바디 검증 스크립트", () => {
	test("정상 본문은 통과한다", () => {
		const result = runPrBodyValidator(
			"v1.2.3 | 템플릿 검증 보강",
			JSON.stringify(validTemplateBodyWithSuffix),
		);

		expect(result.status).toBe(0);
		expect(result.stderr).toBe("");
	});

	test("잘못된 PR 제목은 실패를 반환한다", () => {
		const result = runPrBodyValidator(
			"bad title",
			JSON.stringify(validTemplateBodyWithSuffix),
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("PR 제목 형식을 다시 확인하세요");
	});

	test("헤더 뒤에 부연 문구가 붙은 템플릿도 인식한다", () => {
		const result = runPrBodyValidator(
			"v2.0.0 | 접미사 템플릿 허용",
			JSON.stringify(
				"## 개요 (2줄 이내)\n" +
					"- 변경 요약: 템플릿 가변 헤더\n" +
					"- 변경 이유: 실제 템플릿 형식 대응\n" +
					"## 검증 (실행 결과)\n" +
					"- 버전: v2.0.0\n" +
					"- 테스트: bun run ci\n" +
					"- 커버리지: 100\n" +
					"- 실패 시 회귀 가능성: low\n" +
					"## 핵심 체크 (모두 체크)\n" +
					"- [x] `main` 병합 전용 작업인지 확인\n" +
					"- [x] 브랜치에서 시작해 PR로 `main` 대상인지 확인\n" +
					"- [x] 커밋 메시지(한글) 및 롤백 포인트 명시\n" +
					"## 위험/롤백 (대응)\n" +
					"- 영향 범위: 제한적\n" +
					"- 롤백 전략: revert\n",
			),
		);

		expect(result.status).toBe(0);
		expect(result.stderr).toBe("");
	});

	test("JSON 문자열/헤더 누락/미체크 항목은 실패를 반환한다", () => {
		const body =
			"## 개요\n" +
			"- 변경 요약: 일부 누락 테스트\n" +
			"## 핵심 체크 (모두 체크)\n" +
			"- [x] `main` 병합 전용 작업인지 확인\n" +
			"- [ ] 브랜치에서 시작해 PR로 `main` 대상인지 확인\n" +
			"- [ ] 커밋 메시지(한글) 및 롤백 포인트 명시\n";

		const result = runPrBodyValidator(
			"v0.4.0 | 누락 시나리오",
			JSON.stringify(body),
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("필수 섹션 누락: ## 검증");
		expect(result.stderr).toContain("핵심 체크 누락");
	});

	test("본문이 null로 전달되면 실패한다", () => {
		const result = runPrBodyValidator("v0.4.0 | null 본문", "null");

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("PR 본문이 비어 있습니다.");
		expect(result.stderr).toContain("필수 섹션 누락: ## 개요");
	});
});
