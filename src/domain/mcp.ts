import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, extname, isAbsolute, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

import {
	createMcpStorage,
	createStateStorageAdapter,
} from "../storage/interface.js";
import type { McpStorage } from "../storage/interface.js";

export type McpErrorCode =
	| "E_AUTH_REQUIRED"
	| "E_AUTH_FAILED"
	| "E_CODEX_AUTH_REQUIRED"
	| "E_CODEX_AUTH_FAILED"
	| "E_CODEX_ANALYZE_RETRY_EXHAUSTED"
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
	| "auth_store.logout"
	| "graph_mail_sync.initial_sync"
	| "graph_mail_sync.delta_sync"
	| "graph_mail_sync.download_attachment"
	| "mail_store.get_message"
	| "mail_store.get_thread"
	| "workflow.create_evidence"
	| "workflow.upsert_todo"
	| "workflow.list"
	| "autopilot.set_mode"
	| "autopilot.pause"
	| "autopilot.resume"
	| "autopilot.status"
	| "autopilot.tick";

export const MCP_TOOL_NAMES = [
	"auth_store.start_login",
	"auth_store.complete_login",
	"auth_store.complete_login_auto",
	"auth_store.auth_status",
	"auth_store.logout",
	"graph_mail_sync.initial_sync",
	"graph_mail_sync.delta_sync",
	"graph_mail_sync.download_attachment",
	"mail_store.get_message",
	"mail_store.get_thread",
	"workflow.create_evidence",
	"workflow.upsert_todo",
	"workflow.list",
	"autopilot.set_mode",
	"autopilot.pause",
	"autopilot.resume",
	"autopilot.status",
	"autopilot.tick",
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

export type AuthStoreLogoutInput = Record<string, never>;

export interface AuthStoreLogoutOutput {
	signed_out: boolean;
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

export interface WorkflowEvidenceRecord {
	evidence_id: string;
	evidence_key?: string;
	source: {
		kind: "email";
		id: string;
		thread_pk: string;
	};
	locator: {
		type: "outlook_quote";
		text_quote: string;
	};
	snippet: string;
	confidence: number;
	created_at: string;
}

export interface WorkflowTodoRecord {
	todo_id: string;
	todo_key?: string;
	title: string;
	status: "open" | "in_progress" | "done";
	evidence_id: string | null;
	created_at: string;
	updated_at: string;
}

export interface WorkflowCreateEvidenceInput {
	message_pk: string;
	snippet: string;
	confidence?: number;
	evidence_id?: string;
	idempotency_key?: string;
}

export interface WorkflowCreateEvidenceOutput {
	evidence: WorkflowEvidenceRecord;
	created: boolean;
	updated: boolean;
	skipped_duplicate: boolean;
}

export interface WorkflowUpsertTodoInput {
	todo_id?: string;
	todo_key?: string;
	title: string;
	status?: "open" | "in_progress" | "done";
	evidence_id?: string;
	evidence_key?: string;
	idempotency_key?: string;
}

export interface WorkflowUpsertTodoOutput {
	todo: WorkflowTodoRecord | null;
	created: boolean;
	updated: boolean;
	skipped_duplicate: boolean;
}

export type WorkflowListInput = Record<string, never>;

export interface WorkflowListOutput {
	evidences: WorkflowEvidenceRecord[];
	todos: WorkflowTodoRecord[];
}

export interface PersistenceAuthorityPolicy {
	phase: "phase_1";
	source_of_truth: "native-host/state.json";
	sqlite_mirror: "deferred";
	sqlite_mirror_enabled: false;
}

export interface AutopilotSetModeInput {
	mode: "manual" | "review_first" | "full_auto";
}

export interface AutopilotSetModeOutput {
	mode: "manual" | "review_first" | "full_auto";
	status:
		| "idle"
		| "syncing"
		| "analyzing"
		| "persisting"
		| "paused"
		| "degraded"
		| "retrying";
	paused: boolean;
}

export type AutopilotPauseInput = Record<string, never>;
export type AutopilotResumeInput = Record<string, never>;

export interface AutopilotPauseOutput {
	paused: boolean;
	status: string;
}

export interface AutopilotResumeOutput {
	paused: boolean;
	status: string;
}

export type AutopilotStatusInput = Record<string, never>;

export interface AutopilotMetrics {
	ticks_total: number;
	ticks_success: number;
	ticks_failed: number;
	auto_evidence_created: number;
	auto_todo_created: number;
	auto_attachment_saved: number;
	review_candidates: number;
	codex_stage_started: number;
	codex_stage_success: number;
	codex_stage_fail: number;
	codex_stage_timeout: number;
	codex_stage_schema_fail: number;
}

export interface AutopilotRunCorrelation {
	run_id: string;
	correlation_id: string;
	message_pk: string;
	candidate_stage: "selected";
	analysis_stage:
		| "proposal"
		| "review"
		| "codex_schema_invalid"
		| "codex_retriable_exhausted"
		| "analysis_failed";
	persistence_stage:
		| "skipped_review_first"
		| "persisted"
		| "review_candidate"
		| "not_run";
	attempt: number | null;
	duration_ms: number | null;
	exit_code: number | null;
	failure_kind: string | null;
	fallback_used: boolean;
}

export interface AutopilotCodexStageStatus {
	started: number;
	success: number;
	fail: number;
	timeout: number;
	schema_fail: number;
	last_failure_reason: string | null;
	last_run_correlation: readonly AutopilotRunCorrelation[];
}

export type CodexExecAuthSource = "opencode_connected" | "env_fallback";

export interface CodexExecModePolicyEntry {
	tick_allowed: boolean;
	write_policy: "deny_all" | "analysis_only" | "workflow_persist";
	failure_policy:
		| "fail_closed"
		| "fail_open_review"
		| "fail_closed_threshold"
		| "fail_closed_until_resume";
}

export interface CodexExecRuntimeContract {
	flags: {
		codex_exec_enabled: boolean;
		codex_exec_shadow_mode: boolean;
		codex_exec_fallback_to_synthetic_on_error: boolean;
		env_fallback_only_ci_headless: boolean;
	};
	auth_precedence: readonly CodexExecAuthSource[];
	env_fallback_allowed_contexts: readonly ("ci" | "headless")[];
	mode_policy_matrix: {
		manual: CodexExecModePolicyEntry;
		review_first: CodexExecModePolicyEntry;
		full_auto: CodexExecModePolicyEntry;
		degraded: CodexExecModePolicyEntry;
	};
}

export interface AutopilotStatusOutput {
	mode: "manual" | "review_first" | "full_auto";
	status: string;
	paused: boolean;
	in_flight_run_id: string | null;
	last_error: string | null;
	consecutive_failures: number;
	last_tick_at: string | null;
	metrics: AutopilotMetrics;
	codex_stage: AutopilotCodexStageStatus;
	codex_stage_metrics?: {
		started: number;
		success: number;
		fail: number;
		timeout: number;
		schema_fail: number;
	};
	codex_last_failure_reason?: string | null;
	codex_exec_contract?: CodexExecRuntimeContract;
	persistence_authority: PersistenceAuthorityPolicy;
}

export interface AutopilotTickInput {
	mail_folder?: string;
	max_messages_per_tick?: number;
	max_attachments_per_tick?: number;
}

export interface AutopilotTickOutput {
	run_id: string;
	mode: "manual" | "review_first" | "full_auto";
	synced_changes: {
		added: number;
		updated: number;
		deleted: number;
	};
	auto_evidence_created: number;
	auto_todo_created: number;
	auto_evidence_writes: number;
	auto_todo_writes: number;
	auto_attachment_saved: number;
	review_candidates: number;
	run_correlation: readonly AutopilotRunCorrelation[];
	analysis_proposals?: readonly AutopilotAnalysisProposal[];
}

export interface AutopilotCandidatePayload {
	message_pk: string;
	internet_message_id: string;
	received_at: string;
	subject: string;
	from: string;
	body_text: string;
	has_attachments: boolean;
}

interface AutopilotCandidatePayloadBuildResult {
	payload: AutopilotCandidatePayload;
	requires_user_confirmation: boolean;
}

export interface AutopilotAnalysisProposal {
	message_pk: string;
	subject: string;
	from: string;
	received_at: string;
	snippet: string;
	confidence: number;
	todo_title: string;
	candidate_payload: AutopilotCandidatePayload;
}

export interface DomainMirrorAnalyzeAttemptInput {
	message: MailStoreMessage;
	payload: AutopilotCandidatePayload;
	attempt: number;
	max_attempts: number;
}

export type DomainMirrorAnalyzeAttemptResult =
	| {
			kind: "raw_output";
			raw_output: unknown;
			telemetry: {
				attempt: number;
				duration_ms: number | null;
				exit_code: number | null;
				failure_kind: string | null;
				fallback_used: boolean;
			};
	  }
	| {
			kind: "failure";
			classification: "retriable" | "terminal";
			message: string;
			telemetry: {
				attempt: number;
				duration_ms: number | null;
				exit_code: number | null;
				failure_kind: string | null;
				fallback_used: boolean;
			};
	  };

export interface DomainMirrorAdapter {
	analyzeAutopilotCandidateAttempt: (
		input: DomainMirrorAnalyzeAttemptInput,
	) => DomainMirrorAnalyzeAttemptResult;
}

export const CODEX_PROPOSAL_SCHEMA_VERSION = "codex_proposal.v1";

export interface CodexProposalContractV1 {
	schema_version: typeof CODEX_PROPOSAL_SCHEMA_VERSION;
	proposal: {
		snippet: string;
		confidence: number;
		todo_title: string;
	};
}

export type CodexProposalParseErrorCode =
	| "E_CODEX_OUTPUT_INVALID_TYPE"
	| "E_CODEX_OUTPUT_INVALID_JSON"
	| "E_CODEX_OUTPUT_UNKNOWN_FIELD"
	| "E_CODEX_OUTPUT_MISSING_FIELD"
	| "E_CODEX_OUTPUT_SCHEMA_VERSION"
	| "E_CODEX_OUTPUT_INVALID_FIELD";

export interface CodexProposalParseError {
	code: CodexProposalParseErrorCode;
	message: string;
}

export type CodexProposalParseResult =
	| {
			ok: true;
			value: CodexProposalContractV1["proposal"];
	  }
	| {
			ok: false;
			error: CodexProposalParseError;
	  };

export type McpToolInput = {
	"auth_store.start_login": AuthStoreStartLoginInput;
	"auth_store.complete_login": AuthStoreCompleteLoginInput;
	"auth_store.complete_login_auto": AuthStoreCompleteLoginAutoInput;
	"auth_store.auth_status": AuthStoreAuthStatusInput;
	"auth_store.logout": AuthStoreLogoutInput;
	"graph_mail_sync.initial_sync": GraphMailSyncInitialSyncInput;
	"graph_mail_sync.delta_sync": GraphMailSyncDeltaSyncInput;
	"graph_mail_sync.download_attachment": GraphMailSyncDownloadAttachmentInput;
	"mail_store.get_message": MailStoreGetMessageInput;
	"mail_store.get_thread": MailStoreGetThreadInput;
	"workflow.create_evidence": WorkflowCreateEvidenceInput;
	"workflow.upsert_todo": WorkflowUpsertTodoInput;
	"workflow.list": WorkflowListInput;
	"autopilot.set_mode": AutopilotSetModeInput;
	"autopilot.pause": AutopilotPauseInput;
	"autopilot.resume": AutopilotResumeInput;
	"autopilot.status": AutopilotStatusInput;
	"autopilot.tick": AutopilotTickInput;
};

export type McpToolOutput = {
	"auth_store.start_login": AuthStoreStartLoginOutput;
	"auth_store.complete_login": AuthStoreCompleteLoginOutput;
	"auth_store.complete_login_auto": AuthStoreCompleteLoginAutoOutput;
	"auth_store.auth_status": AuthStoreAuthStatusOutput;
	"auth_store.logout": AuthStoreLogoutOutput;
	"graph_mail_sync.initial_sync": GraphMailSyncInitialSyncOutput;
	"graph_mail_sync.delta_sync": GraphMailSyncDeltaSyncOutput;
	"graph_mail_sync.download_attachment": GraphMailSyncDownloadAttachmentOutput;
	"mail_store.get_message": MailStoreGetMessageOutput;
	"mail_store.get_thread": MailStoreGetThreadOutput;
	"workflow.create_evidence": WorkflowCreateEvidenceOutput;
	"workflow.upsert_todo": WorkflowUpsertTodoOutput;
	"workflow.list": WorkflowListOutput;
	"autopilot.set_mode": AutopilotSetModeOutput;
	"autopilot.pause": AutopilotPauseOutput;
	"autopilot.resume": AutopilotResumeOutput;
	"autopilot.status": AutopilotStatusOutput;
	"autopilot.tick": AutopilotTickOutput;
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

export type McpCodexAuthMode = "disabled" | "env";

export interface McpCodexAuthState {
	mode: McpCodexAuthMode;
	api_key_env_var: string;
	api_key_present: boolean;
	opencode_connected_present?: boolean;
}

export interface McpAttachmentRecord {
	attachment_pk: string;
	graph_message_id: string;
	graph_attachment_id: string;
	message_pk: string;
	file_name?: string;
	content_type?: string;
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
	workflow: {
		evidences: WorkflowEvidenceRecord[];
		todos: WorkflowTodoRecord[];
	};
	autopilot: {
		mode: "manual" | "review_first" | "full_auto";
		status: string;
		paused: boolean;
		in_flight_run_id: string | null;
		last_error: string | null;
		consecutive_failures: number;
		last_tick_at: string | null;
		metrics: AutopilotMetrics;
		codex_stage: AutopilotCodexStageStatus;
	};
	signed_in: boolean;
	auth_token: McpAuthToken | null;
	codex_auth: McpCodexAuthState;
}

export interface McpRuntimeContext {
	state: McpRuntimeState;
	storage: McpStorage;
	domainMirrorAdapter: DomainMirrorAdapter;
}

export interface CreateMcpContextOptions {
	domainMirrorAdapter?: DomainMirrorAdapter;
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
	workflow: {
		evidences: [],
		todos: [],
	},
	autopilot: {
		mode: "manual",
		status: "idle",
		paused: false,
		in_flight_run_id: null,
		last_error: null,
		consecutive_failures: 0,
		last_tick_at: null,
		metrics: {
			ticks_total: 0,
			ticks_success: 0,
			ticks_failed: 0,
			auto_evidence_created: 0,
			auto_todo_created: 0,
			auto_attachment_saved: 0,
			review_candidates: 0,
			codex_stage_started: 0,
			codex_stage_success: 0,
			codex_stage_fail: 0,
			codex_stage_timeout: 0,
			codex_stage_schema_fail: 0,
		},
		codex_stage: {
			started: 0,
			success: 0,
			fail: 0,
			timeout: 0,
			schema_fail: 0,
			last_failure_reason: null,
			last_run_correlation: [],
		},
	},
	signed_in: false,
	auth_token: null,
	codex_auth: {
		mode: "disabled",
		api_key_env_var: "CODEX_API_KEY",
		api_key_present: false,
		opencode_connected_present: false,
	},
});

export const createMcpContext = (
	initial?: Partial<McpRuntimeState>,
	options: CreateMcpContextOptions = {},
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
	domainMirrorAdapter:
		options.domainMirrorAdapter ?? DEFAULT_DOMAIN_MIRROR_ADAPTER,
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const hasUnknownKeys = (
	value: Record<string, unknown>,
	allowed: readonly string[],
): string[] => Object.keys(value).filter((key) => !allowed.includes(key));

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

const requireCodexAuthContext = (context: McpRuntimeContext) => {
	if (
		CODEX_EXEC_RUNTIME_CONTRACT.flags.codex_exec_enabled &&
		context.state.codex_auth.opencode_connected_present
	) {
		return null;
	}

	if (context.state.codex_auth.mode === "disabled") {
		return null;
	}

	if (context.state.codex_auth.mode !== "env") {
		return errorResponse(
			"E_CODEX_AUTH_FAILED",
			"코덱스 인증 모드 설정이 올바르지 않습니다.",
		);
	}

	if (!context.state.codex_auth.api_key_present) {
		return errorResponse(
			"E_CODEX_AUTH_REQUIRED",
			`${context.state.codex_auth.api_key_env_var} 환경변수 설정이 필요합니다.`,
		);
	}

	if (
		CODEX_EXEC_RUNTIME_CONTRACT.flags.codex_exec_enabled &&
		!isEnvFallbackAllowedForRuntime()
	) {
		return errorResponse(
			"E_CODEX_AUTH_REQUIRED",
			"opencode 연결 인증이 필요합니다. env fallback 은 CI/headless 런타임에서만 허용됩니다.",
		);
	}

	return null;
};

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
			"델타 링크가 없습니다. initial_sync 를 먼저 실행하세요.",
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

const normalizeSnippet = (value: string): string =>
	value.replace(/\s+/g, " ").trim().slice(0, 240);

const normalizeFingerprintBody = (value: string): string =>
	value.replace(/\s+/g, " ").trim();

const AUTOPILOT_FINGERPRINT_SCHEMA_VERSION = "v1";
const AUTOPILOT_MAX_CONSECUTIVE_FAILURES = 3;
const AUTOPILOT_CODEX_ANALYZE_TIMEOUT_MS = 1_500;
const AUTOPILOT_CODEX_ANALYZE_MAX_RETRIES = 2;
const AUTOPILOT_CODEX_STAGE_FAILURE_THRESHOLD = 2;
const AUTOPILOT_CANDIDATE_BODY_MAX_CHARS = 2_000;
const AUTOPILOT_CANDIDATE_BODY_WITH_ATTACHMENTS_MAX_CHARS = 4_000;
const AUTOPILOT_ATTACHMENT_TEXT_MAX_CHARS_PER_FILE = 800;
const AUTOPILOT_ATTACHMENT_TEXT_MAX_CHARS_TOTAL = 1_800;

const SUPPORTED_TEXT_ATTACHMENT_EXTENSIONS = new Set([
	"pdf",
	"xlsx",
	"xls",
	"pptx",
	"ppt",
	"txt",
	"docx",
	"doc",
]);

const TEXT_ATTACHMENT_CONTENT_TYPES = new Set([
	"application/pdf",
	"text/plain",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"application/vnd.ms-powerpoint",
]);

const NON_TEXT_ATTACHMENT_EXTENSIONS = new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"bmp",
	"svg",
	"tif",
	"tiff",
	"heic",
	"zip",
	"rar",
	"7z",
	"mp3",
	"wav",
	"mp4",
	"avi",
	"mov",
]);
const CODEX_EXEC_RUNTIME_CONTRACT: CodexExecRuntimeContract = Object.freeze({
	flags: Object.freeze({
		codex_exec_enabled: false,
		codex_exec_shadow_mode: false,
		codex_exec_fallback_to_synthetic_on_error: true,
		env_fallback_only_ci_headless: true,
	}),
	auth_precedence: Object.freeze([
		"opencode_connected",
		"env_fallback",
	] as const),
	env_fallback_allowed_contexts: Object.freeze(["ci", "headless"] as const),
	mode_policy_matrix: Object.freeze({
		manual: Object.freeze({
			tick_allowed: false,
			write_policy: "deny_all",
			failure_policy: "fail_closed",
		}),
		review_first: Object.freeze({
			tick_allowed: true,
			write_policy: "analysis_only",
			failure_policy: "fail_open_review",
		}),
		full_auto: Object.freeze({
			tick_allowed: true,
			write_policy: "workflow_persist",
			failure_policy: "fail_closed_threshold",
		}),
		degraded: Object.freeze({
			tick_allowed: false,
			write_policy: "deny_all",
			failure_policy: "fail_closed_until_resume",
		}),
	}),
});

const isTruthyRuntimeFlag = (value: string | undefined): boolean => {
	if (!isNonEmptyString(value)) {
		return false;
	}
	const normalized = value.trim().toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes";
};

const isCiRuntime = (): boolean => isTruthyRuntimeFlag(process.env.CI);

const isHeadlessRuntime = (): boolean =>
	isTruthyRuntimeFlag(process.env.HEADLESS) ||
	isTruthyRuntimeFlag(process.env.CODEX_HEADLESS) ||
	isTruthyRuntimeFlag(process.env.PLAYWRIGHT_HEADLESS);

const isEnvFallbackAllowedForRuntime = (): boolean =>
	!CODEX_EXEC_RUNTIME_CONTRACT.flags.env_fallback_only_ci_headless ||
	isCiRuntime() ||
	isHeadlessRuntime();

const resolveAutopilotModePolicy = (
	context: McpRuntimeContext,
): CodexExecModePolicyEntry => {
	if (context.state.autopilot.status === "degraded") {
		return CODEX_EXEC_RUNTIME_CONTRACT.mode_policy_matrix.degraded;
	}
	if (context.state.autopilot.mode === "manual") {
		return CODEX_EXEC_RUNTIME_CONTRACT.mode_policy_matrix.manual;
	}
	if (context.state.autopilot.mode === "review_first") {
		return CODEX_EXEC_RUNTIME_CONTRACT.mode_policy_matrix.review_first;
	}
	return CODEX_EXEC_RUNTIME_CONTRACT.mode_policy_matrix.full_auto;
};

const PHASE_1_PERSISTENCE_AUTHORITY: PersistenceAuthorityPolicy = {
	phase: "phase_1",
	source_of_truth: "native-host/state.json",
	sqlite_mirror: "deferred",
	sqlite_mirror_enabled: false,
};

const buildAutopilotMessageFingerprint = (
	message: MailStoreMessage,
	schemaVersion = AUTOPILOT_FINGERPRINT_SCHEMA_VERSION,
): string => {
	const normalizedBody = normalizeFingerprintBody(
		isNonEmptyString(message.body_text) ? message.body_text : message.subject,
	);
	const normalizedInternetMessageId = isNonEmptyString(
		message.internet_message_id,
	)
		? message.internet_message_id.trim().toLowerCase()
		: "";
	return [
		message.message_pk,
		normalizedInternetMessageId,
		message.received_at,
		normalizedBody,
		schemaVersion,
	].join(":");
};

const buildEvidenceKey = (messagePk: string, snippet: string): string =>
	`evk_${createHash("sha1")
		.update(`${messagePk}:${normalizeSnippet(snippet)}:outlook_quote`)
		.digest("hex")
		.slice(0, 20)}`;

const buildTodoKey = (title: string, evidenceKey: string): string =>
	`tdk_${createHash("sha1")
		.update(`${title.trim().toLowerCase()}:${evidenceKey}:mail-agent`)
		.digest("hex")
		.slice(0, 20)}`;

const deriveDeterministicTodoKey = (
	title: string,
	evidenceKey: string,
): string => buildTodoKey(title, evidenceKey);

interface AutopilotCandidateAnalysisResult {
	message: MailStoreMessage;
	payload: AutopilotCandidatePayload;
	proposal: AutopilotAnalysisProposal | null;
	review_reason:
		| "attachment_requires_user_confirmation"
		| "empty_snippet"
		| "analysis_failed"
		| "codex_schema_invalid"
		| "codex_retriable_exhausted"
		| null;
	parse_error?: CodexProposalParseError;
	failure_class?: "retriable" | "terminal";
	failure_kind?: "timeout" | "schema_fail" | "analysis_fail";
	attempt_count?: number;
	failure_message?: string;
	telemetry: {
		attempt: number;
		duration_ms: number | null;
		exit_code: number | null;
		failure_kind: string | null;
		fallback_used: boolean;
	};
}

interface CodexRetryPlan {
	kind: "timeout" | "transient" | "terminal";
	fail_attempts: number;
	message: string | null;
}

interface AutopilotPersistenceBridgeResult {
	review_candidate: boolean;
	evidence_created: number;
	todo_created: number;
	evidence_writes: number;
	todo_writes: number;
}

interface AutopilotStageFailureMatrix {
	retriable_failures: number;
	terminal_failures: number;
	total_failures: number;
	proposal_count: number;
	retriable_exhausted: boolean;
	threshold_breached: boolean;
}

const persistAnalyzedCandidateViaWorkflow = (
	context: McpRuntimeContext,
	analyzed: AutopilotCandidateAnalysisResult,
): AutopilotPersistenceBridgeResult => {
	if (analyzed.proposal === null) {
		return {
			review_candidate: true,
			evidence_created: 0,
			todo_created: 0,
			evidence_writes: 0,
			todo_writes: 0,
		};
	}

	const proposal = analyzed.proposal;
	if (proposal.confidence < 0.75) {
		return {
			review_candidate: true,
			evidence_created: 0,
			todo_created: 0,
			evidence_writes: 0,
			todo_writes: 0,
		};
	}

	const message = analyzed.message;
	const messageFingerprint = buildAutopilotMessageFingerprint(message);
	const evidenceKey = buildEvidenceKey(message.message_pk, messageFingerprint);
	const evidence = handleWorkflowCreateEvidence(context, {
		message_pk: message.message_pk,
		snippet: proposal.snippet,
		confidence: proposal.confidence,
		idempotency_key: evidenceKey,
	});
	if (!evidence.ok) {
		return {
			review_candidate: true,
			evidence_created: 0,
			todo_created: 0,
			evidence_writes: 0,
			todo_writes: 0,
		};
	}

	const persistedEvidenceKey = isNonEmptyString(
		evidence.data.evidence.evidence_key,
	)
		? evidence.data.evidence.evidence_key.trim()
		: "";
	if (
		!isNonEmptyString(persistedEvidenceKey) ||
		persistedEvidenceKey !== evidenceKey
	) {
		return {
			review_candidate: true,
			evidence_created: evidence.data.created ? 1 : 0,
			todo_created: 0,
			evidence_writes: 1,
			todo_writes: 0,
		};
	}

	const deterministicTodoKey = deriveDeterministicTodoKey(
		proposal.todo_title,
		persistedEvidenceKey,
	);
	const todo = handleWorkflowUpsertTodo(context, {
		title: proposal.todo_title,
		status: "open",
		evidence_id: evidence.data.evidence.evidence_id,
		evidence_key: persistedEvidenceKey,
		todo_key: deterministicTodoKey,
		idempotency_key: deterministicTodoKey,
	});
	if (!todo.ok) {
		return {
			review_candidate: true,
			evidence_created: evidence.data.created ? 1 : 0,
			todo_created: 0,
			evidence_writes: 1,
			todo_writes: 0,
		};
	}

	const persistedTodoKey = isNonEmptyString(todo.data.todo?.todo_key)
		? todo.data.todo.todo_key.trim()
		: "";
	if (
		!isNonEmptyString(persistedTodoKey) ||
		persistedTodoKey !== deterministicTodoKey
	) {
		return {
			review_candidate: true,
			evidence_created: evidence.data.created ? 1 : 0,
			todo_created: 0,
			evidence_writes: 1,
			todo_writes: 1,
		};
	}

	return {
		review_candidate: false,
		evidence_created: evidence.data.created ? 1 : 0,
		todo_created: todo.data.created ? 1 : 0,
		evidence_writes: 1,
		todo_writes: 1,
	};
};

export const parseCodexProposalOutput = (
	raw: unknown,
): CodexProposalParseResult => {
	let parsed: unknown = raw;

	if (typeof raw === "string") {
		const trimmed = raw.trim();
		if (trimmed.length === 0) {
			return {
				ok: false,
				error: {
					code: "E_CODEX_OUTPUT_INVALID_JSON",
					message: "codex 출력이 비어 있습니다.",
				},
			};
		}

		try {
			parsed = JSON.parse(trimmed);
		} catch {
			return {
				ok: false,
				error: {
					code: "E_CODEX_OUTPUT_INVALID_JSON",
					message: "codex 출력은 단일 JSON 객체여야 합니다.",
				},
			};
		}
	}

	if (!isRecord(parsed)) {
		return {
			ok: false,
			error: {
				code: "E_CODEX_OUTPUT_INVALID_TYPE",
				message: "codex 출력 루트는 객체여야 합니다.",
			},
		};
	}

	const unknownRootKeys = hasUnknownKeys(parsed, [
		"schema_version",
		"proposal",
	]);
	if (unknownRootKeys.length > 0) {
		return {
			ok: false,
			error: {
				code: "E_CODEX_OUTPUT_UNKNOWN_FIELD",
				message: `codex 출력 루트에 알 수 없는 필드가 있습니다: ${unknownRootKeys.join(", ")}`,
			},
		};
	}

	if (!("schema_version" in parsed)) {
		return {
			ok: false,
			error: {
				code: "E_CODEX_OUTPUT_MISSING_FIELD",
				message: "codex 출력에 schema_version 필드가 필요합니다.",
			},
		};
	}

	if (parsed.schema_version !== CODEX_PROPOSAL_SCHEMA_VERSION) {
		return {
			ok: false,
			error: {
				code: "E_CODEX_OUTPUT_SCHEMA_VERSION",
				message: `지원되지 않는 schema_version 입니다: ${String(parsed.schema_version)}`,
			},
		};
	}

	if (!("proposal" in parsed)) {
		return {
			ok: false,
			error: {
				code: "E_CODEX_OUTPUT_MISSING_FIELD",
				message: "codex 출력에 proposal 필드가 필요합니다.",
			},
		};
	}

	if (!isRecord(parsed.proposal)) {
		return {
			ok: false,
			error: {
				code: "E_CODEX_OUTPUT_INVALID_TYPE",
				message: "proposal 은 객체여야 합니다.",
			},
		};
	}

	const proposal = parsed.proposal;
	const unknownProposalKeys = hasUnknownKeys(proposal, [
		"snippet",
		"confidence",
		"todo_title",
	]);
	if (unknownProposalKeys.length > 0) {
		return {
			ok: false,
			error: {
				code: "E_CODEX_OUTPUT_UNKNOWN_FIELD",
				message: `proposal 에 알 수 없는 필드가 있습니다: ${unknownProposalKeys.join(", ")}`,
			},
		};
	}

	if (!("snippet" in proposal)) {
		return {
			ok: false,
			error: {
				code: "E_CODEX_OUTPUT_MISSING_FIELD",
				message: "proposal.snippet 필드가 필요합니다.",
			},
		};
	}

	if (!("confidence" in proposal)) {
		return {
			ok: false,
			error: {
				code: "E_CODEX_OUTPUT_MISSING_FIELD",
				message: "proposal.confidence 필드가 필요합니다.",
			},
		};
	}

	if (!("todo_title" in proposal)) {
		return {
			ok: false,
			error: {
				code: "E_CODEX_OUTPUT_MISSING_FIELD",
				message: "proposal.todo_title 필드가 필요합니다.",
			},
		};
	}

	const snippet = normalizeSnippet(String(proposal.snippet));
	if (typeof proposal.snippet !== "string" || snippet.length === 0) {
		return {
			ok: false,
			error: {
				code: "E_CODEX_OUTPUT_INVALID_FIELD",
				message: "proposal.snippet 은 비어있지 않은 문자열이어야 합니다.",
			},
		};
	}

	if (
		typeof proposal.confidence !== "number" ||
		!Number.isFinite(proposal.confidence) ||
		proposal.confidence < 0 ||
		proposal.confidence > 1
	) {
		return {
			ok: false,
			error: {
				code: "E_CODEX_OUTPUT_INVALID_FIELD",
				message: "proposal.confidence 는 0 이상 1 이하 숫자여야 합니다.",
			},
		};
	}

	if (
		typeof proposal.todo_title !== "string" ||
		proposal.todo_title.trim().length === 0
	) {
		return {
			ok: false,
			error: {
				code: "E_CODEX_OUTPUT_INVALID_FIELD",
				message: "proposal.todo_title 은 비어있지 않은 문자열이어야 합니다.",
			},
		};
	}

	return {
		ok: true,
		value: {
			snippet,
			confidence: proposal.confidence,
			todo_title: proposal.todo_title.trim(),
		},
	};
};

const buildDefaultCodexProposalOutput = (
	payload: AutopilotCandidatePayload,
): string =>
	JSON.stringify({
		schema_version: CODEX_PROPOSAL_SCHEMA_VERSION,
		proposal: {
			snippet: normalizeSnippet(payload.body_text),
			confidence: 0.92,
			todo_title: `[AUTO] ${payload.subject}`,
		},
	});

const resolveCodexProposalRawOutput = (
	message: MailStoreMessage,
	payload: AutopilotCandidatePayload,
): unknown => {
	const candidate = message as unknown as Record<string, unknown>;
	if ("__codex_output_raw" in candidate) {
		return candidate.__codex_output_raw;
	}

	return buildDefaultCodexProposalOutput(payload);
};

const resolveCodexRetryPlan = (
	message: MailStoreMessage,
): CodexRetryPlan | null => {
	const candidate = message as unknown as Record<string, unknown>;
	const rawPlan = candidate.__codex_retry_plan;
	if (!isRecord(rawPlan)) {
		return null;
	}

	const kind =
		typeof rawPlan.kind === "string" ? rawPlan.kind.trim().toLowerCase() : "";
	if (
		!(["timeout", "transient", "terminal"] as const).includes(kind as never)
	) {
		return null;
	}

	const failAttemptsRaw = Number(rawPlan.fail_attempts);
	const failAttempts =
		Number.isInteger(failAttemptsRaw) && failAttemptsRaw > 0
			? failAttemptsRaw
			: 1;

	return {
		kind: kind as CodexRetryPlan["kind"],
		fail_attempts: failAttempts,
		message:
			typeof rawPlan.message === "string" && rawPlan.message.trim().length > 0
				? rawPlan.message.trim()
				: null,
	};
};

const resolveCodexAttemptFailure = (
	message: MailStoreMessage,
	attempt: number,
): {
	classification: "retriable" | "terminal";
	message: string;
} | null => {
	const plan = resolveCodexRetryPlan(message);
	if (plan === null || attempt > plan.fail_attempts) {
		return null;
	}

	if (plan.kind === "timeout") {
		return {
			classification: "retriable",
			message:
				plan.message ??
				`codex 분석이 ${AUTOPILOT_CODEX_ANALYZE_TIMEOUT_MS}ms 제한 시간을 초과했습니다.`,
		};
	}

	if (plan.kind === "transient") {
		return {
			classification: "retriable",
			message: plan.message ?? "codex 분석 일시 오류가 발생했습니다.",
		};
	}

	return {
		classification: "terminal",
		message:
			plan.message ?? "codex 분석에서 복구 불가능한 오류가 발생했습니다.",
	};
};

const DEFAULT_DOMAIN_MIRROR_ADAPTER: DomainMirrorAdapter = {
	analyzeAutopilotCandidateAttempt: ({ message, payload, attempt }) => {
		const attemptFailure = resolveCodexAttemptFailure(message, attempt);
		if (attemptFailure !== null) {
			return {
				kind: "failure",
				classification: attemptFailure.classification,
				message: attemptFailure.message,
				telemetry: {
					attempt,
					duration_ms: null,
					exit_code: null,
					failure_kind:
						attemptFailure.classification === "retriable"
							? "timeout_retriable"
							: "analysis_fail",
					fallback_used: true,
				},
			};
		}

		return {
			kind: "raw_output",
			raw_output: resolveCodexProposalRawOutput(message, payload),
			telemetry: {
				attempt,
				duration_ms: null,
				exit_code: null,
				failure_kind: null,
				fallback_used: true,
			},
		};
	},
};

const selectAutopilotCandidates = (
	context: McpRuntimeContext,
	maxMessages: number,
): MailStoreMessage[] =>
	Array.from(context.state.messages.values())
		.filter(
			(message) =>
				isNonEmptyString(message.message_pk) &&
				!context.state.workflow.evidences.some(
					(item) => item.source.id === message.message_pk,
				),
		)
		.slice(0, maxMessages);

const decodeXmlEntities = (value: string): string =>
	value
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");

const getAttachmentExtension = (attachment: McpAttachmentRecord): string => {
	const candidates = [
		attachment.file_name,
		attachment.graph_attachment_id,
		attachment.relative_path ? basename(attachment.relative_path) : "",
	];
	for (const candidate of candidates) {
		if (!isNonEmptyString(candidate)) {
			continue;
		}
		const extension = extname(candidate).replace(/^\./, "").toLowerCase();
		if (extension.length > 0) {
			return extension;
		}
	}
	return "";
};

const resolveAttachmentFormatPolicy = (attachment: McpAttachmentRecord) => {
	const extension = getAttachmentExtension(attachment);
	const contentType = isNonEmptyString(attachment.content_type)
		? attachment.content_type.trim().toLowerCase()
		: "";

	if (SUPPORTED_TEXT_ATTACHMENT_EXTENSIONS.has(extension)) {
		return { kind: "text" as const, format: extension };
	}
	if (TEXT_ATTACHMENT_CONTENT_TYPES.has(contentType)) {
		if (contentType === "application/pdf") {
			return { kind: "text" as const, format: "pdf" };
		}
		if (contentType === "text/plain") {
			return { kind: "text" as const, format: "txt" };
		}
		if (
			contentType ===
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		) {
			return { kind: "text" as const, format: "docx" };
		}
		if (contentType === "application/msword") {
			return { kind: "text" as const, format: "doc" };
		}
		if (
			contentType ===
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		) {
			return { kind: "text" as const, format: "xlsx" };
		}
		if (contentType === "application/vnd.ms-excel") {
			return { kind: "text" as const, format: "xls" };
		}
		if (
			contentType ===
			"application/vnd.openxmlformats-officedocument.presentationml.presentation"
		) {
			return { kind: "text" as const, format: "pptx" };
		}
		if (contentType === "application/vnd.ms-powerpoint") {
			return { kind: "text" as const, format: "ppt" };
		}
	}

	if (
		(contentType.startsWith("image/") && contentType.length > 0) ||
		(extension.length > 0 && NON_TEXT_ATTACHMENT_EXTENSIONS.has(extension)) ||
		(contentType.length > 0 && !TEXT_ATTACHMENT_CONTENT_TYPES.has(contentType))
	) {
		return {
			kind: "requires_confirmation" as const,
			format: extension || contentType,
		};
	}

	return { kind: "unknown" as const, format: "" };
};

const extractPrintableText = (buffer: Buffer): string => {
	const latin1 = buffer.toString("latin1");
	const chunks = latin1
		.split(/[^\x20-\x7E\u00A0-\u00FF]+/)
		.map((chunk) => chunk.trim())
		.filter((chunk) => chunk.length >= 3);
	return chunks.join(" ");
};

interface ZipEntry {
	name: string;
	data: Buffer;
}

const parseZipEntries = (buffer: Buffer): ZipEntry[] => {
	const eocdSignature = 0x06054b50;
	const cdfhSignature = 0x02014b50;
	const lfhSignature = 0x04034b50;
	let eocdOffset = -1;
	for (
		let index = Math.max(0, buffer.length - 65_557);
		index <= buffer.length - 22;
		index += 1
	) {
		if (buffer.readUInt32LE(index) === eocdSignature) {
			eocdOffset = index;
		}
	}
	if (eocdOffset < 0) {
		return [];
	}

	const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
	const entryCount = buffer.readUInt16LE(eocdOffset + 10);
	let cursor = centralDirectoryOffset;
	const entries: ZipEntry[] = [];

	for (let index = 0; index < entryCount; index += 1) {
		if (cursor + 46 > buffer.length) {
			break;
		}
		if (buffer.readUInt32LE(cursor) !== cdfhSignature) {
			break;
		}
		const compressionMethod = buffer.readUInt16LE(cursor + 10);
		const compressedSize = buffer.readUInt32LE(cursor + 20);
		const fileNameLength = buffer.readUInt16LE(cursor + 28);
		const extraLength = buffer.readUInt16LE(cursor + 30);
		const commentLength = buffer.readUInt16LE(cursor + 32);
		const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
		const fileName = buffer
			.slice(cursor + 46, cursor + 46 + fileNameLength)
			.toString("utf8");

		if (localHeaderOffset + 30 > buffer.length) {
			break;
		}
		if (buffer.readUInt32LE(localHeaderOffset) !== lfhSignature) {
			break;
		}
		const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
		const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
		const dataStart =
			localHeaderOffset + 30 + localNameLength + localExtraLength;
		const dataEnd = dataStart + compressedSize;
		if (dataEnd > buffer.length) {
			break;
		}

		const compressed = buffer.slice(dataStart, dataEnd);
		if (compressionMethod === 0) {
			entries.push({ name: fileName, data: compressed });
		} else if (compressionMethod === 8) {
			entries.push({ name: fileName, data: inflateRawSync(compressed) });
		}

		cursor += 46 + fileNameLength + extraLength + commentLength;
	}

	return entries;
};

const extractTextFromZipXml = (
	buffer: Buffer,
	entryNamePattern: RegExp,
	tagPattern: RegExp,
): string => {
	const entries = parseZipEntries(buffer)
		.filter((entry) => entryNamePattern.test(entry.name))
		.sort((a, b) => a.name.localeCompare(b.name));
	const chunks: string[] = [];
	for (const entry of entries) {
		const xml = entry.data.toString("utf8");
		for (const match of xml.matchAll(tagPattern)) {
			chunks.push(decodeXmlEntities(match[1] ?? ""));
		}
	}
	return chunks.join(" ");
};

const extractAttachmentTextByFormat = (
	buffer: Buffer,
	format: string,
): string => {
	if (format === "txt") {
		return buffer.toString("utf8");
	}
	if (format === "pdf") {
		return extractPrintableText(buffer);
	}
	if (format === "docx") {
		return extractTextFromZipXml(
			buffer,
			/^word\/.+\.xml$/i,
			/<w:t[^>]*>(.*?)<\/w:t>/g,
		);
	}
	if (format === "xlsx") {
		return extractTextFromZipXml(
			buffer,
			/^xl\/.+\.xml$/i,
			/<t[^>]*>(.*?)<\/t>/g,
		);
	}
	if (format === "pptx") {
		return extractTextFromZipXml(
			buffer,
			/^ppt\/slides\/.+\.xml$/i,
			/<a:t[^>]*>(.*?)<\/a:t>/g,
		);
	}
	if (format === "doc" || format === "xls" || format === "ppt") {
		return extractPrintableText(buffer);
	}
	return "";
};

const resolveAttachmentAbsolutePath = (relativePath: string): string | null => {
	if (!isNonEmptyString(relativePath)) {
		return null;
	}
	if (isAbsolute(relativePath)) {
		return relativePath;
	}
	return resolve(process.cwd(), relativePath);
};

const buildAttachmentTextContext = (
	context: McpRuntimeContext,
	message: MailStoreMessage,
) => {
	if (!message.has_attachments) {
		return {
			merged_attachment_text: "",
			requires_user_confirmation: false,
		};
	}

	const records = Array.from(context.state.attachments.values())
		.filter((item) => item.message_pk === message.message_pk)
		.sort((a, b) => {
			const aKey = [
				a.attachment_pk,
				a.graph_attachment_id,
				a.sha256,
				a.relative_path,
			]
				.filter((part) => typeof part === "string")
				.join("::");
			const bKey = [
				b.attachment_pk,
				b.graph_attachment_id,
				b.sha256,
				b.relative_path,
			]
				.filter((part) => typeof part === "string")
				.join("::");
			return aKey.localeCompare(bKey);
		});

	const mergedParts: string[] = [];
	let totalChars = 0;
	for (const attachment of records) {
		const policy = resolveAttachmentFormatPolicy(attachment);
		if (policy.kind === "requires_confirmation") {
			return {
				merged_attachment_text: "",
				requires_user_confirmation: true,
			};
		}
		if (policy.kind !== "text") {
			continue;
		}

		try {
			const absolutePath = resolveAttachmentAbsolutePath(
				attachment.relative_path,
			);
			if (!isNonEmptyString(absolutePath)) {
				continue;
			}
			const raw = readFileSync(absolutePath);
			const normalized = normalizeFingerprintBody(
				extractAttachmentTextByFormat(raw, policy.format),
			).slice(0, AUTOPILOT_ATTACHMENT_TEXT_MAX_CHARS_PER_FILE);
			if (!isNonEmptyString(normalized)) {
				continue;
			}
			if (totalChars >= AUTOPILOT_ATTACHMENT_TEXT_MAX_CHARS_TOTAL) {
				break;
			}
			const remaining = AUTOPILOT_ATTACHMENT_TEXT_MAX_CHARS_TOTAL - totalChars;
			const text = normalized.slice(0, remaining);
			const label = isNonEmptyString(attachment.file_name)
				? attachment.file_name
				: isNonEmptyString(attachment.graph_attachment_id)
					? attachment.graph_attachment_id
					: attachment.attachment_pk;
			mergedParts.push(`[attachment:${label}] ${text}`);
			totalChars += text.length;
		} catch {}
	}

	return {
		merged_attachment_text: mergedParts.join("\n"),
		requires_user_confirmation: false,
	};
};

const buildAutopilotCandidatePayload = (
	context: McpRuntimeContext,
	message: MailStoreMessage,
): AutopilotCandidatePayloadBuildResult => {
	const subject = isNonEmptyString(message.subject)
		? message.subject.trim()
		: "무제 메일";
	const from = isNonEmptyString(message.from) ? message.from.trim() : "unknown";
	const baseBodyText = normalizeFingerprintBody(
		isNonEmptyString(message.body_text) ? message.body_text : subject,
	).slice(0, AUTOPILOT_CANDIDATE_BODY_MAX_CHARS);
	const attachmentTextContext = buildAttachmentTextContext(context, message);
	const internetMessageId = isNonEmptyString(message.internet_message_id)
		? message.internet_message_id.trim().toLowerCase()
		: "";
	const mergedBodyText = isNonEmptyString(
		attachmentTextContext.merged_attachment_text,
	)
		? `${baseBodyText}\n\n[attachments]\n${attachmentTextContext.merged_attachment_text}`.slice(
				0,
				AUTOPILOT_CANDIDATE_BODY_WITH_ATTACHMENTS_MAX_CHARS,
			)
		: baseBodyText;

	return {
		payload: {
			message_pk: message.message_pk,
			internet_message_id: internetMessageId,
			received_at: message.received_at,
			subject,
			from,
			body_text: mergedBodyText,
			has_attachments: message.has_attachments,
		},
		requires_user_confirmation:
			attachmentTextContext.requires_user_confirmation,
	};
};

const createDefaultRunCorrelationTelemetry = () => ({
	attempt: null,
	duration_ms: null,
	exit_code: null,
	failure_kind: null,
	fallback_used: true,
});

const buildCorrelationTelemetryFromCandidate = (
	telemetry: {
		attempt: number;
		duration_ms: number | null;
		exit_code: number | null;
		failure_kind: string | null;
		fallback_used: boolean;
	},
	overrides: Partial<{
		failure_kind: string | null;
	}> = {},
) => ({
	attempt: telemetry.attempt,
	duration_ms: telemetry.duration_ms,
	exit_code: telemetry.exit_code,
	failure_kind:
		overrides.failure_kind !== undefined
			? overrides.failure_kind
			: telemetry.failure_kind,
	fallback_used: telemetry.fallback_used,
});

const analyzeAutopilotCandidate = (
	context: McpRuntimeContext,
	message: MailStoreMessage,
	domainMirrorAdapter: DomainMirrorAdapter,
): AutopilotCandidateAnalysisResult => {
	const payloadResult = buildAutopilotCandidatePayload(context, message);
	const payload = payloadResult.payload;
	if (payloadResult.requires_user_confirmation) {
		return {
			message,
			payload,
			proposal: null,
			review_reason: "attachment_requires_user_confirmation",
			attempt_count: 0,
			telemetry: {
				attempt: 0,
				duration_ms: null,
				exit_code: null,
				failure_kind: null,
				fallback_used: true,
			},
		};
	}
	const maxAttempts = AUTOPILOT_CODEX_ANALYZE_MAX_RETRIES + 1;
	let exhaustedRetriableMessage: string | null = null;
	let lastAttemptTelemetry: {
		attempt: number;
		duration_ms: number | null;
		exit_code: number | null;
		failure_kind: string | null;
		fallback_used: boolean;
	} = {
		attempt: 1,
		duration_ms: null,
		exit_code: null,
		failure_kind: null,
		fallback_used: true,
	};
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const attemptResult = domainMirrorAdapter.analyzeAutopilotCandidateAttempt({
			message,
			payload,
			attempt,
			max_attempts: maxAttempts,
		});
		lastAttemptTelemetry = attemptResult.telemetry;
		if (attemptResult.kind === "failure") {
			if (attemptResult.classification === "retriable") {
				exhaustedRetriableMessage = attemptResult.message;
				if (attempt < maxAttempts) {
					continue;
				}
				break;
			}

			return {
				message,
				payload,
				proposal: null,
				review_reason: "analysis_failed",
				failure_class: "terminal",
				failure_kind: "analysis_fail",
				attempt_count: attempt,
				failure_message: attemptResult.message,
				telemetry: buildCorrelationTelemetryFromCandidate(
					attemptResult.telemetry,
					{ failure_kind: "analysis_fail" },
				),
			};
		}

		const parsedProposal = parseCodexProposalOutput(attemptResult.raw_output);
		if (!parsedProposal.ok) {
			return {
				message,
				payload,
				proposal: null,
				review_reason: "codex_schema_invalid",
				parse_error: parsedProposal.error,
				failure_class: "terminal",
				failure_kind: "schema_fail",
				attempt_count: attempt,
				telemetry: buildCorrelationTelemetryFromCandidate(
					attemptResult.telemetry,
					{ failure_kind: "schema_fail" },
				),
			};
		}

		return {
			message,
			payload,
			proposal: {
				message_pk: payload.message_pk,
				subject: payload.subject,
				from: payload.from,
				received_at: payload.received_at,
				snippet: parsedProposal.value.snippet,
				confidence: parsedProposal.value.confidence,
				todo_title: parsedProposal.value.todo_title,
				candidate_payload: payload,
			},
			review_reason: null,
			attempt_count: attempt,
			telemetry: buildCorrelationTelemetryFromCandidate(
				attemptResult.telemetry,
			),
		};
	}

	return {
		message,
		payload,
		proposal: null,
		review_reason: "codex_retriable_exhausted",
		failure_class: "retriable",
		failure_kind: "timeout",
		attempt_count: maxAttempts,
		failure_message: `${
			exhaustedRetriableMessage ?? "codex 분석 재시도 한도를 초과했습니다."
		} (attempts=${maxAttempts}/${maxAttempts})`,
		telemetry: buildCorrelationTelemetryFromCandidate(lastAttemptTelemetry, {
			failure_kind: "timeout",
		}),
	};
};

