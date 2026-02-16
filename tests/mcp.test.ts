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
			code_verifier: "code_verifier",
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
		expect(MCP_TOOL_NAMES.length).toBe(8);
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

		const response = invokeMcpTool(
			"auth_store.complete_login",
			{
				code: "code",
				state: "invalid",
				code_verifier: "code_verifier",
			},
			context,
		);

		expect(response.ok).toBe(false);
		if (!response.ok) {
			expect(response.error_code).toBe("E_AUTH_FAILED");
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

	test("auth_status는 로그인 상태를 정확히 노출한다", () => {
		const context = createToolContext();
		const before = invokeMcpTool("auth_store.auth_status", {}, context);
		expect(before.ok).toBe(true);
		if (before.ok) {
			expect(before.data.signed_in).toBe(false);
			expect(before.data.account).toBeNull();
		}

		invokeMcpTool("auth_store.start_login", { scopes: ["Mail.Read"] }, context);
		completeLogin(context);

		const after = invokeMcpTool("auth_store.auth_status", {}, context);
		expect(after.ok).toBe(true);
		if (after.ok) {
			expect(after.data.signed_in).toBe(true);
			expect(after.data.account?.tenant).toBe("default");
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
		}
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
			expect(response.data.changes.added).toBeGreaterThanOrEqual(1);
			expect(response.data.new_delta_link_saved).toBe(true);
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
			expect(first.data.attachment_pk).toBe("att_att_inbox_msg_inbox_1");
			expect(first.data.relative_path).toBe(
				"attachments/inbox_msg_inbox_1/att_inbox_msg_inbox_1.bin",
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
				case "graph_mail_sync.initial_sync":
				case "graph_mail_sync.delta_sync":
				case "graph_mail_sync.download_attachment":
				case "mail_store.get_message":
				case "mail_store.get_thread":
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
				"auth_store.auth_status": {},
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
			}[toolName as McpToolName] as never;

			const byName = invokeMcpToolByName(toolName, input, context);
			const direct = invokeMcpTool(toolName, input as never, context);

			expect(byName.ok).toBe(direct.ok);
		}
	});
});
