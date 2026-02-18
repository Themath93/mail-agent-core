#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { basename, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const statePath = new URL("./state.json", import.meta.url);
const configPath = new URL("./config.json", import.meta.url);
const callbackListenerPath = new URL(
	"./callback-listener.mjs",
	import.meta.url,
);
const attachmentDirPath = new URL("./data/attachments", import.meta.url);

const nowIso = () => new Date().toISOString();

const isNonEmptyString = (value) =>
	typeof value === "string" && value.trim().length > 0;

const isArrayOfNonEmptyStrings = (value) =>
	Array.isArray(value) && value.every(isNonEmptyString);

const toBase64Url = (buffer) =>
	buffer
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");

const defaultState = () => ({
	signed_in: false,
	account: null,
	issued_session: null,
	auth_token: null,
	pending_callback: null,
	mailbox: {
		messages: {},
		thread_messages: {},
		delta_links: {},
		attachments: {},
	},
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
	logs: [],
});

const defaultConfig = () => ({
	tenant: "common",
	client_id: "",
	redirect_uri: "http://127.0.0.1:1270/mcp/callback",
	callback_poll_ms: 1000,
	codex_exec: {
		enabled: false,
		shadow_mode: false,
		fallback_to_synthetic_on_error: true,
		opencode_api_key_env: "OPENCODE_CODEX_API_KEY",
		env_api_key_env: "CODEX_API_KEY",
		env_fallback_only_ci_headless: true,
	},
	codex_auth: {
		mode: "disabled",
		api_key_env: "CODEX_API_KEY",
	},
});

const normalizeObject = (value) =>
	value !== null && typeof value === "object" && !Array.isArray(value)
		? value
		: {};

const normalizeWorkflowState = (value) => {
	const source = normalizeObject(value);
	const evidences = Array.isArray(source.evidences)
		? source.evidences
				.filter((item) => item && typeof item === "object")
				.slice(-500)
		: [];
	const todos = Array.isArray(source.todos)
		? source.todos
				.filter((item) => item && typeof item === "object")
				.slice(-500)
		: [];

	return {
		evidences,
		todos,
	};
};

const normalizeAutopilotState = (value) => {
	const source = normalizeObject(value);
	const allowedModes = ["manual", "review_first", "full_auto"];
	const allowedStatuses = [
		"idle",
		"syncing",
		"analyzing",
		"persisting",
		"paused",
		"degraded",
		"retrying",
	];
	const rawMetrics = normalizeObject(source.metrics);
	const asCount = (input) =>
		typeof input === "number" && Number.isInteger(input) && input >= 0
			? input
			: 0;

	return {
		mode:
			isNonEmptyString(source.mode) && allowedModes.includes(source.mode)
				? source.mode
				: "manual",
		status:
			isNonEmptyString(source.status) && allowedStatuses.includes(source.status)
				? source.status
				: "idle",
		paused: Boolean(source.paused),
		in_flight_run_id: isNonEmptyString(source.in_flight_run_id)
			? source.in_flight_run_id
			: null,
		last_error: isNonEmptyString(source.last_error) ? source.last_error : null,
		consecutive_failures:
			typeof source.consecutive_failures === "number" &&
			Number.isInteger(source.consecutive_failures) &&
			source.consecutive_failures >= 0
				? source.consecutive_failures
				: 0,
		last_tick_at: isNonEmptyString(source.last_tick_at)
			? source.last_tick_at
			: null,
		metrics: {
			ticks_total: asCount(rawMetrics.ticks_total),
			ticks_success: asCount(rawMetrics.ticks_success),
			ticks_failed: asCount(rawMetrics.ticks_failed),
			auto_evidence_created: asCount(rawMetrics.auto_evidence_created),
			auto_todo_created: asCount(rawMetrics.auto_todo_created),
			auto_attachment_saved: asCount(rawMetrics.auto_attachment_saved),
			review_candidates: asCount(rawMetrics.review_candidates),
			codex_stage_started: asCount(rawMetrics.codex_stage_started),
			codex_stage_success: asCount(rawMetrics.codex_stage_success),
			codex_stage_fail: asCount(rawMetrics.codex_stage_fail),
			codex_stage_timeout: asCount(rawMetrics.codex_stage_timeout),
			codex_stage_schema_fail: asCount(rawMetrics.codex_stage_schema_fail),
		},
		codex_stage: {
			started: asCount(source.codex_stage?.started),
			success: asCount(source.codex_stage?.success),
			fail: asCount(source.codex_stage?.fail),
			timeout: asCount(source.codex_stage?.timeout),
			schema_fail: asCount(source.codex_stage?.schema_fail),
			last_failure_reason: isNonEmptyString(
				source.codex_stage?.last_failure_reason,
			)
				? source.codex_stage.last_failure_reason
				: null,
			last_run_correlation: Array.isArray(
				source.codex_stage?.last_run_correlation,
			)
				? source.codex_stage.last_run_correlation
						.filter((item) => item && typeof item === "object")
						.slice(-30)
				: [],
		},
	};
};

const normalizeState = (value) => {
	const base = defaultState();
	const source = normalizeObject(value);
	const mailbox = normalizeObject(source.mailbox);
	const pendingCallback = normalizeObject(source.pending_callback);
	const logs = Array.isArray(source.logs) ? source.logs.slice(-500) : [];
	const workflow = normalizeWorkflowState(source.workflow);
	const autopilot = normalizeAutopilotState(source.autopilot);

	return {
		...base,
		signed_in: Boolean(source.signed_in),
		account:
			source.account && typeof source.account.email === "string"
				? {
						email: source.account.email,
						tenant:
							typeof source.account.tenant === "string"
								? source.account.tenant
								: "default",
					}
				: null,
		issued_session:
			source.issued_session && typeof source.issued_session === "object"
				? source.issued_session
				: null,
		auth_token:
			source.auth_token && typeof source.auth_token === "object"
				? source.auth_token
				: null,
		pending_callback:
			typeof pendingCallback.code === "string" &&
			typeof pendingCallback.state === "string"
				? {
						code: pendingCallback.code,
						state: pendingCallback.state,
						received_at:
							typeof pendingCallback.received_at === "string"
								? pendingCallback.received_at
								: nowIso(),
					}
				: null,
		mailbox: {
			messages: normalizeObject(mailbox.messages),
			thread_messages: normalizeObject(mailbox.thread_messages),
			delta_links: normalizeObject(mailbox.delta_links),
			attachments: normalizeObject(mailbox.attachments),
		},
		workflow,
		autopilot,
		logs: logs,
	};
};

const normalizeConfig = (value) => {
	const source = normalizeObject(value);
	const codexExec = normalizeObject(source.codex_exec);
	const codexAuth = normalizeObject(source.codex_auth);
	const base = defaultConfig();
	const codexExecBase = base.codex_exec;
	const codexAuthBase = base.codex_auth;
	const codexAuthMode =
		isNonEmptyString(codexAuth.mode) &&
		["disabled", "env"].includes(codexAuth.mode)
			? codexAuth.mode
			: codexAuthBase.mode;
	return {
		tenant: isNonEmptyString(source.tenant)
			? source.tenant.trim()
			: base.tenant,
		client_id: isNonEmptyString(source.client_id)
			? source.client_id.trim()
			: "",
		redirect_uri: isNonEmptyString(source.redirect_uri)
			? source.redirect_uri.trim()
			: base.redirect_uri,
		callback_poll_ms:
			typeof source.callback_poll_ms === "number" &&
			source.callback_poll_ms >= 200
				? source.callback_poll_ms
				: base.callback_poll_ms,
		codex_exec: {
			enabled:
				typeof codexExec.enabled === "boolean"
					? codexExec.enabled
					: codexExecBase.enabled,
			shadow_mode:
				typeof codexExec.shadow_mode === "boolean"
					? codexExec.shadow_mode
					: codexExecBase.shadow_mode,
			fallback_to_synthetic_on_error:
				typeof codexExec.fallback_to_synthetic_on_error === "boolean"
					? codexExec.fallback_to_synthetic_on_error
					: codexExecBase.fallback_to_synthetic_on_error,
			opencode_api_key_env: isNonEmptyString(codexExec.opencode_api_key_env)
				? codexExec.opencode_api_key_env.trim()
				: codexExecBase.opencode_api_key_env,
			env_api_key_env: isNonEmptyString(codexExec.env_api_key_env)
				? codexExec.env_api_key_env.trim()
				: codexExecBase.env_api_key_env,
			env_fallback_only_ci_headless:
				typeof codexExec.env_fallback_only_ci_headless === "boolean"
					? codexExec.env_fallback_only_ci_headless
					: codexExecBase.env_fallback_only_ci_headless,
		},
		codex_auth: {
			mode: codexAuthMode,
			api_key_env: isNonEmptyString(codexAuth.api_key_env)
				? codexAuth.api_key_env.trim()
				: codexAuthBase.api_key_env,
		},
	};
};

const readState = () => {
	try {
		const raw = readFileSync(statePath, "utf8");
		return normalizeState(JSON.parse(raw));
	} catch {
		return defaultState();
	}
};

const writeState = (state) => {
	writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

const readConfig = () => {
	try {
		const raw = readFileSync(configPath, "utf8");
		return normalizeConfig(JSON.parse(raw));
	} catch {
		return defaultConfig();
	}
};

const pushLog = (state, level, event, message) => {
	const logs = Array.isArray(state.logs) ? state.logs : [];
	logs.push({
		at: nowIso(),
		level,
		event,
		message: redactSensitiveText(message),
	});
	state.logs = logs.slice(-500);
};

const errorResponse = (errorCode, errorMessage, retryable = false) => ({
	ok: false,
	error_code: errorCode,
	error_message: errorMessage,
	retryable: retryable,
});

const AUTOPILOT_ALLOWED_MODES = ["manual", "review_first", "full_auto"];
const AUTOPILOT_ALLOWED_STATUSES = [
	"idle",
	"syncing",
	"analyzing",
	"persisting",
	"paused",
	"degraded",
	"retrying",
];
const AUTOPILOT_MAX_CONSECUTIVE_FAILURES = 3;
const AUTOPILOT_CODEX_ANALYZE_TIMEOUT_MS = 1500;
const AUTOPILOT_CODEX_ANALYZE_MAX_RETRIES = 2;
const AUTOPILOT_CODEX_STAGE_FAILURE_THRESHOLD = 2;
const CODEX_CLI_EXECUTABLE = "codex";
const CODEX_CLI_TIMEOUT_GRACE_KILL_MS = 500;
const AUTOPILOT_MAX_MESSAGES_PER_TICK = 30;
const AUTOPILOT_MAX_ATTACHMENTS_PER_TICK = 10;
const AUTOPILOT_DEFAULT_FOLDER = "inbox";
const AUTOPILOT_DEFAULT_DAYS_BACK = 1;
const AUTOPILOT_REVIEW_MIN_CONFIDENCE = 0.75;
const AUTOPILOT_AUTO_MIN_CONFIDENCE = 0.92;
const CODEX_AUTH_ALLOWED_MODES = ["disabled", "env"];
const CODEX_EXEC_AUTH_PRECEDENCE = Object.freeze([
	"opencode_connected",
	"env_fallback",
]);
const CODEX_EXEC_ALLOWED_ENV_FALLBACK_CONTEXTS = Object.freeze([
	"ci",
	"headless",
]);
const CODEX_EXEC_MODE_POLICY_MATRIX = Object.freeze({
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
});

const isTruthyRuntimeFlag = (value) => {
	if (!isNonEmptyString(value)) {
		return false;
	}
	const normalized = value.trim().toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes";
};

const SAFE_ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SENSITIVE_ENV_NAME_PATTERN =
	/(api[_-]?key|token|secret|password|authorization)/i;
const SENSITIVE_TEXT_KV_PATTERN =
	/((?:api[_-]?key|token|secret|password|authorization)\s*[=:]\s*)([^\s,;]+)/gi;
const SENSITIVE_TEXT_JSON_PATTERN =
	/("(?:api[_-]?key|token|secret|password|authorization)"\s*:\s*)"[^"]*"/gi;
