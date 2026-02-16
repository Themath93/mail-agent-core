const ALLOWED_EVIDENCE_SOURCE_KINDS = ["email", "attachment"] as const;
const ALLOWED_LOCATOR_TYPES = [
	"outlook_quote",
	"pdf",
	"pptx",
	"docx",
	"xlsx",
	"image",
] as const;

export type EvidenceSourceKind = (typeof ALLOWED_EVIDENCE_SOURCE_KINDS)[number];
export type EvidenceLocatorType = (typeof ALLOWED_LOCATOR_TYPES)[number];

export interface EvidenceSource {
	kind: EvidenceSourceKind;
	id: string;
	thread_pk?: string;
}

export interface EvidenceLocator {
	type: EvidenceLocatorType;
	page?: number;
	slide?: number;
	sheet?: string;
	range?: string;
	paragraph_index?: number;
	bbox?: [number, number, number, number];
	text_quote?: string;
	text_hash?: string;
	anchor?: string;
}

export interface Evidence {
	evidence_id: string;
	source: EvidenceSource;
	locator: EvidenceLocator;
	snippet: string;
	confidence: number;
	created_at: string;
	debug?: Record<string, unknown>;
}

export interface EvidenceValidationError {
	path: string;
	message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isNonEmptyString = (value: unknown): value is string =>
	isString(value) && value.trim().length > 0;

const isNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

const isConfidence = (value: unknown): value is number =>
	isNumber(value) && value >= 0 && value <= 1;

const isIsoDateTime = (value: unknown): value is string => {
	if (!isString(value)) {
		return false;
	}

	const parsed = Date.parse(value);

	return Number.isFinite(parsed);
};

const isPositiveInteger = (value: unknown): value is number =>
	isNumber(value) && Number.isInteger(value) && value >= 1;

const isNonNegativeInteger = (value: unknown): value is number =>
	isNumber(value) && Number.isInteger(value) && value >= 0;

const isEvidenceSourceKind = (value: unknown): value is EvidenceSourceKind =>
	isString(value) && (value === "email" || value === "attachment");

const isEvidenceLocatorType = (value: unknown): value is EvidenceLocatorType =>
	isString(value) &&
	(value === "outlook_quote" ||
		value === "pdf" ||
		value === "pptx" ||
		value === "docx" ||
		value === "xlsx" ||
		value === "image");

const isAttachmentType = (
	value: string,
): value is Extract<
	EvidenceLocatorType,
	"pdf" | "pptx" | "docx" | "xlsx" | "image"
> => {
	return (
		value === "pdf" ||
		value === "pptx" ||
		value === "docx" ||
		value === "xlsx" ||
		value === "image"
	);
};

const hasUnknownKeys = (
	value: Record<string, unknown>,
	allowed: readonly string[],
) => Object.keys(value).some((key) => !allowed.includes(key));

const validateSource = (source: unknown): EvidenceValidationError[] => {
	if (!isRecord(source)) {
		return [{ path: "source", message: "source 는 객체여야 합니다." }];
	}

	const errors: EvidenceValidationError[] = [];
	const kind = source.kind;
	const id = source.id;

	if (!isEvidenceSourceKind(kind)) {
		errors.push({
			path: "source.kind",
			message: `source.kind 는 ${ALLOWED_EVIDENCE_SOURCE_KINDS.join(" 또는 ")} 중 하나여야 합니다.`,
		});
	}

	if (!isNonEmptyString(id)) {
		errors.push({
			path: "source.id",
			message: "source.id 는 빈 값일 수 없습니다.",
		});
	}

	if (
		"thread_pk" in source &&
		source.thread_pk !== undefined &&
		!isString(source.thread_pk)
	) {
		errors.push({
			path: "source.thread_pk",
			message: "source.thread_pk 는 문자열이어야 합니다.",
		});
	}

	if (hasUnknownKeys(source, ["kind", "id", "thread_pk"])) {
		errors.push({
			path: "source",
			message: "source 에 알 수 없는 키가 존재합니다.",
		});
	}

	return errors;
};

const validateLocator = (locator: unknown): EvidenceValidationError[] => {
	if (!isRecord(locator)) {
		return [{ path: "locator", message: "locator 는 객체여야 합니다." }];
	}

	const errors: EvidenceValidationError[] = [];
	const type = locator.type;

	if (!isEvidenceLocatorType(type)) {
		errors.push({
			path: "locator.type",
			message: `locator.type 은 ${ALLOWED_LOCATOR_TYPES.join(", ")} 중 하나여야 합니다.`,
		});
	}

	if (
		hasUnknownKeys(locator, [
			"type",
			"page",
			"slide",
			"sheet",
			"range",
			"paragraph_index",
			"bbox",
			"text_quote",
			"text_hash",
			"anchor",
		])
	) {
		errors.push({
			path: "locator",
			message: "locator 에 알 수 없는 키가 존재합니다.",
		});
	}

	if (
		"page" in locator &&
		locator.page !== undefined &&
		!isPositiveInteger(locator.page)
	) {
		errors.push({
			path: "locator.page",
			message: "locator.page 는 1 이상의 정수여야 합니다.",
		});
	}

	if (
		"slide" in locator &&
		locator.slide !== undefined &&
		!isPositiveInteger(locator.slide)
	) {
		errors.push({
			path: "locator.slide",
			message: "locator.slide 는 1 이상의 정수여야 합니다.",
		});
	}

	if (
		"paragraph_index" in locator &&
		locator.paragraph_index !== undefined &&
		!isNumber(locator.paragraph_index)
	) {
		errors.push({
			path: "locator.paragraph_index",
			message: "locator.paragraph_index 는 숫자여야 합니다.",
		});
	}

	if (
		"text_quote" in locator &&
		locator.text_quote !== undefined &&
		!isString(locator.text_quote)
	) {
		errors.push({
			path: "locator.text_quote",
			message: "locator.text_quote 는 문자열이어야 합니다.",
		});
	}

	if (
		"text_hash" in locator &&
		locator.text_hash !== undefined &&
		!isString(locator.text_hash)
	) {
		errors.push({
			path: "locator.text_hash",
			message: "locator.text_hash 는 문자열이어야 합니다.",
		});
	}

	if (
		"anchor" in locator &&
		locator.anchor !== undefined &&
		!isString(locator.anchor)
	) {
		errors.push({
			path: "locator.anchor",
			message: "locator.anchor 는 문자열이어야 합니다.",
		});
	}

	if (
		"sheet" in locator &&
		locator.sheet !== undefined &&
		!isString(locator.sheet)
	) {
		errors.push({
			path: "locator.sheet",
			message: "locator.sheet 는 문자열이어야 합니다.",
		});
	}

	if (
		"range" in locator &&
		locator.range !== undefined &&
		!isString(locator.range)
	) {
		errors.push({
			path: "locator.range",
			message: "locator.range 는 문자열이어야 합니다.",
		});
	}

	if ("bbox" in locator && locator.bbox !== undefined) {
		const bbox = locator.bbox;
		if (
			!Array.isArray(bbox) ||
			bbox.length !== 4 ||
			bbox.some((value) => !isNumber(value) || value < 0 || value > 1)
		) {
			errors.push({
				path: "locator.bbox",
				message: "locator.bbox 는 길이 4인 [0~1] 숫자 배열이어야 합니다.",
			});
		}
	}

	if (
		isEvidenceLocatorType(type) &&
		type === "outlook_quote" &&
		!isNonEmptyString(locator.text_quote)
	) {
		errors.push({
			path: "locator.text_quote",
			message: "outlook_quote 타입은 text_quote 가 권장됩니다.",
		});
	}

	if (!isEvidenceLocatorType(type)) {
		return errors;
	}

	if (isAttachmentType(type)) {
		if (type === "pdf" && !isPositiveInteger(locator.page)) {
			errors.push({
				path: "locator.page",
				message: "pdf 타입은 page 값이 필요합니다.",
			});
		}

		if (type === "xlsx") {
			if (!isString(locator.sheet) || locator.sheet.trim().length === 0) {
				errors.push({
					path: "locator.sheet",
					message: "xlsx 타입은 sheet 값이 필요합니다.",
				});
			}
			if (!isString(locator.range) || locator.range.trim().length === 0) {
				errors.push({
					path: "locator.range",
					message: "xlsx 타입은 range 값이 필요합니다.",
				});
			}
		}

		if (type === "pptx" && !isPositiveInteger(locator.slide)) {
			errors.push({
				path: "locator.slide",
				message: "pptx 타입은 slide 값이 필요합니다.",
			});
		}

		if (type === "docx" && !isNonNegativeInteger(locator.paragraph_index)) {
			errors.push({
				path: "locator.paragraph_index",
				message: "docx 타입은 paragraph_index 값이 필요합니다.",
			});
		}

		if (
			type === "image" &&
			(!Array.isArray(locator.bbox) || locator.bbox.length !== 4)
		) {
			errors.push({
				path: "locator.bbox",
				message: "image 타입은 bbox 값이 필요합니다.",
			});
		}
	}

	return errors;
};

export const parseEvidence = (
	raw: unknown,
):
	| {
			ok: true;
			value: Evidence;
	  }
	| {
			ok: false;
			errors: EvidenceValidationError[];
	  } => {
	if (!isRecord(raw)) {
		return {
			ok: false,
			errors: [{ path: "root", message: "Evidence 값은 객체여야 합니다." }],
		};
	}

	const errors: EvidenceValidationError[] = [];
	const hasEvidenceId = "evidence_id" in raw;
	const hasSource = "source" in raw;
	const hasLocator = "locator" in raw;
	const hasSnippet = "snippet" in raw;
	const hasConfidence = "confidence" in raw;
	const hasCreatedAt = "created_at" in raw;

	if (hasEvidenceId && !isNonEmptyString(raw.evidence_id)) {
		errors.push({
			path: "evidence_id",
			message: "evidence_id 는 빈 값일 수 없습니다.",
		});
	}

	if (!hasEvidenceId) {
		errors.push({ path: "evidence_id", message: "evidence_id 는 필수입니다." });
	}

	if (!hasSource) {
		errors.push({ path: "source", message: "source 는 필수입니다." });
	}

	if (!hasLocator) {
		errors.push({ path: "locator", message: "locator 는 필수입니다." });
	}

	if (!hasSnippet) {
		errors.push({ path: "snippet", message: "snippet 는 필수입니다." });
	}

	if (!hasConfidence) {
		errors.push({ path: "confidence", message: "confidence 는 필수입니다." });
	}

	if (!hasCreatedAt) {
		errors.push({ path: "created_at", message: "created_at 는 필수입니다." });
	}

	errors.push(...validateSource(raw.source));
	errors.push(...validateLocator(raw.locator));

	if (hasSnippet && !(isString(raw.snippet) && raw.snippet.trim().length > 0)) {
		errors.push({
			path: "snippet",
			message: "snippet 는 빈 값일 수 없습니다.",
		});
	}

	if (hasConfidence && !isConfidence(raw.confidence)) {
		errors.push({
			path: "confidence",
			message: "confidence 는 0에서 1 사이의 숫자여야 합니다.",
		});
	}

	if (hasCreatedAt && !isIsoDateTime(raw.created_at)) {
		errors.push({
			path: "created_at",
			message: "created_at 는 ISO-8601 형식이어야 합니다.",
		});
	}

	if ("debug" in raw && raw.debug !== undefined && !isRecord(raw.debug)) {
		errors.push({ path: "debug", message: "debug 는 객체여야 합니다." });
	}

	if (
		hasUnknownKeys(raw, [
			"evidence_id",
			"source",
			"locator",
			"snippet",
			"confidence",
			"created_at",
			"debug",
		])
	) {
		errors.push({
			path: "root",
			message: "Evidence 에 알 수 없는 키가 존재합니다.",
		});
	}

	if (errors.length > 0) {
		return {
			ok: false,
			errors,
		};
	}

	return {
		ok: true,
		value: raw as unknown as Evidence,
	};
};