const analyzeAutopilotCandidates = (
	context: McpRuntimeContext,
	candidates: readonly MailStoreMessage[],
	domainMirrorAdapter: DomainMirrorAdapter,
): AutopilotCandidateAnalysisResult[] =>
	candidates.map((message) => {
		try {
			return analyzeAutopilotCandidate(context, message, domainMirrorAdapter);
		} catch {
			return {
				message,
				payload: buildAutopilotCandidatePayload(context, message).payload,
				proposal: null,
				review_reason: "analysis_failed",
				failure_kind: "analysis_fail",
				telemetry: {
					attempt: 1,
					duration_ms: null,
					exit_code: null,
					failure_kind: "analysis_fail",
					fallback_used: true,
				},
			};
		}
	});

const buildAutopilotStageFailureMatrix = (
	analyzedCandidates: readonly AutopilotCandidateAnalysisResult[],
	proposalCount: number,
): AutopilotStageFailureMatrix => {
	const retriableFailures = analyzedCandidates.filter(
		(item) => item.failure_class === "retriable",
	).length;
	const terminalFailures = analyzedCandidates.filter(
		(item) => item.failure_class === "terminal",
	).length;
	const totalFailures = retriableFailures + terminalFailures;
	const retriableExhausted = retriableFailures > 0 && proposalCount === 0;
	const thresholdBreached =
		totalFailures >= AUTOPILOT_CODEX_STAGE_FAILURE_THRESHOLD;

	return {
		retriable_failures: retriableFailures,
		terminal_failures: terminalFailures,
		total_failures: totalFailures,
		proposal_count: proposalCount,
		retriable_exhausted: retriableExhausted,
		threshold_breached: thresholdBreached,
	};
};