const SENSITIVE_TEXT_BEARER_PATTERN = /(Bearer\s+)([^\s]+)/gi;
const SENSITIVE_TEXT_QUERY_PATTERN =
	/([?&](?:api[_-]?key|token|secret|password|authorization)=)([^&#\s]+)/gi;

let cachedSensitiveEnvValues = null;

const normalizeSafeEnvName = (value) => {
	if (!isNonEmptyString(value)) {
		return "invalid_env_name";
	}
	const trimmed = value.trim();
	return SAFE_ENV_NAME_PATTERN.test(trimmed) ? trimmed : "invalid_env_name";
};

const resolveSensitiveEnvValues = () => {
	if (cachedSensitiveEnvValues !== null) {
		return cachedSensitiveEnvValues;
	}
	const values = [];
	for (const [name, rawValue] of Object.entries(process.env)) {
		if (!SENSITIVE_ENV_NAME_PATTERN.test(name)) {
			continue;
		}
		if (!isNonEmptyString(rawValue)) {
			continue;
		}
		if (rawValue.trim().length < 8) {
			continue;
		}
		values.push(rawValue);
	}
	values.sort((left, right) => right.length - left.length);
	cachedSensitiveEnvValues = values;
	return values;
};

const redactSensitiveText = (value) => {
	if (!isNonEmptyString(value)) {
		return "";
	}
	let redacted = value;
	redacted = redacted.replace(SENSITIVE_TEXT_BEARER_PATTERN, "$1[REDACTED]");
	redacted = redacted.replace(SENSITIVE_TEXT_KV_PATTERN, "$1[REDACTED]");
	redacted = redacted.replace(SENSITIVE_TEXT_JSON_PATTERN, '$1"[REDACTED]"');
	redacted = redacted.replace(SENSITIVE_TEXT_QUERY_PATTERN, "$1[REDACTED]");
	for (const secretValue of resolveSensitiveEnvValues()) {
		if (!redacted.includes(secretValue)) {
			continue;
		}
		redacted = redacted.split(secretValue).join("[REDACTED]");
	}
	return redacted;
};

const sanitizeLogRecord = (entry) => {
	if (!entry || typeof entry !== "object") {
		return null;
	}
	return {
		at: safeIsoTimestamp(entry.at, nowIso()),
		level: isNonEmptyString(entry.level) ? entry.level : "info",
		event: isNonEmptyString(entry.event) ? entry.event : "unknown",
		message: redactSensitiveText(entry.message),
	};
};

const formatCodexAuthSource = (prefix, envName) =>
	`${prefix}:${normalizeSafeEnvName(envName)}`;

const sanitizeAutopilotForStatus = (autopilot) => {
	const codexStage = normalizeObject(autopilot?.codex_stage);
	const redactedLastError = redactSensitiveText(autopilot.last_error);
	const redactedLastFailureReason = redactSensitiveText(
		codexStage.last_failure_reason,
	);
	return {
		mode: autopilot.mode,
		status: autopilot.status,
		paused: autopilot.paused,
		in_flight_run_id: autopilot.in_flight_run_id,
		last_error: redactedLastError,
		consecutive_failures: autopilot.consecutive_failures,
		last_tick_at: autopilot.last_tick_at,
		metrics: autopilot.metrics,
		codex_stage: {
			...codexStage,
			last_failure_reason: redactedLastFailureReason,
		},
		...buildCodexStageObservability({
			...autopilot,
			last_error: redactedLastError,
			codex_stage: {
				...codexStage,
				last_failure_reason: redactedLastFailureReason,
			},
		}),
	};
};

const sanitizeCodexExecContractForStatus = (runtimeContract) => ({
	...runtimeContract,
	flags: {
		...runtimeContract.flags,
		opencode_connected_api_key_env: normalizeSafeEnvName(
			runtimeContract.flags.opencode_connected_api_key_env,
		),
		env_fallback_api_key_env: normalizeSafeEnvName(
			runtimeContract.flags.env_fallback_api_key_env,
		),
	},
});

const isCiRuntime = () => isTruthyRuntimeFlag(process.env.CI);

const isHeadlessRuntime = () =>
	isTruthyRuntimeFlag(process.env.HEADLESS) ||
	isTruthyRuntimeFlag(process.env.CODEX_HEADLESS) ||
	isTruthyRuntimeFlag(process.env.PLAYWRIGHT_HEADLESS);

const buildCodexExecRuntimeContract = (config) => {
	const codexExecConfig = normalizeObject(config?.codex_exec);
	const base = defaultConfig().codex_exec;
	const flags = {
		codex_exec_enabled:
			typeof codexExecConfig.enabled === "boolean"
				? codexExecConfig.enabled
				: base.enabled,
		codex_exec_shadow_mode:
			typeof codexExecConfig.shadow_mode === "boolean"
				? codexExecConfig.shadow_mode
				: base.shadow_mode,
		codex_exec_fallback_to_synthetic_on_error:
			typeof codexExecConfig.fallback_to_synthetic_on_error === "boolean"
				? codexExecConfig.fallback_to_synthetic_on_error
				: base.fallback_to_synthetic_on_error,
		opencode_connected_api_key_env: isNonEmptyString(
			codexExecConfig.opencode_api_key_env,
		)
			? codexExecConfig.opencode_api_key_env.trim()
			: base.opencode_api_key_env,
		env_fallback_api_key_env: isNonEmptyString(codexExecConfig.env_api_key_env)
			? codexExecConfig.env_api_key_env.trim()
			: base.env_api_key_env,
		env_fallback_only_ci_headless:
			typeof codexExecConfig.env_fallback_only_ci_headless === "boolean"
				? codexExecConfig.env_fallback_only_ci_headless
				: base.env_fallback_only_ci_headless,
	};

	return {
		flags,
		auth_precedence: CODEX_EXEC_AUTH_PRECEDENCE,
		env_fallback_allowed_contexts: CODEX_EXEC_ALLOWED_ENV_FALLBACK_CONTEXTS,
		mode_policy_matrix: CODEX_EXEC_MODE_POLICY_MATRIX,
	};
};

const resolveAutopilotModePolicy = (autopilot, runtimeContract) => {
	if (autopilot.status === "degraded") {
		return runtimeContract.mode_policy_matrix.degraded;
	}
	if (autopilot.mode === "manual") {
		return runtimeContract.mode_policy_matrix.manual;
	}
	if (autopilot.mode === "review_first") {
		return runtimeContract.mode_policy_matrix.review_first;
	}
	return runtimeContract.mode_policy_matrix.full_auto;
};

const redactSecret = (value) => {
	if (!isNonEmptyString(value)) {
		return "[REDACTED]";
	}
	return "[REDACTED]";
};

const resolveCodexAuth = (config) => {
	const authConfig =
		config && typeof config.codex_auth === "object"
			? config.codex_auth
			: defaultConfig().codex_auth;
	const mode = isNonEmptyString(authConfig.mode)
		? authConfig.mode.trim()
		: "disabled";

	if (!CODEX_AUTH_ALLOWED_MODES.includes(mode)) {
		return {
			ok: false,
			error: errorResponse(
				"E_CODEX_AUTH_FAILED",
				"codex auth mode 설정이 올바르지 않습니다.",
			),
			logMessage: `invalid codex auth mode: ${mode}`,
		};
	}

	if (mode === "disabled") {
		return { ok: true, enabled: false };
	}

	const apiKeyEnv = isNonEmptyString(authConfig.api_key_env)
		? authConfig.api_key_env.trim()
		: "CODEX_API_KEY";
	const apiKey = process.env[apiKeyEnv];
	if (!isNonEmptyString(apiKey)) {
		return {
			ok: false,
			error: errorResponse(
				"E_CODEX_AUTH_REQUIRED",
				`${apiKeyEnv} 환경변수 설정이 필요합니다.`,
			),
			logMessage: `missing codex auth env: ${apiKeyEnv}`,
		};
	}

	return {
		ok: true,
		enabled: true,
		source: formatCodexAuthSource("env", apiKeyEnv),
		redacted: redactSecret(apiKey),
	};
};

const resolveCodexExecAuth = (config, runtimeContract) => {
	const opencodeEnv =
		runtimeContract.flags.opencode_connected_api_key_env ??
		"OPENCODE_CODEX_API_KEY";
	const opencodeApiKey = process.env[opencodeEnv];
	if (isNonEmptyString(opencodeApiKey)) {
		return {
			ok: true,
			enabled: true,
			source: formatCodexAuthSource("opencode_connected", opencodeEnv),
			redacted: redactSecret(opencodeApiKey),
		};
	}

	if (!runtimeContract.flags.env_fallback_only_ci_headless) {
		const envName = runtimeContract.flags.env_fallback_api_key_env;
		const apiKey = process.env[envName];
		if (!isNonEmptyString(apiKey)) {
			return {
				ok: false,
				error: errorResponse(
					"E_CODEX_AUTH_REQUIRED",
					`${envName} 환경변수 설정이 필요합니다.`,
				),
				logMessage: `missing codex env fallback: ${envName}`,
			};
		}
		return {
			ok: true,
			enabled: true,
			source: formatCodexAuthSource("env_fallback", envName),
			redacted: redactSecret(apiKey),
		};
	}

	if (!isCiRuntime() && !isHeadlessRuntime()) {
		return {
			ok: false,
			error: errorResponse(
				"E_CODEX_AUTH_REQUIRED",
				"opencode 연결 인증이 필요합니다. env fallback 은 CI/headless 런타임에서만 허용됩니다.",
			),
			logMessage:
				"codex env fallback denied outside ci/headless runtime context",
		};
	}

	const envName = runtimeContract.flags.env_fallback_api_key_env;
	const envApiKey = process.env[envName];
	if (!isNonEmptyString(envApiKey)) {
		return {
			ok: false,
			error: errorResponse(
				"E_CODEX_AUTH_REQUIRED",
				`${envName} 환경변수 설정이 필요합니다.`,
			),
			logMessage: `missing codex env fallback: ${envName}`,
		};
	}

	return {
		ok: true,
		enabled: true,
		source: formatCodexAuthSource("env_fallback", envName),
		redacted: redactSecret(envApiKey),
	};
};

const getAutopilotState = (state) => {
	if (!state.autopilot || typeof state.autopilot !== "object") {
		state.autopilot = defaultState().autopilot;
	}
	return state.autopilot;
};

const incrementAutopilotMetric = (state, key, count = 1) => {
	const autopilot = getAutopilotState(state);
	if (!autopilot.metrics || typeof autopilot.metrics !== "object") {
		autopilot.metrics = defaultState().autopilot.metrics;
	}
	const current =
		typeof autopilot.metrics[key] === "number" &&
		Number.isInteger(autopilot.metrics[key])
			? autopilot.metrics[key]
			: 0;
	autopilot.metrics[key] = current + Math.max(0, Math.trunc(count));
};

const setAutopilotStatus = (state, status) => {
	if (!AUTOPILOT_ALLOWED_STATUSES.includes(status)) {
		return;
	}
	const autopilot = getAutopilotState(state);
	autopilot.status = status;
	if (status === "paused") {
		autopilot.paused = true;
	}
};

const clearAutopilotRun = (state) => {
	const autopilot = getAutopilotState(state);
	autopilot.in_flight_run_id = null;
	if (!autopilot.paused && autopilot.status !== "degraded") {
		autopilot.status = "idle";
	}
};

const markAutopilotFailure = (state, message) => {
	const autopilot = getAutopilotState(state);
	autopilot.last_error = message;
	autopilot.codex_stage.last_failure_reason = message;
	autopilot.consecutive_failures += 1;
	incrementAutopilotMetric(state, "ticks_failed", 1);
	autopilot.in_flight_run_id = null;
	if (autopilot.consecutive_failures >= AUTOPILOT_MAX_CONSECUTIVE_FAILURES) {
		autopilot.status = "degraded";
		autopilot.paused = true;
		pushLog(state, "warn", "autopilot_degraded", message);
		return;
	}
	autopilot.status = autopilot.paused ? "paused" : "retrying";
};

const updateCodexStageStatusFromMetrics = (state) => {
	const autopilot = getAutopilotState(state);
	autopilot.codex_stage.started = autopilot.metrics.codex_stage_started;
	autopilot.codex_stage.success = autopilot.metrics.codex_stage_success;
	autopilot.codex_stage.fail = autopilot.metrics.codex_stage_fail;
	autopilot.codex_stage.timeout = autopilot.metrics.codex_stage_timeout;
	autopilot.codex_stage.schema_fail = autopilot.metrics.codex_stage_schema_fail;
};

const setCodexStageRunCorrelation = (state, runCorrelation) => {
	const autopilot = getAutopilotState(state);
	autopilot.codex_stage.last_run_correlation = Array.isArray(runCorrelation)
		? runCorrelation.slice(-30)
		: [];
};

const createDefaultRunCorrelationTelemetry = (fallbackUsed = false) => ({
	attempt: null,
	duration_ms: null,
	exit_code: null,
	failure_kind: null,
	fallback_used: fallbackUsed,
});

const buildCodexStageObservability = (autopilot) => ({
	codex_stage_metrics: {
		started: autopilot.metrics.codex_stage_started,
		success: autopilot.metrics.codex_stage_success,
		fail: autopilot.metrics.codex_stage_fail,
		timeout: autopilot.metrics.codex_stage_timeout,
		schema_fail: autopilot.metrics.codex_stage_schema_fail,
	},
	codex_last_failure_reason:
		autopilot.codex_stage.last_failure_reason ?? autopilot.last_error,
});

const normalizeSnippet = (value) =>
	typeof value === "string"
		? value.replace(/\s+/g, " ").trim().slice(0, 240)
		: "";

const normalizeFingerprintBody = (value) =>
	typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const AUTOPILOT_CANDIDATE_BODY_MAX_CHARS = 2000;
const AUTOPILOT_CANDIDATE_BODY_WITH_ATTACHMENTS_MAX_CHARS = 4000;
const AUTOPILOT_ATTACHMENT_TEXT_MAX_CHARS_PER_FILE = 800;
const AUTOPILOT_ATTACHMENT_TEXT_MAX_CHARS_TOTAL = 1800;

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

const decodeXmlEntities = (value) =>
	value
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");

const getAttachmentExtension = (attachment) => {
	const candidates = [
		attachment?.file_name,
		attachment?.graph_attachment_id,
		attachment?.relative_path ? basename(attachment.relative_path) : "",
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

const resolveAttachmentFormatPolicy = (attachment) => {
	const extension = getAttachmentExtension(attachment);
	const contentType = isNonEmptyString(attachment?.content_type)
		? attachment.content_type.trim().toLowerCase()
		: "";

	if (SUPPORTED_TEXT_ATTACHMENT_EXTENSIONS.has(extension)) {
		return { kind: "text", format: extension };
	}
	if (TEXT_ATTACHMENT_CONTENT_TYPES.has(contentType)) {
		if (contentType === "application/pdf") {
			return { kind: "text", format: "pdf" };
		}
		if (contentType === "text/plain") {
			return { kind: "text", format: "txt" };
		}
		if (
			contentType ===
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		) {
			return { kind: "text", format: "docx" };
		}
		if (contentType === "application/msword") {
			return { kind: "text", format: "doc" };
		}
		if (
			contentType ===
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		) {
			return { kind: "text", format: "xlsx" };
		}
		if (contentType === "application/vnd.ms-excel") {
			return { kind: "text", format: "xls" };
		}
		if (
			contentType ===
			"application/vnd.openxmlformats-officedocument.presentationml.presentation"
		) {
			return { kind: "text", format: "pptx" };
		}
		if (contentType === "application/vnd.ms-powerpoint") {
			return { kind: "text", format: "ppt" };
		}
	}

	if (
		(contentType.startsWith("image/") && contentType.length > 0) ||
		(extension.length > 0 && NON_TEXT_ATTACHMENT_EXTENSIONS.has(extension)) ||
		(contentType.length > 0 && !TEXT_ATTACHMENT_CONTENT_TYPES.has(contentType))
	) {
		return { kind: "requires_confirmation", format: extension || contentType };
	}

	return { kind: "unknown", format: "" };
};

const extractPrintableText = (buffer) => {
	const latin1 = buffer.toString("latin1");
	const chunks = latin1
		.split(/[^\x20-\x7E\u00A0-\u00FF]+/)
		.map((chunk) => chunk.trim())
		.filter((chunk) => chunk.length >= 3);
	return chunks.join(" ");
};

const parseZipEntries = (buffer) => {
	const eocdSignature = 0x06054b50;
	const cdfhSignature = 0x02014b50;
	const lfhSignature = 0x04034b50;
	let eocdOffset = -1;
	for (
		let index = Math.max(0, buffer.length - 65557);
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
	const entries = [];

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

const extractTextFromZipXml = (buffer, entryNamePattern, tagPattern) => {
	const entries = parseZipEntries(buffer)
		.filter((entry) => entryNamePattern.test(entry.name))
		.sort((a, b) => a.name.localeCompare(b.name));
	const chunks = [];
	for (const entry of entries) {
		const xml = entry.data.toString("utf8");
		for (const match of xml.matchAll(tagPattern)) {
			chunks.push(decodeXmlEntities(match[1] ?? ""));
		}
	}
	return chunks.join(" ");
};

const extractAttachmentTextByFormat = (buffer, format) => {
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

const resolveAttachmentAbsolutePath = (relativePath) => {
	if (!isNonEmptyString(relativePath)) {
		return null;
	}
	if (relativePath.startsWith("native-host/")) {
		return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
	}
	if (relativePath.startsWith("./")) {
		return fileURLToPath(new URL(relativePath, import.meta.url));
	}
	return fileURLToPath(new URL(`./${relativePath}`, import.meta.url));
};

const buildAttachmentTextContext = (state, message) => {
	if (!message?.has_attachments) {
		return {
			merged_attachment_text: "",
			requires_user_confirmation: false,
		};
	}

	const records = Object.values(state.mailbox?.attachments || {})
		.filter((item) => item?.message_pk === message.message_pk)
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

	const mergedParts = [];
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
		} catch (error) {
			pushLog(
				state,
				"warn",
				"attachment_extract",
				`${message.message_pk ?? "unknown"}:${attachment.attachment_pk ?? "unknown"} ${String(error?.message ?? "extract_failed")}`,
			);
		}
	}

	return {
		merged_attachment_text: mergedParts.join("\n"),
		requires_user_confirmation: false,
	};
};

const AUTOPILOT_FINGERPRINT_SCHEMA_VERSION = "v1";

const PHASE_1_PERSISTENCE_AUTHORITY = Object.freeze({
	phase: "phase_1",
	source_of_truth: "native-host/state.json",
	sqlite_mirror: "deferred",
	sqlite_mirror_enabled: false,
});

const DASHBOARD_DRILLDOWN_DEFAULTS = {
	today_mail_count: {
		target_tool: "search.query",
		payload: {
			date_window: "today",
			limit: 50,
		},
	},
	today_todo_count: {
		target_tool: "search.query",
		payload: {
			scope: "work_item",
			date_window: "today",
			limit: 50,
		},
	},
	progress_status: {
		target_tool: "timeline.list",
		payload: {
			date_window: "today",
			event_types: ["status_changed"],
			limit: 100,
		},
	},
	weekly_completed_count: {
		target_tool: "search.query",
		payload: {
			scope: "work_item",
			date_window: "current_week",
			statuses: ["done"],
			limit: 50,
		},
	},
	top_counterparties: {
		target_tool: "search.query",
		payload: {
			scope: "all",
			date_window: "last_7_days",
			limit: 100,
			bindings: [
				{
					token: "counterparty_id",
					target_field: "counterparty_ids",
				},
			],
		},
	},
};

const toUtcDateString = (date) => {
	const year = String(date.getUTCFullYear());
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const safeIsoTimestamp = (value, fallback = nowIso()) => {
	if (!isNonEmptyString(value)) {
		return fallback;
	}
	return parseTimestamp(value) === null ? fallback : value;
};

const resolveDashboardDateRange = (dateRaw, timezoneRaw) => {
	const parsedDate =
		isNonEmptyString(dateRaw) &&
		parseTimestamp(`${dateRaw}T00:00:00.000Z`) !== null
			? new Date(`${dateRaw}T00:00:00.000Z`)
			: new Date();
	const normalizedDate = new Date(
		Date.UTC(
			parsedDate.getUTCFullYear(),
			parsedDate.getUTCMonth(),
			parsedDate.getUTCDate(),
		),
	);
	const dayIndex = normalizedDate.getUTCDay();
	const weekStartOffset = (dayIndex + 6) % 7;
	const weekStart = new Date(normalizedDate);
	weekStart.setUTCDate(weekStart.getUTCDate() - weekStartOffset);
	const weekEnd = new Date(weekStart);
	weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

	return {
		date: toUtcDateString(normalizedDate),
		week_start: toUtcDateString(weekStart),
		week_end: toUtcDateString(weekEnd),
		timezone: isNonEmptyString(timezoneRaw) ? timezoneRaw.trim() : "UTC",
	};
};

const resolveDateWindow = (windowType) => {
	const now = new Date();
	const currentDate = toUtcDateString(now);
	if (windowType === "today") {
		return {
			start: `${currentDate}T00:00:00.000Z`,
			end: `${currentDate}T23:59:59.999Z`,
		};
	}

	if (windowType === "current_week") {
		const range = resolveDashboardDateRange(currentDate, "UTC");
		return {
			start: `${range.week_start}T00:00:00.000Z`,
			end: `${range.week_end}T23:59:59.999Z`,
		};
	}

	if (windowType === "last_7_days") {
		const end = new Date();
		const start = new Date(end);
		start.setUTCDate(start.getUTCDate() - 6);
		return {
			start: `${toUtcDateString(start)}T00:00:00.000Z`,
			end: `${toUtcDateString(end)}T23:59:59.999Z`,
		};
	}

	return null;
};

const withinRange = (value, fromRaw, toRaw) => {
	const ts = parseTimestamp(value);
	if (ts === null) {
		return false;
	}
	const fromTs = parseTimestamp(fromRaw);
	const toTs = parseTimestamp(toRaw);
	if (fromTs !== null && ts < fromTs) {
		return false;
	}
	if (toTs !== null && ts > toTs) {
		return false;
	}
	return true;
};

const parseOffsetCursor = (cursorRaw) => {
	if (!isNonEmptyString(cursorRaw)) {
		return 0;
	}
	if (!cursorRaw.startsWith("offset:")) {
		return 0;
	}
	const value = Number(cursorRaw.slice("offset:".length));
	return Number.isInteger(value) && value >= 0 ? value : 0;
};

const normalizeCounterpartyId = (value) =>
	`counterparty:${createHash("sha1")
		.update(value.trim().toLowerCase())
		.digest("hex")
		.slice(0, 12)}`;

const scoreByQuery = (query, ...fields) => {
	const normalized = query.trim().toLowerCase();
	if (normalized.length === 0) {
		return 0;
	}
	let score = 0;
	for (const field of fields) {
		if (!isNonEmptyString(field)) {
			continue;
		}
		const text = field.toLowerCase();
		if (text === normalized) {
			score = Math.max(score, 1);
			continue;
		}
		if (text.includes(normalized)) {
			score = Math.max(score, 0.85);
		}
	}
	return score;
};

const buildEvidenceReference = (evidence) => {
	if (!evidence || typeof evidence !== "object") {
		return null;
	}
	if (!isNonEmptyString(evidence.evidence_id)) {
		return null;
	}
	const source =
		evidence.source && typeof evidence.source === "object"
			? evidence.source
			: null;
	if (!source || !isNonEmptyString(source.id)) {
		return null;
	}
	const locator =
		evidence.locator && typeof evidence.locator === "object"
			? evidence.locator
			: null;
	const textQuote =
		isNonEmptyString(locator?.text_quote) &&
		locator.text_quote.trim().length > 0
			? locator.text_quote.trim()
			: normalizeSnippet(evidence.snippet);
	if (!isNonEmptyString(textQuote)) {
		return null;
	}

	return {
		evidence_id: evidence.evidence_id,
		source_kind: source.kind === "attachment" ? "attachment" : "email",
		source_id: source.id,
		...(isNonEmptyString(source.thread_pk)
			? { thread_id: source.thread_pk }
			: {}),
		locator: {
			type: "outlook_quote",
			text_quote: textQuote,
		},
	};
};

const mapLogToTimelineEvent = (log, index) => {
	if (!log || typeof log !== "object") {
		return null;
	}
	const at = safeIsoTimestamp(log.at, nowIso());
	const event = isNonEmptyString(log.event) ? log.event : "";
	const payload = {
		level: isNonEmptyString(log.level) ? log.level : "info",
		event,
		message: isNonEmptyString(log.message) ? log.message : "",
	};

	if (event === "initial_sync") {
		return {
			event_id: `log:${index}:initial_sync`,
			event_type: "message_synced",
			source_tool: "graph_mail_sync.initial_sync",
			entity_id: "mailbox:initial_sync",
			at,
			payload,
		};
	}

	if (event === "delta_sync") {
		return {
			event_id: `log:${index}:delta_sync`,
			event_type: "message_synced",
			source_tool: "graph_mail_sync.delta_sync",
			entity_id: "mailbox:delta_sync",
			at,
			payload,
		};
	}

	if (event === "download_attachment") {
		return {
			event_id: `log:${index}:download_attachment`,
			event_type: "attachment_synced",
			source_tool: "graph_mail_sync.download_attachment",
			entity_id: isNonEmptyString(log.message)
				? `attachment:${log.message}`
				: `attachment:${index}`,
			at,
			payload,
		};
	}

	if (event === "workflow_evidence") {
		return {
			event_id: `log:${index}:workflow_evidence`,
			event_type: "evidence_created",
			source_tool: "workflow.create_evidence",
			entity_id: isNonEmptyString(log.message)
				? `evidence:${log.message}`
				: `evidence:${index}`,
			at,
			payload,
		};
	}

	if (event === "workflow_todo") {
		return {
			event_id: `log:${index}:workflow_todo`,
			event_type: "todo_updated",
			source_tool: "workflow.upsert_todo",
			entity_id: isNonEmptyString(log.message)
				? `todo:${log.message}`
				: `todo:${index}`,
			at,
			payload,
		};
	}

	return null;
};

const buildTimelineEvents = (state) => {
	const events = [];
	const logs = Array.isArray(state.logs) ? state.logs : [];
	for (const [index, log] of logs.entries()) {
		const mapped = mapLogToTimelineEvent(log, index);
		if (mapped) {
			events.push(mapped);
		}
	}

	const todos = Array.isArray(state.workflow?.todos)
		? state.workflow.todos
		: [];
	for (const todo of todos) {
		if (!todo || typeof todo !== "object") {
			continue;
		}
		if (!isNonEmptyString(todo.todo_id)) {
			continue;
		}
		events.push({
			event_id: `todo_status:${todo.todo_id}`,
			event_type: "status_changed",
			source_tool: "workflow.upsert_todo",
			entity_id: todo.todo_id,
			at: safeIsoTimestamp(todo.updated_at || todo.created_at, nowIso()),
			payload: {
				title: isNonEmptyString(todo.title) ? todo.title : "",
				status: isNonEmptyString(todo.status) ? todo.status : "open",
			},
		});
	}

	return events;
};

const buildAutopilotMessageFingerprint = (
	message,
	schemaVersion = AUTOPILOT_FINGERPRINT_SCHEMA_VERSION,
) => {
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

const buildEvidenceKey = (messagePk, snippet, locatorType = "outlook_quote") =>
	`evk_${createHash("sha1")
		.update(`${messagePk}:${normalizeSnippet(snippet)}:${locatorType}`)
		.digest("hex")
		.slice(0, 20)}`;

const buildTodoKey = (title, evidenceKey, namespace = "mail-agent") =>
	`tdk_${createHash("sha1")
		.update(`${title.trim().toLowerCase()}:${evidenceKey}:${namespace}`)
		.digest("hex")
		.slice(0, 20)}`;

const autopilotModeAllowsWrites = (mode) => mode === "full_auto";

const deriveDeterministicTodoKey = (title, evidenceKey) =>
	buildTodoKey(title, evidenceKey, "mail-agent");

const persistAnalyzedCandidateViaWorkflow = (state, analyzed) => {
	const proposal = analyzed.proposal;
	if (proposal === null) {
		return {
			review_candidate: true,
			evidence_created: 0,
			todo_created: 0,
			evidence_writes: 0,
			todo_writes: 0,
		};
	}

	const message = analyzed.message;
	if (!isNonEmptyString(message.message_pk)) {
		return {
			review_candidate: true,
			evidence_created: 0,
			todo_created: 0,
			evidence_writes: 0,
			todo_writes: 0,
		};
	}

	if (proposal.confidence < AUTOPILOT_REVIEW_MIN_CONFIDENCE) {
		return {
			review_candidate: true,
			evidence_created: 0,
			todo_created: 0,
			evidence_writes: 0,
			todo_writes: 0,
		};
	}

	const messageFingerprint = buildAutopilotMessageFingerprint(message);
	const evidenceKey = buildEvidenceKey(message.message_pk, messageFingerprint);
	const evidenceResponse = createWorkflowEvidence(state, {
		message_pk: message.message_pk,
		snippet: proposal.snippet,
		confidence: proposal.confidence,
		idempotency_key: evidenceKey,
	});
	if (!evidenceResponse.ok) {
		return {
			review_candidate: true,
			evidence_created: 0,
			todo_created: 0,
			evidence_writes: 0,
			todo_writes: 0,
		};
	}

	const evidence = evidenceResponse.data.evidence;
	const persistedEvidenceKey = isNonEmptyString(evidence?.evidence_key)
		? evidence.evidence_key.trim()
		: "";
	if (
		!isNonEmptyString(persistedEvidenceKey) ||
		persistedEvidenceKey !== evidenceKey
	) {
		return {
			review_candidate: true,
			evidence_created: evidenceResponse.data.created === true ? 1 : 0,
			todo_created: 0,
			evidence_writes: 1,
			todo_writes: 0,
		};
	}
	const deterministicTodoKeyFromEvidence = deriveDeterministicTodoKey(
		proposal.todo_title,
		persistedEvidenceKey,
	);
	const todoResponse = upsertWorkflowTodo(state, {
		title: proposal.todo_title,
		status: "open",
		evidence_id: evidence.evidence_id,
		evidence_key: persistedEvidenceKey,
		todo_key: deterministicTodoKeyFromEvidence,
		idempotency_key: deterministicTodoKeyFromEvidence,
	});
	if (!todoResponse.ok) {
		return {
			review_candidate: true,
			evidence_created: evidenceResponse.data.created === true ? 1 : 0,
			todo_created: 0,
			evidence_writes: 1,
			todo_writes: 0,
		};
	}
	const persistedTodoKey = isNonEmptyString(todoResponse.data.todo?.todo_key)
		? todoResponse.data.todo.todo_key.trim()
		: "";
	if (
		!isNonEmptyString(persistedTodoKey) ||
		persistedTodoKey !== deterministicTodoKeyFromEvidence
	) {
		return {
			review_candidate: true,
			evidence_created: evidenceResponse.data.created === true ? 1 : 0,
			todo_created: 0,
			evidence_writes: 1,
			todo_writes: 1,
		};
	}

	return {
		review_candidate: false,
		evidence_created: evidenceResponse.data.created === true ? 1 : 0,
		todo_created: todoResponse.data.created === true ? 1 : 0,
		evidence_writes: 1,
		todo_writes: 1,
	};
};

const generateCodeVerifier = () => toBase64Url(randomBytes(32));
const generateCodeChallenge = (codeVerifier) =>
	toBase64Url(createHash("sha256").update(codeVerifier).digest());
const generateLoginState = () => toBase64Url(randomBytes(16));

const parseTimestamp = (value) => {
	const ts = Date.parse(value);
	return Number.isNaN(ts) ? null : ts;
};

const parseRedirectAddress = (redirectUriRaw) => {
	try {
		const redirectUri = new URL(redirectUriRaw);
		if (!isNonEmptyString(redirectUri.hostname)) {
			return {
				ok: false,
				errorMessage: "redirect_uri host 값이 올바르지 않습니다.",
			};
		}
		const port = Number(
			redirectUri.port || (redirectUri.protocol === "https:" ? "443" : "80"),
		);
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			return {
				ok: false,
				errorMessage: "redirect_uri port 값이 올바르지 않습니다.",
			};
		}
		return {
			ok: true,
			host: redirectUri.hostname,
			port,
		};
	} catch {
		return {
			ok: false,
			errorMessage: "redirect_uri 형식이 올바르지 않습니다.",
		};
	}
};

const probePortInUse = (host, port) =>
	new Promise((resolve) => {
		const tester = createNetServer();
		let settled = false;
		const complete = (result) => {
			if (settled) {
				return;
			}
			settled = true;
			resolve(result);
		};

		tester.once("error", (error) => {
			const code =
				error && typeof error === "object" && "code" in error ? error.code : "";
			if (code === "EADDRINUSE") {
				complete({ ok: true, inUse: true });
				return;
			}
			if (code === "EACCES") {
				complete({
					ok: false,
					inUse: false,
					reason: `권한 오류(${host}:${port})`,
				});
				return;
			}
			complete({
				ok: false,
				inUse: false,
				reason: error instanceof Error ? error.message : String(error),
			});
		});

		tester.once("listening", () => {
			tester.close(() => complete({ ok: true, inUse: false }));
		});

		try {
			tester.listen(port, host);
		} catch (error) {
			complete({
				ok: false,
				inUse: false,
				reason: error instanceof Error ? error.message : String(error),
			});
		}
	});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForPortInUse = async (host, port, timeoutMs) => {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		const probe = await probePortInUse(host, port);
		if (!probe.ok) {
			return {
				ok: false,
				errorMessage: `callback listener 시작 점검 실패: ${probe.reason}`,
			};
		}
		if (probe.inUse) {
			return { ok: true };
		}
		await wait(50);
	}
	return {
		ok: false,
		errorMessage: "callback listener 시작 확인이 시간 내 완료되지 않았습니다.",
	};
};

const isTokenNearExpiry = (token) => {
	if (!token || typeof token.expires_at !== "string") {
		return true;
	}
	const expiresAt = parseTimestamp(token.expires_at);
	if (expiresAt === null) {
		return true;
	}
	return expiresAt - Date.now() < 120000;
};

const isRefreshTokenExpired = (token) => {
	if (!token || typeof token.refresh_token_expires_at !== "string") {
		return true;
	}
	const expiresAt = parseTimestamp(token.refresh_token_expires_at);
	if (expiresAt === null) {
		return true;
	}
	return expiresAt <= Date.now();
};

const validateAuthConfig = (config) => {
	if (!isNonEmptyString(config.client_id)) {
		return errorResponse(
			"E_AUTH_FAILED",
			"native-host/config.json 의 client_id를 설정하세요.",
		);
	}

	if (!isNonEmptyString(config.redirect_uri)) {
		return errorResponse(
			"E_AUTH_FAILED",
			"native-host/config.json 의 redirect_uri를 설정하세요.",
		);
	}

	try {
		new URL(config.redirect_uri);
	} catch {
		return errorResponse(
			"E_AUTH_FAILED",
			"native-host/config.json 의 redirect_uri 형식이 잘못되었습니다.",
		);
	}

	return null;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestWithRetry = async (url, options, maxRetries = 3) => {
	let attempt = 0;
	while (true) {
		attempt += 1;
		let response;
		try {
			response = await fetch(url, options);
		} catch (error) {
			if (attempt >= maxRetries) {
				throw error;
			}
			await sleep(attempt * 500);
			continue;
		}

		if (
			response.status === 429 ||
			(response.status >= 500 && response.status < 600)
		) {
			if (attempt >= maxRetries) {
				return response;
			}
			const retryAfterHeader = response.headers.get("retry-after");
			const retryAfter = retryAfterHeader
				? Number(retryAfterHeader)
				: Number.NaN;
			const waitMs = Number.isFinite(retryAfter)
				? Math.max(200, retryAfter * 1000)
				: attempt * 500;
			await sleep(waitMs);
			continue;
		}

		return response;
	}
};

const parseJsonResponse = async (response) => {
	try {
		return await response.json();
	} catch {
		return null;
	}
};

const exchangeAuthorizationCode = async (state, config, code, codeVerifier) => {
	const endpoint = `https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/token`;
	const params = new URLSearchParams();
	params.set("grant_type", "authorization_code");
	params.set("client_id", config.client_id);
	params.set("code", code);
	params.set("redirect_uri", config.redirect_uri);
	params.set("code_verifier", codeVerifier);

	if (
		state.issued_session &&
		isArrayOfNonEmptyStrings(state.issued_session.scopes) &&
		state.issued_session.scopes.length > 0
	) {
		params.set("scope", state.issued_session.scopes.join(" "));
	}

	let response;
	try {
		response = await requestWithRetry(
			endpoint,
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: params.toString(),
			},
			3,
		);
	} catch {
		return {
			ok: false,
			error: errorResponse(
				"E_AUTH_FAILED",
				"토큰 엔드포인트에 연결하지 못했습니다.",
				true,
			),
		};
	}

	const payload = await parseJsonResponse(response);

	if (!response.ok) {
		const description =
			payload && typeof payload.error_description === "string"
				? payload.error_description
				: payload && typeof payload.error === "string"
					? payload.error
					: `HTTP ${response.status}`;
		return {
			ok: false,
			error: errorResponse("E_AUTH_FAILED", `토큰 교환 실패: ${description}`),
		};
	}

	if (
		payload === null ||
		typeof payload !== "object" ||
		!isNonEmptyString(payload.access_token)
	) {
		return {
			ok: false,
			error: errorResponse(
				"E_AUTH_FAILED",
				"토큰 응답 형식이 올바르지 않습니다.",
			),
		};
	}

	return { ok: true, tokenResponse: payload };
};

const refreshAccessToken = async (state, config) => {
	if (!state.auth_token || !isNonEmptyString(state.auth_token.refresh_token)) {
		return {
			ok: false,
			error: errorResponse("E_AUTH_REQUIRED", "로그인이 필요합니다."),
		};
	}

	if (isRefreshTokenExpired(state.auth_token)) {
		state.signed_in = false;
		state.account = null;
		state.auth_token = null;
		state.issued_session = null;
		pushLog(state, "warn", "refresh_expired", "refresh token expired");
		writeState(state);
		return {
			ok: false,
			error: errorResponse(
				"E_AUTH_FAILED",
				"refresh token이 만료되어 재로그인이 필요합니다.",
				true,
			),
		};
	}

	const endpoint = `https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/token`;
	const params = new URLSearchParams();
	params.set("grant_type", "refresh_token");
	params.set("client_id", config.client_id);
	params.set("refresh_token", state.auth_token.refresh_token);
	if (
		state.issued_session &&
		isArrayOfNonEmptyStrings(state.issued_session.scopes) &&
		state.issued_session.scopes.length > 0
	) {
		params.set("scope", state.issued_session.scopes.join(" "));
	}

	let response;
	try {
		response = await requestWithRetry(
			endpoint,
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: params.toString(),
			},
			3,
		);
	} catch {
		return {
			ok: false,
			error: errorResponse("E_AUTH_FAILED", "토큰 갱신 연결 실패", true),
		};
	}

	const payload = await parseJsonResponse(response);
	if (!response.ok) {
		const description =
			payload && typeof payload.error_description === "string"
				? payload.error_description
				: payload && typeof payload.error === "string"
					? payload.error
					: `HTTP ${response.status}`;
		state.signed_in = false;
		state.account = null;
		state.auth_token = null;
		state.issued_session = null;
		pushLog(state, "warn", "refresh_failed", description);
		writeState(state);
		return {
			ok: false,
			error: errorResponse(
				"E_AUTH_FAILED",
				`인증 갱신 실패: ${description}`,
				true,
			),
		};
	}

	if (
		payload === null ||
		typeof payload !== "object" ||
		!isNonEmptyString(payload.access_token)
	) {
		return {
			ok: false,
			error: errorResponse(
				"E_AUTH_FAILED",
				"토큰 갱신 응답 형식이 올바르지 않습니다.",
			),
		};
	}

	const now = Date.now();
	const expiresIn =
		typeof payload.expires_in === "number" && payload.expires_in > 0
			? payload.expires_in
			: 3600;
	const refreshExpiresIn =
		typeof payload.refresh_token_expires_in === "number" &&
		payload.refresh_token_expires_in > 0
			? payload.refresh_token_expires_in
			: 30 * 24 * 60 * 60;

	state.auth_token = {
		access_token: payload.access_token,
		refresh_token:
			typeof payload.refresh_token === "string"
				? payload.refresh_token
				: state.auth_token.refresh_token,
		token_type:
			typeof payload.token_type === "string" ? payload.token_type : "Bearer",
		expires_at: new Date(now + expiresIn * 1000).toISOString(),
		refresh_token_expires_at: new Date(
			now + refreshExpiresIn * 1000,
		).toISOString(),
		issued_at: nowIso(),
	};
	writeState(state);
	pushLog(state, "info", "refresh_success", "access token refreshed");
	return { ok: true };
};

const decodeJwtPayload = (token) => {
	if (!isNonEmptyString(token)) {
		return null;
	}
	const chunks = token.split(".");
	if (chunks.length < 2) {
		return null;
	}
	try {
		return JSON.parse(Buffer.from(chunks[1], "base64url").toString("utf8"));
	} catch {
		return null;
	}
};

const extractAccount = (tokenResponse, config) => {
	const claims = decodeJwtPayload(tokenResponse.id_token);
	if (claims && typeof claims === "object") {
		const emailCandidates = [
			claims.preferred_username,
			claims.email,
			claims.upn,
		];
		for (const candidate of emailCandidates) {
			if (isNonEmptyString(candidate)) {
				return {
					email: candidate,
					tenant:
						typeof claims.tid === "string" && claims.tid.length > 0
							? claims.tid
							: config.tenant,
				};
			}
		}
	}
	return { email: "user@localhost", tenant: config.tenant };
};

const beginCallbackListener = async (state, config, loginState) => {
	const address = parseRedirectAddress(config.redirect_uri);
	if (!address.ok) {
		pushLog(
			state,
			"warn",
			"callback_listener",
			`callback listener failed: ${address.errorMessage}`,
		);
		return { ok: false, errorMessage: address.errorMessage };
	}

	const preflight = await probePortInUse(address.host, address.port);
	if (!preflight.ok) {
		pushLog(
			state,
			"warn",
			"callback_listener",
			`callback listener preflight failed: ${preflight.reason}`,
		);
		return {
			ok: false,
			errorMessage: `callback listener 사전 점검 실패: ${preflight.reason}`,
		};
	}
	if (preflight.inUse) {
		const message = `callback listener 포트(${address.host}:${address.port})가 이미 사용 중입니다.`;
		pushLog(state, "warn", "callback_listener", message);
		return { ok: false, errorMessage: message };
	}

	try {
		const processArgs = [
			fileURLToPath(callbackListenerPath),
			fileURLToPath(statePath),
			config.redirect_uri,
			loginState,
		];
		const child = spawn(process.execPath, processArgs, {
			detached: true,
			stdio: "ignore",
		});
		child.unref();
	} catch (error) {
		const message =
			error instanceof Error
				? `callback listener failed: ${error.message}`
				: "callback listener failed";
		pushLog(state, "warn", "callback_listener", message);
		return {
			ok: false,
			errorMessage: "callback listener 시작에 실패했습니다.",
		};
	}

	const started = await waitForPortInUse(address.host, address.port, 1000);
	if (!started.ok) {
		pushLog(
			state,
			"warn",
			"callback_listener",
			`callback listener startup failed: ${started.errorMessage}`,
		);
		return { ok: false, errorMessage: started.errorMessage };
	}

	pushLog(state, "info", "callback_listener", "callback listener started");
	return { ok: true };
};

const handleStartLogin = async (message, state, config) => {
	if (
		!isArrayOfNonEmptyStrings(message.scopes) ||
		message.scopes.length === 0
	) {
		return errorResponse(
			"E_PARSE_FAILED",
			"scopes 는 비어있지 않은 문자열 목록이어야 합니다.",
		);
	}

	const configError = validateAuthConfig(config);
	if (configError !== null) {
		return configError;
	}

	const loginState = generateLoginState();
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = generateCodeChallenge(codeVerifier);

	state.issued_session = {
		scopes: message.scopes,
		state: loginState,
		code_verifier: codeVerifier,
		code_challenge: codeChallenge,
		issued_at: nowIso(),
		redirect_uri: config.redirect_uri,
		client_id: config.client_id,
		tenant: config.tenant,
	};
	state.pending_callback = null;
	writeState(state);

	const callbackListener = await beginCallbackListener(
		state,
		config,
		loginState,
	);
	if (!callbackListener.ok) {
		state.issued_session = null;
		state.pending_callback = null;
		pushLog(state, "warn", "start_login", callbackListener.errorMessage);
		writeState(state);
		return errorResponse("E_AUTH_FAILED", callbackListener.errorMessage, true);
	}

	writeState(state);

	return {
		ok: true,
		data: {
			login_url: `https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/authorize?response_type=code&client_id=${encodeURIComponent(config.client_id)}&scope=${encodeURIComponent(message.scopes.join(" "))}&state=${encodeURIComponent(loginState)}&redirect_uri=${encodeURIComponent(config.redirect_uri)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`,
			callback_url: config.redirect_uri,
			state: loginState,
			code_verifier: codeVerifier,
		},
	};
};

const completeLoginWithCode = async (
	state,
	config,
	code,
	incomingState,
	codeVerifier,
) => {
	if (!isNonEmptyString(code) || !isNonEmptyString(incomingState)) {
		return errorResponse("E_PARSE_FAILED", "code/state 가 누락되었습니다.");
	}

	if (!isNonEmptyString(codeVerifier)) {
		return errorResponse("E_PARSE_FAILED", "code_verifier 가 누락되었습니다.");
	}

	if (state.issued_session === null) {
		return errorResponse("E_AUTH_REQUIRED", "로그인 시작 정보가 없습니다.");
	}

	if (incomingState !== state.issued_session.state) {
		return errorResponse("E_AUTH_FAILED", "state 값이 일치하지 않습니다.");
	}

	if (codeVerifier !== state.issued_session.code_verifier) {
		return errorResponse(
			"E_AUTH_FAILED",
			"code_verifier 값이 일치하지 않습니다.",
		);
	}

	const tokenResult = await exchangeAuthorizationCode(
		state,
		config,
		code,
		codeVerifier,
	);
	if (!tokenResult.ok) {
		pushLog(state, "warn", "complete_login", tokenResult.error.error_message);
		writeState(state);
		return tokenResult.error;
	}

	const tokenResponse = tokenResult.tokenResponse;
	const now = Date.now();
	const expiresIn =
		typeof tokenResponse.expires_in === "number" && tokenResponse.expires_in > 0
			? tokenResponse.expires_in
			: 3600;
	const refreshExpiresIn =
		typeof tokenResponse.refresh_token_expires_in === "number" &&
		tokenResponse.refresh_token_expires_in > 0
			? tokenResponse.refresh_token_expires_in
			: 30 * 24 * 60 * 60;

	state.auth_token = {
		access_token: tokenResponse.access_token,
		refresh_token:
			typeof tokenResponse.refresh_token === "string"
				? tokenResponse.refresh_token
				: "",
		token_type:
			typeof tokenResponse.token_type === "string"
				? tokenResponse.token_type
				: "Bearer",
		expires_at: new Date(now + expiresIn * 1000).toISOString(),
		refresh_token_expires_at: new Date(
			now + refreshExpiresIn * 1000,
		).toISOString(),
		issued_at: nowIso(),
	};
	state.account = extractAccount(tokenResponse, config);
	state.signed_in = true;
	state.pending_callback = null;
	writeState(state);
	pushLog(state, "info", "complete_login", "login completed");

	return {
		ok: true,
		data: {
			account: state.account,
		},
	};
};

const handleCompleteLogin = async (message, state, config) =>
	completeLoginWithCode(
		state,
		config,
		message.code,
		message.state,
		message.code_verifier,
	);

const handleCompleteLoginAuto = async (state, config) => {
	if (!state.pending_callback) {
		return errorResponse(
			"E_NOT_FOUND",
			"자동 완료 대기 중인 callback code가 없습니다.",
			true,
		);
	}

	if (
		!state.issued_session ||
		!isNonEmptyString(state.issued_session.code_verifier)
	) {
		return errorResponse("E_AUTH_REQUIRED", "로그인 시작 정보가 없습니다.");
	}

	return completeLoginWithCode(
		state,
		config,
		state.pending_callback.code,
		state.pending_callback.state,
		state.issued_session.code_verifier,
	);
};

const handleLogout = (state) => {
	state.signed_in = false;
	state.account = null;
	state.auth_token = null;
	state.issued_session = null;
	state.pending_callback = null;
	writeState(state);
	pushLog(state, "info", "logout", "logout completed");
	return { ok: true, data: { signed_out: true } };
};

const ensureAuthenticated = async (state, config) => {
	if (!state.signed_in || state.account === null || state.auth_token === null) {
		return {
			ok: false,
			error: errorResponse("E_AUTH_REQUIRED", "로그인이 필요합니다."),
		};
	}

	if (!isTokenNearExpiry(state.auth_token)) {
		return { ok: true };
	}

	return refreshAccessToken(state, config);
};

const graphFetch = async (state, config, url) => {
	const auth = await ensureAuthenticated(state, config);
	if (!auth.ok) {
		return auth;
	}

	const token = state.auth_token?.access_token;
	if (!isNonEmptyString(token)) {
		return {
			ok: false,
			error: errorResponse("E_AUTH_REQUIRED", "로그인이 필요합니다."),
		};
	}

	let response = await requestWithRetry(
		url,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
			},
		},
		3,
	);

	if (response.status === 401) {
		const refreshed = await refreshAccessToken(state, config);
		if (!refreshed.ok) {
			return refreshed;
		}
		response = await requestWithRetry(
			url,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${state.auth_token.access_token}`,
					Accept: "application/json",
				},
			},
			2,
		);
	}

	if (!response.ok) {
		const payload = await parseJsonResponse(response);
		const message =
			payload && typeof payload.error?.message === "string"
				? payload.error.message
				: `Graph API 요청 실패: HTTP ${response.status}`;
		const code =
			response.status === 429 ? "E_GRAPH_THROTTLED" : "E_AUTH_FAILED";
		return {
			ok: false,
			error: errorResponse(code, message, response.status >= 500),
		};
	}

	const payload = await parseJsonResponse(response);
	if (payload === null || typeof payload !== "object") {
		return {
			ok: false,
			error: errorResponse("E_PARSE_FAILED", "Graph 응답 파싱 실패"),
		};
	}

	return { ok: true, payload };
};

const normalizeRecipients = (list) => {
	if (!Array.isArray(list)) {
		return [];
	}
	return list
		.map((item) => item?.emailAddress?.address)
		.filter((value) => typeof value === "string" && value.length > 0);
};

const mapGraphMessage = (raw) => {
	const messagePk = isNonEmptyString(raw.id) ? raw.id : `msg_${Date.now()}`;
	const threadId = isNonEmptyString(raw.conversationId)
		? raw.conversationId
		: "thread_unknown";
	const attachments = Array.isArray(raw.attachments)
		? raw.attachments
				.map((item) => item?.id)
				.filter((id) => typeof id === "string")
		: [];

	return {
		message_pk: messagePk,
		provider_message_id: messagePk,
		provider_thread_id: threadId,
		internet_message_id:
			typeof raw.internetMessageId === "string" ? raw.internetMessageId : "",
		web_link: typeof raw.webLink === "string" ? raw.webLink : "",
		subject: typeof raw.subject === "string" ? raw.subject : "",
		from:
			typeof raw.from?.emailAddress?.address === "string"
				? raw.from.emailAddress.address
				: "",
		to: normalizeRecipients(raw.toRecipients),
		cc: normalizeRecipients(raw.ccRecipients),
		received_at:
			typeof raw.receivedDateTime === "string"
				? raw.receivedDateTime
				: nowIso(),
		body_text:
			typeof raw.bodyPreview === "string"
				? raw.bodyPreview
				: typeof raw.body?.content === "string"
					? raw.body.content
					: "",
		has_attachments: Boolean(raw.hasAttachments),
		attachments: attachments,
	};
};

const upsertMessage = (state, message) => {
	const messages = state.mailbox.messages;
	const threadMessages = state.mailbox.thread_messages;
	messages[message.message_pk] = message;
	if (!Array.isArray(threadMessages[message.provider_thread_id])) {
		threadMessages[message.provider_thread_id] = [];
	}
	if (
		!threadMessages[message.provider_thread_id].includes(message.message_pk)
	) {
		threadMessages[message.provider_thread_id].push(message.message_pk);
	}
};

const removeMessage = (state, messagePk) => {
	const existing = state.mailbox.messages[messagePk];
	if (!existing) {
		return;
	}
	delete state.mailbox.messages[messagePk];
	const threadId = existing.provider_thread_id;
	if (Array.isArray(state.mailbox.thread_messages[threadId])) {
		state.mailbox.thread_messages[threadId] = state.mailbox.thread_messages[
			threadId
		].filter((pk) => pk !== messagePk);
	}
};

const initialSync = async (state, config, input) => {
	if (!isNonEmptyString(input.mail_folder)) {
		return errorResponse("E_PARSE_FAILED", "mail_folder 가 누락되었습니다.");
	}
	const daysBack = Number(input.days_back);
	if (!Number.isInteger(daysBack) || daysBack <= 0) {
		return errorResponse(
			"E_PARSE_FAILED",
			"days_back 는 양의 정수여야 합니다.",
		);
	}
	const select = isArrayOfNonEmptyStrings(input.select)
		? input.select
		: [
				"id",
				"conversationId",
				"internetMessageId",
				"webLink",
				"subject",
				"from",
				"toRecipients",
				"ccRecipients",
				"receivedDateTime",
				"bodyPreview",
				"hasAttachments",
			];

	const since = new Date(
		Date.now() - daysBack * 24 * 60 * 60 * 1000,
	).toISOString();
	let nextUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${encodeURIComponent(input.mail_folder)}/messages?$top=50&$select=${encodeURIComponent(
		select.join(","),
	)}&$filter=${encodeURIComponent(`receivedDateTime ge ${since}`)}`;

	let syncedMessages = 0;
	while (isNonEmptyString(nextUrl)) {
		const result = await graphFetch(state, config, nextUrl);
		if (!result.ok) {
			return result.error;
		}
		const value = Array.isArray(result.payload.value)
			? result.payload.value
			: [];
		for (const raw of value) {
			const mapped = mapGraphMessage(raw);
			if (!state.mailbox.messages[mapped.message_pk]) {
				syncedMessages += 1;
			}
			upsertMessage(state, mapped);
		}
		nextUrl =
			typeof result.payload["@odata.nextLink"] === "string"
				? result.payload["@odata.nextLink"]
				: "";
	}

	state.mailbox.delta_links[input.mail_folder] =
		`https://graph.microsoft.com/v1.0/me/mailFolders/${encodeURIComponent(input.mail_folder)}/messages/delta?$select=${encodeURIComponent(select.join(","))}`;
	writeState(state);
	pushLog(
		state,
		"info",
		"initial_sync",
		`${input.mail_folder} ${syncedMessages}`,
	);

	return {
		ok: true,
		data: {
			synced_messages: syncedMessages,
			synced_attachments: 0,
		},
	};
};

const deltaSync = async (state, config, input) => {
	if (!isNonEmptyString(input.mail_folder)) {
		return errorResponse("E_PARSE_FAILED", "mail_folder 가 누락되었습니다.");
	}

	let deltaUrl = state.mailbox.delta_links[input.mail_folder];
	if (!isNonEmptyString(deltaUrl)) {
		deltaUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${encodeURIComponent(input.mail_folder)}/messages/delta`;
	}

	let added = 0;
	let updated = 0;
	let deleted = 0;
	let currentUrl = deltaUrl;
	let newDeltaLink = deltaUrl;

	while (isNonEmptyString(currentUrl)) {
		const result = await graphFetch(state, config, currentUrl);
		if (!result.ok) {
			return result.error;
		}
		const value = Array.isArray(result.payload.value)
			? result.payload.value
			: [];
		for (const raw of value) {
			if (raw && typeof raw === "object" && raw["@removed"]) {
				if (isNonEmptyString(raw.id)) {
					if (state.mailbox.messages[raw.id]) {
						deleted += 1;
					}
					removeMessage(state, raw.id);
				}
				continue;
			}

			const mapped = mapGraphMessage(raw);
			if (state.mailbox.messages[mapped.message_pk]) {
				updated += 1;
			} else {
				added += 1;
			}
			upsertMessage(state, mapped);
		}

		if (typeof result.payload["@odata.deltaLink"] === "string") {
			newDeltaLink = result.payload["@odata.deltaLink"];
			currentUrl = "";
		} else {
			currentUrl =
				typeof result.payload["@odata.nextLink"] === "string"
					? result.payload["@odata.nextLink"]
					: "";
		}
	}

	state.mailbox.delta_links[input.mail_folder] = newDeltaLink;
	writeState(state);
	pushLog(
		state,
		"info",
		"delta_sync",
		`${input.mail_folder} +${added} ~${updated} -${deleted}`,
	);

	return {
		ok: true,
		data: {
			changes: { added, updated, deleted },
			new_delta_link_saved: true,
		},
	};
};

const attachmentLookupKey = (messageId, attachmentId) =>
	`${messageId}::${attachmentId}`;

const ensureAttachmentDir = () => {
	mkdirSync(fileURLToPath(attachmentDirPath), { recursive: true });
};

const downloadAttachment = async (state, config, input) => {
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

	const url = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(input.graph_message_id)}/attachments/${encodeURIComponent(input.graph_attachment_id)}`;
	const result = await graphFetch(state, config, url);
	if (!result.ok) {
		return result.error;
	}

	if (!isNonEmptyString(result.payload.contentBytes)) {
		return errorResponse("E_NOT_FOUND", "첨부 contentBytes 가 없습니다.");
	}

	const bytes = Buffer.from(result.payload.contentBytes, "base64");
	const sha256 = createHash("sha256").update(bytes).digest("hex");
	ensureAttachmentDir();
	const relativePath = `native-host/data/attachments/${sha256}.bin`;
	const absolutePath = fileURLToPath(
		new URL(`./data/attachments/${sha256}.bin`, import.meta.url),
	);
	writeFileSync(absolutePath, bytes);

	const attachmentPk = `att_${sha256.slice(0, 16)}`;
	state.mailbox.attachments[
		attachmentLookupKey(input.graph_message_id, input.graph_attachment_id)
	] = {
		attachment_pk: attachmentPk,
		graph_message_id: input.graph_message_id,
		graph_attachment_id: input.graph_attachment_id,
		message_pk: input.message_pk,
		file_name: isNonEmptyString(result.payload.name)
			? result.payload.name
			: null,
		content_type: isNonEmptyString(result.payload.contentType)
			? result.payload.contentType
			: null,
		relative_path: relativePath,
		size_bytes: bytes.length,
		sha256,
	};

	const existing = state.mailbox.messages[input.message_pk];
	if (existing) {
		const attachments = Array.isArray(existing.attachments)
			? existing.attachments
			: [];
		if (!attachments.includes(attachmentPk)) {
			attachments.push(attachmentPk);
		}
		existing.attachments = attachments;
		existing.has_attachments = attachments.length > 0;
		state.mailbox.messages[input.message_pk] = existing;
	}

	writeState(state);
	pushLog(state, "info", "download_attachment", input.graph_attachment_id);

	return {
		ok: true,
		data: {
			attachment_pk: attachmentPk,
			sha256,
			relative_path: relativePath,
			size_bytes: bytes.length,
		},
	};
};

const getMessage = async (state, config, input) => {
	const auth = await ensureAuthenticated(state, config);
	if (!auth.ok) {
		return auth.error;
	}

	const messagePk = isNonEmptyString(input.message_pk)
		? input.message_pk
		: input.message_id;
	if (!isNonEmptyString(messagePk)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"message_pk 또는 message_id 가 필요합니다.",
		);
	}

	const message = state.mailbox.messages[messagePk];
	if (!message) {
		return errorResponse("E_NOT_FOUND", "요청한 message 를 찾을 수 없습니다.");
	}

	return { ok: true, data: { message } };
};

const getThread = async (state, config, input) => {
	const auth = await ensureAuthenticated(state, config);
	if (!auth.ok) {
		return auth.error;
	}

	const threadPk = isNonEmptyString(input.thread_pk)
		? input.thread_pk
		: input.thread_id;
	const depth = Number(input.depth);
	if (!isNonEmptyString(threadPk)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"thread_pk 또는 thread_id 가 필요합니다.",
		);
	}
	if (!Number.isInteger(depth) || depth <= 0) {
		return errorResponse("E_PARSE_FAILED", "depth 는 양의 정수여야 합니다.");
	}

	const messagePks = Array.isArray(state.mailbox.thread_messages[threadPk])
		? state.mailbox.thread_messages[threadPk]
		: [];
	if (messagePks.length === 0) {
		return errorResponse("E_NOT_FOUND", "thread 를 찾을 수 없습니다.");
	}

	const messages = messagePks
		.map((pk) => state.mailbox.messages[pk])
		.filter((msg) => msg && typeof msg === "object")
		.sort((a, b) => {
			const ta = parseTimestamp(a.received_at) ?? 0;
			const tb = parseTimestamp(b.received_at) ?? 0;
			return tb - ta;
		})
		.slice(0, depth);

	return { ok: true, data: messages };
};

const listMessages = async (state, config, input) => {
	const auth = await ensureAuthenticated(state, config);
	if (!auth.ok) {
		return auth.error;
	}

	const limit = Number(input.limit);
	const resolvedLimit = Number.isInteger(limit) && limit > 0 ? limit : 50;
	const items = Object.values(state.mailbox.messages)
		.filter((msg) => msg && typeof msg === "object")
		.sort((a, b) => {
			const ta = parseTimestamp(a.received_at) ?? 0;
			const tb = parseTimestamp(b.received_at) ?? 0;
			return tb - ta;
		})
		.slice(0, resolvedLimit)
		.map((msg) => ({
			message_pk: msg.message_pk,
			subject: msg.subject,
			from: msg.from,
			received_at: msg.received_at,
			thread_pk: msg.provider_thread_id,
			has_attachments: Boolean(msg.has_attachments),
			attachment_count: Array.isArray(msg.attachments)
				? msg.attachments.length
				: 0,
		}));

	return {
		ok: true,
		data: {
			items,
			total: Object.keys(state.mailbox.messages).length,
		},
	};
};

const listThreads = async (state, config, input) => {
	const auth = await ensureAuthenticated(state, config);
	if (!auth.ok) {
		return auth.error;
	}

	const limit = Number(input.limit);
	const resolvedLimit = Number.isInteger(limit) && limit > 0 ? limit : 50;
	const rows = Object.entries(state.mailbox.thread_messages)
		.map(([thread_pk, messagePks]) => {
			const ids = Array.isArray(messagePks) ? messagePks : [];
			let latestReceivedAt = "";
			for (const id of ids) {
				const message = state.mailbox.messages[id];
				if (!message) {
					continue;
				}
				if (
					latestReceivedAt.length === 0 ||
					message.received_at > latestReceivedAt
				) {
					latestReceivedAt = message.received_at;
				}
			}
			return {
				thread_pk,
				message_count: ids.length,
				latest_received_at: latestReceivedAt,
			};
		})
		.sort((a, b) => {
			const ta = parseTimestamp(a.latest_received_at) ?? 0;
			const tb = parseTimestamp(b.latest_received_at) ?? 0;
			return tb - ta;
		})
		.slice(0, resolvedLimit);

	return {
		ok: true,
		data: {
			items: rows,
			total: Object.keys(state.mailbox.thread_messages).length,
		},
	};
};

const listAttachments = async (state, config, input) => {
	const auth = await ensureAuthenticated(state, config);
	if (!auth.ok) {
		return auth.error;
	}

	const messagePk = isNonEmptyString(input.message_pk) ? input.message_pk : "";
	if (!isNonEmptyString(messagePk)) {
		return errorResponse("E_PARSE_FAILED", "message_pk 가 필요합니다.");
	}

	const message = state.mailbox.messages[messagePk];
	if (!message) {
		return errorResponse("E_NOT_FOUND", "요청한 message 를 찾을 수 없습니다.");
	}

	const attachmentPks = Array.isArray(message.attachments)
		? message.attachments
		: [];
	const items = Object.values(state.mailbox.attachments)
		.filter((item) => item && attachmentPks.includes(item.attachment_pk))
		.map((item) => ({
			attachment_pk: item.attachment_pk,
			graph_message_id: item.graph_message_id,
			graph_attachment_id: item.graph_attachment_id,
			relative_path: item.relative_path,
			size_bytes: item.size_bytes,
			sha256: item.sha256,
		}));

	return {
		ok: true,
		data: {
			message_pk: messagePk,
			items,
		},
	};
};

const getSystemHealth = (state) => {
	const logs = Array.isArray(state.logs) ? state.logs : [];
	const recent = logs
		.slice(-20)
		.map(sanitizeLogRecord)
		.filter((item) => item !== null);
	const autopilot = getAutopilotState(state);
	const safeAutopilot = sanitizeAutopilotForStatus(autopilot);
	return {
		ok: true,
		data: {
			signed_in: Boolean(state.signed_in && state.account),
			account: state.account,
			message_count: Object.keys(state.mailbox.messages).length,
			thread_count: Object.keys(state.mailbox.thread_messages).length,
			attachment_count: Object.keys(state.mailbox.attachments).length,
			workflow_evidence_count: Array.isArray(state.workflow?.evidences)
				? state.workflow.evidences.length
				: 0,
			workflow_todo_count: Array.isArray(state.workflow?.todos)
				? state.workflow.todos.length
				: 0,
			autopilot: {
				...safeAutopilot,
				persistence_authority: PHASE_1_PERSISTENCE_AUTHORITY,
			},
			last_log: recent.length > 0 ? recent[recent.length - 1] : null,
			recent_logs: recent,
		},
	};
};

const resetSession = (state, input) => {
	const clearMailbox = Boolean(input.clear_mailbox);
	state.signed_in = false;
	state.account = null;
	state.auth_token = null;
	state.issued_session = null;
	state.pending_callback = null;
	state.autopilot = defaultState().autopilot;
	if (clearMailbox) {
		state.mailbox = {
			messages: {},
			thread_messages: {},
			delta_links: {},
			attachments: {},
		};
	}
	pushLog(
		state,
		"warn",
		"reset_session",
		clearMailbox ? "auth+mailbox" : "auth",
	);
	writeState(state);
	return {
		ok: true,
		data: {
			cleared_auth: true,
			cleared_mailbox: clearMailbox,
		},
	};
};

const createWorkflowEvidence = (state, input) => {
	if (!isNonEmptyString(input.message_pk)) {
		return errorResponse("E_PARSE_FAILED", "message_pk 가 필요합니다.");
	}
	if (!isNonEmptyString(input.snippet)) {
		return errorResponse("E_PARSE_FAILED", "snippet 이 필요합니다.");
	}
	const confidenceRaw = Number(input.confidence);
	const confidence =
		Number.isFinite(confidenceRaw) && confidenceRaw >= 0 && confidenceRaw <= 1
			? confidenceRaw
			: 0.7;
	const normalizedSnippet = normalizeSnippet(input.snippet);
	if (!isNonEmptyString(normalizedSnippet)) {
		return errorResponse("E_PARSE_FAILED", "snippet 이 필요합니다.");
	}

	const message = state.mailbox.messages[input.message_pk];
	if (!message) {
		return errorResponse("E_NOT_FOUND", "요청한 message 를 찾을 수 없습니다.");
	}

	if (!state.workflow || typeof state.workflow !== "object") {
		state.workflow = { evidences: [], todos: [] };
	}
	if (!Array.isArray(state.workflow.evidences)) {
		state.workflow.evidences = [];
	}
	const evidenceKey = isNonEmptyString(input.idempotency_key)
		? input.idempotency_key.trim()
		: buildEvidenceKey(input.message_pk, normalizedSnippet, "outlook_quote");
	const existingEvidence = state.workflow.evidences.find(
		(item) =>
			item && typeof item === "object" && item.evidence_key === evidenceKey,
	);
	if (existingEvidence) {
		return {
			ok: true,
			data: {
				evidence: existingEvidence,
				created: false,
				updated: false,
				skipped_duplicate: true,
			},
		};
	}

	const evidenceId = `ev_${evidenceKey.slice(4, 16)}`;
	const evidence = {
		evidence_id: evidenceId,
		evidence_key: evidenceKey,
		source: {
			kind: "email",
			id: input.message_pk,
			thread_pk: message.provider_thread_id,
		},
		locator: {
			type: "outlook_quote",
			text_quote: normalizedSnippet,
		},
		snippet: normalizedSnippet,
		confidence,
		created_at: nowIso(),
	};
	state.workflow.evidences.push(evidence);
	state.workflow.evidences = state.workflow.evidences.slice(-500);
	writeState(state);
	pushLog(state, "info", "workflow_evidence", evidenceId);
	return {
		ok: true,
		data: {
			evidence,
			created: true,
			updated: false,
			skipped_duplicate: false,
		},
	};
};

const upsertWorkflowTodo = (state, input) => {
	if (!isNonEmptyString(input.title)) {
		return errorResponse("E_PARSE_FAILED", "title 이 필요합니다.");
	}
	if (!state.workflow || typeof state.workflow !== "object") {
		state.workflow = { evidences: [], todos: [] };
	}
	if (!Array.isArray(state.workflow.todos)) {
		state.workflow.todos = [];
	}
	const allowed = ["open", "in_progress", "done"];
	const status =
		isNonEmptyString(input.status) && allowed.includes(input.status)
			? input.status
			: "open";
	const titleNormalized = input.title.trim();
	const evidenceId = isNonEmptyString(input.evidence_id)
		? input.evidence_id
		: null;
	const evidenceKey = isNonEmptyString(input.evidence_key)
		? input.evidence_key.trim()
		: isNonEmptyString(evidenceId)
			? evidenceId
			: "none";
	const todoKey = isNonEmptyString(input.idempotency_key)
		? input.idempotency_key.trim()
		: isNonEmptyString(input.todo_key)
			? input.todo_key.trim()
			: buildTodoKey(titleNormalized, evidenceKey, "mail-agent");
	const todoId = `todo_${todoKey.slice(4, 16)}`;
	const now = nowIso();
	const idx = state.workflow.todos.findIndex(
		(item) => item.todo_key === todoKey,
	);
	let created = false;
	let skippedDuplicate = false;
	if (idx >= 0) {
		const prev = state.workflow.todos[idx];
		if (
			prev.title === titleNormalized &&
			prev.status === status &&
			prev.evidence_id === evidenceId
		) {
			skippedDuplicate = true;
		}
		state.workflow.todos[idx] = {
			...prev,
			todo_id: prev.todo_id,
			todo_key: todoKey,
			title: titleNormalized,
			status,
			evidence_id: evidenceId,
			updated_at: now,
		};
	} else {
		created = true;
		state.workflow.todos.push({
			todo_id: todoId,
			todo_key: todoKey,
			title: titleNormalized,
			status,
			evidence_id: evidenceId,
			created_at: now,
			updated_at: now,
		});
	}
	state.workflow.todos = state.workflow.todos.slice(-500);
	writeState(state);
	pushLog(state, "info", "workflow_todo", todoId);
	const todo =
		state.workflow.todos.find((item) => item.todo_id === todoId) ?? null;
	return {
		ok: true,
		data: {
			todo,
			created,
			updated: !created,
			skipped_duplicate: skippedDuplicate,
		},
	};
};

const listWorkflow = (state) => ({
	ok: true,
	data: {
		evidences: Array.isArray(state.workflow?.evidences)
			? state.workflow.evidences
			: [],
		todos: Array.isArray(state.workflow?.todos) ? state.workflow.todos : [],
	},
});

const handleDashboardGetOverview = (state, input) => {
	if (input === null || typeof input !== "object" || Array.isArray(input)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"dashboard.get_overview input 은 객체여야 합니다.",
		);
	}

	const range = resolveDashboardDateRange(input.date, input.timezone);
	const messages = Object.values(state.mailbox?.messages || {}).filter(
		(item) => item && typeof item === "object",
	);
	const todos = Array.isArray(state.workflow?.todos)
		? state.workflow.todos
		: [];
	const evidences = Array.isArray(state.workflow?.evidences)
		? state.workflow.evidences
		: [];

	const topLimitRaw = Number(input.top_counterparties_limit);
	const topLimit =
		Number.isInteger(topLimitRaw) && topLimitRaw > 0
			? Math.min(topLimitRaw, 20)
			: 5;

	const todayMailCount = messages.filter(
		(message) =>
			isNonEmptyString(message.received_at) &&
			message.received_at.startsWith(range.date),
	).length;

	const todayTodoCount = todos.filter((todo) => {
		const timestamp = safeIsoTimestamp(todo.updated_at || todo.created_at, "");
		return isNonEmptyString(timestamp) && timestamp.startsWith(range.date);
	}).length;

	const openCount = todos.filter((todo) => todo?.status === "open").length;
	const inProgressCount = todos.filter(
		(todo) => todo?.status === "in_progress",
	).length;
	const doneCount = todos.filter((todo) => todo?.status === "done").length;
	const completionRate =
		todos.length > 0
			? Number((doneCount / Math.max(todos.length, 1)).toFixed(4))
			: 0;

	const weeklyCompletedCount = todos.filter((todo) => {
		if (todo?.status !== "done") {
			return false;
		}
		const timestamp = safeIsoTimestamp(todo.updated_at || todo.created_at, "");
		if (!isNonEmptyString(timestamp)) {
			return false;
		}
		return withinRange(
			timestamp,
			`${range.week_start}T00:00:00.000Z`,
			`${range.week_end}T23:59:59.999Z`,
		);
	}).length;

	const counterparties = new Map();
	const senderByMessagePk = new Map();
	for (const message of messages) {
		const sender = isNonEmptyString(message.from) ? message.from.trim() : "-";
		const counterpartyId = normalizeCounterpartyId(sender);
		const at = safeIsoTimestamp(message.received_at, nowIso());
		senderByMessagePk.set(message.message_pk, sender);
		const existing = counterparties.get(counterpartyId);
		if (existing) {
			existing.message_count += 1;
			if (at > existing.last_interaction_at) {
				existing.last_interaction_at = at;
			}
			continue;
		}
		counterparties.set(counterpartyId, {
			contact_id: counterpartyId,
			display_name: sender,
			message_count: 1,
			todo_count: 0,
			last_interaction_at: at,
		});
	}

	const evidenceById = new Map();
	for (const evidence of evidences) {
		if (!evidence || typeof evidence !== "object") {
			continue;
		}
		if (!isNonEmptyString(evidence.evidence_id)) {
			continue;
		}
		evidenceById.set(evidence.evidence_id, evidence);
	}

	for (const todo of todos) {
		if (!isNonEmptyString(todo?.evidence_id)) {
			continue;
		}
		const evidence = evidenceById.get(todo.evidence_id);
		const messagePk = evidence?.source?.id;
		if (!isNonEmptyString(messagePk)) {
			continue;
		}
		const sender = senderByMessagePk.get(messagePk);
		if (!isNonEmptyString(sender)) {
			continue;
		}
		const counterpartyId = normalizeCounterpartyId(sender);
		const item = counterparties.get(counterpartyId);
		if (!item) {
			continue;
		}
		item.todo_count += 1;
	}

	const topCounterparties = Array.from(counterparties.values())
		.sort((a, b) => {
			if (b.message_count !== a.message_count) {
				return b.message_count - a.message_count;
			}
			if (b.todo_count !== a.todo_count) {
				return b.todo_count - a.todo_count;
			}
			return (b.last_interaction_at || "").localeCompare(
				a.last_interaction_at || "",
			);
		})
		.slice(0, topLimit)
		.map((item) => ({
			contact_id: item.contact_id,
			display_name: item.display_name,
			message_count: item.message_count,
			todo_count: item.todo_count,
			last_interaction_at: item.last_interaction_at,
		}));

	return {
		ok: true,
		data: {
			generated_at: nowIso(),
			range,
			kpis: {
				today_mail_count: todayMailCount,
				today_todo_count: todayTodoCount,
				progress_status: {
					open_count: openCount,
					in_progress_count: inProgressCount,
					done_count: doneCount,
					completion_rate: completionRate,
				},
				weekly_completed_count: weeklyCompletedCount,
				top_counterparties: topCounterparties,
			},
			drilldowns: DASHBOARD_DRILLDOWN_DEFAULTS,
		},
	};
};

const handleSearchQuery = (state, input) => {
	if (input === null || typeof input !== "object" || Array.isArray(input)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"search.query input 은 객체여야 합니다.",
		);
	}
	if (!isNonEmptyString(input.query)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"search.query 는 query 가 필요합니다.",
		);
	}

	const query = input.query.trim();
	const allowedScopes = [
		"all",
		"mail",
		"attachment",
		"work_item",
		"timeline_event",
	];
	const scope =
		isNonEmptyString(input.scope) && allowedScopes.includes(input.scope)
			? input.scope
			: "all";
	const allowedSorts = ["relevance", "newest", "oldest"];
	const sort =
		isNonEmptyString(input.sort) && allowedSorts.includes(input.sort)
			? input.sort
			: "relevance";
	const limitRaw = Number(input.limit);
	const limit =
		Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 20;
	const offset = parseOffsetCursor(input.cursor);

	const filters =
		input.filters &&
		typeof input.filters === "object" &&
		!Array.isArray(input.filters)
			? input.filters
			: {};
	const dateWindow =
		isNonEmptyString(filters.date_window) &&
		["today", "current_week", "last_7_days"].includes(filters.date_window)
			? resolveDateWindow(filters.date_window)
			: null;
	const fromFilter = isNonEmptyString(filters.from) ? filters.from : null;
	const toFilter = isNonEmptyString(filters.to) ? filters.to : null;
	const hasEvidenceFilter =
		typeof filters.has_evidence === "boolean" ? filters.has_evidence : null;
	const statusFilterSet =
		Array.isArray(filters.statuses) && filters.statuses.length > 0
			? new Set(filters.statuses.filter((value) => isNonEmptyString(value)))
			: null;
	const counterpartyFilterSet =
		Array.isArray(filters.counterparty_ids) &&
		filters.counterparty_ids.length > 0
			? new Set(
					filters.counterparty_ids.filter((value) => isNonEmptyString(value)),
				)
			: null;
	const eventTypeFilterSet =
		Array.isArray(filters.event_types) && filters.event_types.length > 0
			? new Set(filters.event_types.filter((value) => isNonEmptyString(value)))
			: null;
	const sourceToolFilterSet =
		Array.isArray(filters.source_tools) && filters.source_tools.length > 0
			? new Set(filters.source_tools.filter((value) => isNonEmptyString(value)))
			: null;

	const messages = Object.values(state.mailbox?.messages || {}).filter(
		(item) => item && typeof item === "object",
	);
	const attachments = Object.values(state.mailbox?.attachments || {}).filter(
		(item) => item && typeof item === "object",
	);
	const todos = Array.isArray(state.workflow?.todos)
		? state.workflow.todos
		: [];
	const evidences = Array.isArray(state.workflow?.evidences)
		? state.workflow.evidences
		: [];

	const messageByPk = new Map();
	for (const message of messages) {
		if (isNonEmptyString(message.message_pk)) {
			messageByPk.set(message.message_pk, message);
		}
	}

	const evidenceById = new Map();
	const evidenceByMessagePk = new Map();
	for (const evidence of evidences) {
		const reference = buildEvidenceReference(evidence);
		if (!reference) {
			continue;
		}
		evidenceById.set(reference.evidence_id, reference);
		const list = evidenceByMessagePk.get(reference.source_id) || [];
		list.push(reference);
		evidenceByMessagePk.set(reference.source_id, list);
	}

	const candidates = [];

	if (scope === "all" || scope === "mail") {
		for (const message of messages) {
			const subject = isNonEmptyString(message.subject)
				? message.subject
				: "(제목 없음)";
			const sender = isNonEmptyString(message.from) ? message.from : "-";
			const snippet = normalizeSnippet(
				isNonEmptyString(message.body_text) ? message.body_text : subject,
			);
			const score = scoreByQuery(query, subject, sender, snippet);
			if (score <= 0) {
				continue;
			}
			const evidenceLocators =
				evidenceByMessagePk.get(message.message_pk) || [];
			const availableActions = ["open_source", "open_timeline"];
			if (evidenceLocators.length > 0) {
				availableActions.push("jump_evidence");
			}
			candidates.push({
				item: {
					result_id: `mail:${message.message_pk}`,
					source_type: "mail",
					source_id: message.message_pk,
					...(isNonEmptyString(message.provider_thread_id)
						? { thread_id: message.provider_thread_id }
						: {}),
					title: subject,
					snippet,
					score,
					occurred_at: safeIsoTimestamp(message.received_at, nowIso()),
					evidence_locators: evidenceLocators,
					available_actions: availableActions,
				},
				meta: {
					has_evidence: evidenceLocators.length > 0,
					status: null,
					counterparty_id: normalizeCounterpartyId(sender),
					event_type: null,
					source_tool: null,
				},
			});
		}
	}

	if (scope === "all" || scope === "attachment") {
		for (const attachment of attachments) {
			const title = isNonEmptyString(attachment.graph_attachment_id)
				? attachment.graph_attachment_id
				: attachment.attachment_pk;
			const snippet = isNonEmptyString(attachment.relative_path)
				? attachment.relative_path
				: attachment.attachment_pk;
			const score = scoreByQuery(
				query,
				title,
				snippet,
				attachment.attachment_pk,
			);
			if (score <= 0) {
				continue;
			}
			const relatedMessage = messageByPk.get(attachment.message_pk);
			candidates.push({
				item: {
					result_id: `attachment:${attachment.attachment_pk}`,
					source_type: "attachment",
					source_id: attachment.attachment_pk,
					title,
					snippet,
					score,
					occurred_at: safeIsoTimestamp(relatedMessage?.received_at, nowIso()),
					evidence_locators: [],
					available_actions: ["open_source", "open_timeline"],
				},
				meta: {
					has_evidence: false,
					status: null,
					counterparty_id: null,
					event_type: null,
					source_tool: null,
				},
			});
		}
	}

	if (scope === "all" || scope === "work_item") {
		for (const todo of todos) {
			if (
				!todo ||
				typeof todo !== "object" ||
				!isNonEmptyString(todo.todo_id)
			) {
				continue;
			}
			const title = isNonEmptyString(todo.title) ? todo.title : "(제목 없음)";
			const status = isNonEmptyString(todo.status) ? todo.status : "open";
			const snippet = `상태: ${status}`;
			const score = scoreByQuery(query, title, snippet, todo.todo_id);
			if (score <= 0) {
				continue;
			}
			const evidenceRef = isNonEmptyString(todo.evidence_id)
				? evidenceById.get(todo.evidence_id)
				: null;
			const evidenceLocators = evidenceRef ? [evidenceRef] : [];
			const availableActions = ["open_timeline"];
			if (evidenceLocators.length > 0) {
				availableActions.push("jump_evidence");
			}
			candidates.push({
				item: {
					result_id: `work_item:${todo.todo_id}`,
					source_type: "work_item",
					source_id: todo.todo_id,
					title,
					snippet,
					score,
					occurred_at: safeIsoTimestamp(
						todo.updated_at || todo.created_at,
						nowIso(),
					),
					evidence_locators: evidenceLocators,
					available_actions: availableActions,
				},
				meta: {
					has_evidence: evidenceLocators.length > 0,
					status,
					counterparty_id: null,
					event_type: null,
					source_tool: "workflow.upsert_todo",
				},
			});
		}
	}

	if (scope === "all" || scope === "timeline_event") {
		for (const event of buildTimelineEvents(state)) {
			const score = scoreByQuery(
				query,
				event.event_type,
				event.source_tool,
				event.entity_id,
				isNonEmptyString(event.payload?.message) ? event.payload.message : "",
			);
			if (score <= 0) {
				continue;
			}
			candidates.push({
				item: {
					result_id: `timeline:${event.event_id}`,
					source_type: "timeline_event",
					source_id: event.event_id,
					title: `${event.event_type} | ${event.source_tool}`,
					snippet: isNonEmptyString(event.payload?.message)
						? event.payload.message
						: event.entity_id,
					score,
					occurred_at: event.at,
					evidence_locators: [],
					available_actions: ["open_timeline"],
				},
				meta: {
					has_evidence: false,
					status: null,
					counterparty_id: null,
					event_type: event.event_type,
					source_tool: event.source_tool,
				},
			});
		}
	}

	const filtered = candidates.filter((candidate) => {
		const occurredAt = candidate.item.occurred_at;

		if (
			dateWindow &&
			!withinRange(occurredAt, dateWindow.start, dateWindow.end)
		) {
			return false;
		}

		if (
			(fromFilter && !withinRange(occurredAt, fromFilter, null)) ||
			(toFilter && !withinRange(occurredAt, null, toFilter))
		) {
			return false;
		}

		if (
			hasEvidenceFilter !== null &&
			Boolean(candidate.meta.has_evidence) !== hasEvidenceFilter
		) {
			return false;
		}

		if (statusFilterSet) {
			if (candidate.item.source_type !== "work_item") {
				return false;
			}
			if (!statusFilterSet.has(candidate.meta.status)) {
				return false;
			}
		}

		if (counterpartyFilterSet) {
			if (candidate.item.source_type !== "mail") {
				return false;
			}
			if (!counterpartyFilterSet.has(candidate.meta.counterparty_id)) {
				return false;
			}
		}

		if (eventTypeFilterSet) {
			if (candidate.item.source_type !== "timeline_event") {
				return false;
			}
			if (!eventTypeFilterSet.has(candidate.meta.event_type)) {
				return false;
			}
		}

		if (sourceToolFilterSet) {
			if (candidate.item.source_type !== "timeline_event") {
				return false;
			}
			if (!sourceToolFilterSet.has(candidate.meta.source_tool)) {
				return false;
			}
		}

		return true;
	});

	filtered.sort((a, b) => {
		if (sort === "newest") {
			return (
				(parseTimestamp(b.item.occurred_at) || 0) -
				(parseTimestamp(a.item.occurred_at) || 0)
			);
		}
		if (sort === "oldest") {
			return (
				(parseTimestamp(a.item.occurred_at) || 0) -
				(parseTimestamp(b.item.occurred_at) || 0)
			);
		}
		if (b.item.score !== a.item.score) {
			return b.item.score - a.item.score;
		}
		return (
			(parseTimestamp(b.item.occurred_at) || 0) -
			(parseTimestamp(a.item.occurred_at) || 0)
		);
	});

	const paged = filtered.slice(offset, offset + limit);
	const nextOffset = offset + paged.length;

	return {
		ok: true,
		data: {
			items: paged.map((candidate) => candidate.item),
			...(nextOffset < filtered.length
				? { next_cursor: `offset:${nextOffset}` }
				: {}),
			total_estimate: filtered.length,
		},
	};
};

