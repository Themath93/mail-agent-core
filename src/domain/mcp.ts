export type McpErrorCode =
	| "E_AUTH_REQUIRED"
	| "E_AUTH_FAILED"
	| "E_GRAPH_THROTTLED"
	| "E_NOT_FOUND"
	| "E_PARSE_FAILED"
	| "E_VIEWER_UNAVAILABLE"
	| "E_POLICY_DENIED"
	| "E_UNKNOWN";

export interface McpOk<TData> {
	ok: true;
	data: TData;
}

export interface McpError {
	ok: false;
	error_code: McpErrorCode;
	error_message: string;
	retryable: boolean;
}

export type McpResponse<TData> = McpOk<TData> | McpError;

export const okResponse = <TData>(data: TData): McpOk<TData> => ({
	ok: true,
	data,
});

export const errorResponse = (
	error_code: McpErrorCode,
	error_message: string,
	retryable = false,
): McpError => ({
	ok: false,
	error_code,
	error_message,
	retryable,
});

export const isOkResponse = <TData>(
	response: McpResponse<TData>,
): response is McpOk<TData> => response.ok;

export type McpToolName =
	| "auth_store.start_login"
	| "auth_store.complete_login"
	| "auth_store.auth_status"
	| "graph_mail_sync.initial_sync"
	| "graph_mail_sync.delta_sync"
	| "graph_mail_sync.download_attachment"
	| "mail_store.get_message"
	| "mail_store.get_thread";

export const MCP_TOOL_NAMES = [
	"auth_store.start_login",
	"auth_store.complete_login",
	"auth_store.auth_status",
	"graph_mail_sync.initial_sync",
	"graph_mail_sync.delta_sync",
	"graph_mail_sync.download_attachment",
	"mail_store.get_message",
	"mail_store.get_thread",
] as const;

export interface McpAuthAccount {
	email: string;
	tenant: string;
}

export interface AuthStoreStartLoginInput {
	scopes: readonly string[];
}

export interface AuthStoreStartLoginOutput {
	login_url: string;
	callback_url: string;
}

export interface AuthStoreCompleteLoginInput {
	code: string;
	state: string;
	code_verifier: string;
}

export interface AuthStoreCompleteLoginOutput {
	account: McpAuthAccount;
}

export type AuthStoreAuthStatusInput = Record<string, never>;

export interface AuthStoreAuthStatusOutput {
	signed_in: boolean;
	account: McpAuthAccount | null;
}

export interface GraphMailSyncInitialSyncInput {
	mail_folder: string;
	days_back: number;
	select: readonly string[];
}

export interface GraphMailSyncInitialSyncOutput {
	synced_messages: number;
	synced_attachments: number;
}

export interface GraphMailSyncDeltaSyncInput {
	mail_folder: string;
}

export interface GraphMailSyncDeltaSyncOutput {
	changes: {
		added: number;
		updated: number;
		deleted: number;
	};
	new_delta_link_saved: boolean;
}

export interface GraphMailSyncDownloadAttachmentInput {
	graph_message_id: string;
	graph_attachment_id: string;
	message_pk: string;
}

export interface GraphMailSyncDownloadAttachmentOutput {
	attachment_pk: string;
	sha256: string;
	relative_path: string;
	size_bytes: number;
}

export interface MailStoreGetMessageInput {
	message_pk: string;
}

export interface MailStoreMessage {
	message_pk: string;
	provider_message_id: string;
	provider_thread_id: string;
	internet_message_id: string;
	web_link: string;
	subject: string;
	from: string;
	to: readonly string[];
	cc: readonly string[];
	received_at: string;
	body_text: string;
	has_attachments: boolean;
	attachments: readonly string[];
}

export interface MailStoreGetMessageOutput {
	message: MailStoreMessage;
}

export interface MailStoreGetThreadInput {
	thread_pk: string;
	depth: number;
}

export type MailStoreGetThreadOutput = MailStoreMessage[];

export type McpToolInput = {
	"auth_store.start_login": AuthStoreStartLoginInput;
	"auth_store.complete_login": AuthStoreCompleteLoginInput;
	"auth_store.auth_status": AuthStoreAuthStatusInput;
	"graph_mail_sync.initial_sync": GraphMailSyncInitialSyncInput;
	"graph_mail_sync.delta_sync": GraphMailSyncDeltaSyncInput;
	"graph_mail_sync.download_attachment": GraphMailSyncDownloadAttachmentInput;
	"mail_store.get_message": MailStoreGetMessageInput;
	"mail_store.get_thread": MailStoreGetThreadInput;
};