const handleAuthStoreLogout = (
	context: McpRuntimeContext,
	_input: AuthStoreLogoutInput,
) => {
	context.state.signed_in = false;
	context.state.account = null;
	context.state.auth_token = null;
	context.state.issued_session = null;
	context.state.pending_callback = null;
	return okResponse<AuthStoreLogoutOutput>({ signed_out: true });
};

const handleWorkflowCreateEvidence = (
	context: McpRuntimeContext,
	input: WorkflowCreateEvidenceInput,
) => {
	if (!isNonEmptyString(input.message_pk)) {
		return errorResponse("E_PARSE_FAILED", "message_pk 가 필요합니다.");
	}
	if (!isNonEmptyString(input.snippet)) {
		return errorResponse("E_PARSE_FAILED", "snippet 이 필요합니다.");
	}
	const message = context.state.messages.get(input.message_pk);
	if (!message) {
		return errorResponse("E_NOT_FOUND", "요청한 message 를 찾을 수 없습니다.");
	}
	const confidenceRaw = Number(input.confidence);
	const confidence =
		Number.isFinite(confidenceRaw) && confidenceRaw >= 0 && confidenceRaw <= 1
			? confidenceRaw
			: 0.7;
	const snippet = normalizeSnippet(input.snippet);
	const evidenceKey = isNonEmptyString(input.idempotency_key)
		? input.idempotency_key.trim()
		: buildEvidenceKey(input.message_pk, snippet);
	const existing = context.state.workflow.evidences.find(
		(item) => item.evidence_key === evidenceKey,
	);
	if (existing) {
		return okResponse<WorkflowCreateEvidenceOutput>({
			evidence: existing,
			created: false,
			updated: false,
			skipped_duplicate: true,
		});
	}
	const evidenceId = `ev_${evidenceKey.slice(4, 16)}`;
	const evidence: WorkflowEvidenceRecord = {
		evidence_id: evidenceId,
		evidence_key: evidenceKey,
		source: {
			kind: "email",
			id: input.message_pk,
			thread_pk: message.provider_thread_id,
		},
		locator: {
			type: "outlook_quote",
			text_quote: snippet,
		},
		snippet,
		confidence,
		created_at: nowIso(),
	};
	context.state.workflow.evidences = [
		...context.state.workflow.evidences,
		evidence,
	].slice(-500);
	return okResponse<WorkflowCreateEvidenceOutput>({
		evidence,
		created: true,
		updated: false,
		skipped_duplicate: false,
	});
};