const handleTimelineList = (state, input) => {
	if (input === null || typeof input !== "object" || Array.isArray(input)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"timeline.list input 은 객체여야 합니다.",
		);
	}

	const includePayload = input.include_payload === true;
	const limitRaw = Number(input.limit);
	const limit =
		Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 50;
	const offset = parseOffsetCursor(input.cursor);
	const entityId = isNonEmptyString(input.entity_id) ? input.entity_id : null;
	const eventTypeSet =
		Array.isArray(input.event_types) && input.event_types.length > 0
			? new Set(input.event_types.filter((value) => isNonEmptyString(value)))
			: null;
	const sourceToolSet =
		Array.isArray(input.source_tools) && input.source_tools.length > 0
			? new Set(input.source_tools.filter((value) => isNonEmptyString(value)))
			: null;
	const fromFilter = isNonEmptyString(input.from) ? input.from : null;
	const toFilter = isNonEmptyString(input.to) ? input.to : null;

	const filtered = buildTimelineEvents(state)
		.filter((event) => {
			if (entityId && event.entity_id !== entityId) {
				return false;
			}
			if (eventTypeSet && !eventTypeSet.has(event.event_type)) {
				return false;
			}
			if (sourceToolSet && !sourceToolSet.has(event.source_tool)) {
				return false;
			}
			if (
				(fromFilter && !withinRange(event.at, fromFilter, null)) ||
				(toFilter && !withinRange(event.at, null, toFilter))
			) {
				return false;
			}
			return true;
		})
		.sort((a, b) => (parseTimestamp(b.at) || 0) - (parseTimestamp(a.at) || 0));

	const paged = filtered.slice(offset, offset + limit);
	const nextOffset = offset + paged.length;

	return {
		ok: true,
		data: {
			events: paged.map((event) =>
				includePayload ? event : { ...event, payload: {} },
			),
			...(nextOffset < filtered.length
				? { next_cursor: `offset:${nextOffset}` }
				: {}),
		},
	};
};