export type McpToolOutput = {
	"auth_store.start_login": AuthStoreStartLoginOutput;
	"auth_store.complete_login": AuthStoreCompleteLoginOutput;
	"auth_store.auth_status": AuthStoreAuthStatusOutput;
	"graph_mail_sync.initial_sync": GraphMailSyncInitialSyncOutput;
	"graph_mail_sync.delta_sync": GraphMailSyncDeltaSyncOutput;
	"graph_mail_sync.download_attachment": GraphMailSyncDownloadAttachmentOutput;
	"mail_store.get_message": MailStoreGetMessageOutput;
	"mail_store.get_thread": MailStoreGetThreadOutput;
};

export type McpToolResponse<ToolName extends McpToolName> = McpResponse<
	McpToolOutput[ToolName]
>;

export interface McpAuthSession {
	account: McpAuthAccount;
	scopes: readonly string[];
	state: string;
	issued_at: string;
}

export interface McpAttachmentRecord {
	attachment_pk: string;
	graph_message_id: string;
	graph_attachment_id: string;
	message_pk: string;
	relative_path: string;
	size_bytes: number;
	sha256: string;
}

export interface McpRuntimeState {
	account: McpAuthAccount | null;
	issued_session: McpAuthSession | null;
	messages: Map<string, MailStoreMessage>;
	threadMessages: Map<string, string[]>;
	attachments: Map<string, McpAttachmentRecord>;
	deltaLinks: Map<string, string>;
	signed_in: boolean;
}

export interface McpRuntimeContext {
	state: McpRuntimeState;
}

const fallbackUrl = "http://127.0.0.1:1270/mcp/callback";

const buildDefaultMessage = (
	threadPk: string,
	messageIndex: number,
	folder: string,
	hasAttachments = false,
): MailStoreMessage => {
	const now = new Date(Date.now() - messageIndex * 60_000).toISOString();
	const messagePk = `${folder}_msg_${threadPk}_${messageIndex + 1}`;

	return {
		message_pk: messagePk,
		provider_message_id: `graph_${messagePk}`,
		provider_thread_id: threadPk,
		internet_message_id: `<${messagePk}@outlook.example.com>`,
		web_link: `https://outlook.office.com/mail/${messagePk}`,
		subject: `동기화 메시지 ${messageIndex + 1}`,
		from: "sender@local.test",
		to: [],
		cc: [],
		received_at: now,
		body_text: `샘플 본문 ${messageIndex + 1}`,
		has_attachments: hasAttachments,
		attachments: [],
	};
};

const hasSignedIn = (context: McpRuntimeContext): boolean =>
	context.state.signed_in && context.state.account !== null;

const createRuntimeState = (): McpRuntimeState => ({
	account: null,
	issued_session: null,
	messages: new Map(),
	threadMessages: new Map(),
	attachments: new Map(),
	deltaLinks: new Map(),
	signed_in: false,
});

export const createMcpContext = (
	initial?: Partial<McpRuntimeState>,
): McpRuntimeContext => ({
	state: {
		...createRuntimeState(),
		...initial,
	},
});

export const resetMcpContext = (context: McpRuntimeContext): void => {
	context.state = createRuntimeState();
};

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === "string" && value.trim().length > 0;

const isArrayOfNonEmptyStrings = (
	value: unknown,
): value is readonly string[] => {
	if (!Array.isArray(value)) {
		return false;
	}

	return value.every(isNonEmptyString);
};

const isPositiveInteger = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value > 0;

const isMcpToolName = (value: string): value is McpToolName =>
	(MCP_TOOL_NAMES as readonly string[]).includes(value);

export const isSupportedMcpTool = (toolName: string): toolName is McpToolName =>
	isMcpToolName(toolName);

