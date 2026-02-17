#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const statePath = new URL("./state.json", import.meta.url);
const configPath = new URL("./config.json", import.meta.url);

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

const generateLoginState = () => toBase64Url(randomBytes(16));
const generateCodeVerifier = () => toBase64Url(randomBytes(32));
const generateCodeChallenge = (codeVerifier) =>
	toBase64Url(createHash("sha256").update(codeVerifier).digest());

const defaultState = () => ({
	signed_in: false,
	account: null,
	issued_session: null,
	auth_token: null,
});

const defaultConfig = () => ({
	tenant: "common",
	client_id: "",
	redirect_uri: "http://127.0.0.1:1270/mcp/callback",
});

const normalizeState = (value) => {
	if (value === null || typeof value !== "object") {
		return defaultState();
	}

	const state = value;
	return {
		signed_in: Boolean(state.signed_in),
		account:
			state.account && typeof state.account.email === "string"
				? {
						email: state.account.email,
						tenant:
							typeof state.account.tenant === "string"
								? state.account.tenant
								: "default",
					}
				: null,
		issued_session:
			state.issued_session && typeof state.issued_session === "object"
				? state.issued_session
				: null,
		auth_token:
			state.auth_token && typeof state.auth_token === "object"
				? state.auth_token
				: null,
	};
};

const normalizeConfig = (value) => {
	if (value === null || typeof value !== "object") {
		return defaultConfig();
	}

	const config = value;
	return {
		tenant: isNonEmptyString(config.tenant) ? config.tenant.trim() : "common",
		client_id: isNonEmptyString(config.client_id)
			? config.client_id.trim()
			: "",
		redirect_uri: isNonEmptyString(config.redirect_uri)
			? config.redirect_uri.trim()
			: "http://127.0.0.1:1270/mcp/callback",
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

const errorResponse = (errorCode, errorMessage, retryable = false) => ({
	ok: false,
	error_code: errorCode,
	error_message: errorMessage,
	retryable: retryable,
});

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

const buildAuthTokenFromResponse = (tokenResponse) => {
	const issuedAt = nowIso();
	const expiresIn =
		typeof tokenResponse.expires_in === "number" && tokenResponse.expires_in > 0
			? tokenResponse.expires_in
			: 3600;
	const refreshExpiresIn =
		typeof tokenResponse.refresh_token_expires_in === "number" &&
		tokenResponse.refresh_token_expires_in > 0
			? tokenResponse.refresh_token_expires_in
			: 30 * 24 * 60 * 60;

	return {
		access_token: tokenResponse.access_token,
		refresh_token:
			typeof tokenResponse.refresh_token === "string"
				? tokenResponse.refresh_token
				: "",
		token_type:
			typeof tokenResponse.token_type === "string"
				? tokenResponse.token_type
				: "Bearer",
		expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
		refresh_token_expires_at: new Date(
			Date.now() + refreshExpiresIn * 1000,
		).toISOString(),
		issued_at: issuedAt,
	};
};

const parseJwtClaims = (idToken) => {
	if (!isNonEmptyString(idToken)) {
		return null;
	}

	const chunks = idToken.split(".");
	if (chunks.length < 2) {
		return null;
	}

	try {
		const payload = Buffer.from(chunks[1], "base64url").toString("utf8");
		const parsed = JSON.parse(payload);
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
};

const extractAccount = (tokenResponse, config) => {
	const claims = parseJwtClaims(tokenResponse.id_token);
	if (claims) {
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

	return {
		email: "user@localhost",
		tenant: config.tenant,
	};
};

const exchangeAuthorizationCode = async (
	config,
	code,
	codeVerifier,
	scopes,
) => {
	const endpoint = `https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/token`;
	const params = new URLSearchParams();
	params.set("grant_type", "authorization_code");
	params.set("client_id", config.client_id);
	params.set("code", code);
	params.set("redirect_uri", config.redirect_uri);
	params.set("code_verifier", codeVerifier);
	if (isArrayOfNonEmptyStrings(scopes) && scopes.length > 0) {
		params.set("scope", scopes.join(" "));
	}

	let response;
	try {
		response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: params.toString(),
		});
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

	let payload = null;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}

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

	return {
		ok: true,
		tokenResponse: payload,
	};
};

const handleStartLogin = (message, state) => {
	if (
		!isArrayOfNonEmptyStrings(message.scopes) ||
		message.scopes.length === 0
	) {
		return errorResponse(
			"E_PARSE_FAILED",
			"scopes 는 비어있지 않은 문자열 목록이어야 합니다.",
		);
	}

	const config = readConfig();
	const configError = validateAuthConfig(config);
	if (configError !== null) {
		return configError;
	}

	const loginState = generateLoginState();
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = generateCodeChallenge(codeVerifier);

	state.issued_session = {
		account: {
			email: "",
			tenant: "",
		},
		scopes: message.scopes,
		state: loginState,
		code_verifier: codeVerifier,
		code_challenge: codeChallenge,
		issued_at: nowIso(),
		redirect_uri: config.redirect_uri,
		client_id: config.client_id,
		tenant: config.tenant,
	};
	writeState(state);

	return {
		ok: true,
		data: {
			login_url: `https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/authorize?response_type=code&client_id=${encodeURIComponent(
				config.client_id,
			)}&scope=${encodeURIComponent(message.scopes.join(" "))}&state=${encodeURIComponent(loginState)}&redirect_uri=${encodeURIComponent(
				config.redirect_uri,
			)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`,
			callback_url: config.redirect_uri,
			state: loginState,
			code_verifier: codeVerifier,
		},
	};
};

const handleCompleteLogin = async (message, state) => {
	if (!isNonEmptyString(message.code) || !isNonEmptyString(message.state)) {
		return errorResponse("E_PARSE_FAILED", "code/state 가 누락되었습니다.");
	}

	if (!isNonEmptyString(message.code_verifier)) {
		return errorResponse("E_PARSE_FAILED", "code_verifier 가 누락되었습니다.");
	}

	if (state.issued_session === null) {
		return errorResponse("E_AUTH_REQUIRED", "로그인 시작 정보가 없습니다.");
	}

	if (message.code_verifier !== state.issued_session.code_verifier) {
		return errorResponse(
			"E_AUTH_FAILED",
			"code_verifier 값이 일치하지 않습니다.",
		);
	}

	if (message.state !== state.issued_session.state) {
		return errorResponse("E_AUTH_FAILED", "state 값이 일치하지 않습니다.");
	}

	const config = readConfig();
	const configError = validateAuthConfig(config);
	if (configError !== null) {
		return configError;
	}

	const tokenResult = await exchangeAuthorizationCode(
		config,
		message.code,
		message.code_verifier,
		state.issued_session.scopes,
	);
	if (!tokenResult.ok) {
		return tokenResult.error;
	}

	const account = extractAccount(tokenResult.tokenResponse, config);
	state.account = account;
	state.signed_in = true;
	state.auth_token = buildAuthTokenFromResponse(tokenResult.tokenResponse);
	writeState(state);

	return {
		ok: true,
		data: {
			account,
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

	if (message.action === "auth_store.start_login") {
		return handleStartLogin(message, state);
	}

	if (message.action === "auth_store.complete_login") {
		return handleCompleteLogin(message, state);
	}

	if (message.action === "auth_store.auth_status") {
		return handleAuthStatus(state);
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