const listRecentMessagesForAutopilot = (state, maxMessages) =>
	Object.values(state.mailbox.messages)
		.filter((msg) => msg && typeof msg === "object")
		.sort((a, b) => {
			const ta = parseTimestamp(a.received_at) ?? 0;
			const tb = parseTimestamp(b.received_at) ?? 0;
			return tb - ta;
		})
		.slice(0, maxMessages);

const hasEvidenceForMessage = (state, messagePk) => {
	if (!Array.isArray(state.workflow?.evidences)) {
		return false;
	}
	return state.workflow.evidences.some(
		(item) => item?.source?.id === messagePk,
	);
};

const selectAutopilotCandidates = (state, maxMessages) => {
	const messages = listRecentMessagesForAutopilot(state, maxMessages);
	return messages.filter(
		(message) =>
			isNonEmptyString(message.message_pk) &&
			!hasEvidenceForMessage(state, message.message_pk),
	);
};

const buildAutoTodoTitle = (message) => {
	const subject = isNonEmptyString(message.subject)
		? message.subject.trim()
		: "무제 메일";
	const sender = isNonEmptyString(message.from)
		? message.from.trim()
		: "unknown";
	return `[AUTO] ${subject} - 확인/처리 (${sender})`;
};

const buildCodexCliSpawnArgs = (args) => ["exec", ...args];