const handleWorkflowUpsertTodo = (
	context: McpRuntimeContext,
	input: WorkflowUpsertTodoInput,
) => {
	if (!isNonEmptyString(input.title)) {
		return errorResponse("E_PARSE_FAILED", "title 이 필요합니다.");
	}
	const allowed: WorkflowTodoRecord["status"][] = [
		"open",
		"in_progress",
		"done",
	];
	const status: WorkflowTodoRecord["status"] =
		isNonEmptyString(input.status) && allowed.includes(input.status)
			? input.status
			: "open";
	const evidenceKey = isNonEmptyString(input.evidence_key)
		? input.evidence_key.trim()
		: isNonEmptyString(input.evidence_id)
			? input.evidence_id.trim()
			: "none";
	const todoKey = isNonEmptyString(input.idempotency_key)
		? input.idempotency_key.trim()
		: isNonEmptyString(input.todo_key)
			? input.todo_key.trim()
			: buildTodoKey(input.title, evidenceKey);
	const todoId = isNonEmptyString(input.todo_id)
		? input.todo_id.trim()
		: `todo_${todoKey.slice(4, 16)}`;
	const evidenceId = isNonEmptyString(input.evidence_id)
		? input.evidence_id.trim()
		: null;
	const now = nowIso();
	const idx = context.state.workflow.todos.findIndex(
		(item) => item.todo_id === todoId || item.todo_key === todoKey,
	);
	let created = false;
	let skippedDuplicate = false;
	if (idx >= 0) {
		const prev = context.state.workflow.todos[idx];
		if (
			prev.title === input.title.trim() &&
			prev.status === status &&
			prev.evidence_id === evidenceId
		) {
			skippedDuplicate = true;
		}
		context.state.workflow.todos[idx] = {
			...prev,
			todo_id: todoId,
			todo_key: todoKey,
			title: input.title.trim(),
			status,
			evidence_id: evidenceId,
			updated_at: now,
		};
	} else {
		created = true;
		context.state.workflow.todos.push({
			todo_id: todoId,
			todo_key: todoKey,
			title: input.title.trim(),
			status,
			evidence_id: evidenceId,
			created_at: now,
			updated_at: now,
		});
	}
	context.state.workflow.todos = context.state.workflow.todos.slice(-500);
	const todo =
		context.state.workflow.todos.find((item) => item.todo_id === todoId) ??
		null;
	return okResponse<WorkflowUpsertTodoOutput>({
		todo,
		created,
		updated: !created,
		skipped_duplicate: skippedDuplicate,
	});
};

