import { describe, expect, test } from "vitest";
import { parseEvidence } from "../src/domain/evidence.js";

describe("Evidence 파싱/검증", () => {
	const createValidEvidence = (overrides?: Record<string, unknown>) => ({
		evidence_id: "ev_20260216_001",
		source: {
			kind: "attachment",
			id: "att_123",
			thread_pk: "th_1",
		},
		locator: {
			type: "pdf",
			page: 3,
			text_quote: "요구사항",
			text_hash: "abc123",
		},
		snippet: "요청된 금액은 1,000,000원입니다.",
		confidence: 0.9,
		created_at: new Date().toISOString(),
		...overrides,
	});

	test("유효한 Evidence 는 ok=true 를 반환한다", () => {
		const result = parseEvidence(createValidEvidence());

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(result.value.source.kind).toBe("attachment");
	});

	test("Email source 도 유효성 검증을 통과한다", () => {
		const evidence = createValidEvidence({
			source: {
				kind: "email",
				id: "email_42",
			},
		});

		const result = parseEvidence(evidence);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(result.value.source.kind).toBe("email");
	});

	test("루트가 객체가 아니면 에러를 반환한다", () => {
		const result = parseEvidence("not-object" as unknown);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors).toMatchObject([
			{ path: "root", message: "Evidence 값은 객체여야 합니다." },
		]);
	});

	test("필수 항목 누락 시 에러를 반환한다", () => {
		const { created_at: _, ...withoutDate } = createValidEvidence();
		const result = parseEvidence(withoutDate);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].path).toBe("created_at");
	});

	test("evidence_id 가 빈 문자열이면 에러를 반환한다", () => {
		const evidence = createValidEvidence({
			evidence_id: "",
		});

		const result = parseEvidence(evidence);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "evidence_id")).toBe(
			true,
		);
	});

	test("evidence_id 가 없으면 에러를 반환한다", () => {
		const { evidence_id: _, ...withoutEvidenceId } = createValidEvidence();

		const result = parseEvidence(withoutEvidenceId);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "evidence_id")).toBe(
			true,
		);
	});

	test("snippet 누락 시 snippet 필수 에러를 반환한다", () => {
		const { snippet: _, ...withoutSnippet } = createValidEvidence();
		const result = parseEvidence(withoutSnippet);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "snippet")).toBe(true);
	});

	test("snippet 공백은 빈값 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			snippet: "  ",
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "snippet")).toBe(true);
	});

	test("confidence 누락 시 필수 에러를 반환한다", () => {
		const { confidence: _, ...withoutConfidence } = createValidEvidence();
		const result = parseEvidence(withoutConfidence);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "confidence")).toBe(
			true,
		);
	});

	test("source 항목의 타입 오류를 검출한다", () => {
		const evidence = createValidEvidence({
			source: {
				kind: "invalid_kind",
				id: "",
				thread_pk: 10,
			},
		});

		const result = parseEvidence(evidence);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		const paths = new Set(result.errors.map((error) => error.path));
		expect(paths.has("source.kind")).toBe(true);
		expect(paths.has("source.id")).toBe(true);
		expect(paths.has("source.thread_pk")).toBe(true);
	});

	test("locator 타입이 잘못되면 에러를 반환한다", () => {
		const evidence = createValidEvidence({
			locator: {
				type: "invalid_type",
			},
		});

		const result = parseEvidence(evidence);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "locator.type")).toBe(
			true,
		);
	});

	test("outlook_quote 타입은 text_quote가 권장된다", () => {
		const evidence = createValidEvidence({
			locator: {
				type: "outlook_quote",
			},
		});

		const result = parseEvidence(evidence);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(
			result.errors.some((error) => error.path === "locator.text_quote"),
		).toBe(true);
	});

	test("pdf locator 는 page 가 필요하다", () => {
		const evidence = createValidEvidence({
			locator: {
				type: "pdf",
			},
		});

		const result = parseEvidence(evidence);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "locator.page")).toBe(
			true,
		);
	});

	test("xlsx locator 는 sheet/range 가 필요하다", () => {
		const xlsxEvidence = {
			...createValidEvidence(),
			locator: {
				type: "xlsx",
			},
		};

		const result = parseEvidence(xlsxEvidence);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		const paths = new Set(result.errors.map((error) => error.path));
		expect(paths.has("locator.sheet")).toBe(true);
		expect(paths.has("locator.range")).toBe(true);
	});

	test("pptx locator 는 slide 가 필요하다", () => {
		const pptxEvidence = createValidEvidence({
			locator: {
				type: "pptx",
			},
		});

		const result = parseEvidence(pptxEvidence);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "locator.slide")).toBe(
			true,
		);
	});

	test("docx locator 는 paragraph_index 가 필요하다", () => {
		const docxEvidence = createValidEvidence({
			locator: {
				type: "docx",
				paragraph_index: -1,
			},
		});

		const result = parseEvidence(docxEvidence);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(
			result.errors.some((error) => error.path === "locator.paragraph_index"),
		).toBe(true);
	});

	test("image locator 는 bbox 가 필요하다", () => {
		const imageEvidence = createValidEvidence({
			locator: {
				type: "image",
			},
		});

		const result = parseEvidence(imageEvidence);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "locator.bbox")).toBe(
			true,
		);
	});

	test("bbox 값 범위를 벗어나면 에러", () => {
		const imageEvidence = createValidEvidence({
			locator: {
				type: "image",
				bbox: [1.2, 0.2, 0.3, 0.4],
			},
		});

		const result = parseEvidence(imageEvidence);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "locator.bbox")).toBe(
			true,
		);
	});

	test("debug 는 객체만 허용된다", () => {
		const evidence = createValidEvidence({
			debug: 1,
		});

		const result = parseEvidence(evidence);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "debug")).toBe(true);
	});

	test("created_at 형식이 깨지면 에러를 반환한다", () => {
		const evidence = createValidEvidence({
			created_at: "invalid-date",
		});

		const result = parseEvidence(evidence);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "created_at")).toBe(
			true,
		);
	});

	test("confidence 는 0에서 1 범위를 벗어나면 에러", () => {
		const evidence = createValidEvidence({
			confidence: 1.1,
		});

		const result = parseEvidence(evidence);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "confidence")).toBe(
			true,
		);
	});

	test("예상치 못한 키가 있을 때 에러를 반환한다", () => {
		const withExtra = {
			...createValidEvidence(),
			unknown: "wrong",
			locator: {
				...createValidEvidence().locator,
				unknown_key: "wrong",
			},
		};

		const result = parseEvidence(withExtra);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "root")).toBe(true);
		expect(result.errors.some((error) => error.path === "locator")).toBe(true);
	});

	test("source 가 객체가 아니면 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			source: 123 as unknown,
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "source")).toBe(true);
		expect(
			result.errors.some((error) => error.message.includes("객체여야")),
		).toBe(true);
	});

	test("locator.text_quote 가 문자열이 아니면 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			locator: {
				type: "pdf",
				page: 2,
				text_quote: 100 as unknown,
			},
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(
			result.errors.some((error) => error.path === "locator.text_quote"),
		).toBe(true);
	});

	test("locator 가 객체가 아니면 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			locator: 123 as unknown,
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "locator")).toBe(true);
		expect(
			result.errors.some((error) => error.message.includes("객체여야")),
		).toBe(true);
	});

	test("source 에 알 수 없는 키가 있으면 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			source: {
				kind: "email",
				id: "mail_001",
				extra: "unknown",
			},
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "source")).toBe(true);
	});

	test("locator 에 알 수 없는 키가 있으면 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			locator: {
				type: "pdf",
				page: 1,
				extra: "unknown",
			},
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "locator")).toBe(true);
	});

	test("locator.page 가 숫자가 아니면 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			locator: {
				type: "pdf",
				page: "1" as unknown,
			},
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "locator.page")).toBe(
			true,
		);
	});

	test("locator.slide 가 숫자가 아니면 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			locator: {
				type: "pptx",
				slide: "3" as unknown,
			},
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "locator.slide")).toBe(
			true,
		);
	});

	test("locator.paragraph_index 가 숫자가 아니면 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			locator: {
				type: "docx",
				paragraph_index: "1" as unknown,
			},
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(
			result.errors.some((error) => error.path === "locator.paragraph_index"),
		).toBe(true);
	});

	test("locator.text_hash 가 문자열이 아니면 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			locator: {
				type: "pdf",
				page: 1,
				text_hash: 10 as unknown,
			},
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(
			result.errors.some((error) => error.path === "locator.text_hash"),
		).toBe(true);
	});

	test("locator.anchor 가 문자열이 아니면 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			locator: {
				type: "pdf",
				page: 1,
				anchor: 10 as unknown,
			},
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "locator.anchor")).toBe(
			true,
		);
	});

	test("locator.sheet 가 문자열이 아니면 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			locator: {
				type: "xlsx",
				page: 1,
				sheet: 100 as unknown,
				range: "A1:B1",
			},
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "locator.sheet")).toBe(
			true,
		);
	});

	test("locator.range 가 문자열이 아니면 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			locator: {
				type: "xlsx",
				page: 1,
				sheet: "Sheet1",
				range: 100 as unknown,
			},
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "locator.range")).toBe(
			true,
		);
	});

	test("locator.bbox 가 배열이 아니면 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			locator: {
				type: "image",
				bbox: "x,y,z,w" as unknown,
			},
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "locator.bbox")).toBe(
			true,
		);
	});

	test("source 가 없을 때 root 누락 에러를 반환한다", () => {
		const { source: _, ...withoutSource } = createValidEvidence();

		const result = parseEvidence(withoutSource);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "source")).toBe(true);
	});

	test("locator 가 없을 때 root 누락 에러를 반환한다", () => {
		const { locator: _, ...withoutLocator } = createValidEvidence();

		const result = parseEvidence(withoutLocator);

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(result.errors.some((error) => error.path === "locator")).toBe(true);
	});

	test("created_at 가 문자열이 아니면 ISO 형식 에러를 반환한다", () => {
		const result = parseEvidence({
			...createValidEvidence(),
			created_at: 12345 as unknown,
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}

		expect(
			result.errors.some(
				(error) =>
					error.path === "created_at" &&
					error.message.includes("ISO-8601 형식이어야") === true,
			),
		).toBe(true);
	});
});