const runCodexCliAdapter = async (
	{
		executable = CODEX_CLI_EXECUTABLE,
		args = [],
		timeout_ms = AUTOPILOT_CODEX_ANALYZE_TIMEOUT_MS,
		cwd = undefined,
		env = process.env,
	},
	{
		spawnFn = spawn,
		nowFn = Date.now,
		setTimeoutFn = setTimeout,
		clearTimeoutFn = clearTimeout,
		killFn = process.kill,
		platform = process.platform,
	} = {},
) => {
	const startedAt = nowFn();
	const spawnArgs = buildCodexCliSpawnArgs(
		Array.isArray(args) ? args.filter((item) => typeof item === "string") : [],
	);
	const timeoutMs =
		typeof timeout_ms === "number" &&
		Number.isFinite(timeout_ms) &&
		timeout_ms > 0
			? Math.trunc(timeout_ms)
			: AUTOPILOT_CODEX_ANALYZE_TIMEOUT_MS;
	const stdoutChunks = [];
	const stderrChunks = [];
	const isWindows = platform === "win32";
	const killProcess = (child, signal) => {
		if (typeof child?.pid === "number" && child.pid > 0) {
			if (!isWindows) {
				try {
					killFn(-child.pid, signal);
				} catch {
					// best effort
				}
			}
		}
		try {
			child.kill(signal);
		} catch {
			// best effort
		}
	};

	return new Promise((resolve) => {
		let settled = false;
		let timedOut = false;
		let spawnError = null;
		let timeoutHandle = null;
		let forceKillHandle = null;
		let child;

		const finish = ({ exitCode, signalCode }) => {
			if (settled) {
				return;
			}
			settled = true;
			if (timeoutHandle !== null) {
				clearTimeoutFn(timeoutHandle);
			}
			if (forceKillHandle !== null) {
				clearTimeoutFn(forceKillHandle);
			}
			const durationMs = Math.max(0, nowFn() - startedAt);
			const stdout = Buffer.concat(stdoutChunks).toString("utf8");
			const stderr = Buffer.concat(stderrChunks).toString("utf8");
			const normalizedExitCode =
				typeof exitCode === "number" ? exitCode : timedOut ? 124 : -1;
			if (timedOut) {
				resolve({
					ok: false,
					exit_code: 124,
					duration_ms: durationMs,
					stdout,
					stderr,
					failure_kind: "timeout_retriable",
				});
				return;
			}
			if (spawnError instanceof Error) {
				resolve({
					ok: false,
					exit_code: normalizedExitCode,
					duration_ms: durationMs,
					stdout,
					stderr: `${stderr}${stderr.length > 0 ? "\n" : ""}${spawnError.message}`,
					failure_kind: "spawn_error",
				});
				return;
			}
			if (typeof exitCode === "number" && exitCode === 0) {
				resolve({
					ok: true,
					exit_code: 0,
					duration_ms: durationMs,
					stdout,
					stderr,
					failure_kind: null,
				});
				return;
			}
			if (typeof exitCode === "number") {
				resolve({
					ok: false,
					exit_code: exitCode,
					duration_ms: durationMs,
					stdout,
					stderr,
					failure_kind: "exit_non_zero",
				});
				return;
			}
			resolve({
				ok: false,
				exit_code: normalizedExitCode,
				duration_ms: durationMs,
				stdout,
				stderr,
				failure_kind:
					typeof signalCode === "string" ? "signal_terminated" : "spawn_error",
			});
		};

		try {
			child = spawnFn(executable, spawnArgs, {
				cwd,
				env,
				shell: false,
				detached: !isWindows,
				stdio: ["ignore", "pipe", "pipe"],
			});
		} catch (error) {
			spawnError = error instanceof Error ? error : new Error(String(error));
			finish({ exitCode: -1, signalCode: null });
			return;
		}

		if (child.stdout) {
			child.stdout.on("data", (chunk) => {
				stdoutChunks.push(
					Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)),
				);
			});
		}
		if (child.stderr) {
			child.stderr.on("data", (chunk) => {
				stderrChunks.push(
					Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)),
				);
			});
		}

		timeoutHandle = setTimeoutFn(() => {
			timedOut = true;
			killProcess(child, "SIGTERM");
			forceKillHandle = setTimeoutFn(() => {
				if (settled) {
					return;
				}
				killProcess(child, "SIGKILL");
			}, CODEX_CLI_TIMEOUT_GRACE_KILL_MS);
		}, timeoutMs);

		child.once("error", (error) => {
			spawnError = error instanceof Error ? error : new Error(String(error));
		});
		child.once("close", (exitCode, signalCode) => {
			finish({ exitCode, signalCode });
		});
	});
};

