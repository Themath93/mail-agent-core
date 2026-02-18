import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
	MCP_TOOL_NAMES,
	type MailStoreGetThreadInput,
	type McpResponse,
	type McpRuntimeContext,
	type McpToolName,
	createMcpContext,
	errorResponse,
	invokeMcpTool,
	invokeMcpToolByName,
	isOkResponse,
	okResponse,
} from "../src/domain/mcp.js";

const expectParseFailure = (response: McpResponse<unknown>) => {
	expect(response.ok).toBe(false);
	if (!response.ok) {
		expect(response.error_code).toBe("E_PARSE_FAILED");
	}
};

const expectUnknownTool = (response: McpResponse<unknown>) => {
	expect(response.ok).toBe(false);
	if (!response.ok) {
		expect(response.error_code).toBe("E_UNKNOWN");
		expect(response.error_message).toContain("지원되지 않는 MCP 도구");
	}
};

const createToolContext = (): McpRuntimeContext => createMcpContext();

const completeLogin = (context: McpRuntimeContext) => {
	const issued = context.state.issued_session;
	return invokeMcpTool(
		"auth_store.complete_login",
		{
			code: "code",
			state: issued?.state ?? "",
			code_verifier: issued?.code_verifier ?? "",
		},
		context,
	);
};

describe("MCP 응답 타입", () => {
	test("성공 응답을 생성한다", () => {
		const response = okResponse({ message: "ok" });

		expect(response.ok).toBe(true);
		expect(response.data).toEqual({ message: "ok" });
		expect(isOkResponse(response)).toBe(true);
	});

	test("실패 응답을 생성한다", () => {
		const response = errorResponse("E_AUTH_REQUIRED", "로그인 필요", true);

		expect(response.ok).toBe(false);
		expect(response.error_code).toBe("E_AUTH_REQUIRED");
		expect(response.retryable).toBe(true);
		expect(isOkResponse(response)).toBe(false);
	});

	test("지원 도구 전체를 기준 검증한다", () => {
		expect(Array.isArray(MCP_TOOL_NAMES)).toBe(true);
		expect(MCP_TOOL_NAMES.length).toBe(18);
	});
});

describe("MCP invokeByName", () => {
	test("알 수 없는 도구명은 E_UNKNOWN 반환", () => {
		const context = createToolContext();
		const response = invokeMcpToolByName("not.exists", {}, context);

		expectUnknownTool(response);
	});

	test("요청 본문이 객체가 아니면 E_PARSE_FAILED 반환", () => {
		const context = createToolContext();
		const response = invokeMcpToolByName(
			"auth_store.start_login",
			"bad",
			context,
		);

		expectParseFailure(response);
	});

	test("null 객체는 E_PARSE_FAILED 반환", () => {
		const context = createToolContext();
		const response = invokeMcpToolByName(
			"auth_store.start_login",
			null,
			context,
		);

		expectParseFailure(response);
	});
});

