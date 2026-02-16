import { describe, expect, test } from "vitest";
import {
	buildAttachmentViewerUrl,
	buildEmailDeepLink,
	buildEmailDeepLinkNavigationPlan,
	buildEvidenceDeepLink,
	errorResponse,
	isOkResponse,
	okResponse,
	parseEmailDeepLink,
	parseEvidence,
} from "../src/index.js";

describe("public index exports", () => {
	test("MCP 헬퍼와 deep link 유틸이 재노출된다", () => {
		const success = okResponse({ status: "ok" });
		expect(success.ok).toBe(true);
		expect(isOkResponse(success)).toBe(true);

		const failure = errorResponse("E_VIEWER_UNAVAILABLE", "뷰어 오류", true);
		expect(failure.ok).toBe(false);
		expect(failure.retryable).toBe(true);

		const attachmentUrl = buildAttachmentViewerUrl({
			attachmentPk: "att_index",
			locator: { type: "pdf", page: 2 },
		});
		expect(attachmentUrl).toContain("/viewer/pdf/att_index");

		const emailUrl = buildEmailDeepLink(
			"https://outlook.office.com/mail",
			"index",
		);
		expect(emailUrl).toContain("mail_quote=index");

		const evidenceEmailUrl = buildEvidenceDeepLink({
			evidence: {
				evidence_id: "ev_index_2",
				source: { kind: "email", id: "email_index" },
				locator: { type: "outlook_quote", text_quote: "요약" },
				snippet: "요약 본문",
				confidence: 0.88,
				created_at: new Date().toISOString(),
			},
			emailWebLink: "https://outlook.office.com/mail/thread",
		});

		const evidenceQuote = new URL(evidenceEmailUrl).searchParams.get(
			"mail_quote",
		);
		expect(evidenceQuote).toBe("요약");

		const parsed = parseEmailDeepLink(evidenceEmailUrl);
		expect(parsed.isFallback).toBe(false);
		expect(parsed.fallbackReason).toBeNull();
		expect(parsed.quoteText).toBe("요약");
	});

	test("parse/복구 플랜이 index 에서 노출된다", () => {
		const evidenceEmailUrl = buildEmailDeepLink("mailbox", "요약", "fallback");
		const plan = buildEmailDeepLinkNavigationPlan(evidenceEmailUrl);

		expect(plan.mode).toBe("fallback_invalid_email_web_link");
		expect(plan.shouldRetry).toBe(true);
		expect(plan.shouldReindex).toBe(true);
		expect(plan.recoverySteps).toContain("reindex_message");
	});

	test("parseEvidence 가 index 를 통해 접근 가능하다", () => {
		const evidence = parseEvidence({
			evidence_id: "ev_index_1",
			source: {
				kind: "email",
				id: "email_1",
			},
			locator: {
				type: "outlook_quote",
				text_quote: "결재 진행",
			},
			snippet: "결재 진행을 위한 확인",
			confidence: 1,
			created_at: new Date().toISOString(),
		});

		expect(evidence.ok).toBe(true);
		if (!evidence.ok) {
			return;
		}

		expect(evidence.value.source.kind).toBe("email");
	});
});