const CODEX_PROPOSAL_SCHEMA_VERSION = "codex_proposal.v1";

const isRecord = (value) =>
	value !== null && typeof value === "object" && !Array.isArray(value);

const unknownKeys = (value, allowed) =>
	Object.keys(value).filter((key) => !allowed.includes(key));

const parseCodexProposalOutput = (raw) => {
	let parsed = raw;

	if (typeof raw === "string") {
		const trimmed = raw.trim();
		if (trimmed.length === 0) {
			return {
				ok: false,
				error_code: "E_CODEX_OUTPUT_INVALID_JSON",
				error_message: "codex 출력이 비어 있습니다.",
			};
		}

		try {
			parsed = JSON.parse(trimmed);
		} catch {
			return {
				ok: false,
				error_code: "E_CODEX_OUTPUT_INVALID_JSON",
				error_message: "codex 출력은 단일 JSON 객체여야 합니다.",
			};
		}
	}

	if (!isRecord(parsed)) {
		return {
			ok: false,
			error_code: "E_CODEX_OUTPUT_INVALID_TYPE",
			error_message: "codex 출력 루트는 객체여야 합니다.",
		};
	}

	const rootUnknown = unknownKeys(parsed, ["schema_version", "proposal"]);
	if (rootUnknown.length > 0) {
		return {
			ok: false,
			error_code: "E_CODEX_OUTPUT_UNKNOWN_FIELD",
			error_message: `codex 출력 루트에 알 수 없는 필드가 있습니다: ${rootUnknown.join(", ")}`,
		};
	}

	if (!Object.prototype.hasOwnProperty.call(parsed, "schema_version")) {
		return {
			ok: false,
			error_code: "E_CODEX_OUTPUT_MISSING_FIELD",
			error_message: "codex 출력에 schema_version 필드가 필요합니다.",
		};
	}

	if (parsed.schema_version !== CODEX_PROPOSAL_SCHEMA_VERSION) {
		return {
			ok: false,
			error_code: "E_CODEX_OUTPUT_SCHEMA_VERSION",
			error_message: `지원되지 않는 schema_version 입니다: ${String(parsed.schema_version)}`,
		};
	}

	if (!Object.prototype.hasOwnProperty.call(parsed, "proposal")) {
		return {
			ok: false,
			error_code: "E_CODEX_OUTPUT_MISSING_FIELD",
			error_message: "codex 출력에 proposal 필드가 필요합니다.",
		};
	}

	if (!isRecord(parsed.proposal)) {
		return {
			ok: false,
			error_code: "E_CODEX_OUTPUT_INVALID_TYPE",
			error_message: "proposal 은 객체여야 합니다.",
		};
	}

	const proposal = parsed.proposal;
	const proposalUnknown = unknownKeys(proposal, [
		"snippet",
		"confidence",
		"todo_title",
	]);
	if (proposalUnknown.length > 0) {
		return {
			ok: false,
			error_code: "E_CODEX_OUTPUT_UNKNOWN_FIELD",
			error_message: `proposal 에 알 수 없는 필드가 있습니다: ${proposalUnknown.join(", ")}`,
		};
	}

	if (!Object.prototype.hasOwnProperty.call(proposal, "snippet")) {
		return {
			ok: false,
			error_code: "E_CODEX_OUTPUT_MISSING_FIELD",
			error_message: "proposal.snippet 필드가 필요합니다.",
		};
	}

	if (!Object.prototype.hasOwnProperty.call(proposal, "confidence")) {
		return {
			ok: false,
			error_code: "E_CODEX_OUTPUT_MISSING_FIELD",
			error_message: "proposal.confidence 필드가 필요합니다.",
		};
	}

	if (!Object.prototype.hasOwnProperty.call(proposal, "todo_title")) {
		return {
			ok: false,
			error_code: "E_CODEX_OUTPUT_MISSING_FIELD",
			error_message: "proposal.todo_title 필드가 필요합니다.",
		};
	}

	const snippet = normalizeSnippet(proposal.snippet);
	if (typeof proposal.snippet !== "string" || snippet.length === 0) {
		return {
			ok: false,
			error_code: "E_CODEX_OUTPUT_INVALID_FIELD",
			error_message: "proposal.snippet 은 비어있지 않은 문자열이어야 합니다.",
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
			error_code: "E_CODEX_OUTPUT_INVALID_FIELD",
			error_message: "proposal.confidence 는 0 이상 1 이하 숫자여야 합니다.",
		};
	}

	if (
		typeof proposal.todo_title !== "string" ||
		proposal.todo_title.trim().length === 0
	) {
		return {
			ok: false,
			error_code: "E_CODEX_OUTPUT_INVALID_FIELD",
			error_message:
				"proposal.todo_title 은 비어있지 않은 문자열이어야 합니다.",
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

const buildDefaultCodexProposalOutput = (message, payload) =>
	JSON.stringify({
		schema_version: CODEX_PROPOSAL_SCHEMA_VERSION,
		proposal: {
			snippet: normalizeSnippet(payload.body_text),
			confidence: AUTOPILOT_AUTO_MIN_CONFIDENCE,
			todo_title: buildAutoTodoTitle(message),
		},
	});

const resolveCodexProposalRawOutput = (message, payload) => {
	if (
		message &&
		typeof message === "object" &&
		Object.prototype.hasOwnProperty.call(message, "__codex_output_raw")
	) {
		return message.__codex_output_raw;
	}

	return buildDefaultCodexProposalOutput(message, payload);
};

const resolveCodexRetryPlan = (message) => {
	if (message === null || typeof message !== "object") {
		return null;
	}
	const rawPlan = message.__codex_retry_plan;
	if (
		rawPlan === null ||
		typeof rawPlan !== "object" ||
		Array.isArray(rawPlan)
	) {
		return null;
	}
	const kind =
		typeof rawPlan.kind === "string" ? rawPlan.kind.trim().toLowerCase() : "";
	if (!["timeout", "transient", "terminal"].includes(kind)) {
		return null;
	}
	const failAttemptsRaw = Number(rawPlan.fail_attempts);
	const failAttempts =
		Number.isInteger(failAttemptsRaw) && failAttemptsRaw > 0
			? failAttemptsRaw
			: 1;
	return {
		kind,
		fail_attempts: failAttempts,
		message:
			typeof rawPlan.message === "string" && rawPlan.message.trim().length > 0
				? rawPlan.message.trim()
				: null,
	};
};

const resolveCodexAttemptFailure = (message, attempt) => {
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

const buildAutopilotCandidatePayload = (state, message) => {
	const subject = isNonEmptyString(message.subject)
		? message.subject.trim()
		: "무제 메일";
	const from = isNonEmptyString(message.from) ? message.from.trim() : "unknown";
	const baseBodyText = normalizeFingerprintBody(
		isNonEmptyString(message.body_text) ? message.body_text : subject,
	).slice(0, AUTOPILOT_CANDIDATE_BODY_MAX_CHARS);
	const attachmentTextContext = buildAttachmentTextContext(state, message);
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
			has_attachments: Boolean(message.has_attachments),
		},
		requires_user_confirmation:
			attachmentTextContext.requires_user_confirmation,
	};
};

const CODEX_CANDIDATE_ALLOWED_METADATA_KEYS = Object.freeze([
	"message_pk",
	"internet_message_id",
	"received_at",
	"has_attachments",
	"attempt",
	"max_attempts",
]);

const buildCodexAnalyzeAllowedMetadata = (payload) => {
	const metadata = {};
	for (const key of CODEX_CANDIDATE_ALLOWED_METADATA_KEYS) {
		if (!Object.prototype.hasOwnProperty.call(payload, key)) {
			continue;
		}
		metadata[key] = payload[key];
	}
	return metadata;
};

const buildCodexAnalyzeInputPayload = (payload) => ({
	schema_version: "codex_candidate.v1",
	candidate: {
		message_pk: payload.message_pk,
		internet_message_id: payload.internet_message_id,
		received_at: payload.received_at,
		subject: payload.subject,
		from: payload.from,
		body_text: payload.body_text,
		has_attachments: payload.has_attachments,
	},
	metadata: buildCodexAnalyzeAllowedMetadata(payload),
});

const buildCodexAnalyzeArgs = (payload) => [
	"--json",
	"--input",
	JSON.stringify(buildCodexAnalyzeInputPayload(payload)),
];

const resolveCodexAdapterFailure = (adapterResult) => {
	if (adapterResult.failure_kind === "timeout_retriable") {
		return {
			classification: "retriable",
			message:
				isNonEmptyString(adapterResult.stderr) &&
				adapterResult.stderr.trim().length > 0
					? adapterResult.stderr.trim()
					: `codex 분석이 ${AUTOPILOT_CODEX_ANALYZE_TIMEOUT_MS}ms 제한 시간을 초과했습니다.`,
		};
	}

	const message =
		isNonEmptyString(adapterResult.stderr) &&
		adapterResult.stderr.trim().length > 0
			? adapterResult.stderr.trim()
			: `codex exec 실행에 실패했습니다. kind=${String(
					adapterResult.failure_kind ?? "unknown",
				)} exit=${String(adapterResult.exit_code ?? -1)}`;

	return {
		classification: "terminal",
		message,
	};
};

const analyzeAutopilotCandidateAttempt = async (
	message,
	payload,
	runtimeContract,
	runCodexCliAdapterFn,
) => {
	if (!runtimeContract.flags.codex_exec_enabled) {
		const syntheticFailure = resolveCodexAttemptFailure(
			message,
			payload.attempt,
		);
		if (syntheticFailure !== null) {
			return {
				kind: "failure",
				classification: syntheticFailure.classification,
				message: syntheticFailure.message,
				telemetry: {
					attempt: payload.attempt,
					duration_ms: null,
					exit_code: null,
					failure_kind:
						syntheticFailure.classification === "retriable"
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
				attempt: payload.attempt,
				duration_ms: null,
				exit_code: null,
				failure_kind: null,
				fallback_used: true,
			},
		};
	}

	const adapterResult = await runCodexCliAdapterFn({
		args: buildCodexAnalyzeArgs(payload),
		timeout_ms: AUTOPILOT_CODEX_ANALYZE_TIMEOUT_MS,
	});
	if (adapterResult.ok) {
		return {
			kind: "raw_output",
			raw_output: adapterResult.stdout,
			telemetry: {
				attempt: payload.attempt,
				duration_ms:
					typeof adapterResult.duration_ms === "number"
						? adapterResult.duration_ms
						: null,
				exit_code:
					typeof adapterResult.exit_code === "number"
						? adapterResult.exit_code
						: null,
				failure_kind: null,
				fallback_used: false,
			},
		};
	}

	const adapterFailure = resolveCodexAdapterFailure(adapterResult);
	return {
		kind: "failure",
		classification: adapterFailure.classification,
		message: adapterFailure.message,
		telemetry: {
			attempt: payload.attempt,
			duration_ms:
				typeof adapterResult.duration_ms === "number"
					? adapterResult.duration_ms
					: null,
			exit_code:
				typeof adapterResult.exit_code === "number"
					? adapterResult.exit_code
					: null,
			failure_kind: isNonEmptyString(adapterResult.failure_kind)
				? adapterResult.failure_kind
				: null,
			fallback_used: false,
		},
	};
};

const analyzeAutopilotCandidate = async (
	message,
	runtimeContract,
	{ runCodexCliAdapterFn = runCodexCliAdapter } = {},
	state = null,
) => {
	const payloadResult = buildAutopilotCandidatePayload(state ?? {}, message);
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
				fallback_used: !runtimeContract.flags.codex_exec_enabled,
			},
		};
	}
	const maxAttempts = AUTOPILOT_CODEX_ANALYZE_MAX_RETRIES + 1;
	let exhaustedRetriableMessage = null;
	let lastAttemptTelemetry = {
		attempt: 1,
		duration_ms: null,
		exit_code: null,
		failure_kind: null,
		fallback_used: !runtimeContract.flags.codex_exec_enabled,
	};
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const attemptResult = await analyzeAutopilotCandidateAttempt(
			message,
			{ ...payload, attempt, max_attempts: maxAttempts },
			runtimeContract,
			runCodexCliAdapterFn,
		);
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
				telemetry: {
					attempt: attemptResult.telemetry.attempt,
					duration_ms: attemptResult.telemetry.duration_ms,
					exit_code: attemptResult.telemetry.exit_code,
					failure_kind: "analysis_fail",
					fallback_used: attemptResult.telemetry.fallback_used,
				},
			};
		}

		const codexOutput = attemptResult.raw_output;
		const parsed = parseCodexProposalOutput(codexOutput);
		if (!parsed.ok) {
			return {
				message,
				payload,
				proposal: null,
				review_reason: "codex_schema_invalid",
				parse_error: {
					code: parsed.error_code,
					message: parsed.error_message,
				},
				failure_class: "terminal",
				failure_kind: "schema_fail",
				attempt_count: attempt,
				telemetry: {
					attempt: attemptResult.telemetry.attempt,
					duration_ms: attemptResult.telemetry.duration_ms,
					exit_code: attemptResult.telemetry.exit_code,
					failure_kind: "schema_fail",
					fallback_used: attemptResult.telemetry.fallback_used,
				},
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
				snippet: parsed.value.snippet,
				confidence: parsed.value.confidence,
				todo_title: parsed.value.todo_title,
				candidate_payload: payload,
			},
			review_reason: null,
			attempt_count: attempt,
			telemetry: {
				attempt: attemptResult.telemetry.attempt,
				duration_ms: attemptResult.telemetry.duration_ms,
				exit_code: attemptResult.telemetry.exit_code,
				failure_kind: null,
				fallback_used: attemptResult.telemetry.fallback_used,
			},
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
		telemetry: {
			attempt: lastAttemptTelemetry.attempt,
			duration_ms: lastAttemptTelemetry.duration_ms,
			exit_code: lastAttemptTelemetry.exit_code,
			failure_kind: "timeout",
			fallback_used: lastAttemptTelemetry.fallback_used,
		},
	};
};