const handleWorkflowList = (
	context: McpRuntimeContext,
	_input: WorkflowListInput,
) =>
	okResponse<WorkflowListOutput>({
		evidences: context.state.workflow.evidences,
		todos: context.state.workflow.todos,
	});

const markAutopilotFailure = (
	context: McpRuntimeContext,
	errorMessage: string,
): void => {
	context.state.autopilot.metrics.ticks_failed += 1;
	context.state.autopilot.consecutive_failures += 1;
	context.state.autopilot.last_error = errorMessage;
	context.state.autopilot.in_flight_run_id = null;
	if (
		context.state.autopilot.consecutive_failures >=
		AUTOPILOT_MAX_CONSECUTIVE_FAILURES
	) {
		context.state.autopilot.status = "degraded";
		context.state.autopilot.paused = true;
		return;
	}
	context.state.autopilot.status = "retrying";
};

const updateCodexStageStatusFromMetrics = (
	context: McpRuntimeContext,
): void => {
	context.state.autopilot.codex_stage.started =
		context.state.autopilot.metrics.codex_stage_started;
	context.state.autopilot.codex_stage.success =
		context.state.autopilot.metrics.codex_stage_success;
	context.state.autopilot.codex_stage.fail =
		context.state.autopilot.metrics.codex_stage_fail;
	context.state.autopilot.codex_stage.timeout =
		context.state.autopilot.metrics.codex_stage_timeout;
	context.state.autopilot.codex_stage.schema_fail =
		context.state.autopilot.metrics.codex_stage_schema_fail;
};

