import { describe, expect, test } from "vitest";
import { buildEmailDeepLinkNavigationPlan } from "../src/domain/deep-link-workflow.js";
import {
	buildAttachmentViewerUrl,
	buildEmailDeepLink,
	buildEvidenceDeepLink,
	parseEmailDeepLink,
} from "../src/domain/deep-link.js";
import type { Evidence } from "../src/domain/evidence.js";

describe("Deep Link 생성", () => {
	test("Evidence 의 attachment source 를 뷰어 링크로 변환한다", () => {
		const evidence: Evidence = {
			evidence_id: "ev_001",
			source: {
				kind: "attachment",
				id: "att_from_evidence",
			},
			locator: {
				type: "pdf",
				page: 5,
				text_quote: "테스트 인용",
			},
			snippet: "샘플 텍스트",
			confidence: 0.84,
			created_at: new Date("2026-01-01T00:00:00Z").toISOString(),
		};

		const url = buildEvidenceDeepLink({
			evidence,
			port: 1880,
			token: "token_3",
		});

		const parsed = new URL(url);

		expect(parsed.pathname).toBe("/viewer/pdf/att_from_evidence");
		expect(parsed.port).toBe("1880");
		expect(parsed.searchParams.get("page")).toBe("5");
		expect(parsed.searchParams.get("hl")).toBe("테스트 인용");
		expect(parsed.searchParams.get("t")).toBe("token_3");
	});

	test("Evidence 의 email source 를 web 링크로 변환한다", () => {
		const evidence: Evidence = {
			evidence_id: "ev_002",
			source: {
				kind: "email",
				id: "msg_001",
			},
			locator: {
				type: "outlook_quote",
				text_quote: "안건 확인",
			},
			snippet: "요청 내용",
			confidence: 1,
			created_at: new Date("2026-01-02T00:00:00Z").toISOString(),
		};

		const url = buildEvidenceDeepLink({
			evidence,
			emailWebLink: "https://outlook.office.com/mail/read",
		});

		const parsed = new URL(url);

		expect(parsed.origin).toBe("https://outlook.office.com");
		expect(parsed.searchParams.get("mail_quote")).toBe("안건 확인");
	});

	test("Evidence 로 email 변환 시 emailWebLink 가 없으면 폴백 링크를 생성한다", () => {
		const evidence: Evidence = {
			evidence_id: "ev_003",
			source: {
				kind: "email",
				id: "msg_002",
			},
			locator: {
				type: "outlook_quote",
			},
			snippet: "요청",
			confidence: 0.91,
			created_at: new Date("2026-01-03T00:00:00Z").toISOString(),
		};

		const url = buildEvidenceDeepLink({
			evidence,
		});
		const parsed = new URL(url);

		expect(parsed.host).toBe("outlook.office.com");
		expect(parsed.pathname).toBe("/mail");
		expect(parsed.searchParams.get("mail_fallback")).toBe(
			"missing_email_web_link",
		);
		expect(parsed.searchParams.get("mail_quote")).toBeNull();
	});

	test("Evidence 의 email source 는 잘못된 webLink 에서도 폴백 링크를 생성한다", () => {
		const evidence: Evidence = {
			evidence_id: "ev_004",
			source: {
				kind: "email",
				id: "msg_003",
			},
			locator: {
				type: "outlook_quote",
				text_quote: "fallback",
			},
			snippet: "폴백 샘플",
			confidence: 0.99,
			created_at: new Date("2026-01-04T00:00:00Z").toISOString(),
		};

		const url = buildEvidenceDeepLink({
			evidence,
			emailWebLink: "mailbox",
		});
		const parsed = new URL(url);

		expect(parsed.host).toBe("outlook.office.com");
		expect(parsed.pathname).toBe("/mail");
		expect(parsed.searchParams.get("mail_fallback")).toBe(
			"invalid_email_web_link",
		);
		expect(parsed.searchParams.get("mail_quote")).toBe("fallback");
	});

	test("buildEmailDeepLink 는 fallback 모드에서 비정상 URL 을 폴백한다", () => {
		const url = buildEmailDeepLink("mailbox", "fallback", "fallback");
		const parsed = new URL(url);

		expect(parsed.pathname).toBe("/mail");
		expect(parsed.searchParams.get("mail_fallback")).toBe(
			"invalid_email_web_link",
		);
		expect(parsed.searchParams.get("mail_quote")).toBe("fallback");
	});

	test("parseEmailDeepLink 는 fallback 정보를 해석한다", () => {
		const fallbackUrl = buildEmailDeepLink("mailbox", "안건", "fallback");
		const parsed = parseEmailDeepLink(fallbackUrl);

		expect(parsed.isFallback).toBe(true);
		expect(parsed.fallbackReason).toBe("invalid_email_web_link");
		expect(parsed.quoteText).toBe("안건");
		expect(parsed.webLink).toBe("https://outlook.office.com/mail");
	});

	test("parseEmailDeepLink 는 실패 폴백이 없으면 직접 링크를 반환한다", () => {
		const directUrl = buildEmailDeepLink(
			"https://outlook.office.com/mail/read",
			"요약",
		);
		const parsed = parseEmailDeepLink(directUrl);

		expect(parsed.isFallback).toBe(false);
		expect(parsed.fallbackReason).toBeNull();
		expect(parsed.quoteText).toBe("요약");
		expect(parsed.webLink).toBe("https://outlook.office.com/mail/read");
	});

	test("parseEmailDeepLink 는 잘못된 URL 을 예외로 처리한다", () => {
		expect(() => parseEmailDeepLink("not-a-url")).toThrow();
	});

	test("buildEmailDeepLinkNavigationPlan 는 정상 링크에서 재시도 플로우를 비활성화한다", () => {
		const directLink = buildEmailDeepLink(
			"https://outlook.office.com/mail/read",
			"요약",
		);

		const plan = buildEmailDeepLinkNavigationPlan(directLink);

		expect(plan.mode).toBe("normal");
		expect(plan.shouldRetry).toBe(false);
		expect(plan.shouldReindex).toBe(false);
		expect(plan.recoverySteps).toHaveLength(0);
		expect(plan.deepLinkInfo.isFallback).toBe(false);
	});

	test("buildEmailDeepLinkNavigationPlan 는 webLink 누락 시 재시도 플로우를 제공한다", () => {
		const fallbackLink = buildEmailDeepLink("", "요약", "fallback");
		const plan = buildEmailDeepLinkNavigationPlan(fallbackLink);

		expect(plan.mode).toBe("fallback_missing_email_web_link");
		expect(plan.shouldRetry).toBe(true);
		expect(plan.shouldReindex).toBe(false);
		expect(plan.recoverySteps).toEqual([
			"refresh_message_link",
			"retry_navigation",
		]);
		expect(plan.guidance).toContain("메일 링크(webLink)");
	});

	test("buildEmailDeepLinkNavigationPlan 는 잘못된 webLink 에서 재인덱싱 플로우를 제공한다", () => {
		const fallbackLink = buildEmailDeepLink("mailbox", "요약", "fallback");
		const plan = buildEmailDeepLinkNavigationPlan(fallbackLink);

		expect(plan.mode).toBe("fallback_invalid_email_web_link");
		expect(plan.shouldRetry).toBe(true);
		expect(plan.shouldReindex).toBe(true);
		expect(plan.recoverySteps).toEqual(["reindex_message", "retry_navigation"]);
		expect(plan.guidance).toContain("재인덱싱");
	});

	test("buildEmailDeepLinkNavigationPlan 는 파싱 불가한 링크에서도 복구 플로우를 제공한다", () => {
		const plan = buildEmailDeepLinkNavigationPlan(":::not-a-url:::");

		expect(plan.mode).toBe("fallback_invalid_email_web_link");
		expect(plan.shouldRetry).toBe(true);
		expect(plan.shouldReindex).toBe(true);
		expect(plan.recoverySteps).toEqual(["reindex_message", "retry_navigation"]);
		expect(plan.deepLinkInfo.isFallback).toBe(true);
		expect(plan.deepLinkInfo.fallbackReason).toBe("invalid_email_web_link");
		expect(plan.deepLinkInfo.webLink).toBe("https://outlook.office.com/mail");
		expect(plan.guidance).toContain("올바르지 않습니다");
	});

	test("첨부 뷰어 URL을 생성한다", () => {
		const url = buildAttachmentViewerUrl({
			attachmentPk: "att_321",
			locator: {
				type: "pdf",
				page: 3,
				text_quote: "총괄 비용",
			},
			token: "token_1",
			port: 1387,
		});

		const parsed = new URL(url);

		expect(parsed.pathname).toBe("/viewer/pdf/att_321");
		expect(parsed.searchParams.get("page")).toBe("3");
		expect(parsed.searchParams.get("hl")).toBe("총괄 비용");
		expect(parsed.searchParams.get("t")).toBe("token_1");
	});

	test("이미지 뷰어 URL의 bbox가 정렬되어 전달된다", () => {
		const url = buildAttachmentViewerUrl({
			attachmentPk: "att_img",
			locator: {
				type: "image",
				bbox: [0.1, 0.2, 0.3, 0.4],
			},
			token: "token_2",
		});

		expect(url).toContain("bbox=0.1%2C0.2%2C0.3%2C0.4");
	});

	test("기본 포트와 빈 쿼리는 query string 없이 생성된다", () => {
		const url = buildAttachmentViewerUrl({
			attachmentPk: "att_default",
			locator: {
				type: "image",
				bbox: [0.01, 0.02, 0.03, 0.04],
			},
		});

		expect(url).toBe(
			"http://127.0.0.1:1270/viewer/image/att_default?bbox=0.01%2C0.02%2C0.03%2C0.04",
		);
	});

	test("옵션이 없으면 query string 이 붙지 않는다", () => {
		const url = buildAttachmentViewerUrl({
			attachmentPk: "att_empty_query",
			locator: {
				type: "outlook_quote",
			},
		});

		expect(url).toBe(
			"http://127.0.0.1:1270/viewer/outlook_quote/att_empty_query",
		);
	});

	test("슬라이드/범위/문단 위치도 쿼리로 생성된다", () => {
		const url = buildAttachmentViewerUrl({
			attachmentPk: "att_detail",
			locator: {
				type: "xlsx",
				sheet: "Summary",
				range: "A1:B5",
				page: 2,
				slide: 5,
				paragraph_index: 12,
				text_quote: "테스트",
			},
		});

		const parsed = new URL(url);
		expect(parsed.searchParams.get("page")).toBe("2");
		expect(parsed.searchParams.get("slide")).toBe("5");
		expect(parsed.searchParams.get("sheet")).toBe("Summary");
		expect(parsed.searchParams.get("range")).toBe("A1:B5");
		expect(parsed.searchParams.get("p")).toBe("12");
		expect(parsed.searchParams.get("hl")).toBe("테스트");
	});

	test("빈 문자열 토큰은 제외되고 필수 값만 반영된다", () => {
		const url = buildAttachmentViewerUrl({
			attachmentPk: "att_empty",
			locator: {
				type: "pdf",
				page: 1,
			},
			token: "",
		});

		expect(url).toContain("page=1");
		expect(url).not.toContain("t=");
	});

	test("quoteText 가 빈 값이면 원본 링크를 반환한다", () => {
		const webLink = "https://outlook.office.com/mail/inbox";

		const url = buildEmailDeepLink(webLink, "");

		expect(url).toBe(webLink);
	});

	test("빈 webLink 는 예외를 던진다", () => {
		expect(() => buildEmailDeepLink("", "요청")).toThrow(
			"메일 링크(webLink)는 빈 값일 수 없습니다.",
		);
	});

	test("메일 webLink에 quote가 있으면 쿼리가 추가된다", () => {
		const url = buildEmailDeepLink(
			"https://outlook.office.com/mail",
			"요구사항 합의",
		);
		const parsed = new URL(url);

		expect(parsed.searchParams.get("mail_quote")).toBe("요구사항 합의");
	});

	test("잘못된 webLink는 예외를 던진다", () => {
		expect(() => buildEmailDeepLink("mailbox")).toThrow(
			"메일 링크(webLink)는 절대 URL이어야 합니다.",
		);
	});
});