const analyzeAutopilotCandidates = async (
	state,
	candidates,
	runtimeContract,
	{ runCodexCliAdapterFn = runCodexCliAdapter } = {},
) => {
	const analyzed = await Promise.all(
		candidates.map(async (message) => {
			try {
				return await analyzeAutopilotCandidate(
					message,
					runtimeContract,
					{
						runCodexCliAdapterFn,
					},
					state,
				);
			} catch {
				pushLog(
					state,
					"warn",
					"codex_analyze",
					`candidate analysis failed: ${message.message_pk ?? "unknown"}`,
				);
				return {
					message,
					payload: buildAutopilotCandidatePayload(state, message).payload,
					proposal: null,
					review_reason: "analysis_failed",
					failure_kind: "analysis_fail",
					telemetry: {
						attempt: 1,
						duration_ms: null,
						exit_code: null,
						failure_kind: "analysis_fail",
						fallback_used: !runtimeContract.flags.codex_exec_enabled,
					},
				};
			}
		}),
	);

	return analyzed.map((result) => {
		if (result.review_reason === "codex_schema_invalid" && result.parse_error) {
			pushLog(
				state,
				"warn",
				"codex_schema_invalid",
				`${result.message.message_pk ?? "unknown"}: ${result.parse_error.code} ${result.parse_error.message}`,
			);
		}
		return result;
	});
};