const setCodexStageLastFailure = (
	context: McpRuntimeContext,
	reason: string | null,
): void => {
	context.state.autopilot.codex_stage.last_failure_reason = reason;
};

const setCodexStageRunCorrelation = (
	context: McpRuntimeContext,
	runCorrelation: readonly AutopilotRunCorrelation[],
): void => {
	context.state.autopilot.codex_stage.last_run_correlation =
		runCorrelation.slice(-30);
};

const buildCodexStageObservability = (context: McpRuntimeContext) => ({
	codex_stage_metrics: {
		started: context.state.autopilot.metrics.codex_stage_started,
		success: context.state.autopilot.metrics.codex_stage_success,
		fail: context.state.autopilot.metrics.codex_stage_fail,
		timeout: context.state.autopilot.metrics.codex_stage_timeout,
		schema_fail: context.state.autopilot.metrics.codex_stage_schema_fail,
	},
	codex_last_failure_reason:
		context.state.autopilot.codex_stage.last_failure_reason ??
		context.state.autopilot.last_error,
});

const handleAutopilotSetMode = (
	context: McpRuntimeContext,
	input: AutopilotSetModeInput,
) => {
	if (!["manual", "review_first", "full_auto"].includes(input.mode)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"mode 는 manual/review_first/full_auto 중 하나여야 합니다.",
		);
	}
	context.state.autopilot.mode = input.mode;
	context.state.autopilot.paused = input.mode === "manual";
	context.state.autopilot.status = input.mode === "manual" ? "paused" : "idle";
	context.state.autopilot.last_error = null;
	context.state.autopilot.consecutive_failures = 0;
	return okResponse<AutopilotSetModeOutput>({
		mode: context.state.autopilot.mode,
		status: context.state.autopilot.status as AutopilotSetModeOutput["status"],
		paused: context.state.autopilot.paused,
	});
};