describe("MCP tools", () => {
	test("auth_store.start_login는 로그인 URL을 반환하고 issued_session을 저장한다", () => {
		const context = createToolContext();
		const response = invokeMcpTool(
			"auth_store.start_login",
			{ scopes: ["Mail.Read", "User.Read"] },
			context,
		);

		expect(response.ok).toBe(true);
		if (!response.ok) {
			throw new Error("예상치 못한 에러 응답");
		}

		expect(context.state.issued_session).not.toBeNull();
		expect(context.state.issued_session?.scopes).toEqual([
			"Mail.Read",
			"User.Read",
		]);
		expect(response.data.login_url).toContain("response_type=code");
		expect(response.data.login_url).toContain("login.microsoftonline.com");
		expect(response.data.login_url).toContain("code_challenge=");
		expect(response.data.login_url).toContain("code_challenge_method=S256");
		expect(response.data.callback_url).toBe(
			"http://127.0.0.1:1270/mcp/callback",
		);
	});

	test("start_login 빈 스코프는 파싱 에러를 반환한다", () => {
		const context = createToolContext();
		const response = invokeMcpTool(
			"auth_store.start_login",
			{ scopes: [] },
			context,
		);

		expectParseFailure(response);
		if (!response.ok) {
			expect(response.error_message).toContain("비어있지 않은 문자열 목록");
		}
	});

	test("complete_login은 선행 로그인이 없으면 E_AUTH_REQUIRED", () => {
		const context = createToolContext();
		const response = invokeMcpTool(
			"auth_store.complete_login",
			{
				code: "code",
				state: "state",
				code_verifier: "verifier",
			},
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_AUTH_REQUIRED");
		}
	});

	test("complete_login은 state 불일치 시 E_AUTH_FAILED 반환", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		const codeVerifier = context.state.issued_session?.code_verifier ?? "";

		const response = invokeMcpTool(
			"auth_store.complete_login",
			{
				code: "code",
				state: "invalid",
				code_verifier: codeVerifier,
			},
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_AUTH_FAILED");
		}
	});

	test("complete_login은 code_verifier 불일치 시 E_AUTH_FAILED를 반환한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);

		const response = invokeMcpTool(
			"auth_store.complete_login",
			{
				code: "code",
				state: context.state.issued_session?.state ?? "state",
				code_verifier: "mismatched",
			},
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_AUTH_FAILED");
			expect(response.error_message).toContain("일치하지 않습니다");
		}
	});

	test("complete_login은 상태 일치 시 로그인 완료 상태로 전환한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		const response = completeLogin(context);

		expect(response.ok).toBe(true);
		expect(context.state.signed_in).toBe(true);

		const status = invokeMcpTool("auth_store.auth_status", {}, context);
		expect(status.ok).toBe(true);
		if (status.ok) {
			expect(status.data.signed_in).toBe(true);
			expect(status.data.account?.email).toBe("user@localhost");
		}
	});

	test("complete_login_auto는 pending callback이 없으면 E_NOT_FOUND(retryable)", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);

		const response = invokeMcpTool(
			"auth_store.complete_login_auto",
			{},
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_NOT_FOUND");
			expect(response.retryable).toBe(true);
		}
	});

	test("complete_login_auto는 pending callback이 있으면 로그인 완료된다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		const issuedSession = context.state.issued_session;
		if (!issuedSession) {
			throw new Error("issued_session 준비 실패");
		}

		context.state.pending_callback = {
			code: "auto-code",
			state: issuedSession.state,
			received_at: new Date().toISOString(),
		};

		const response = invokeMcpTool(
			"auth_store.complete_login_auto",
			{},
			context,
		);

		expect(response.ok).toBe(true);
		expect(context.state.signed_in).toBe(true);
		expect(context.state.pending_callback).toBeNull();
	});

	test("complete_login_auto는 state 불일치 시 E_AUTH_FAILED", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		context.state.pending_callback = {
			code: "auto-code",
			state: "invalid-state",
			received_at: new Date().toISOString(),
		};

		const response = invokeMcpTool(
			"auth_store.complete_login_auto",
			{},
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_AUTH_FAILED");
		}
	});

	test("complete_login_auto는 issued_session이 없으면 E_AUTH_REQUIRED", () => {
		const context = createToolContext();
		context.state.pending_callback = {
			code: "auto-code",
			state: "any-state",
			received_at: new Date().toISOString(),
		};

		const response = invokeMcpTool(
			"auth_store.complete_login_auto",
			{},
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_AUTH_REQUIRED");
		}
	});

	test("auth_status는 로그인 상태를 정확히 노출한다", () => {
		const context = createToolContext();
		const before = invokeMcpTool("auth_store.auth_status", {}, context);
		expect(before.ok).toBe(true);
		if (before.ok) {
			expect(before.data.signed_in).toBe(false);
			expect(before.data.account).toBeNull();
			expect(before.data.pending_callback_received).toBe(false);
		}

		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const after = invokeMcpTool("auth_store.auth_status", {}, context);
		expect(after.ok).toBe(true);
		if (after.ok) {
			expect(after.data.signed_in).toBe(true);
			expect(after.data.account?.tenant).toBe("default");
			expect(after.data.access_token_expires_at).toBeDefined();
			expect(after.data.pending_callback_received).toBe(false);
		}
	});

	test("auth_status는 pending_callback_received 플래그를 노출한다", () => {
		const context = createToolContext();
		const issued = invokeMcpTool(
			"auth_store.start_login",
			{ scopes: ["Mail.Read"] },
			context,
		);
		expect(issued.ok).toBe(true);
		if (!issued.ok) {
			throw new Error("start_login 실패");
		}

		context.state.pending_callback = {
			code: "auto-code",
			state: context.state.issued_session?.state ?? "",
			received_at: new Date().toISOString(),
		};

		const status = invokeMcpTool("auth_store.auth_status", {}, context);
		expect(status.ok).toBe(true);
		if (status.ok) {
			expect(status.data.pending_callback_received).toBe(true);
			expect(status.data.pending_callback_received_at).toBeDefined();
		}
	});

	test("autopilot.tick은 manual 모드에서 E_POLICY_DENIED", () => {
		const context = createToolContext();
		const response = invokeMcpTool(
			"autopilot.tick",
			{ mail_folder: "inbox" },
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_POLICY_DENIED");
		}
	});

	test("autopilot.set_mode/review_first + tick은 review 후보를 만든다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);
		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 1,
				select: ["id", "subject"],
			},
			context,
		);

		const modeResponse = invokeMcpTool(
			"autopilot.set_mode",
			{ mode: "review_first" },
			context,
		);
		expect(modeResponse.ok).toBe(true);

		const tickResponse = invokeMcpTool(
			"autopilot.tick",
			{ mail_folder: "inbox", max_messages_per_tick: 5 },
			context,
		);
		expect(tickResponse.ok).toBe(true);
		if (tickResponse.ok) {
			expect(tickResponse.data.review_candidates).toBeGreaterThanOrEqual(0);
		}
	});

	test("autopilot.set_mode/full_auto + tick은 evidence/todo를 생성한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);
		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 1,
				select: ["id", "subject"],
			},
			context,
		);

		invokeMcpTool("autopilot.set_mode", { mode: "full_auto" }, context);
		const tickResponse = invokeMcpTool(
			"autopilot.tick",
			{ mail_folder: "inbox", max_messages_per_tick: 5 },
			context,
		);
		expect(tickResponse.ok).toBe(true);
		if (tickResponse.ok) {
			expect(tickResponse.data.auto_evidence_created).toBeGreaterThanOrEqual(0);
			expect(tickResponse.data.auto_todo_created).toBeGreaterThanOrEqual(0);
		}
	});

	test("autopilot.pause/status/resume는 상태 전이를 보장하고 manual resume은 거부한다", () => {
		const context = createToolContext();
		invokeMcpTool("autopilot.set_mode", { mode: "full_auto" }, context);
		context.state.autopilot.last_error = "failure";
		context.state.autopilot.consecutive_failures = 2;

		const paused = invokeMcpTool("autopilot.pause", {}, context);
		expect(paused.ok).toBe(true);
		if (!paused.ok) {
			throw new Error("pause 실패");
		}
		expect(paused.data.paused).toBe(true);

		const status = invokeMcpTool("autopilot.status", {}, context);
		expect(status.ok).toBe(true);
		if (status.ok) {
			expect(status.data.status).toBe("paused");
			expect(status.data.paused).toBe(true);
		}

		const resumed = invokeMcpTool("autopilot.resume", {}, context);
		expect(resumed.ok).toBe(true);
		if (!resumed.ok) {
			throw new Error("resume 실패");
		}
		expect(resumed.data.status).toBe("idle");
		expect(context.state.autopilot.last_error).toBeNull();
		expect(context.state.autopilot.consecutive_failures).toBe(0);

		invokeMcpTool("autopilot.set_mode", { mode: "manual" }, context);
		const manualResume = invokeMcpTool("autopilot.resume", {}, context);
		expect(manualResume.ok).toBe(false);
		if (!manualResume.ok) {
			expect(manualResume.error_code).toBe("E_POLICY_DENIED");
		}
	});

	test("autopilot.tick은 paused 상태면 E_POLICY_DENIED", () => {
		const context = createToolContext();
		invokeMcpTool("autopilot.set_mode", { mode: "full_auto" }, context);
		invokeMcpTool("autopilot.pause", {}, context);

		const response = invokeMcpTool(
			"autopilot.tick",
			{ mail_folder: "inbox" },
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_POLICY_DENIED");
		}
	});

	test("autopilot.full_auto tick은 빈 snippet 및 evidence 생성 실패를 review 후보로 누적한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);
		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 1,
				select: ["id", "subject"],
			},
			context,
		);
		invokeMcpTool("autopilot.set_mode", { mode: "full_auto" }, context);

		const baseMessage = Array.from(context.state.messages.values())[0];
		if (!baseMessage) {
			throw new Error("메시지 준비 실패");
		}

		context.state.messages.set("blank_entry", {
			...baseMessage,
			message_pk: "blank_pk",
			provider_message_id: "graph_blank_pk",
			internet_message_id: "<blank_pk@outlook.example.com>",
			web_link: "https://outlook.office.com/mail/blank_pk",
			subject: "   ",
			body_text: "   ",
		});
		context.state.messages.set("ghost_entry", {
			...baseMessage,
			message_pk: "ghost_pk",
			provider_message_id: "graph_ghost_pk",
			internet_message_id: "<ghost_pk@outlook.example.com>",
			web_link: "https://outlook.office.com/mail/ghost_pk",
			subject: "자동 분석 대상",
			body_text: "본문 텍스트",
		});

		const tick = invokeMcpTool(
			"autopilot.tick",
			{ mail_folder: "inbox", max_messages_per_tick: 30 },
			context,
		);

		expect(tick.ok).toBe(true);
		if (tick.ok) {
			expect(tick.data.review_candidates).toBeGreaterThanOrEqual(2);
		}
	});

	test("workflow.create_evidence는 idempotency를 보장하고 confidence 기본값을 사용한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);
		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 1,
				select: ["id", "subject"],
			},
			context,
		);

		const created = invokeMcpTool(
			"workflow.create_evidence",
			{
				message_pk: "inbox_msg_inbox_1",
				snippet: "  자동   근거  생성  ",
				confidence: 99,
			},
			context,
		);
		expect(created.ok).toBe(true);
		if (!created.ok) {
			throw new Error("evidence 생성 실패");
		}
		expect(created.data.created).toBe(true);
		expect(created.data.evidence.confidence).toBe(0.7);

		const duplicate = invokeMcpTool(
			"workflow.create_evidence",
			{
				message_pk: "inbox_msg_inbox_1",
				snippet: "자동 근거 생성",
				confidence: 0.9,
			},
			context,
		);
		expect(duplicate.ok).toBe(true);
		if (duplicate.ok) {
			expect(duplicate.data.created).toBe(false);
			expect(duplicate.data.skipped_duplicate).toBe(true);
		}
	});

	test("workflow.upsert_todo는 생성/중복감지/업데이트 분기를 처리한다", () => {
		const context = createToolContext();

		const invalidStatus = invokeMcpToolByName(
			"workflow.upsert_todo",
			{
				todo_key: "todo_key_1",
				title: "후속 작업",
				status: "invalid",
				evidence_id: "ev_1",
			},
			context,
		);
		expect(invalidStatus.ok).toBe(true);

		const created = invokeMcpTool(
			"workflow.upsert_todo",
			{
				todo_key: "todo_key_2",
				title: "후속 작업",
				status: "open",
				evidence_id: "ev_1",
			},
			context,
		);
		expect(created.ok).toBe(true);
		if (!created.ok || !created.data.todo) {
			throw new Error("todo 생성 실패");
		}
		expect(created.data.created).toBe(true);
		expect(created.data.todo.status).toBe("open");

		const duplicate = invokeMcpTool(
			"workflow.upsert_todo",
			{
				todo_id: created.data.todo.todo_id,
				title: "후속 작업",
				status: "open",
				evidence_id: "ev_1",
			},
			context,
		);
		expect(duplicate.ok).toBe(true);
		if (duplicate.ok) {
			expect(duplicate.data.created).toBe(false);
			expect(duplicate.data.updated).toBe(true);
			expect(duplicate.data.skipped_duplicate).toBe(true);
		}

		const updated = invokeMcpTool(
			"workflow.upsert_todo",
			{
				todo_key: "todo_key_1",
				title: "후속 작업",
				status: "done",
				evidence_id: "ev_1",
			},
			context,
		);
		expect(updated.ok).toBe(true);
		if (updated.ok && updated.data.todo) {
			expect(updated.data.created).toBe(false);
			expect(updated.data.updated).toBe(true);
			expect(updated.data.skipped_duplicate).toBe(false);
			expect(updated.data.todo.status).toBe("done");
		}
	});

	test("auth_store.logout은 인증 상태를 초기화한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const response = invokeMcpTool("auth_store.logout", {}, context);
		expect(response.ok).toBe(true);
		expect(context.state.signed_in).toBe(false);
		expect(context.state.account).toBeNull();
		expect(context.state.auth_token).toBeNull();
		expect(context.state.issued_session).toBeNull();
		expect(context.state.pending_callback).toBeNull();
	});

	test("만료된 액세스 토큰은 리프레시 토큰으로 갱신된다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		if (context.state.auth_token === null) {
			throw new Error("예상치 못한 토큰 부재");
		}
		const beforeAccessToken = context.state.auth_token.access_token;
		context.state.auth_token.expires_at = new Date(
			Date.now() - 10_000,
		).toISOString();

		const after = invokeMcpTool("auth_store.auth_status", {}, context);
		expect(after.ok).toBe(true);
		if (after.ok) {
			expect(after.data.signed_in).toBe(true);
			expect(after.data.access_token_expires_at).toBeDefined();
		}

		if (context.state.auth_token === null) {
			throw new Error("예상치 못한 갱신 실패");
		}
		expect(context.state.auth_token.access_token).not.toBe(beforeAccessToken);
	});

	test("만료된 갱신 토큰은 로그인 상태를 false로 전환한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		if (context.state.auth_token === null) {
			throw new Error("예상치 못한 토큰 부재");
		}
		context.state.auth_token.expires_at = new Date(
			Date.now() - 10_000,
		).toISOString();
		context.state.auth_token.refresh_token_expires_at = new Date(
			Date.now() - 10_000,
		).toISOString();

		const after = invokeMcpTool("auth_store.auth_status", {}, context);
		expect(after.ok).toBe(true);
		if (after.ok) {
			expect(after.data.signed_in).toBe(false);
		}
		expect(context.state.signed_in).toBe(false);
		expect(context.state.account).toBeNull();
	});

	test("refresh 토큰 만료 시 동기화는 E_AUTH_FAILED를 반환한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		if (context.state.auth_token === null) {
			throw new Error("예상치 못한 토큰 부재");
		}
		context.state.auth_token.expires_at = new Date(
			Date.now() - 10_000,
		).toISOString();
		context.state.auth_token.refresh_token_expires_at = new Date(
			Date.now() - 10_000,
		).toISOString();

		const response = invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 1,
				select: ["id", "subject"],
			},
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_AUTH_FAILED");
		}
	});

	test("complete_login은 필수 필드 누락 시 파싱 에러", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);

		const response = invokeMcpTool(
			"auth_store.complete_login",
			{
				code: "code",
				state: "",
				code_verifier: "code_verifier",
			},
			context,
		);

		expectParseFailure(response);
	});

	test("graph_mail_sync.initial_sync는 인증이 없으면 E_AUTH_REQUIRED", () => {
		const context = createToolContext();
		const response = invokeMcpToolByName(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 7,
				select: ["id", "subject"],
			},
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_AUTH_REQUIRED");
		}
	});

	test("graph_mail_sync.initial_sync는 메시지/첨부 동기화 카운트를 반환한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const response = invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 7,
				select: ["id", "subject"],
			},
			context,
		);

		expect(response.ok).toBe(true);
		if (response.ok) {
			expect(response.data.synced_messages).toBe(3);
			expect(response.data.synced_attachments).toBe(2);
			expect(context.state.deltaLinks.get("inbox")).toBeDefined();
		}
	});

	test("graph_mail_sync.initial_sync는 days_back 30 경계값을 허용한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const response = invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 30,
				select: ["id", "subject"],
			},
			context,
		);

		expect(response.ok).toBe(true);
		if (!response.ok) {
			throw new Error("경계값 동기화 실패");
		}

		expect(response.data.synced_messages).toBe(3);
		expect(response.data.synced_attachments).toBe(2);
		expect(context.state.deltaLinks.get("inbox")).toBeDefined();
	});

	test("initial_sync는 기존 메시지를 중복 계산하지 않는다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const first = invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 3,
				select: ["id", "subject"],
			},
			context,
		);

		if (!first.ok) {
			throw new Error("초기 동기화 실패");
		}

		const firstDeltaLink = context.state.deltaLinks.get("inbox");
		if (!firstDeltaLink) {
			throw new Error("첫 delta link 저장 실패");
		}

		const beforeMessages = context.state.threadMessages.get("inbox")?.length;
		if (typeof beforeMessages !== "number") {
			throw new Error("스레드 메시지 수 확인 실패");
		}

		const second = invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 3,
				select: ["id", "subject"],
			},
			context,
		);

		expect(second.ok).toBe(true);
		if (!second.ok) {
			throw new Error("두 번째 동기화 실패");
		}

		expect(second.data.synced_messages).toBe(0);
		expect(second.data.synced_attachments).toBe(0);
		expect(context.state.threadMessages.get("inbox")?.length).toBe(
			beforeMessages,
		);
		expect(context.state.deltaLinks.get("inbox")).toBe(firstDeltaLink);
	});

	test("graph_mail_sync.initial_sync는 mail_folder 유효성 실패 시 E_PARSE_FAILED", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const response = invokeMcpToolByName(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "   ",
				days_back: 1,
				select: ["id", "subject"],
			},
			context,
		);

		expectParseFailure(response);
	});

	test("graph_mail_sync.initial_sync는 잘못된 days_back를 거부한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const response = invokeMcpToolByName(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: -3,
				select: ["id", "subject"],
			},
			context,
		);

		expectParseFailure(response);
	});

	test("graph_mail_sync.initial_sync는 days_back가 정책 한도를 넘으면 E_GRAPH_THROTTLED", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const response = invokeMcpToolByName(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 31,
				select: ["id", "subject"],
			},
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_GRAPH_THROTTLED");
		}
	});

	test("graph_mail_sync.initial_sync는 select 유효성 실패 시 E_PARSE_FAILED", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const response = invokeMcpToolByName(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 1,
				select: ["id", ""],
			},
			context,
		);

		expectParseFailure(response);
	});

	test("graph_mail_sync.delta_sync는 변경 내역을 반환한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);
		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 1,
				select: ["id", "subject"],
			},
			context,
		);

		const response = invokeMcpTool(
			"graph_mail_sync.delta_sync",
			{
				mail_folder: "inbox",
			},
			context,
		);

		expect(response.ok).toBe(true);
		if (response.ok) {
			expect(Number.isInteger(response.data.changes.added)).toBe(true);
			expect(Number.isInteger(response.data.changes.updated)).toBe(true);
			expect(Number.isInteger(response.data.changes.deleted)).toBe(true);
			expect(response.data.changes.added).toBeGreaterThanOrEqual(0);
			expect(response.data.changes.updated).toBeGreaterThanOrEqual(0);
			expect(response.data.changes.deleted).toBeGreaterThanOrEqual(0);
			expect(response.data.new_delta_link_saved).toBe(true);
			expect(context.state.deltaLinks.get("inbox")).toBeDefined();
		}
	});

	test("graph_mail_sync.delta_sync는 완료 후 새 delta link를 저장하고 조회 가능하다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);
		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 1,
				select: ["id", "subject"],
			},
			context,
		);

		const beforeLink = context.state.deltaLinks.get("inbox");
		expect(beforeLink).toBeDefined();

		const response = invokeMcpTool(
			"graph_mail_sync.delta_sync",
			{
				mail_folder: "inbox",
			},
			context,
		);

		expect(response.ok).toBe(true);
		if (!response.ok) {
			throw new Error("delta 동기화 실패");
		}

		const afterLink = context.state.deltaLinks.get("inbox");
		expect(afterLink).toBeDefined();
		expect(afterLink).not.toBe(beforeLink);
		expect(response.data.new_delta_link_saved).toBe(true);
	});

	test("graph_mail_sync.delta_sync는 initial_sync가 없으면 E_GRAPH_THROTTLED", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const response = invokeMcpTool(
			"graph_mail_sync.delta_sync",
			{
				mail_folder: "inbox",
			},
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_GRAPH_THROTTLED");
		}
	});

	test("delta_sync는 delta link 형식이 손상되면 E_PARSE_FAILED", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);
		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 1,
				select: ["id", "subject"],
			},
			context,
		);

		context.state.deltaLinks.set("inbox", "broken_delta_link");

		const response = invokeMcpTool(
			"graph_mail_sync.delta_sync",
			{ mail_folder: "inbox" },
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_PARSE_FAILED");
		}
	});

	test("delta_sync는 빈 delta 대상이면 E_NOT_FOUND", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		context.state.deltaLinks.set("inbox", `inbox_${Date.now()}_delta`);

		const response = invokeMcpTool(
			"graph_mail_sync.delta_sync",
			{ mail_folder: "inbox" },
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_NOT_FOUND");
		}
	});

	test("delta_sync는 thread 메시지-스토어 불일치 시 E_NOT_FOUND", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		context.state.deltaLinks.set("inbox", `inbox_${Date.now()}_delta`);
		context.state.threadMessages.set("inbox", ["missing_message_pk"]);

		const response = invokeMcpTool(
			"graph_mail_sync.delta_sync",
			{ mail_folder: "inbox" },
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_NOT_FOUND");
		}
	});

	test("delta_sync는 thread collision 감지 시 E_PARSE_FAILED", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);
		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 2,
				select: ["id", "subject"],
			},
			context,
		);

		const messagePk = context.state.threadMessages.get("inbox")?.[0];
		if (!messagePk) {
			throw new Error("테스트 메시지 준비 실패");
		}
		const message = context.state.messages.get(messagePk);
		if (!message) {
			throw new Error("테스트 메시지 조회 실패");
		}
		context.state.messages.set(messagePk, {
			...message,
			provider_thread_id: "other-thread",
		});

		const response = invokeMcpTool(
			"graph_mail_sync.delta_sync",
			{ mail_folder: "inbox" },
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_PARSE_FAILED");
		}
	});

	test("delta_sync는 삭제와 갱신 카운트를 포함한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 3,
				select: ["id", "subject"],
			},
			context,
		);

		const before = invokeMcpTool(
			"mail_store.get_message",
			{
				message_pk: "inbox_msg_inbox_1",
			},
			context,
		);
		expect(before.ok).toBe(true);

		const response = invokeMcpTool(
			"graph_mail_sync.delta_sync",
			{
				mail_folder: "inbox",
			},
			context,
		);

		expect(response.ok).toBe(true);
		if (!response.ok) {
			throw new Error("delta 동기화 실패");
		}

		expect(response.data.changes.added).toBe(1);
		expect(response.data.changes.updated).toBe(1);
		expect(response.data.changes.deleted).toBe(1);

		const deleted = invokeMcpTool(
			"mail_store.get_message",
			{
				message_pk: "inbox_msg_inbox_1",
			},
			context,
		);

		expect(deleted.ok).toBe(false);
		if (!deleted.ok) {
			expect(deleted.error_code).toBe("E_NOT_FOUND");
		}
	});

	test("graph_mail_sync.download_attachment는 저장된 메시지만 처리한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const responseMissing = invokeMcpTool(
			"graph_mail_sync.download_attachment",
			{
				graph_message_id: "graph_unknown",
				graph_attachment_id: "att_unknown",
				message_pk: "unknown",
			},
			context,
		);
		expect(responseMissing.ok).toBe(false);
		if (!responseMissing.ok) {
			expect(responseMissing.error_code).toBe("E_NOT_FOUND");
		}

		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 1,
				select: ["id", "subject"],
			},
			context,
		);

		const first = invokeMcpTool(
			"graph_mail_sync.download_attachment",
			{
				graph_message_id: "graph_inbox_msg_inbox_1",
				graph_attachment_id: "att_inbox_msg_inbox_1",
				message_pk: "inbox_msg_inbox_1",
			},
			context,
		);

		expect(first.ok).toBe(true);
		if (first.ok) {
			const sha256 = createHash("sha256")
				.update("graph_inbox_msg_inbox_1::att_inbox_msg_inbox_1")
				.digest("hex");
			expect(first.data.attachment_pk).toBe(`att_${sha256.slice(0, 16)}`);
			expect(first.data.relative_path).toBe(
				`attachments/${sha256.slice(0, 2)}/${sha256}.bin`,
			);
		}

		const same = invokeMcpTool(
			"graph_mail_sync.download_attachment",
			{
				graph_message_id: "graph_inbox_msg_inbox_1",
				graph_attachment_id: "att_inbox_msg_inbox_1",
				message_pk: "inbox_msg_inbox_1",
			},
			context,
		);
		expect(same.ok).toBe(true);
		if (same.ok && first.ok) {
			expect(same.data.attachment_pk).toBe(first.data.attachment_pk);
			expect(same.data.sha256).toBe(first.data.sha256);
			expect(same.data.relative_path).toBe(first.data.relative_path);
			expect(same.data.size_bytes).toBe(first.data.size_bytes);
		}
	});

	test("download_attachment는 동일한 sha256 기준으로 첨부를 dedupe 한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 1,
				select: ["id", "subject"],
			},
			context,
		);

		const baseline = invokeMcpTool(
			"graph_mail_sync.download_attachment",
			{
				graph_message_id: "graph_inbox_msg_inbox_1",
				graph_attachment_id: "att_inbox_msg_inbox_1",
				message_pk: "inbox_msg_inbox_1",
			},
			context,
		);
		expect(baseline.ok).toBe(true);
		if (!baseline.ok) {
			throw new Error("기준 첨부 다운로드 실패");
		}
		const attachmentsBefore = context.state.attachments.size;

		const sharedMessage = {
			message_pk: "inbox_msg_inbox_dup",
			provider_message_id: "graph_inbox_msg_inbox_1",
			provider_thread_id: "inbox",
			internet_message_id: "<dup@outlook.example.com>",
			web_link: "https://outlook.office.com/mail/inbox_msg_inbox_dup",
			subject: "중복 대상 메시지",
			from: "sender@local.test",
			to: [],
			cc: [],
			received_at: new Date().toISOString(),
			body_text: "샘플 본문 duplicate",
			has_attachments: false,
			attachments: [],
		};
		context.state.messages.set(sharedMessage.message_pk, sharedMessage);
		context.state.threadMessages.set("inbox", [
			...(context.state.threadMessages.get("inbox") ?? []),
			sharedMessage.message_pk,
		]);

		const deduped = invokeMcpTool(
			"graph_mail_sync.download_attachment",
			{
				graph_message_id: "graph_inbox_msg_inbox_1",
				graph_attachment_id: "att_inbox_msg_inbox_1",
				message_pk: "inbox_msg_inbox_dup",
			},
			context,
		);

		expect(deduped.ok).toBe(true);
		if (deduped.ok) {
			expect(deduped.data.attachment_pk).toBe(baseline.data.attachment_pk);
			expect(deduped.data.sha256).toBe(baseline.data.sha256);
			expect(deduped.data.relative_path).toBe(baseline.data.relative_path);
		}
		expect(context.state.attachments.size).toBe(attachmentsBefore);
	});

	test("download_attachment는 메시지에 없는 첨부 요청 시 E_NOT_FOUND", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{ mail_folder: "inbox", days_back: 1, select: ["id", "subject"] },
			context,
		);

		const missing = invokeMcpTool(
			"graph_mail_sync.download_attachment",
			{
				graph_message_id: "graph_inbox_msg_inbox_1",
				graph_attachment_id: "att_missing",
				message_pk: "inbox_msg_inbox_1",
			},
			context,
		);

		expect(missing.ok).toBe(false);
		if (!missing.ok) {
			expect(missing.error_code).toBe("E_NOT_FOUND");
		}
	});

	test("download_attachment는 저장된 sha256 불일치 시 E_PARSE_FAILED", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{ mail_folder: "inbox", days_back: 1, select: ["id", "subject"] },
			context,
		);

		const lookupKey = "graph_inbox_msg_inbox_1::att_inbox_msg_inbox_1";
		const stored = context.state.attachments.get(lookupKey);
		if (!stored) {
			throw new Error("테스트 첨부 레코드 준비 실패");
		}
		context.state.attachments.set(lookupKey, {
			...stored,
			sha256: "sha_mismatch",
		});

		const response = invokeMcpTool(
			"graph_mail_sync.download_attachment",
			{
				graph_message_id: "graph_inbox_msg_inbox_1",
				graph_attachment_id: "att_inbox_msg_inbox_1",
				message_pk: "inbox_msg_inbox_1",
			},
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_PARSE_FAILED");
		}
	});

	test("download_attachment는 message_pk와 graph_message_id 불일치 시 E_NOT_FOUND", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 1,
				select: ["id", "subject"],
			},
			context,
		);

		const mismatch = invokeMcpTool(
			"graph_mail_sync.download_attachment",
			{
				graph_message_id: "graph_mismatch",
				graph_attachment_id: "att_inbox_msg_inbox_1",
				message_pk: "inbox_msg_inbox_1",
			},
			context,
		);

		expect(mismatch.ok).toBe(false);
		if (!mismatch.ok) {
			expect(mismatch.error_code).toBe("E_NOT_FOUND");
		}
	});

	test("mail_store.get_message는 존재 확인과 조회를 수행한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);
		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 1,
				select: ["id", "subject"],
			},
			context,
		);

		const found = invokeMcpTool(
			"mail_store.get_message",
			{
				message_pk: "inbox_msg_inbox_1",
			},
			context,
		);
		expect(found.ok).toBe(true);
		if (found.ok) {
			expect(found.data.message.message_pk).toBe("inbox_msg_inbox_1");
			expect(found.data.message.provider_message_id).toBe(
				"graph_inbox_msg_inbox_1",
			);
		}

		const missing = invokeMcpTool(
			"mail_store.get_message",
			{ message_pk: "missing" },
			context,
		);
		expect(missing.ok).toBe(false);
		if (!missing.ok) {
			expect(missing.error_code).toBe("E_NOT_FOUND");
		}
	});

	test("mail_store.get_message supports message_id alias", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);
		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 1,
				select: ["id", "subject"],
			},
			context,
		);

		const response = invokeMcpToolByName(
			"mail_store.get_message",
			{ message_id: "inbox_msg_inbox_1" },
			context,
		);

		expect(response.ok).toBe(true);
	});

	test("mail_store.get_message not found returns E_NOT_FOUND", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const response = invokeMcpToolByName(
			"mail_store.get_message",
			{ message_id: "missing" },
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_NOT_FOUND");
		}
	});

	test("mail_store.get_message는 message_pk 누락 시 E_PARSE_FAILED", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const response = invokeMcpTool(
			"mail_store.get_message",
			{ message_pk: "   " },
			context,
		);

		expectParseFailure(response);
	});

	test("mail_store.get_message는 message_pk/message_id가 모두 없으면 E_PARSE_FAILED", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const response = invokeMcpToolByName("mail_store.get_message", {}, context);

		expectParseFailure(response);
	});

	test("mail_store.get_message는 messages store가 없으면 E_PARSE_FAILED", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		context.state.messages =
			undefined as unknown as McpRuntimeContext["state"]["messages"];

		const response = invokeMcpTool(
			"mail_store.get_message",
			{ message_pk: "inbox_msg_inbox_1" },
			context,
		);

		expectParseFailure(response);
	});

	test("mail_store.get_thread는 thread_pk 기준으로 메시지 목록을 반환한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);
		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{
				mail_folder: "inbox",
				days_back: 2,
				select: ["id", "subject"],
			},
			context,
		);

		const input: MailStoreGetThreadInput = {
			thread_pk: "inbox",
			depth: 20,
		};
		const response = invokeMcpTool("mail_store.get_thread", input, context);

		expect(response.ok).toBe(true);
		if (response.ok) {
			expect(response.data.length).toBeGreaterThan(0);
			expect(response.data[0].provider_thread_id).toBe("inbox");
		}

		const aliasResponse = invokeMcpToolByName(
			"mail_store.get_thread",
			{ thread_id: "inbox", depth: 20 },
			context,
		);
		expect(aliasResponse.ok).toBe(true);
	});

	test("mail_store.get_thread invalid thread depth returns E_PARSE_FAILED", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const zero = invokeMcpTool(
			"mail_store.get_thread",
			{ thread_pk: "inbox", depth: 0 },
			context,
		);
		expectParseFailure(zero);

		const negative = invokeMcpTool(
			"mail_store.get_thread",
			{ thread_pk: "inbox", depth: -1 },
			context,
		);
		expectParseFailure(negative);
	});

	test("mail_store.get_thread는 thread_pk/thread_id가 모두 없으면 E_PARSE_FAILED", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const response = invokeMcpToolByName(
			"mail_store.get_thread",
			{ depth: 20 },
			context,
		);

		expectParseFailure(response);
	});

	test("mail_store.get_thread not found returns E_NOT_FOUND", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const response = invokeMcpTool(
			"mail_store.get_thread",
			{ thread_pk: "missing-thread", depth: 20 },
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_NOT_FOUND");
		}
	});

	test("mail_store.get_thread는 threadMessages가 비어있으면 E_NOT_FOUND", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		context.state.threadMessages.set("empty", []);
		const response = invokeMcpTool(
			"mail_store.get_thread",
			{ thread_pk: "empty", depth: 20 },
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_NOT_FOUND");
		}
	});

	test("mail_store.get_thread는 threadMessages/messages store 의존성이 깨지면 명시적으로 실패한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		context.state.threadMessages.set("inbox", ["missing_message_pk"]);
		context.state.messages.clear();
		const missingMessage = invokeMcpTool(
			"mail_store.get_thread",
			{ thread_pk: "inbox", depth: 20 },
			context,
		);
		expect(missingMessage.ok).toBe(false);
		if (!missingMessage.ok) {
			expect(missingMessage.error_code).toBe("E_NOT_FOUND");
		}

		context.state.threadMessages =
			undefined as unknown as McpRuntimeContext["state"]["threadMessages"];
		const corrupted = invokeMcpTool(
			"mail_store.get_thread",
			{ thread_pk: "inbox", depth: 20 },
			context,
		);
		expectParseFailure(corrupted);

		context.state.threadMessages = new Map([
			["inbox", null as unknown as string[]],
		]);
		const nullCache = invokeMcpTool(
			"mail_store.get_thread",
			{ thread_pk: "inbox", depth: 20 },
			context,
		);
		expectParseFailure(nullCache);
	});

	test("mail_store.get_thread는 received_at 기준 내림차순으로 정렬한다", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);
		invokeMcpTool(
			"graph_mail_sync.initial_sync",
			{ mail_folder: "inbox", days_back: 2, select: ["id", "subject"] },
			context,
		);

		const before = context.state.threadMessages.get("inbox");
		if (!before || before.length < 2) {
			throw new Error("정렬 테스트 준비 실패");
		}

		context.state.threadMessages.set("inbox", [
			before[1] ?? "",
			before[0] ?? "",
		]);
		const response = invokeMcpTool(
			"mail_store.get_thread",
			{ thread_pk: "inbox", depth: 20 },
			context,
		);

		expect(response.ok).toBe(true);
		if (response.ok) {
			expect(response.data[0].message_pk).toBe(before[0]);
		}
	});

	test("mail_store.get_thread는 동일 timestamp면 message_pk로 결정적 정렬", () => {
		const context = createToolContext();
		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const receivedAt = new Date(0).toISOString();
		const threadPk = "custom";
		const messageA = {
			message_pk: "custom_a",
			provider_message_id: "graph_custom_a",
			provider_thread_id: threadPk,
			internet_message_id: "<custom_a@outlook.example.com>",
			web_link: "https://outlook.office.com/mail/custom_a",
			subject: "A",
			from: "sender@local.test",
			to: [],
			cc: [],
			received_at: receivedAt,
			body_text: "A",
			has_attachments: false,
			attachments: [],
		};
		const messageB = {
			...messageA,
			message_pk: "custom_b",
			provider_message_id: "graph_custom_b",
			internet_message_id: "<custom_b@outlook.example.com>",
			web_link: "https://outlook.office.com/mail/custom_b",
			subject: "B",
			body_text: "B",
		};

		context.state.messages.set(messageB.message_pk, messageB);
		context.state.messages.set(messageA.message_pk, messageA);
		context.state.threadMessages.set(threadPk, [
			messageB.message_pk,
			messageA.message_pk,
		]);

		const response = invokeMcpTool(
			"mail_store.get_thread",
			{ thread_pk: threadPk, depth: 20 },
			context,
		);

		expect(response.ok).toBe(true);
		if (response.ok) {
			expect(response.data.map((m) => m.message_pk)).toEqual([
				"custom_a",
				"custom_b",
			]);
		}
	});

	test("지원 도구별 직접/이름기반 호출이 동일 상태에서 동일한 ok 플래그를 가진다", () => {
		for (const toolName of MCP_TOOL_NAMES) {
			const context = createToolContext();

			switch (toolName) {
				case "auth_store.complete_login":
					invokeMcpTool(
						"auth_store.start_login",
						{ scopes: ["Mail.Read"] },
						context,
					);
					break;
				case "auth_store.complete_login_auto": {
					invokeMcpTool(
						"auth_store.start_login",
						{ scopes: ["Mail.Read"] },
						context,
					);
					const issuedSession = context.state.issued_session;
					if (!issuedSession) {
						throw new Error("auto complete 테스트 준비 실패");
					}
					context.state.pending_callback = {
						code: "abc",
						state: issuedSession.state,
						received_at: new Date().toISOString(),
					};
					break;
				}
				case "graph_mail_sync.initial_sync":
				case "graph_mail_sync.delta_sync":
				case "graph_mail_sync.download_attachment":
				case "mail_store.get_message":
				case "mail_store.get_thread":
				case "workflow.create_evidence":
				case "workflow.upsert_todo":
				case "workflow.list":
				case "autopilot.tick":
					invokeMcpTool(
						"auth_store.start_login",
						{ scopes: ["Mail.Read"] },
						context,
					);
					completeLogin(context);
					if (toolName !== "graph_mail_sync.download_attachment") {
						invokeMcpTool(
							"graph_mail_sync.initial_sync",
							{
								mail_folder: "inbox",
								days_back: 1,
								select: ["id", "subject"],
							},
							context,
						);
					}
					if (toolName === "autopilot.tick") {
						invokeMcpTool("autopilot.set_mode", { mode: "full_auto" }, context);
					}
					break;
				case "autopilot.set_mode":
				case "autopilot.pause":
				case "autopilot.resume":
				case "autopilot.status":
					invokeMcpTool("autopilot.set_mode", { mode: "full_auto" }, context);
					break;
				default:
					break;
			}

			const input = {
				"auth_store.start_login": {
					scopes: ["Mail.Read", "User.Read"],
				},
				"auth_store.complete_login": {
					code: "abc",
					state: context.state.issued_session?.state ?? "state",
					code_verifier: "challenge",
				},
				"auth_store.complete_login_auto": {},
				"auth_store.auth_status": {},
				"auth_store.logout": {},
				"graph_mail_sync.initial_sync": {
					mail_folder: "inbox",
					days_back: 7,
					select: ["id", "subject"],
				},
				"graph_mail_sync.delta_sync": {
					mail_folder: "inbox",
				},
				"graph_mail_sync.download_attachment": {
					graph_message_id: "graph_inbox_msg_inbox_1",
					graph_attachment_id: "att_inbox_msg_inbox_1",
					message_pk: "inbox_msg_inbox_1",
				},
				"mail_store.get_message": {
					message_pk: "inbox_msg_inbox_1",
				},
				"mail_store.get_thread": {
					thread_pk: "inbox",
					depth: 20,
				},
				"workflow.create_evidence": {
					message_pk: "inbox_msg_inbox_1",
					snippet: "자동 추출 테스트",
					confidence: 0.9,
				},
				"workflow.upsert_todo": {
					title: "자동 todo 테스트",
					status: "open",
					evidence_id: "ev_123",
				},
				"workflow.list": {},
				"autopilot.set_mode": {
					mode: "full_auto",
				},
				"autopilot.pause": {},
				"autopilot.resume": {},
				"autopilot.status": {},
				"autopilot.tick": {
					mail_folder: "inbox",
					max_messages_per_tick: 5,
					max_attachments_per_tick: 2,
				},
			}[toolName as McpToolName] as never;

			const byName = invokeMcpToolByName(toolName, input, context);
			if (toolName === "auth_store.complete_login_auto" && byName.ok) {
				const issuedSession = context.state.issued_session;
				if (!issuedSession) {
					throw new Error("auto complete 재호출 테스트 준비 실패");
				}
				context.state.pending_callback = {
					code: "abc",
					state: issuedSession.state,
					received_at: new Date().toISOString(),
				};
			}
			const direct = invokeMcpTool(toolName, input as never, context);

			expect(byName.ok).toBe(direct.ok);
		}
	});
});