const buildAutopilotStageFailureMatrix = (
	analyzedCandidates,
	proposalCount,
) => {
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

const setAutopilotMode = (state, input) => {
	const autopilot = getAutopilotState(state);
	const requestedMode = isNonEmptyString(input.mode) ? input.mode.trim() : "";
	if (!AUTOPILOT_ALLOWED_MODES.includes(requestedMode)) {
		return errorResponse(
			"E_PARSE_FAILED",
			"mode 는 manual/review_first/full_auto 중 하나여야 합니다.",
		);
	}
	autopilot.mode = requestedMode;
	autopilot.paused = requestedMode === "manual";
	autopilot.status = autopilot.paused ? "paused" : "idle";
	autopilot.last_error = null;
	autopilot.consecutive_failures = 0;
	writeState(state);
	pushLog(state, "info", "autopilot_mode", requestedMode);
	return {
		ok: true,
		data: {
			mode: autopilot.mode,
			status: autopilot.status,
			paused: autopilot.paused,
		},
	};
};

const pauseAutopilot = (state) => {
	const autopilot = getAutopilotState(state);
	autopilot.paused = true;
	autopilot.status = "paused";
	autopilot.in_flight_run_id = null;
	writeState(state);
	pushLog(state, "warn", "autopilot_pause", "paused by request");
	return { ok: true, data: { paused: true, status: autopilot.status } };
};

const resumeAutopilot = (state) => {
	const autopilot = getAutopilotState(state);
	if (autopilot.mode === "manual") {
		return errorResponse(
			"E_POLICY_DENIED",
			"manual 모드에서는 resume 할 수 없습니다.",
		);
	}
	autopilot.paused = false;
	autopilot.status = "idle";
	autopilot.last_error = null;
	autopilot.consecutive_failures = 0;
	autopilot.in_flight_run_id = null;
	writeState(state);
	pushLog(state, "info", "autopilot_resume", "resumed");
	return { ok: true, data: { paused: false, status: autopilot.status } };
};

const getAutopilotStatus = (state) => {
	const autopilot = getAutopilotState(state);
	const runtimeContract = buildCodexExecRuntimeContract(readConfig());
	const safeAutopilot = sanitizeAutopilotForStatus(autopilot);
	return {
		ok: true,
		data: {
			...safeAutopilot,
			codex_exec_contract: sanitizeCodexExecContractForStatus(runtimeContract),
			persistence_authority: PHASE_1_PERSISTENCE_AUTHORITY,
		},
	};
};

const runAutopilotTick = async (state, config, input) => {
	const autopilot = getAutopilotState(state);
	const runtimeContract = buildCodexExecRuntimeContract(config);
	const modePolicy = resolveAutopilotModePolicy(autopilot, runtimeContract);
	if (!modePolicy.tick_allowed && autopilot.mode === "manual") {
		return errorResponse(
			"E_POLICY_DENIED",
			"manual 모드입니다. autopilot.set_mode 후 실행하세요.",
		);
	}
	if (!modePolicy.tick_allowed && autopilot.status === "degraded") {
		return errorResponse(
			"E_POLICY_DENIED",
			`autopilot 이 degraded 상태입니다. ${autopilot.last_error ?? "복구 후 resume 하세요."}`,
		);
	}
	if (autopilot.paused || autopilot.status === "paused") {
		return errorResponse("E_POLICY_DENIED", "autopilot 이 paused 상태입니다.");
	}
	if (isNonEmptyString(autopilot.in_flight_run_id)) {
		return errorResponse(
			"E_GRAPH_THROTTLED",
			"autopilot tick 이 이미 실행 중입니다.",
			true,
		);
	}

	const folder = isNonEmptyString(input.mail_folder)
		? input.mail_folder.trim()
		: AUTOPILOT_DEFAULT_FOLDER;
	const requestedMaxMessages = Number(input.max_messages_per_tick);
	const maxMessages =
		Number.isInteger(requestedMaxMessages) && requestedMaxMessages > 0
			? Math.min(requestedMaxMessages, AUTOPILOT_MAX_MESSAGES_PER_TICK)
			: AUTOPILOT_MAX_MESSAGES_PER_TICK;
	const requestedMaxAttachments = Number(input.max_attachments_per_tick);
	const maxAttachments =
		Number.isInteger(requestedMaxAttachments) && requestedMaxAttachments > 0
			? Math.min(requestedMaxAttachments, AUTOPILOT_MAX_ATTACHMENTS_PER_TICK)
			: AUTOPILOT_MAX_ATTACHMENTS_PER_TICK;

	const runId = `run_${Date.now()}_${randomBytes(3).toString("hex")}`;
	autopilot.in_flight_run_id = runId;
	autopilot.last_tick_at = nowIso();
	autopilot.status = "syncing";
	incrementAutopilotMetric(state, "ticks_total", 1);
	writeState(state);

	const syncResult = await deltaSync(state, config, { mail_folder: folder });
	if (!syncResult.ok) {
		markAutopilotFailure(state, syncResult.error_message);
		writeState(state);
		return syncResult;
	}

	autopilot.status = "analyzing";
	writeState(state);

	const candidates = selectAutopilotCandidates(state, maxMessages);
	const runCorrelation = candidates.map((message) => ({
		run_id: runId,
		correlation_id: `corr_${createHash("sha1")
			.update(`${runId}:${message.message_pk}`)
			.digest("hex")
			.slice(0, 16)}`,
		message_pk: message.message_pk,
		candidate_stage: "selected",
		analysis_stage: "review",
		persistence_stage: "not_run",
		...createDefaultRunCorrelationTelemetry(
			!runtimeContract.flags.codex_exec_enabled,
		),
	}));
	const runCorrelationByMessagePk = new Map(
		runCorrelation.map((item) => [item.message_pk, item]),
	);
	incrementAutopilotMetric(state, "codex_stage_started", candidates.length);
	for (const correlation of runCorrelation) {
		pushLog(
			state,
			"info",
			"autopilot_candidate_selected",
			`${correlation.correlation_id} ${correlation.message_pk}`,
		);
	}

	if (candidates.length > 0) {
		const codexAuth = runtimeContract.flags.codex_exec_enabled
			? resolveCodexExecAuth(config, runtimeContract)
			: resolveCodexAuth(config);
		if (!codexAuth.ok) {
			autopilot.codex_stage.last_failure_reason = codexAuth.error.error_message;
			updateCodexStageStatusFromMetrics(state);
			setCodexStageRunCorrelation(state, runCorrelation);
			markAutopilotFailure(state, codexAuth.error.error_message);
			pushLog(state, "warn", "codex_auth", codexAuth.logMessage);
			writeState(state);
			return codexAuth.error;
		}
		if (codexAuth.enabled) {
			pushLog(
				state,
				"info",
				"codex_auth",
				`resolved ${codexAuth.source} ${codexAuth.redacted}`,
			);
		}
	}

	const analyzedCandidates = await analyzeAutopilotCandidates(
		state,
		candidates,
		runtimeContract,
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
			incrementAutopilotMetric(state, "codex_stage_success", 1);
			if (correlation) {
				correlation.analysis_stage = "proposal";
				pushLog(
					state,
					"info",
					"autopilot_analysis",
					`${correlation.correlation_id} proposal`,
				);
			}
			continue;
		}

		incrementAutopilotMetric(state, "codex_stage_fail", 1);
		if (analyzed.failure_kind === "timeout") {
			incrementAutopilotMetric(state, "codex_stage_timeout", 1);
		}
		if (analyzed.failure_kind === "schema_fail") {
			incrementAutopilotMetric(state, "codex_stage_schema_fail", 1);
		}
		if (isNonEmptyString(analyzed.failure_message)) {
			autopilot.codex_stage.last_failure_reason = analyzed.failure_message;
		} else if (isNonEmptyString(analyzed.parse_error?.message)) {
			autopilot.codex_stage.last_failure_reason = analyzed.parse_error.message;
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
			pushLog(
				state,
				"warn",
				"autopilot_analysis",
				`${correlation.correlation_id} ${correlation.analysis_stage}`,
			);
		}
	}
	updateCodexStageStatusFromMetrics(state);
	const analysisProposals = analyzedCandidates
		.map((item) => item.proposal)
		.filter((item) => item !== null);
	const failureMatrix = buildAutopilotStageFailureMatrix(
		analyzedCandidates,
		analysisProposals.length,
	);
	if (failureMatrix.retriable_exhausted) {
		const details = analyzedCandidates
			.map((item) => item.failure_message)
			.filter((item) => isNonEmptyString(item))
			.join(" | ");
		const failureMessage =
			details.length > 0 ? details : "codex 분석 재시도 한도를 초과했습니다.";
		autopilot.codex_stage.last_failure_reason = failureMessage;
		setCodexStageRunCorrelation(state, runCorrelation);
		markAutopilotFailure(state, failureMessage);
		writeState(state);
		return errorResponse(
			"E_CODEX_ANALYZE_RETRY_EXHAUSTED",
			failureMessage,
			true,
		);
	}
	if (autopilot.mode === "full_auto" && failureMatrix.threshold_breached) {
		const failureMessage = `codex 분석 실패 임계치(${AUTOPILOT_CODEX_STAGE_FAILURE_THRESHOLD})를 초과했습니다. retriable=${failureMatrix.retriable_failures}, terminal=${failureMatrix.terminal_failures}, sync=+${syncResult.data.changes.added} ~${syncResult.data.changes.updated} -${syncResult.data.changes.deleted}`;
		autopilot.codex_stage.last_failure_reason = failureMessage;
		setCodexStageRunCorrelation(state, runCorrelation);
		markAutopilotFailure(state, failureMessage);
		writeState(state);
		return errorResponse(
			"E_CODEX_ANALYZE_RETRY_EXHAUSTED",
			failureMessage,
			failureMatrix.retriable_failures > 0,
		);
	}

	if (autopilot.mode === "review_first") {
		incrementAutopilotMetric(
			state,
			"review_candidates",
			analysisProposals.length,
		);
		for (const correlation of runCorrelation) {
			correlation.persistence_stage = "skipped_review_first";
			pushLog(
				state,
				"info",
				"autopilot_persistence",
				`${correlation.correlation_id} skipped_review_first`,
			);
		}
		setCodexStageRunCorrelation(state, runCorrelation);
		incrementAutopilotMetric(state, "ticks_success", 1);
		autopilot.consecutive_failures = 0;
		autopilot.last_error = null;
		clearAutopilotRun(state);
		writeState(state);
		return {
			ok: true,
			data: {
				run_id: runId,
				mode: autopilot.mode,
				synced_changes: syncResult.data.changes,
				run_correlation: runCorrelation,
				review_candidates: analysisProposals,
			},
		};
	}

	autopilot.status = "persisting";
	let evidenceCreated = 0;
	let todoCreated = 0;
	let evidenceWrites = 0;
	let todoWrites = 0;
	let attachmentSaved = 0;
	let reviewCandidates = 0;
	let attachmentBudgetLeft = maxAttachments;

	for (const analyzed of analyzedCandidates) {
		const persistResult = persistAnalyzedCandidateViaWorkflow(state, analyzed);
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
			pushLog(
				state,
				persistResult.review_candidate ? "warn" : "info",
				"autopilot_persistence",
				`${correlation.correlation_id} ${correlation.persistence_stage}`,
			);
		}
		if (persistResult.review_candidate) {
			continue;
		}

		const message = analyzed.message;

		if (
			attachmentBudgetLeft > 0 &&
			Array.isArray(message.attachments) &&
			isNonEmptyString(message.provider_message_id)
		) {
			for (const graphAttachmentIdRaw of message.attachments) {
				if (attachmentBudgetLeft <= 0) {
					break;
				}
				if (!isNonEmptyString(graphAttachmentIdRaw)) {
					continue;
				}
				const lookupKey = attachmentLookupKey(
					message.provider_message_id,
					graphAttachmentIdRaw,
				);
				if (state.mailbox.attachments[lookupKey]) {
					continue;
				}
				const attachmentResult = await downloadAttachment(state, config, {
					graph_message_id: message.provider_message_id,
					graph_attachment_id: graphAttachmentIdRaw,
					message_pk: message.message_pk,
				});
				if (attachmentResult.ok) {
					attachmentSaved += 1;
					attachmentBudgetLeft -= 1;
				}
			}
		}
	}

	incrementAutopilotMetric(state, "auto_evidence_created", evidenceCreated);
	incrementAutopilotMetric(state, "auto_todo_created", todoCreated);
	incrementAutopilotMetric(state, "auto_attachment_saved", attachmentSaved);
	incrementAutopilotMetric(state, "review_candidates", reviewCandidates);
	incrementAutopilotMetric(state, "ticks_success", 1);
	if (failureMatrix.total_failures === 0) {
		autopilot.codex_stage.last_failure_reason = null;
	}
	autopilot.consecutive_failures = 0;
	autopilot.last_error = null;
	updateCodexStageStatusFromMetrics(state);
	setCodexStageRunCorrelation(state, runCorrelation);
	clearAutopilotRun(state);
	writeState(state);
	pushLog(
		state,
		"info",
		"autopilot_tick",
		`${runId} evidences=${evidenceCreated} todos=${todoCreated} attachments=${attachmentSaved}`,
	);

	return {
		ok: true,
		data: {
			run_id: runId,
			mode: autopilot.mode,
			synced_changes: syncResult.data.changes,
			auto_evidence_created: evidenceCreated,
			auto_todo_created: todoCreated,
			auto_evidence_writes: evidenceWrites,
			auto_todo_writes: todoWrites,
			auto_attachment_saved: attachmentSaved,
			review_candidates: reviewCandidates,
			run_correlation: runCorrelation,
		},
	};
};

const handleAuthStatus = (state) => ({
	ok: true,
	data: {
		signed_in: Boolean(state.signed_in && state.account !== null),
		account: state.account,
		...(state.auth_token && typeof state.auth_token.expires_at === "string"
			? { access_token_expires_at: state.auth_token.expires_at }
			: {}),
		...(state.pending_callback
			? {
					pending_callback_received: true,
					pending_callback_received_at: state.pending_callback.received_at,
				}
			: { pending_callback_received: false }),
	},
});

const handleMessage = async (message) => {
	if (
		message === null ||
		typeof message !== "object" ||
		Array.isArray(message)
	) {
		return errorResponse("E_PARSE_FAILED", "요청 본문은 객체여야 합니다.");
	}

	const state = readState();
	const config = readConfig();

	if (message.action === "auth_store.start_login") {
		return handleStartLogin(message, state, config);
	}
	if (message.action === "auth_store.complete_login") {
		return handleCompleteLogin(message, state, config);
	}
	if (message.action === "auth_store.complete_login_auto") {
		return handleCompleteLoginAuto(state, config);
	}
	if (message.action === "auth_store.auth_status") {
		return handleAuthStatus(state);
	}
	if (message.action === "auth_store.logout") {
		return handleLogout(state);
	}
	if (message.action === "graph_mail_sync.initial_sync") {
		return initialSync(state, config, message);
	}
	if (message.action === "graph_mail_sync.delta_sync") {
		return deltaSync(state, config, message);
	}
	if (message.action === "graph_mail_sync.download_attachment") {
		return downloadAttachment(state, config, message);
	}
	if (message.action === "mail_store.get_message") {
		return getMessage(state, config, message);
	}
	if (message.action === "mail_store.get_thread") {
		return getThread(state, config, message);
	}
	if (message.action === "mail_store.list_messages") {
		return listMessages(state, config, message);
	}
	if (message.action === "mail_store.list_threads") {
		return listThreads(state, config, message);
	}
	if (message.action === "mail_store.list_attachments") {
		return listAttachments(state, config, message);
	}
	if (message.action === "system.health") {
		return getSystemHealth(state);
	}
	if (message.action === "system.reset_session") {
		return resetSession(state, message);
	}
	if (message.action === "workflow.create_evidence") {
		return createWorkflowEvidence(state, message);
	}
	if (message.action === "workflow.upsert_todo") {
		return upsertWorkflowTodo(state, message);
	}
	if (message.action === "workflow.list") {
		return listWorkflow(state);
	}
	if (message.action === "dashboard.get_overview") {
		return handleDashboardGetOverview(state, message);
	}
	if (message.action === "search.query") {
		return handleSearchQuery(state, message);
	}
	if (message.action === "timeline.list") {
		return handleTimelineList(state, message);
	}
	if (message.action === "autopilot.set_mode") {
		return setAutopilotMode(state, message);
	}
	if (message.action === "autopilot.pause") {
		return pauseAutopilot(state);
	}
	if (message.action === "autopilot.resume") {
		return resumeAutopilot(state);
	}
	if (message.action === "autopilot.status") {
		return getAutopilotStatus(state);
	}
	if (message.action === "autopilot.tick") {
		return runAutopilotTick(state, config, message);
	}

	return errorResponse("E_UNKNOWN", "unsupported action");
};

const sendMessage = (message) => {
	const payload = Buffer.from(JSON.stringify(message), "utf8");
	const header = Buffer.alloc(4);
	header.writeUInt32LE(payload.length, 0);
	process.stdout.write(Buffer.concat([header, payload]));
};

let inputBuffer = Buffer.alloc(0);
let messageQueue = Promise.resolve();

const consumeMessages = async () => {
	while (inputBuffer.length >= 4) {
		const messageLength = inputBuffer.readUInt32LE(0);
		if (inputBuffer.length < 4 + messageLength) {
			return;
		}

		const body = inputBuffer.subarray(4, 4 + messageLength);
		inputBuffer = inputBuffer.subarray(4 + messageLength);

		let message;
		try {
			message = JSON.parse(body.toString("utf8"));
		} catch {
			sendMessage(
				errorResponse(
					"E_PARSE_FAILED",
					"요청 본문은 유효한 JSON이어야 합니다.",
				),
			);
			continue;
		}

		try {
			const response = await handleMessage(message);
			sendMessage(response);
		} catch {
			sendMessage(
				errorResponse("E_UNKNOWN", "native host internal error", true),
			);
		}
	}
};

const startHostRuntime = () => {
	process.stdin.on("data", (chunk) => {
		inputBuffer = Buffer.concat([inputBuffer, chunk]);
		messageQueue = messageQueue.then(consumeMessages).catch(() => {
			sendMessage(errorResponse("E_UNKNOWN", "native host queue error", true));
		});
	});
};

const isMainModule = () => {
	if (!isNonEmptyString(process.argv[1])) {
		return false;
	}
	return process.argv[1] === fileURLToPath(import.meta.url);
};

if (isMainModule()) {
	startHostRuntime();
}

export const __hostTestables = Object.freeze({
	buildCodexExecRuntimeContract,
	analyzeAutopilotCandidate,
	buildCodexCliSpawnArgs,
	runCodexCliAdapter,
	redactSensitiveText,
	buildCodexAnalyzeInputPayload,
	getSystemHealth,
	getAutopilotStatus,
	sanitizeAutopilotForStatus,
	sanitizeCodexExecContractForStatus,
});