const handleAutopilotPause = (
	context: McpRuntimeContext,
	_input: AutopilotPauseInput,
) => {
	context.state.autopilot.paused = true;
	context.state.autopilot.status = "paused";
	context.state.autopilot.in_flight_run_id = null;
	return okResponse<AutopilotPauseOutput>({
		paused: true,
		status: "paused",
	});
};

const handleAutopilotResume = (
	context: McpRuntimeContext,
	_input: AutopilotResumeInput,
) => {
	if (context.state.autopilot.mode === "manual") {
		return errorResponse(
			"E_POLICY_DENIED",
			"manual 모드에서는 재개할 수 없습니다.",
		);
	}
	context.state.autopilot.paused = false;
	context.state.autopilot.status = "idle";
	context.state.autopilot.consecutive_failures = 0;
	context.state.autopilot.last_error = null;
	return okResponse<AutopilotResumeOutput>({
		paused: false,
		status: "idle",
	});
};

const handleAutopilotStatus = (
	context: McpRuntimeContext,
	_input: AutopilotStatusInput,
) =>
	okResponse<AutopilotStatusOutput>({
		mode: context.state.autopilot.mode,
		status: context.state.autopilot.status,
		paused: context.state.autopilot.paused,
		in_flight_run_id: context.state.autopilot.in_flight_run_id,
		last_error: context.state.autopilot.last_error,
		consecutive_failures: context.state.autopilot.consecutive_failures,
		last_tick_at: context.state.autopilot.last_tick_at,
		metrics: context.state.autopilot.metrics,
		codex_stage: context.state.autopilot.codex_stage,
		...buildCodexStageObservability(context),
		codex_exec_contract: CODEX_EXEC_RUNTIME_CONTRACT,
		persistence_authority: PHASE_1_PERSISTENCE_AUTHORITY,
	});

