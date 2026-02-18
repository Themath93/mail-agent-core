import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
	NON_TRANSLATABLE_CONTRACT_KEYS,
	TRANSLATABLE_UI_TEXT,
	isNonTranslatableContractToken,
} from "../src/domain/i18n-contract.js";

describe("i18n contract bootstrap", () => {
	test("로컬라이제이션 경계 기준 토큰이 유지된다", () => {
		const mcpSource = readFileSync("src/domain/mcp.ts", "utf8");

		expect(mcpSource).toContain("error_code");
		expect(mcpSource).toContain("mail_folder");
	});

	test("번역 허용/금지 경계 상수가 고정된다", () => {
		expect(TRANSLATABLE_UI_TEXT).toEqual([
			"heading",
			"button_label",
			"status_text",
			"error_message",
			"placeholder_text",
			"help_text",
			"option_label",
		]);

		expect(NON_TRANSLATABLE_CONTRACT_KEYS).toEqual([
			"action",
			"error_code",
			"manual",
			"review_first",
			"full_auto",
			"open",
			"in_progress",
			"done",
			"mail_folder",
			"message_pk",
		]);

		expect(isNonTranslatableContractToken("action")).toBe(true);
		expect(isNonTranslatableContractToken("error_code")).toBe(true);
		expect(isNonTranslatableContractToken("manual")).toBe(true);
		expect(isNonTranslatableContractToken("open")).toBe(true);
		expect(isNonTranslatableContractToken("mail_folder")).toBe(true);
		expect(isNonTranslatableContractToken("message_pk")).toBe(true);
		expect(isNonTranslatableContractToken("로그인")).toBe(false);

		for (const token of TRANSLATABLE_UI_TEXT) {
			expect(isNonTranslatableContractToken(token)).toBe(false);
		}
	});

	test("계약 경계 토큰은 계약 소스에 그대로 존재한다", () => {
		const mcpSource = readFileSync("src/domain/mcp.ts", "utf8");
		const sidepanelHtml = readFileSync("extension/sidepanel.html", "utf8");
		const sidepanelJs = readFileSync("extension/sidepanel.js", "utf8");

		expect(mcpSource).toContain("error_code");
		expect(mcpSource).toContain(
			'mode: "manual" | "review_first" | "full_auto"',
		);
		expect(mcpSource).toContain('status: "open" | "in_progress" | "done"');
		expect(mcpSource).toContain("mail_folder");
		expect(mcpSource).toContain("message_pk");

		expect(sidepanelHtml).toContain('<option value="manual">manual</option>');
		expect(sidepanelHtml).toContain(
			'<option value="review_first">review_first</option>',
		);
		expect(sidepanelHtml).toContain(
			'<option value="full_auto">full_auto</option>',
		);
		expect(sidepanelHtml).toContain('<option value="open">open</option>');
		expect(sidepanelHtml).toContain(
			'<option value="in_progress">in_progress</option>',
		);
		expect(sidepanelHtml).toContain('<option value="done">done</option>');
		expect(sidepanelHtml).toContain('placeholder="mail_folder"');
		expect(sidepanelHtml).toContain('placeholder="message_pk"');

		expect(sidepanelJs).toContain("{ action, ...payload }");
		expect(sidepanelJs).toContain("response.error_code");
		expect(sidepanelJs).toContain("mail_folder:");
		expect(sidepanelJs).toContain("message_pk:");
	});

	test("e2e 검증 부트스트랩 파일이 존재한다", () => {
		expect(existsSync("playwright.config.ts")).toBe(true);
		expect(existsSync("tests/e2e/smoke.e2e.ts")).toBe(true);
	});
});