const generateLoginState = (): string =>
	`state_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

const buildDeltaLink = (mailFolder: string): string =>
	`${mailFolder}_${Date.now()}_delta`;

const isValidAuthInput = (input: AuthStoreStartLoginInput): boolean => {
	return isArrayOfNonEmptyStrings(input.scopes) && input.scopes.length > 0;
};

const createAttachmentRecord = (
	input: GraphMailSyncDownloadAttachmentInput,
): McpAttachmentRecord => ({
	attachment_pk: `att_${input.graph_attachment_id}`,
	graph_message_id: input.graph_message_id,
	graph_attachment_id: input.graph_attachment_id,
	message_pk: input.message_pk,
	relative_path: `attachments/${input.message_pk}/${input.graph_attachment_id}.bin`,
	sha256: `sha256_${input.graph_message_id.slice(0, 8)}`,
	size_bytes: 1024,
});

const parseAttachmentLookupKey = (
	input: GraphMailSyncDownloadAttachmentInput,
): string =>
	`${input.message_pk}::${input.graph_message_id}::${input.graph_attachment_id}`;

const setThreadMessages = (
	context: McpRuntimeContext,
	threadPk: string,
	messagePk: string,
) => {
	const current = context.state.threadMessages.get(threadPk) ?? [];
	if (!current.includes(messagePk)) {
		context.state.threadMessages.set(threadPk, [...current, messagePk]);
	}
};

const addMessage = (
	context: McpRuntimeContext,
	threadPk: string,
	message: MailStoreMessage,
) => {
	context.state.messages.set(message.message_pk, message);
	setThreadMessages(context, threadPk, message.message_pk);
};

const hasContextSignedIn = (context: McpRuntimeContext): boolean =>
	context.state.signed_in && context.state.account !== null;

const handleAuthStoreStartLogin = (
	context: McpRuntimeContext,
	input: AuthStoreStartLoginInput,
) => {
	if (!isValidAuthInput(input)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"scopes 는 비어있지 않은 문자열 목록이어야 합니다.",
		);
	}

	const loginState = generateLoginState();
	context.state.issued_session = {
		account: {
			email: "",
			tenant: "",
		},
		scopes: input.scopes,
		state: loginState,
		issued_at: new Date().toISOString(),
	};

	return okResponse<AuthStoreStartLoginOutput>({
		login_url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?response_type=code&scope=${encodeURIComponent(
			input.scopes.join(" "),
		)}&state=${encodeURIComponent(loginState)}&redirect_uri=${encodeURIComponent(
			fallbackUrl,
		)}`,
		callback_url: fallbackUrl,
	});
};

const handleAuthStoreCompleteLogin = (
	context: McpRuntimeContext,
	input: AuthStoreCompleteLoginInput,
) => {
	if (!isNonEmptyString(input.code) || !isNonEmptyString(input.state)) {
		return errorResponse("E_PARSE_FAILED", "code/state 가 누락되었습니다.");
	}

	if (!isNonEmptyString(input.code_verifier)) {
		return errorResponse("E_PARSE_FAILED", "code_verifier 가 누락되었습니다.");
	}

	if (context.state.issued_session === null) {
		return errorResponse("E_AUTH_REQUIRED", "로그인 시작 정보가 없습니다.");
	}

	if (context.state.issued_session.state !== input.state) {
		return errorResponse("E_AUTH_FAILED", "state 값이 일치하지 않습니다.");
	}

	const account = {
		email: "user@localhost",
		tenant: "default",
	};
	context.state.account = account;
	context.state.signed_in = true;

	return okResponse<AuthStoreCompleteLoginOutput>({ account });
};

const handleAuthStoreAuthStatus = (
	context: McpRuntimeContext,
	_input: AuthStoreAuthStatusInput,
) =>
	okResponse<AuthStoreAuthStatusOutput>({
		signed_in: hasContextSignedIn(context),
		account: context.state.account,
	});

const handleGraphInitialSync = (
	context: McpRuntimeContext,
	input: GraphMailSyncInitialSyncInput,
) => {
	if (!hasContextSignedIn(context)) {
		return errorResponse("E_AUTH_REQUIRED", "로그인이 필요합니다.");
	}

	if (!isNonEmptyString(input.mail_folder)) {
		return errorResponse("E_PARSE_FAILED", "mail_folder 가 누락되었습니다.");
	}

	if (!isPositiveInteger(input.days_back)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"days_back 는 양의 정수여야 합니다.",
		);
	}

	if (!isArrayOfNonEmptyStrings(input.select) || input.select.length === 0) {
		return errorResponse("E_PARSE_FAILED", "select 는 비어있지 않아야 합니다.");
	}

	const syncedMessages = Math.min(input.days_back, 3);
	let syncedAttachments = 0;
	const threadPk = input.mail_folder;

	for (let index = 0; index < syncedMessages; index += 1) {
		const hasAttachment = index % 2 === 0;
		const message = buildDefaultMessage(
			threadPk,
			index,
			input.mail_folder,
			hasAttachment,
		);
		addMessage(context, threadPk, message);

		if (hasAttachment) {
			syncedAttachments += 1;
			const attachmentInput: GraphMailSyncDownloadAttachmentInput = {
				graph_message_id: message.provider_message_id,
				graph_attachment_id: `att_${message.message_pk}`,
				message_pk: message.message_pk,
			};
			const attachment = createAttachmentRecord(attachmentInput);
			context.state.attachments.set(
				parseAttachmentLookupKey(attachmentInput),
				attachment,
			);
			context.state.messages.set(message.message_pk, {
				...message,
				has_attachments: true,
				attachments: [attachment.attachment_pk],
			});
		}
	}

	context.state.deltaLinks.set(
		input.mail_folder,
		buildDeltaLink(input.mail_folder),
	);

	return okResponse<GraphMailSyncInitialSyncOutput>({
		synced_messages: syncedMessages,
		synced_attachments: syncedAttachments,
	});
};

