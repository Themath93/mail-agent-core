import { createHash, randomBytes } from "node:crypto";

import {
	createMcpStorage,
	createStateStorageAdapter,
} from "../storage/interface.js";
import type { McpStorage } from "../storage/interface.js";

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
	| "auth_store.complete_login_auto"
	| "auth_store.auth_status"
	| "graph_mail_sync.initial_sync"
	| "graph_mail_sync.delta_sync"
	| "graph_mail_sync.download_attachment"
	| "mail_store.get_message"
	| "mail_store.get_thread";

export const MCP_TOOL_NAMES = [
	"auth_store.start_login",
	"auth_store.complete_login",
	"auth_store.complete_login_auto",
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

export type AuthStoreCompleteLoginAutoInput = Record<string, never>;

export interface AuthStoreCompleteLoginAutoOutput {
	account: McpAuthAccount;
}

export type AuthStoreAuthStatusInput = Record<string, never>;

export interface AuthStoreAuthStatusOutput {
	signed_in: boolean;
	account: McpAuthAccount | null;
	access_token_expires_at?: string;
	pending_callback_received: boolean;
	pending_callback_received_at?: string;
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
	message_pk?: string;
	message_id?: string;
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
	thread_pk?: string;
	thread_id?: string;
	depth: number;
}

export type MailStoreGetThreadOutput = MailStoreMessage[];

export type McpToolInput = {
	"auth_store.start_login": AuthStoreStartLoginInput;
	"auth_store.complete_login": AuthStoreCompleteLoginInput;
	"auth_store.complete_login_auto": AuthStoreCompleteLoginAutoInput;
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
	"auth_store.complete_login_auto": AuthStoreCompleteLoginAutoOutput;
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
	code_verifier: string;
	code_challenge: string;
	issued_at: string;
}

export interface McpAuthToken {
	access_token: string;
	refresh_token: string;
	token_type: "Bearer";
	refresh_token_expires_at: string;
	expires_at: string;
	issued_at: string;
}

export interface McpPendingCallback {
	code: string;
	state: string;
	received_at: string;
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

interface McpAttachmentContentMeta {
	attachment_pk: string;
	relative_path: string;
	size_bytes: number;
	sha256: string;
}

export interface McpRuntimeState {
	account: McpAuthAccount | null;
	issued_session: McpAuthSession | null;
	pending_callback: McpPendingCallback | null;
	messages: Map<string, MailStoreMessage>;
	threadMessages: Map<string, string[]>;
	attachments: Map<string, McpAttachmentRecord>;
	attachmentContentBySha: Map<string, McpAttachmentContentMeta>;
	deltaLinks: Map<string, string>;
	signed_in: boolean;
	auth_token: McpAuthToken | null;
}

export interface McpRuntimeContext {
	state: McpRuntimeState;
	storage: McpStorage;
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
	pending_callback: null,
	messages: new Map(),
	threadMessages: new Map(),
	attachments: new Map(),
	attachmentContentBySha: new Map(),
	deltaLinks: new Map(),
	signed_in: false,
	auth_token: null,
});

export const createMcpContext = (
	initial?: Partial<McpRuntimeState>,
): McpRuntimeContext => ({
	state: {
		...createRuntimeState(),
		...initial,
	},
	storage: (() => {
		const state = {
			...createRuntimeState(),
			...initial,
		};
		const adapter = createStateStorageAdapter(state);
		return createMcpStorage(adapter);
	})(),
});

export const resetMcpContext = (context: McpRuntimeContext): void => {
	const next = createRuntimeState();
	context.state = next;
	context.storage = createMcpStorage(createStateStorageAdapter(next));
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

const isMailStoreMessageRecord = (
	value: unknown,
): value is MailStoreMessage => {
	if (value === null || typeof value !== "object") {
		return false;
	}

	const candidate = value as Partial<MailStoreMessage>;
	return (
		isNonEmptyString(candidate.message_pk) &&
		isNonEmptyString(candidate.provider_message_id) &&
		isNonEmptyString(candidate.provider_thread_id) &&
		isNonEmptyString(candidate.internet_message_id) &&
		isNonEmptyString(candidate.web_link) &&
		isNonEmptyString(candidate.subject) &&
		isNonEmptyString(candidate.from) &&
		isArrayOfNonEmptyStrings(candidate.to) &&
		isArrayOfNonEmptyStrings(candidate.cc) &&
		isNonEmptyString(candidate.received_at) &&
		isNonEmptyString(candidate.body_text) &&
		typeof candidate.has_attachments === "boolean" &&
		isArrayOfNonEmptyStrings(candidate.attachments)
	);
};

const resolveMailMessagePk = (
	input: MailStoreGetMessageInput,
): string | null => {
	if (isNonEmptyString(input.message_pk)) {
		return input.message_pk.trim();
	}

	if (isNonEmptyString(input.message_id)) {
		return input.message_id.trim();
	}

	return null;
};

const resolveMailThreadPk = (input: MailStoreGetThreadInput): string | null => {
	if (isNonEmptyString(input.thread_pk)) {
		return input.thread_pk.trim();
	}

	if (isNonEmptyString(input.thread_id)) {
		return input.thread_id.trim();
	}

	return null;
};

const isMcpToolName = (value: string): value is McpToolName =>
	(MCP_TOOL_NAMES as readonly string[]).includes(value);

export const isSupportedMcpTool = (toolName: string): toolName is McpToolName =>
	isMcpToolName(toolName);

const generateLoginState = (): string =>
	`state_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

const nowIso = (): string => new Date().toISOString();

const generateCodeVerifier = (): string =>
	randomBytes(48).toString("base64url").slice(0, 96);

const generateCodeChallenge = (codeVerifier: string): string =>
	createHash("sha256").update(codeVerifier).digest("base64url");

const isTokenExpired = (value: string): boolean => {
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) {
		return true;
	}

	return parsed <= Date.now();
};

const isTokenValid = (token: McpAuthToken | null): boolean => {
	if (token === null) {
		return false;
	}

	return !isTokenExpired(token.expires_at);
};

const isRefreshTokenValid = (token: McpAuthToken): boolean =>
	!isTokenExpired(token.refresh_token_expires_at);

const nextTokenNonce = (): string =>
	`${Date.now()}_${randomBytes(3).toString("hex")}`;

const createMockAccessToken = (): string => `access_${nextTokenNonce()}`;

const createMockRefreshToken = (): string => `refresh_${nextTokenNonce()}`;

const buildAuthToken = (sessionState: McpAuthSession): McpAuthToken => ({
	access_token: createMockAccessToken(),
	refresh_token: createMockRefreshToken(),
	token_type: "Bearer",
	issued_at: nowIso(),
	expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
	refresh_token_expires_at: new Date(
		Date.now() + 24 * 60 * 60 * 1000,
	).toISOString(),
});

const refreshAuthToken = (context: McpRuntimeContext): boolean => {
	if (
		context.state.auth_token === null ||
		!isRefreshTokenValid(context.state.auth_token)
	) {
		return false;
	}

	context.state.auth_token = {
		...context.state.auth_token,
		access_token: createMockAccessToken(),
		expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
		issued_at: nowIso(),
	};

	return true;
};

const requireAuthenticatedContext = (context: McpRuntimeContext) => {
	if (!context.state.signed_in || context.state.account === null) {
		return errorResponse("E_AUTH_REQUIRED", "로그인이 필요합니다.");
	}

	if (isTokenValid(context.state.auth_token)) {
		return null;
	}

	if (context.state.auth_token === null) {
		return errorResponse("E_AUTH_REQUIRED", "로그인이 필요합니다.");
	}

	if (!isRefreshTokenValid(context.state.auth_token)) {
		context.state.signed_in = false;
		context.state.account = null;
		context.state.auth_token = null;
		context.state.issued_session = null;
		return errorResponse(
			"E_AUTH_FAILED",
			"refresh token이 만료되어 재로그인이 필요합니다.",
			true,
		);
	}

	const refreshed = refreshAuthToken(context);
	if (!refreshed) {
		context.state.signed_in = false;
		context.state.account = null;
		context.state.auth_token = null;
		context.state.issued_session = null;
		return errorResponse("E_AUTH_FAILED", "인증 갱신에 실패했습니다.", true);
	}

	return null;
};

const buildDeltaLink = (mailFolder: string): string =>
	`${mailFolder}_${Date.now()}_delta`;

const parseDeltaLink = (
	mailFolder: string,
	deltaLink: string,
): { folder: string; issuedAt: number } | null => {
	const marker = "_delta";
	if (!deltaLink.endsWith(marker)) {
		return null;
	}

	const withoutMarker = deltaLink.slice(0, -marker.length);
	const separatorIndex = withoutMarker.lastIndexOf("_");
	if (separatorIndex <= 0) {
		return null;
	}

	const folder = withoutMarker.slice(0, separatorIndex);
	const issuedAtRaw = withoutMarker.slice(separatorIndex + 1);
	if (folder !== mailFolder || !/^\d+$/.test(issuedAtRaw)) {
		return null;
	}

	return {
		folder,
		issuedAt: Number(issuedAtRaw),
	};
};

const MAX_DAYS_BACK = 30;

interface ParsedInitialSyncInput {
	mailFolder: string;
	daysBack: number;
	select: readonly string[];
}

const parseInitialSyncInput = (
	input: GraphMailSyncInitialSyncInput,
): McpResponse<ParsedInitialSyncInput> => {
	if (!isNonEmptyString(input.mail_folder)) {
		return errorResponse("E_PARSE_FAILED", "mail_folder 가 누락되었습니다.");
	}

	if (!isPositiveInteger(input.days_back)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"days_back 는 양의 정수여야 합니다.",
		);
	}

	if (input.days_back > MAX_DAYS_BACK) {
		return errorResponse(
			"E_GRAPH_THROTTLED",
			`days_back 는 ${MAX_DAYS_BACK}일 이하여야 합니다.`,
			true,
		);
	}

	if (!isArrayOfNonEmptyStrings(input.select) || input.select.length === 0) {
		return errorResponse("E_PARSE_FAILED", "select 는 비어있지 않아야 합니다.");
	}

	return okResponse({
		mailFolder: input.mail_folder.trim(),
		daysBack: input.days_back,
		select: input.select,
	});
};

const isValidAuthInput = (input: AuthStoreStartLoginInput): boolean => {
	return isArrayOfNonEmptyStrings(input.scopes) && input.scopes.length > 0;
};

const createAttachmentRecord = (
	input: GraphMailSyncDownloadAttachmentInput,
	sha256: string,
	attachmentPk: string,
	sizeBytes: number,
	relativePath: string,
): McpAttachmentRecord => ({
	attachment_pk: attachmentPk,
	graph_message_id: input.graph_message_id,
	graph_attachment_id: input.graph_attachment_id,
	message_pk: input.message_pk,
	relative_path: relativePath,
	sha256,
	size_bytes: sizeBytes,
});

const buildAttachmentSha256 = (
	input: GraphMailSyncDownloadAttachmentInput,
): string =>
	createHash("sha256")
		.update(`${input.graph_message_id}::${input.graph_attachment_id}`)
		.digest("hex");

const buildAttachmentMeta = (sha256: string): McpAttachmentContentMeta => {
	const attachmentPk = `att_${sha256.slice(0, 16)}`;
	return {
		attachment_pk: attachmentPk,
		relative_path: `attachments/${sha256.slice(0, 2)}/${sha256}.bin`,
		size_bytes: 1024,
		sha256,
	};
};

const resolveAttachmentRecord = (
	context: McpRuntimeContext,
	input: GraphMailSyncDownloadAttachmentInput,
) => {
	const lookupKey = parseAttachmentLookupKey(input);
	const existing = context.state.attachments.get(lookupKey);
	if (existing !== undefined) {
		return { record: existing, created: false };
	}

	const sha256 = buildAttachmentSha256(input);
	const cached = context.state.attachmentContentBySha.get(sha256);
	const baseMeta =
		cached ??
		(() => {
			const next = buildAttachmentMeta(sha256);
			context.state.attachmentContentBySha.set(sha256, next);
			return next;
		})();

	const record = createAttachmentRecord(
		input,
		baseMeta.sha256,
		baseMeta.attachment_pk,
		baseMeta.size_bytes,
		baseMeta.relative_path,
	);

	context.state.attachments.set(lookupKey, record);

	return { record, created: cached === undefined };
};

const parseAttachmentLookupKey = (
	input: GraphMailSyncDownloadAttachmentInput,
): string => `${input.graph_message_id}::${input.graph_attachment_id}`;

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

const mergeAttachmentPks = (
	current: readonly string[],
	next: readonly string[],
): string[] => {
	const attachmentPks = [...current, ...next];
	return attachmentPks.filter(
		(attachmentPk, index) => attachmentPks.indexOf(attachmentPk) === index,
	);
};

const removeMessageAndAttachments = (
	context: McpRuntimeContext,
	messagePk: string,
): void => {
	context.state.messages.delete(messagePk);
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
	context.state.signed_in && context.state.account !== null
		? requireAuthenticatedContext(context) === null
		: false;

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
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = generateCodeChallenge(codeVerifier);
	context.state.issued_session = {
		account: {
			email: "",
			tenant: "",
		},
		scopes: input.scopes,
		state: loginState,
		code_verifier: codeVerifier,
		code_challenge: codeChallenge,
		issued_at: nowIso(),
	};
	context.state.pending_callback = null;

	return okResponse<AuthStoreStartLoginOutput>({
		login_url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?response_type=code&scope=${encodeURIComponent(
			input.scopes.join(" "),
		)}&state=${encodeURIComponent(loginState)}&redirect_uri=${encodeURIComponent(
			fallbackUrl,
		)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`,
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

	if (input.code_verifier !== context.state.issued_session.code_verifier) {
		return errorResponse(
			"E_AUTH_FAILED",
			"code_verifier 값이 일치하지 않습니다.",
		);
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
	context.state.pending_callback = null;
	context.state.auth_token = buildAuthToken(context.state.issued_session);

	return okResponse<AuthStoreCompleteLoginOutput>({ account });
};

const handleAuthStoreCompleteLoginAuto = (
	context: McpRuntimeContext,
	_input: AuthStoreCompleteLoginAutoInput,
) => {
	if (context.state.pending_callback === null) {
		return errorResponse(
			"E_NOT_FOUND",
			"자동 완료 대기 중인 callback code가 없습니다.",
			true,
		);
	}

	if (context.state.issued_session === null) {
		return errorResponse("E_AUTH_REQUIRED", "로그인 시작 정보가 없습니다.");
	}

	return handleAuthStoreCompleteLogin(context, {
		code: context.state.pending_callback.code,
		state: context.state.pending_callback.state,
		code_verifier: context.state.issued_session.code_verifier,
	});
};

const handleAuthStoreAuthStatus = (
	context: McpRuntimeContext,
	_input: AuthStoreAuthStatusInput,
) =>
	okResponse<AuthStoreAuthStatusOutput>({
		signed_in: hasContextSignedIn(context),
		account: context.state.account,
		...(context.state.auth_token
			? { access_token_expires_at: context.state.auth_token.expires_at }
			: {}),
		...(context.state.pending_callback
			? {
					pending_callback_received: true,
					pending_callback_received_at:
						context.state.pending_callback.received_at,
				}
			: { pending_callback_received: false }),
	});

const handleGraphInitialSync = (
	context: McpRuntimeContext,
	input: GraphMailSyncInitialSyncInput,
) => {
	const authError = requireAuthenticatedContext(context);
	if (authError !== null) {
		return authError;
	}

	const parsedInput = parseInitialSyncInput(input);
	if (!parsedInput.ok) {
		return parsedInput;
	}

	const { mailFolder, daysBack } = parsedInput.data;

	const syncedMessages = Math.min(daysBack, 3);
	let syncedAttachments = 0;
	let syncedMessageCount = 0;
	const threadPk = mailFolder;

	for (let index = 0; index < syncedMessages; index += 1) {
		const hasAttachment = index % 2 === 0;
		const message = buildDefaultMessage(
			threadPk,
			index,
			mailFolder,
			hasAttachment,
		);
		const existingMessage = context.state.messages.get(message.message_pk);
		let attachmentPks = existingMessage?.attachments ?? [];

		if (hasAttachment) {
			const attachmentInput: GraphMailSyncDownloadAttachmentInput = {
				graph_message_id: message.provider_message_id,
				graph_attachment_id: `att_${message.message_pk}`,
				message_pk: message.message_pk,
			};
			const { created, record } = resolveAttachmentRecord(
				context,
				attachmentInput,
			);

			if (created) {
				syncedAttachments += 1;
			}

			attachmentPks = mergeAttachmentPks(attachmentPks, [record.attachment_pk]);
		}

		const normalizedMessage = {
			...message,
			has_attachments: attachmentPks.length > 0,
			attachments: attachmentPks,
		};

		if (context.state.messages.get(message.message_pk) === undefined) {
			syncedMessageCount += 1;
		}

		addMessage(context, threadPk, normalizedMessage);
	}

	const currentDeltaLink = context.state.deltaLinks.get(mailFolder);
	const shouldUpdateDeltaLink =
		currentDeltaLink === undefined ||
		syncedMessageCount > 0 ||
		syncedAttachments > 0;

	if (shouldUpdateDeltaLink) {
		context.state.deltaLinks.set(mailFolder, buildDeltaLink(mailFolder));
	}

	return okResponse<GraphMailSyncInitialSyncOutput>({
		synced_messages: syncedMessageCount,
		synced_attachments: syncedAttachments,
	});
};

const handleGraphDeltaSync = (
	context: McpRuntimeContext,
	input: GraphMailSyncDeltaSyncInput,
) => {
	const authError = requireAuthenticatedContext(context);
	if (authError !== null) {
		return authError;
	}

	if (!isNonEmptyString(input.mail_folder)) {
		return errorResponse("E_PARSE_FAILED", "mail_folder 가 누락되었습니다.");
	}

	const mailFolder = input.mail_folder.trim();
	const currentDeltaLink = context.state.deltaLinks.get(mailFolder);
	if (currentDeltaLink === undefined) {
		return errorResponse(
			"E_GRAPH_THROTTLED",
			"delta link 가 없습니다. initial_sync 를 먼저 실행하세요.",
			true,
		);
	}

	if (parseDeltaLink(mailFolder, currentDeltaLink) === null) {
		return errorResponse(
			"E_PARSE_FAILED",
			"delta link 형식이 올바르지 않습니다.",
		);
	}

	const threadPk = mailFolder;
	let existingThreadMessages = context.state.threadMessages.get(threadPk) ?? [];

	if (existingThreadMessages.length === 0) {
		return errorResponse("E_NOT_FOUND", "delta 동기화 대상 메시지가 없습니다.");
	}

	const missingMessagePk = existingThreadMessages.find(
		(messagePk) => !context.state.messages.has(messagePk),
	);
	if (missingMessagePk !== undefined) {
		return errorResponse(
			"E_NOT_FOUND",
			`delta 동기화 메시지 불일치: ${missingMessagePk}`,
		);
	}

	const hasThreadCollision = existingThreadMessages.some((messagePk) => {
		const message = context.state.messages.get(messagePk);
		return message !== undefined && message.provider_thread_id !== threadPk;
	});
	if (hasThreadCollision) {
		return errorResponse(
			"E_PARSE_FAILED",
			"thread 충돌이 감지되어 delta 동기화를 중단했습니다.",
		);
	}

	let deletedCount = 0;
	let updatedCount = 0;
	let addedCount = 0;

	if (existingThreadMessages.length >= 3) {
		const deletedMessagePk = existingThreadMessages[0] ?? "";
		existingThreadMessages = existingThreadMessages.slice(1);
		removeMessageAndAttachments(context, deletedMessagePk);
		deletedCount += 1;
	}

	if (existingThreadMessages.length > 0) {
		const targetMessagePk = existingThreadMessages[0] ?? "";
		const targetMessage = context.state.messages.get(targetMessagePk);
		if (targetMessage) {
			context.state.messages.set(targetMessage.message_pk, {
				...targetMessage,
				subject: `갱신 ${targetMessage.subject}`,
			});
			updatedCount += 1;
		}
	}

	context.state.threadMessages.set(threadPk, existingThreadMessages);

	const addedMessage = buildDefaultMessage(
		threadPk,
		existingThreadMessages.length,
		input.mail_folder,
		true,
	);
	let attachmentPks =
		context.state.messages.get(addedMessage.message_pk)?.attachments ?? [];
	const attachmentInput: GraphMailSyncDownloadAttachmentInput = {
		graph_message_id: addedMessage.provider_message_id,
		graph_attachment_id: `att_delta_${addedMessage.message_pk}`,
		message_pk: addedMessage.message_pk,
	};
	const { record: deltaAttachment } = resolveAttachmentRecord(
		context,
		attachmentInput,
	);

	attachmentPks = mergeAttachmentPks(attachmentPks, [
		deltaAttachment.attachment_pk,
	]);
	addMessage(context, threadPk, {
		...addedMessage,
		has_attachments: true,
		attachments: attachmentPks,
	});
	addedCount += 1;

	let nextDeltaLink = buildDeltaLink(mailFolder);
	if (nextDeltaLink === currentDeltaLink) {
		const parsedCurrentDeltaLink = parseDeltaLink(mailFolder, currentDeltaLink);
		const nextIssuedAt = (parsedCurrentDeltaLink?.issuedAt ?? Date.now()) + 1;
		nextDeltaLink = `${mailFolder}_${nextIssuedAt}_delta`;
	}
	context.state.deltaLinks.set(mailFolder, nextDeltaLink);

	const changes = {
		added: Math.max(0, addedCount),
		updated: Math.max(0, updatedCount),
		deleted: Math.max(0, deletedCount),
	};

	return okResponse<GraphMailSyncDeltaSyncOutput>({
		changes,
		new_delta_link_saved: nextDeltaLink !== currentDeltaLink,
	});
};

const handleGraphDownloadAttachment = (
	context: McpRuntimeContext,
	input: GraphMailSyncDownloadAttachmentInput,
) => {
	const authError = requireAuthenticatedContext(context);
	if (authError !== null) {
		return authError;
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

	const messagePk = input.message_pk.trim();
	const message = context.state.messages.get(messagePk);
	if (!message) {
		return errorResponse(
			"E_NOT_FOUND",
			"요청한 message_pk 를 찾을 수 없습니다.",
		);
	}

	if (message.provider_message_id !== input.graph_message_id) {
		return errorResponse(
			"E_NOT_FOUND",
			"요청한 graph_message_id 와 message_pk 가 일치하지 않습니다.",
		);
	}

	const lookupKey = parseAttachmentLookupKey(input);
	const record = context.state.attachments.get(lookupKey);
	if (record === undefined) {
		return errorResponse(
			"E_NOT_FOUND",
			"요청한 graph_attachment_id 를 찾을 수 없습니다.",
		);
	}

	const expectedSha = buildAttachmentSha256(input);
	if (record.sha256 !== expectedSha) {
		return errorResponse(
			"E_PARSE_FAILED",
			"저장된 첨부 sha256 값이 요청 값과 일치하지 않습니다.",
		);
	}

	const expectedAttachmentPk = `att_${expectedSha.slice(0, 16)}`;
	const expectedRelativePath = `attachments/${expectedSha.slice(0, 2)}/${expectedSha}.bin`;
	if (record.attachment_pk !== expectedAttachmentPk) {
		return errorResponse(
			"E_PARSE_FAILED",
			"저장된 attachment_pk 값이 sha256 파생 규칙과 일치하지 않습니다.",
		);
	}
	if (record.relative_path !== expectedRelativePath) {
		return errorResponse(
			"E_PARSE_FAILED",
			"저장된 relative_path 값이 sha256 파생 규칙과 일치하지 않습니다.",
		);
	}

	const cachedMeta = context.state.attachmentContentBySha.get(expectedSha);
	if (cachedMeta !== undefined) {
		if (
			cachedMeta.attachment_pk !== record.attachment_pk ||
			cachedMeta.relative_path !== record.relative_path ||
			cachedMeta.size_bytes !== record.size_bytes ||
			cachedMeta.sha256 !== record.sha256
		) {
			return errorResponse(
				"E_PARSE_FAILED",
				"첨부 캐시 메타가 저장된 첨부 레코드와 일치하지 않습니다.",
			);
		}
	} else {
		context.state.attachmentContentBySha.set(expectedSha, {
			attachment_pk: record.attachment_pk,
			relative_path: record.relative_path,
			size_bytes: record.size_bytes,
			sha256: record.sha256,
		});
	}

	context.state.messages.set(messagePk, {
		...message,
		has_attachments: true,
		attachments: mergeAttachmentPks(message.attachments, [
			record.attachment_pk,
		]),
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
	const authError = requireAuthenticatedContext(context);
	if (authError !== null) {
		return authError;
	}

	const messagePk = resolveMailMessagePk(input);
	if (messagePk === null) {
		return errorResponse(
			"E_PARSE_FAILED",
			"message_pk 또는 message_id 가 비어있습니다.",
		);
	}

	if (!(context.state.messages instanceof Map)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"messages store 가 준비되지 않았습니다.",
		);
	}

	const message = context.state.messages.get(messagePk);
	if (!message) {
		return errorResponse(
			"E_NOT_FOUND",
			"요청한 message_pk 를 찾을 수 없습니다.",
		);
	}

	if (!isMailStoreMessageRecord(message)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"messages store 의 message 형식이 올바르지 않습니다.",
		);
	}

	if (message.message_pk !== messagePk) {
		return errorResponse(
			"E_NOT_FOUND",
			"요청한 message_pk 와 저장된 message_pk 가 일치하지 않습니다.",
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
	const authError = requireAuthenticatedContext(context);
	if (authError !== null) {
		return authError;
	}

	if (!isPositiveInteger(input.depth)) {
		return errorResponse("E_PARSE_FAILED", "depth 는 양의 정수여야 합니다.");
	}

	const threadPk = resolveMailThreadPk(input);
	if (threadPk === null) {
		return errorResponse(
			"E_PARSE_FAILED",
			"thread_pk 또는 thread_id 가 비어있습니다.",
		);
	}

	if (!(context.state.threadMessages instanceof Map)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"threadMessages store 가 준비되지 않았습니다.",
		);
	}
	if (!(context.state.messages instanceof Map)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"messages store 가 준비되지 않았습니다.",
		);
	}

	const storedMessagePks = context.state.threadMessages.get(threadPk);
	if (storedMessagePks === undefined) {
		return errorResponse("E_NOT_FOUND", "thread 를 찾을 수 없습니다.");
	}
	if (storedMessagePks === null) {
		return errorResponse(
			"E_PARSE_FAILED",
			"threadMessages 형식이 올바르지 않습니다.",
		);
	}

	if (
		!Array.isArray(storedMessagePks) ||
		!storedMessagePks.every(isNonEmptyString)
	) {
		return errorResponse(
			"E_PARSE_FAILED",
			"threadMessages 형식이 올바르지 않습니다.",
		);
	}

	const messagePks = storedMessagePks.map((messagePk) => messagePk.trim());
	if (messagePks.length === 0) {
		return errorResponse("E_NOT_FOUND", "thread 를 찾을 수 없습니다.");
	}

	const threadMessages: MailStoreMessage[] = [];
	for (const messagePk of messagePks) {
		const cachedMessage = context.state.messages.get(messagePk);
		if (cachedMessage === undefined) {
			return errorResponse(
				"E_NOT_FOUND",
				`thread 메시지를 찾을 수 없습니다: ${messagePk}`,
			);
		}
		if (!isMailStoreMessageRecord(cachedMessage)) {
			return errorResponse(
				"E_PARSE_FAILED",
				`thread message 형식이 올바르지 않습니다: ${messagePk}`,
			);
		}
		const message = cachedMessage;
		if (message.message_pk !== messagePk) {
			return errorResponse(
				"E_NOT_FOUND",
				`thread message_pk 불일치: ${messagePk}`,
			);
		}
		if (message.provider_thread_id !== threadPk) {
			return errorResponse(
				"E_NOT_FOUND",
				`thread 충돌이 감지되었습니다: ${messagePk}`,
			);
		}
		threadMessages.push(message);
	}

	const sorted = [...threadMessages].sort((a, b) => {
		const aTimestamp = Date.parse(a.received_at);
		const bTimestamp = Date.parse(b.received_at);
		const aValue = Number.isNaN(aTimestamp)
			? Number.NEGATIVE_INFINITY
			: aTimestamp;
		const bValue = Number.isNaN(bTimestamp)
			? Number.NEGATIVE_INFINITY
			: bTimestamp;
		if (aValue !== bValue) {
			return bValue - aValue;
		}
		if (a.message_pk < b.message_pk) {
			return -1;
		}
		if (a.message_pk > b.message_pk) {
			return 1;
		}
		if (a.provider_message_id < b.provider_message_id) {
			return -1;
		}
		if (a.provider_message_id > b.provider_message_id) {
			return 1;
		}
		return 0;
	});

	return okResponse<MailStoreGetThreadOutput>(sorted.slice(0, input.depth));
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
	"auth_store.complete_login_auto": (context, input) =>
		handleAuthStoreCompleteLoginAuto(context, input),
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
