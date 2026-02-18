#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
		},
	},
	logs: [],
});

const defaultConfig = () => ({
	tenant: "common",
	client_id: "",
	redirect_uri: "http://127.0.0.1:1270/mcp/callback",
	callback_poll_ms: 1000,
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
	const base = defaultConfig();
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
	logs.push({ at: nowIso(), level, event, message });
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
const AUTOPILOT_MAX_MESSAGES_PER_TICK = 30;
const AUTOPILOT_MAX_ATTACHMENTS_PER_TICK = 10;
const AUTOPILOT_DEFAULT_FOLDER = "inbox";
const AUTOPILOT_DEFAULT_DAYS_BACK = 1;
const AUTOPILOT_REVIEW_MIN_CONFIDENCE = 0.75;
const AUTOPILOT_AUTO_MIN_CONFIDENCE = 0.92;

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
	autopilot.consecutive_failures += 1;
	incrementAutopilotMetric(state, "ticks_failed", 1);
	autopilot.in_flight_run_id = null;
	if (autopilot.consecutive_failures >= AUTOPILOT_MAX_CONSECUTIVE_FAILURES) {
		autopilot.status = "degraded";
		autopilot.paused = true;
		pushLog(state, "warn", "autopilot_degraded", message);
		return;
	}
	autopilot.status = autopilot.paused ? "paused" : "idle";
};

const normalizeSnippet = (value) =>
	typeof value === "string"
		? value.replace(/\s+/g, " ").trim().slice(0, 240)
		: "";

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
	const recent = logs.slice(-20);
	const autopilot = getAutopilotState(state);
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
				mode: autopilot.mode,
				status: autopilot.status,
				paused: autopilot.paused,
				in_flight_run_id: autopilot.in_flight_run_id,
				last_error: autopilot.last_error,
				consecutive_failures: autopilot.consecutive_failures,
				last_tick_at: autopilot.last_tick_at,
				metrics: autopilot.metrics,
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

	const evidenceId = isNonEmptyString(input.evidence_id)
		? input.evidence_id.trim()
		: `ev_${evidenceKey.slice(4, 16)}`;
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
	const todoId = isNonEmptyString(input.todo_id)
		? input.todo_id
		: `todo_${todoKey.slice(4, 16)}`;
	const now = nowIso();
	const idx = state.workflow.todos.findIndex(
		(item) => item.todo_id === todoId || item.todo_key === todoKey,
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

const pickAutoSnippet = (message) => {
	const candidate = isNonEmptyString(message.body_text)
		? message.body_text
		: isNonEmptyString(message.subject)
			? message.subject
			: "메일 본문 요약";
	return normalizeSnippet(candidate);
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
	return {
		ok: true,
		data: {
			mode: autopilot.mode,
			status: autopilot.status,
			paused: autopilot.paused,
			in_flight_run_id: autopilot.in_flight_run_id,
			last_error: autopilot.last_error,
			consecutive_failures: autopilot.consecutive_failures,
			last_tick_at: autopilot.last_tick_at,
			metrics: autopilot.metrics,
		},
	};
};

const runAutopilotTick = async (state, config, input) => {
	const autopilot = getAutopilotState(state);
	if (autopilot.mode === "manual") {
		return errorResponse(
			"E_POLICY_DENIED",
			"manual 모드입니다. autopilot.set_mode 후 실행하세요.",
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

	const messages = listRecentMessagesForAutopilot(state, maxMessages);
	const candidates = messages.filter(
		(message) =>
			isNonEmptyString(message.message_pk) &&
			!hasEvidenceForMessage(state, message.message_pk),
	);

	if (autopilot.mode === "review_first") {
		incrementAutopilotMetric(state, "review_candidates", candidates.length);
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
				review_candidates: candidates.map((message) => ({
					message_pk: message.message_pk,
					subject: message.subject,
					from: message.from,
					received_at: message.received_at,
				})),
			},
		};
	}

	autopilot.status = "persisting";
	let evidenceCreated = 0;
	let todoCreated = 0;
	let attachmentSaved = 0;
	let reviewCandidates = 0;
	let attachmentBudgetLeft = maxAttachments;

	for (const message of candidates) {
		if (!isNonEmptyString(message.message_pk)) {
			continue;
		}
		const snippet = pickAutoSnippet(message);
		if (!isNonEmptyString(snippet)) {
			reviewCandidates += 1;
			continue;
		}
		const confidence = AUTOPILOT_AUTO_MIN_CONFIDENCE;
		if (confidence < AUTOPILOT_REVIEW_MIN_CONFIDENCE) {
			reviewCandidates += 1;
			continue;
		}

		const evidenceKey = buildEvidenceKey(message.message_pk, snippet);
		const evidenceResponse = createWorkflowEvidence(state, {
			message_pk: message.message_pk,
			snippet,
			confidence,
			idempotency_key: evidenceKey,
		});
		if (!evidenceResponse.ok) {
			reviewCandidates += 1;
			continue;
		}
		if (evidenceResponse.data.created === true) {
			evidenceCreated += 1;
		}

		const evidence = evidenceResponse.data.evidence;
		const title = buildAutoTodoTitle(message);
		const todoKey = buildTodoKey(
			title,
			evidence.evidence_key ?? evidence.evidence_id,
		);
		const todoResponse = upsertWorkflowTodo(state, {
			title,
			status: "open",
			evidence_id: evidence.evidence_id,
			evidence_key: evidence.evidence_key,
			idempotency_key: todoKey,
		});
		if (todoResponse.ok && todoResponse.data.created === true) {
			todoCreated += 1;
		}

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
	autopilot.consecutive_failures = 0;
	autopilot.last_error = null;
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
			auto_attachment_saved: attachmentSaved,
			review_candidates: reviewCandidates,
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

process.stdin.on("data", (chunk) => {
	inputBuffer = Buffer.concat([inputBuffer, chunk]);
	messageQueue = messageQueue.then(consumeMessages).catch(() => {
		sendMessage(errorResponse("E_UNKNOWN", "native host queue error", true));
	});
});