const handleGraphDeltaSync = (
	context: McpRuntimeContext,
	input: GraphMailSyncDeltaSyncInput,
) => {
	if (!hasContextSignedIn(context)) {
		return errorResponse("E_AUTH_REQUIRED", "로그인이 필요합니다.");
	}

	if (!isNonEmptyString(input.mail_folder)) {
		return errorResponse("E_PARSE_FAILED", "mail_folder 가 누락되었습니다.");
	}

	const threadPk = input.mail_folder;
	const existingThreadMessages =
		context.state.threadMessages.get(threadPk) ?? [];
	const changes = {
		added: 1,
		updated: existingThreadMessages.length > 0 ? 1 : 0,
		deleted: 0,
	};

	if (existingThreadMessages.length > 0) {
		const target = existingThreadMessages[0] ?? "";
		const targetMessage = context.state.messages.get(target);
		if (targetMessage) {
			context.state.messages.set(targetMessage.message_pk, {
				...targetMessage,
				subject: `갱신 ${targetMessage.subject}`,
			});
		}
	}

	const addedMessage = buildDefaultMessage(
		threadPk,
		existingThreadMessages.length,
		input.mail_folder,
		true,
	);
	addMessage(context, threadPk, addedMessage);
	const attachmentInput: GraphMailSyncDownloadAttachmentInput = {
		graph_message_id: addedMessage.provider_message_id,
		graph_attachment_id: `att_delta_${addedMessage.message_pk}`,
		message_pk: addedMessage.message_pk,
	};
	const attachment = createAttachmentRecord(attachmentInput);
	context.state.attachments.set(
		parseAttachmentLookupKey(attachmentInput),
		attachment,
	);
	context.state.messages.set(addedMessage.message_pk, {
		...addedMessage,
		has_attachments: true,
		attachments: [attachment.attachment_pk],
	});
	context.state.deltaLinks.set(
		input.mail_folder,
		buildDeltaLink(input.mail_folder),
	);

	return okResponse<GraphMailSyncDeltaSyncOutput>({
		changes,
		new_delta_link_saved: true,
	});
};

const handleGraphDownloadAttachment = (
	context: McpRuntimeContext,
	input: GraphMailSyncDownloadAttachmentInput,
) => {
	if (!hasContextSignedIn(context)) {
		return errorResponse("E_AUTH_REQUIRED", "로그인이 필요합니다.");
	}

	if (!isNonEmptyString(input.graph_message_id)) {
		return errorResponse("E_PARSE_FAILED", "graph_message_id 가 비어있습니다.");
	}

	if (!isNonEmptyString(input.graph_attachment_id)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"graph_attachment_id 가 비어있습니다.",
		);
	}

	if (!isNonEmptyString(input.message_pk)) {
		return errorResponse("E_PARSE_FAILED", "message_pk 가 비어있습니다.");
	}

	const message = context.state.messages.get(input.message_pk);
	if (!message) {
		return errorResponse(
			"E_NOT_FOUND",
			"요청한 message_pk 를 찾을 수 없습니다.",
		);
	}

	const existingAttachment = context.state.attachments.get(
		parseAttachmentLookupKey(input),
	);
	if (existingAttachment) {
		return okResponse<GraphMailSyncDownloadAttachmentOutput>({
			attachment_pk: existingAttachment.attachment_pk,
			sha256: existingAttachment.sha256,
			relative_path: existingAttachment.relative_path,
			size_bytes: existingAttachment.size_bytes,
		});
	}

	const record = createAttachmentRecord(input);
	context.state.attachments.set(parseAttachmentLookupKey(input), record);
	context.state.messages.set(input.message_pk, {
		...message,
		has_attachments: true,
		attachments: [...message.attachments, record.attachment_pk],
	});

	return okResponse<GraphMailSyncDownloadAttachmentOutput>({
		attachment_pk: record.attachment_pk,
		sha256: record.sha256,
		relative_path: record.relative_path,
		size_bytes: record.size_bytes,
	});
};

