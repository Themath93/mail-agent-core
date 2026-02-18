import type { EvidenceLocator } from "./evidence.js";
import type { Evidence } from "./evidence.js";

export interface AttachmentViewerInput {
	attachmentPk: string;
	locator: EvidenceLocator;
	port?: number;
	token?: string;
}

type EmailDeepLinkMode = "throw" | "fallback";

export type EmailDeepLinkFallbackReason =
	| "missing_email_web_link"
	| "invalid_email_web_link";

export interface EmailDeepLinkInfo {
	readonly isFallback: boolean;
	readonly fallbackReason: EmailDeepLinkFallbackReason | null;
	readonly quoteText: string | null;
	readonly webLink: string;
}

export const EMAIL_DEEP_LINK_FALLBACK_WEB_LINK =
	"https://outlook.office.com/mail";

const buildEmailFallbackLink = (
	quoteText: string | undefined,
	reason: "missing_email_web_link" | "invalid_email_web_link",
): string => {
	const fallback = new URL(EMAIL_DEEP_LINK_FALLBACK_WEB_LINK);
	fallback.searchParams.set("mail_fallback", reason);

	if (quoteText !== undefined && quoteText.length > 0) {
		fallback.searchParams.set("mail_quote", quoteText);
	}

	return fallback.toString();
};

const normalizeEmailFallbackReason = (
	value: string | null,
): EmailDeepLinkFallbackReason | null => {
	if (
		value === "missing_email_web_link" ||
		value === "invalid_email_web_link"
	) {
		return value;
	}

	return null;
};

const toQueryParams = (
	entries: ReadonlyArray<[string, string | undefined]>,
): string => {
	const searchParams = new URLSearchParams();

	for (const [key, value] of entries) {
		if (value !== undefined && value.length > 0) {
			searchParams.set(key, value);
		}
	}

	return searchParams.toString();
};

const normalizeBbox = (bbox: readonly number[]): string =>
	bbox.map((value) => value.toString()).join(",");

export const buildAttachmentViewerUrl = ({
	attachmentPk,
	locator,
	port = 1270,
	token,
}: AttachmentViewerInput): string => {
	const base = `http://127.0.0.1:${port}/viewer/${locator.type}/${attachmentPk}`;
	const query = toQueryParams([
		["t", token],
		["page", locator.page?.toString()],
		["slide", locator.slide?.toString()],
		["sheet", locator.sheet],
		["range", locator.range],
		["p", locator.paragraph_index?.toString()],
		["hl", locator.text_quote],
		["bbox", locator.bbox ? normalizeBbox(locator.bbox) : undefined],
	]);

	return query.length > 0 ? `${base}?${query}` : base;
};

export const parseEmailDeepLink = (deepLink: string): EmailDeepLinkInfo => {
	const parsed = new URL(deepLink);
	const fallbackReason = normalizeEmailFallbackReason(
		parsed.searchParams.get("mail_fallback"),
	);

	return {
		isFallback: fallbackReason !== null,
		fallbackReason,
		quoteText: parsed.searchParams.get("mail_quote"),
		webLink: parsed.origin + parsed.pathname,
	};
};

export const buildEmailDeepLink = (
	webLink: string,
	quoteText?: string,
	mode: EmailDeepLinkMode = "throw",
): string => {
	const normalizedWebLink = webLink.trim();

	if (normalizedWebLink.length === 0) {
		if (mode === "fallback") {
			return buildEmailFallbackLink(quoteText, "missing_email_web_link");
		}

		throw new Error("메일 링크(webLink)는 빈 값일 수 없습니다.");
	}

	if (
		!normalizedWebLink.startsWith("http://") &&
		!normalizedWebLink.startsWith("https://")
	) {
		if (mode === "fallback") {
			return buildEmailFallbackLink(quoteText, "invalid_email_web_link");
		}

		throw new Error("메일 링크(webLink)는 절대 URL이어야 합니다.");
	}

	if (quoteText === undefined || quoteText.length === 0) {
		return normalizedWebLink;
	}

	const base = new URL(normalizedWebLink);
	base.searchParams.set("mail_quote", quoteText);
	return base.toString();
};

export interface EvidenceDeepLinkInput {
	readonly evidence: Evidence;
	readonly emailWebLink?: string;
	readonly port?: number;
	readonly token?: string;
}

export const buildEvidenceDeepLink = ({
	evidence,
	emailWebLink,
	port,
	token,
}: EvidenceDeepLinkInput): string => {
	if (evidence.source.kind === "email") {
		return buildEmailDeepLink(
			emailWebLink ?? "",
			evidence.locator.text_quote,
			"fallback",
		);
	}

	return buildAttachmentViewerUrl({
		attachmentPk: evidence.source.id,
		locator: evidence.locator,
		port,
		token,
	});
};