const handleAutopilotTick = (
	context: McpRuntimeContext,
	input: AutopilotTickInput,
) => {
	const modePolicy = resolveAutopilotModePolicy(context);
	if (!modePolicy.tick_allowed && context.state.autopilot.mode === "manual") {
		return errorResponse(
			"E_POLICY_DENIED",
			"manual 모드입니다. autopilot.set_mode 도구를 먼저 실행하세요.",
		);
	}
	if (
		!modePolicy.tick_allowed &&
		context.state.autopilot.status === "degraded"
	) {
		return errorResponse(
			"E_POLICY_DENIED",
			`autopilot 이 성능 저하(degraded) 상태입니다. ${context.state.autopilot.last_error ?? "복구 후 재개(resume)하세요."}`,
		);
	}
	if (context.state.autopilot.paused) {
		return errorResponse(
			"E_POLICY_DENIED",
			"autopilot 이 일시정지(paused) 상태입니다.",
		);
	}
	const runId = `run_${Date.now()}_${randomBytes(3).toString("hex")}`;
	context.state.autopilot.in_flight_run_id = runId;
	context.state.autopilot.last_tick_at = nowIso();
	context.state.autopilot.metrics.ticks_total += 1;
	const folder = isNonEmptyString(input.mail_folder)
		? input.mail_folder
		: "inbox";
	const sync = handleGraphDeltaSync(context, { mail_folder: folder });
	if (!sync.ok) {
		markAutopilotFailure(context, sync.error_message);
		return sync;
	}

	context.state.autopilot.status = "analyzing";
	const maxMessages =
		typeof input.max_messages_per_tick === "number" &&
		Number.isInteger(input.max_messages_per_tick) &&
		input.max_messages_per_tick > 0
			? Math.min(30, input.max_messages_per_tick)
			: 30;
	const candidates = selectAutopilotCandidates(context, maxMessages);

	if (candidates.length > 0) {
		const codexAuthError = requireCodexAuthContext(context);
		if (codexAuthError !== null) {
			setCodexStageLastFailure(context, codexAuthError.error_message);
			markAutopilotFailure(context, codexAuthError.error_message);
			return codexAuthError;
		}
	}

	const runCorrelation: AutopilotRunCorrelation[] = candidates.map(
		(message) => ({
			run_id: runId,
			correlation_id: `corr_${createHash("sha1")
				.update(`${runId}:${message.message_pk}`)
				.digest("hex")
				.slice(0, 16)}`,
			message_pk: message.message_pk,
			candidate_stage: "selected",
			analysis_stage: "review",
			persistence_stage: "not_run",
			...createDefaultRunCorrelationTelemetry(),
		}),
	);
	const runCorrelationByMessagePk = new Map(
		runCorrelation.map((item) => [item.message_pk, item]),
	);
	context.state.autopilot.metrics.codex_stage_started += candidates.length;
	const analyzedCandidates = analyzeAutopilotCandidates(
		context,
		candidates,
		context.domainMirrorAdapter ?? DEFAULT_DOMAIN_MIRROR_ADAPTER,
	);
	for (const analyzed of analyzedCandidates) {
		const correlation = runCorrelationByMessagePk.get(
			analyzed.message.message_pk,
		);
		if (correlation) {
			correlation.attempt = analyzed.telemetry.attempt;
			correlation.duration_ms = analyzed.telemetry.duration_ms;
			correlation.exit_code = analyzed.telemetry.exit_code;
			correlation.failure_kind = analyzed.telemetry.failure_kind;
			correlation.fallback_used = analyzed.telemetry.fallback_used;
		}
		if (analyzed.proposal !== null) {
			context.state.autopilot.metrics.codex_stage_success += 1;
			if (correlation) {
				correlation.analysis_stage = "proposal";
			}
			continue;
		}

		context.state.autopilot.metrics.codex_stage_fail += 1;
		if (analyzed.failure_kind === "timeout") {
			context.state.autopilot.metrics.codex_stage_timeout += 1;
		}
		if (analyzed.failure_kind === "schema_fail") {
			context.state.autopilot.metrics.codex_stage_schema_fail += 1;
		}
		if (correlation) {
			if (analyzed.review_reason === "codex_schema_invalid") {
				correlation.analysis_stage = "codex_schema_invalid";
			} else if (analyzed.review_reason === "codex_retriable_exhausted") {
				correlation.analysis_stage = "codex_retriable_exhausted";
			} else if (analyzed.review_reason === "analysis_failed") {
				correlation.analysis_stage = "analysis_failed";
			} else {
				correlation.analysis_stage = "review";
			}
		}
		if (isNonEmptyString(analyzed.failure_message)) {
			setCodexStageLastFailure(context, analyzed.failure_message);
		} else if (isNonEmptyString(analyzed.parse_error?.message)) {
			setCodexStageLastFailure(context, analyzed.parse_error.message);
		}
	}
	updateCodexStageStatusFromMetrics(context);
	const analysisProposals = analyzedCandidates
		.map((item) => item.proposal)
		.filter((item): item is AutopilotAnalysisProposal => item !== null);
	const failureMatrix = buildAutopilotStageFailureMatrix(
		analyzedCandidates,
		analysisProposals.length,
	);
	if (failureMatrix.retriable_exhausted) {
		const details = analyzedCandidates
			.map((item) => item.failure_message)
			.filter(isNonEmptyString)
			.join(" | ");
		const failureMessage =
			details.length > 0 ? details : "codex 분석 재시도 한도를 초과했습니다.";
		setCodexStageLastFailure(context, failureMessage);
		setCodexStageRunCorrelation(context, runCorrelation);
		markAutopilotFailure(context, failureMessage);
		return errorResponse(
			"E_CODEX_ANALYZE_RETRY_EXHAUSTED",
			failureMessage,
			true,
		);
	}
	if (
		context.state.autopilot.mode === "full_auto" &&
		failureMatrix.threshold_breached
	) {
		const failureMessage = `codex 분석 실패 임계치(${AUTOPILOT_CODEX_STAGE_FAILURE_THRESHOLD})를 초과했습니다. retriable=${failureMatrix.retriable_failures}, terminal=${failureMatrix.terminal_failures}, sync=+${sync.data.changes.added} ~${sync.data.changes.updated} -${sync.data.changes.deleted}`;
		setCodexStageLastFailure(context, failureMessage);
		setCodexStageRunCorrelation(context, runCorrelation);
		markAutopilotFailure(context, failureMessage);
		return errorResponse(
			"E_CODEX_ANALYZE_RETRY_EXHAUSTED",
			failureMessage,
			failureMatrix.retriable_failures > 0,
		);
	}

	let evidenceCreated = 0;
	let todoCreated = 0;
	let evidenceWrites = 0;
	let todoWrites = 0;
	let reviewCandidates = 0;
	if (context.state.autopilot.mode === "review_first") {
		reviewCandidates = analysisProposals.length;
		context.state.autopilot.metrics.review_candidates += reviewCandidates;
		for (const correlation of runCorrelation) {
			correlation.persistence_stage = "skipped_review_first";
		}
	} else {
		context.state.autopilot.status = "persisting";
		for (const analyzed of analyzedCandidates) {
			const persistResult = persistAnalyzedCandidateViaWorkflow(
				context,
				analyzed,
			);
			const correlation = runCorrelationByMessagePk.get(
				analyzed.message.message_pk,
			);
			reviewCandidates += persistResult.review_candidate ? 1 : 0;
			evidenceCreated += persistResult.evidence_created;
			todoCreated += persistResult.todo_created;
			evidenceWrites += persistResult.evidence_writes;
			todoWrites += persistResult.todo_writes;
			if (correlation) {
				correlation.persistence_stage = persistResult.review_candidate
					? "review_candidate"
					: "persisted";
			}
		}
	}

	context.state.autopilot.status = "idle";
	context.state.autopilot.in_flight_run_id = null;
	context.state.autopilot.consecutive_failures = 0;
	context.state.autopilot.last_error = null;
	context.state.autopilot.metrics.ticks_success += 1;
	context.state.autopilot.metrics.auto_evidence_created += evidenceCreated;
	context.state.autopilot.metrics.auto_todo_created += todoCreated;
	context.state.autopilot.metrics.review_candidates += reviewCandidates;
	if (failureMatrix.total_failures === 0) {
		setCodexStageLastFailure(context, null);
	}
	setCodexStageRunCorrelation(context, runCorrelation);

	return okResponse<AutopilotTickOutput>({
		run_id: runId,
		mode: context.state.autopilot.mode,
		synced_changes: sync.data.changes,
		auto_evidence_created: evidenceCreated,
		auto_todo_created: todoCreated,
		auto_evidence_writes: evidenceWrites,
		auto_todo_writes: todoWrites,
		auto_attachment_saved: 0,
		review_candidates: reviewCandidates,
		run_correlation: runCorrelation,
		...(context.state.autopilot.mode === "review_first"
			? { analysis_proposals: analysisProposals }
			: {}),
	});
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
	"auth_store.logout": (context, input) =>
		handleAuthStoreLogout(context, input),
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
	"workflow.create_evidence": (context, input) =>
		handleWorkflowCreateEvidence(context, input),
	"workflow.upsert_todo": (context, input) =>
		handleWorkflowUpsertTodo(context, input),
	"workflow.list": (context, input) => handleWorkflowList(context, input),
	"autopilot.set_mode": (context, input) =>
		handleAutopilotSetMode(context, input),
	"autopilot.pause": (context, input) => handleAutopilotPause(context, input),
	"autopilot.resume": (context, input) => handleAutopilotResume(context, input),
	"autopilot.status": (context, input) => handleAutopilotStatus(context, input),
	"autopilot.tick": (context, input) => handleAutopilotTick(context, input),
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