const handleMailGetMessage = (
	context: McpRuntimeContext,
	input: MailStoreGetMessageInput,
) => {
	if (!hasContextSignedIn(context)) {
		return errorResponse("E_AUTH_REQUIRED", "로그인이 필요합니다.");
	}

	if (!isNonEmptyString(input.message_pk)) {
		return errorResponse("E_PARSE_FAILED", "message_pk 가 비어있습니다.");
	}

	const message = context.state.messages.get(input.message_pk);
	if (!message) {
		return errorResponse(
			"E_NOT_FOUND",
			"요청한 message_pk 를 찾을 수 없습니다.",
		);
	}

	return okResponse<MailStoreGetMessageOutput>({
		message: {
			...message,
		},
	});
};

const handleMailGetThread = (
	context: McpRuntimeContext,
	input: MailStoreGetThreadInput,
) => {
	if (!hasContextSignedIn(context)) {
		return errorResponse("E_AUTH_REQUIRED", "로그인이 필요합니다.");
	}

	if (!isNonEmptyString(input.thread_pk)) {
		return errorResponse("E_PARSE_FAILED", "thread_pk 가 비어있습니다.");
	}

	if (!isPositiveInteger(input.depth)) {
		return errorResponse("E_PARSE_FAILED", "depth 는 양의 정수여야 합니다.");
	}

	const messagePks = context.state.threadMessages.get(input.thread_pk) ?? [];
	if (messagePks.length === 0) {
		return errorResponse("E_NOT_FOUND", "thread 를 찾을 수 없습니다.");
	}

	const threadMessages = messagePks
		.slice(0, input.depth)
		.map((messagePk) => context.state.messages.get(messagePk))
		.filter((message): message is MailStoreMessage => message !== undefined);

	if (threadMessages.length === 0) {
		return errorResponse("E_NOT_FOUND", "thread 를 찾을 수 없습니다.");
	}

	return okResponse<MailStoreGetThreadOutput>(threadMessages);
};

const MCP_TOOL_HANDLERS: {
	[K in McpToolName]: (
		context: McpRuntimeContext,
		input: McpToolInput[K],
	) => McpToolResponse<K>;
} = {
	"auth_store.start_login": (context, input) =>
		handleAuthStoreStartLogin(context, input),
	"auth_store.complete_login": (context, input) =>
		handleAuthStoreCompleteLogin(context, input),
	"auth_store.auth_status": (context, input) =>
		handleAuthStoreAuthStatus(context, input),
	"graph_mail_sync.initial_sync": (context, input) =>
		handleGraphInitialSync(context, input),
	"graph_mail_sync.delta_sync": (context, input) =>
		handleGraphDeltaSync(context, input),
	"graph_mail_sync.download_attachment": (context, input) =>
		handleGraphDownloadAttachment(context, input),
	"mail_store.get_message": (context, input) =>
		handleMailGetMessage(context, input),
	"mail_store.get_thread": (context, input) =>
		handleMailGetThread(context, input),
} as const;
const defaultContext = createMcpContext();

type McpToolHandler = <ToolName extends McpToolName>(
	context: McpRuntimeContext,
	input: McpToolInput[ToolName],
) => McpToolResponse<ToolName>;

export const invokeMcpTool = <ToolName extends McpToolName>(
	toolName: ToolName,
	input: McpToolInput[ToolName],
	context: McpRuntimeContext = defaultContext,
): McpToolResponse<ToolName> =>
	(MCP_TOOL_HANDLERS[toolName] as McpToolHandler)(
		context,
		input,
	) as McpToolResponse<ToolName>;

export const invokeMcpToolByName = (
	toolName: string,
	input: unknown,
	context: McpRuntimeContext = defaultContext,
): McpResponse<unknown> => {
	if (!isSupportedMcpTool(toolName)) {
		return errorResponse(
			"E_UNKNOWN",
			`${toolName} 은(는) 지원되지 않는 MCP 도구입니다.`,
		);
	}

	if (input === null || typeof input !== "object" || Array.isArray(input)) {
		return errorResponse("E_PARSE_FAILED", "요청 본문은 객체여야 합니다.");
	}

	return invokeMcpTool(toolName, input as never, context);
};
