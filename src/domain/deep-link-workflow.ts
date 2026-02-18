import type {
	EmailDeepLinkFallbackReason,
	EmailDeepLinkInfo,
} from "./deep-link.js";
import {
	EMAIL_DEEP_LINK_FALLBACK_WEB_LINK,
	parseEmailDeepLink,
} from "./deep-link.js";

export type EmailDeepLinkRecoveryStep =
	| "refresh_message_link"
	| "reindex_message"
	| "retry_navigation";

export type EmailDeepLinkNavigationMode =
	| "normal"
	| "fallback_missing_email_web_link"
	| "fallback_invalid_email_web_link";

export interface EmailDeepLinkNavigationPlan {
	readonly mode: EmailDeepLinkNavigationMode;
	readonly deepLinkInfo: EmailDeepLinkInfo;
	readonly shouldRetry: boolean;
	readonly shouldReindex: boolean;
	readonly recoverySteps: readonly EmailDeepLinkRecoveryStep[];
	readonly guidance: string;
}

type FallbackRecoveryConfig = {
	readonly mode: EmailDeepLinkNavigationMode;
	readonly shouldReindex: boolean;
	readonly recoverySteps: readonly EmailDeepLinkRecoveryStep[];
	readonly guidance: string;
};

const FALLBACK_RECOVERY: Record<
	EmailDeepLinkFallbackReason,
	FallbackRecoveryConfig
> = {
	missing_email_web_link: {
		mode: "fallback_missing_email_web_link",
		shouldReindex: false,
		recoverySteps: ["refresh_message_link", "retry_navigation"],
		guidance:
			"메일 링크(webLink)가 비어 있어 기본 메일함으로 이동한 뒤 동기화 메타데이터를 갱신하세요.",
	},
	invalid_email_web_link: {
		mode: "fallback_invalid_email_web_link",
		shouldReindex: true,
		recoverySteps: ["reindex_message", "retry_navigation"],
		guidance:
			"메일 링크 형식이 유효하지 않아 재인덱싱 후 링크를 다시 생성해 재시도하세요.",
	},
};

const malformedLinkPlan: Omit<EmailDeepLinkNavigationPlan, "deepLinkInfo"> = {
	mode: "fallback_invalid_email_web_link",
	shouldRetry: true,
	shouldReindex: true,
	recoverySteps: ["reindex_message", "retry_navigation"],
	guidance:
		"이메일 딥링크 형식이 올바르지 않습니다. 메시지 링크를 재인덱싱한 뒤 재시도하세요.",
};

export const buildEmailDeepLinkNavigationPlan = (
	deepLink: string,
): EmailDeepLinkNavigationPlan => {
	let deepLinkInfo: EmailDeepLinkInfo;

	try {
		deepLinkInfo = parseEmailDeepLink(deepLink);
	} catch {
		return {
			...malformedLinkPlan,
			deepLinkInfo: {
				isFallback: true,
				fallbackReason: "invalid_email_web_link",
				quoteText: null,
				webLink: EMAIL_DEEP_LINK_FALLBACK_WEB_LINK,
			},
		};
	}

	if (!deepLinkInfo.isFallback || deepLinkInfo.fallbackReason === null) {
		return {
			mode: "normal",
			deepLinkInfo,
			shouldRetry: false,
			shouldReindex: false,
			recoverySteps: [],
			guidance: "메일 링크에서 인용문 하이라이트를 시도합니다.",
		};
	}

	const fallbackConfig = FALLBACK_RECOVERY[deepLinkInfo.fallbackReason];

	return {
		mode: fallbackConfig.mode,
		deepLinkInfo,
		shouldRetry: true,
		shouldReindex: fallbackConfig.shouldReindex,
		recoverySteps: fallbackConfig.recoverySteps,
		guidance: fallbackConfig.guidance,
	};
};
