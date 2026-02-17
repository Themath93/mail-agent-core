#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const statePath = new URL("./state.json", import.meta.url);
const fallbackUrl = "http://127.0.0.1:1270/mcp/callback";

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

const buildAuthToken = (issuedSession) => {
	const issuedAt = nowIso();
	const accessExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
	const refreshExpiresAt = new Date(
		Date.now() + 30 * 24 * 60 * 60 * 1000,
	).toISOString();

	return {
		access_token: `access_${issuedSession.state}`,
		refresh_token: `refresh_${issuedSession.state}`,
		token_type: "Bearer",
		expires_at: accessExpiresAt,
		refresh_token_expires_at: refreshExpiresAt,
		issued_at: issuedAt,
	};
};

const errorResponse = (errorCode, errorMessage, retryable = false) => ({
	ok: false,
	error_code: errorCode,
	error_message: errorMessage,
	retryable: retryable,
});

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
	};
	writeState(state);

	return {
		ok: true,
		data: {
			login_url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?response_type=code&scope=${encodeURIComponent(
				message.scopes.join(" "),
			)}&state=${encodeURIComponent(loginState)}&redirect_uri=${encodeURIComponent(
				fallbackUrl,
			)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`,
			callback_url: fallbackUrl,
			state: loginState,
			code_verifier: codeVerifier,
		},
	};
};

const handleCompleteLogin = (message, state) => {
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

	const account = {
		email: "user@localhost",
		tenant: "default",
	};

	state.account = account;
	state.signed_in = true;
	state.auth_token = buildAuthToken(state.issued_session);
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

const readMessage = () => {
	const header = process.stdin.read(4);
	if (!header) {
		return null;
	}

	const length = header.readUInt32LE(0);
	const body = process.stdin.read(length);
	if (!body) {
		return null;
	}

	try {
		return JSON.parse(body.toString("utf8"));
	} catch {
		return null;
	}
};

const sendMessage = (message) => {
	const payload = Buffer.from(JSON.stringify(message), "utf8");
	const header = Buffer.alloc(4);
	header.writeUInt32LE(payload.length, 0);
	process.stdout.write(Buffer.concat([header, payload]));
};

process.stdin.on("readable", () => {
	while (true) {
		const message = readMessage();
		if (!message) {
			break;
		}

		const state = readState();

		if (message.action === "auth_store.start_login") {
			sendMessage(handleStartLogin(message, state));
			continue;
		}

		if (message.action === "auth_store.complete_login") {
			sendMessage(handleCompleteLogin(message, state));
			continue;
		}

		if (message.action === "auth_store.auth_status") {
			sendMessage(handleAuthStatus(state));
			continue;
		}

		sendMessage(errorResponse("E_UNKNOWN", "unsupported action"));
	}
});
