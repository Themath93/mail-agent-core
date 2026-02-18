import path from "node:path";

import { expect, test } from "@playwright/test";

test("sidepanel codex oauth controls support start/auto/manual/status/logout", async ({
	page,
}) => {
	await page.addInitScript(() => {
		type ProviderName = "graph" | "codex";
		type NativeRequest = {
			action: string;
			provider?: string;
			state?: string;
			code_verifier?: string;
		};
		type Account = {
			email: string;
			tenant: string;
		};
		type ProviderState = {
			signedIn: boolean;
			pendingCallbackReceived: boolean;
			account: Account | null;
			issuedSession: { state: string; codeVerifier: string } | null;
		};

		const providers: Record<ProviderName, ProviderState> = {
			graph: {
				signedIn: false,
				pendingCallbackReceived: false,
				account: null,
				issuedSession: null,
			},
			codex: {
				signedIn: false,
				pendingCallbackReceived: false,
				account: null,
				issuedSession: null,
			},
		};

		const stateStore = new Map<string, unknown>();
		const messageLog: NativeRequest[] = [];

		const resolveProvider = (payload: NativeRequest): ProviderName =>
			typeof payload?.provider === "string" && payload.provider === "codex"
				? "codex"
				: "graph";

		const toResponse = (providerState: ProviderState) => ({
			signed_in: providerState.signedIn,
			account: providerState.account,
			pending_callback_received: providerState.pendingCallbackReceived,
		});

		const buildAuthUrl = (
			provider: ProviderName,
			state: string,
			codeVerifier: string,
		) => {
			const redirect = "http://localhost:18080/callback";
			const scopes =
				provider === "codex"
					? "openid profile offline_access"
					: "Mail.Read User.Read";
			return `https://auth.example/${provider}/authorize?response_type=code&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(scopes)}&code_challenge=${encodeURIComponent(codeVerifier)}`;
		};

		const handleAuth = (payload: NativeRequest) => {
			const provider = resolveProvider(payload);
			const providerState = providers[provider];

			switch (payload.action) {
				case "auth_store.auth_status":
					return { ok: true, data: toResponse(providerState) };
				case "auth_store.start_login": {
					const state = `${provider}-state`;
					const codeVerifier = `${provider}-verifier`;
					providerState.issuedSession = { state, codeVerifier };
					providerState.pendingCallbackReceived = true;
					return {
						ok: true,
						data: {
							state,
							code_verifier: codeVerifier,
							callback_url: "http://localhost:18080/callback",
							login_url: buildAuthUrl(provider, state, codeVerifier),
						},
					};
				}
				case "auth_store.complete_login_auto":
					if (
						!providerState.pendingCallbackReceived ||
						!providerState.issuedSession
					) {
						return {
							ok: false,
							error_code: "E_NOT_FOUND",
							error_message: "callback not ready",
							retryable: true,
						};
					}
					providerState.pendingCallbackReceived = false;
					providerState.signedIn = true;
					providerState.account = {
						email: `${provider}@example.com`,
						tenant: "tenant",
					};
					return {
						ok: true,
						data: {
							account: providerState.account,
						},
					};
				case "auth_store.complete_login": {
					if (!providerState.issuedSession) {
						return {
							ok: false,
							error_code: "E_AUTH_REQUIRED",
							error_message: "missing session",
						};
					}
					if (payload.state !== providerState.issuedSession.state) {
						return {
							ok: false,
							error_code: "E_AUTH_FAILED",
							error_message: "state mismatch",
						};
					}
					if (
						payload.code_verifier !== providerState.issuedSession.codeVerifier
					) {
						return {
							ok: false,
							error_code: "E_AUTH_FAILED",
							error_message: "code verifier mismatch",
						};
					}
					providerState.pendingCallbackReceived = false;
					providerState.signedIn = true;
					providerState.account = {
						email: `${provider}@example.com`,
						tenant: "tenant",
					};
					return {
						ok: true,
						data: { account: providerState.account },
					};
				}
				case "auth_store.logout":
					providerState.signedIn = false;
					providerState.pendingCallbackReceived = false;
					providerState.account = null;
					providerState.issuedSession = null;
					return {
						ok: true,
						data: {
							signed_out: true,
						},
					};
				default:
					return null;
			}
		};

		const handleAction = (payload: NativeRequest) => {
			const auth = handleAuth(payload);
			if (auth) {
				return auth;
			}
			if (payload.action === "autopilot.status") {
				return {
					ok: true,
					data: { mode: "manual", status: "idle", paused: false },
				};
			}
			if (payload.action === "dashboard.get_overview") {
				return {
					ok: true,
					data: {
						kpis: {
							today_mail_count: 0,
							today_todo_count: 0,
							progress_status: {
								open_count: 0,
								in_progress_count: 0,
								done_count: 0,
							},
						},
					},
				};
			}
			if (payload.action === "timeline.list") {
				return { ok: true, data: { events: [] } };
			}
			return {
				ok: true,
				data: {},
			};
		};

		const globalRef = globalThis as typeof globalThis & {
			chrome: {
				runtime: {
					lastError: null;
					sendNativeMessage: (
						host: string,
						payload: NativeRequest,
						callback: (response: unknown) => void,
					) => void;
				};
				storage: {
					local: {
						set: (payload: Record<string, unknown>) => void;
						get: (
							keys: string[],
							callback: (value: Record<string, unknown>) => void,
						) => void;
						remove: (keys: string[]) => void;
					};
				};
			};
			open?: (...args: unknown[]) => unknown;
			__nativeMessageLog?: NativeRequest[];
		};

		globalRef.open = () => null;

		globalRef.chrome = {
			runtime: {
				lastError: null,
				sendNativeMessage: (_host, payload, callback) => {
					messageLog.push({ ...payload });
					setTimeout(() => {
						callback(handleAction(payload));
					}, 0);
				},
			},
			storage: {
				local: {
					set: (payload) => {
						for (const [key, value] of Object.entries(payload)) {
							stateStore.set(key, value);
						}
					},
					get: (keys, callback) => {
						const output: Record<string, unknown> = {};
						for (const key of keys) {
							output[key] = stateStore.get(key);
						}
						setTimeout(() => callback(output), 0);
					},
					remove: (keys) => {
						for (const key of keys) {
							stateStore.delete(key);
						}
					},
				},
			},
		};

		globalRef.__nativeMessageLog = messageLog;
	});

	const sidepanelPath = path.resolve("extension/sidepanel.html");
	await page.goto(`file://${sidepanelPath}`);

	await expect(page.locator("#codex-auth-status")).toContainText(
		"signed_in=false",
	);

	await page.click("#codex-start-login");
	await expect(page.locator("#codex-login-url")).toContainText(
		"https://auth.example/codex/authorize",
	);
	await page.click("#codex-complete-login-auto");
	await expect(page.locator("#codex-auth-status")).toContainText(
		"signed_in=true",
	);
	await expect(page.locator("#codex-auth-status")).not.toContainText("token");

	await page.click("#codex-logout");
	await expect(page.locator("#codex-auth-status")).toContainText(
		"signed_in=false",
	);

	await page.click("#codex-start-login");
	await expect(page.locator("#codex-login-url")).toContainText(
		"https://auth.example/codex/authorize",
	);
	const loginUrlText = await page.locator("#codex-login-url").textContent();
	const loginUrl = new URL((loginUrlText ?? "").replace("Login URL: ", ""));
	const state = loginUrl.searchParams.get("state");
	expect(state).toBeTruthy();

	await page.fill(
		"#codex-auth-code",
		`http://localhost:18080/callback?code=manual-code&state=${state}`,
	);
	await page.click("#codex-complete-login");
	await expect(page.locator("#codex-auth-status")).toContainText(
		"signed_in=true",
	);

	const messageLog = (await page.evaluate(
		() =>
			(
				globalThis as typeof globalThis & {
					__nativeMessageLog?: Array<{
						action: string;
						provider?: string;
					}>;
				}
			).__nativeMessageLog,
	)) as Array<{
		action: string;
		provider?: string;
	}>;
	expect(
		messageLog.some(
			(entry) =>
				entry.action === "auth_store.start_login" && entry.provider === "codex",
		),
	).toBe(true);
});

test("sidepanel codex oauth reliability matrix covers deterministic callback failures", async ({
	page,
}) => {
	await page.addInitScript(() => {
		type ProviderState = {
			signedIn: boolean;
			issuedSession: { state: string; codeVerifier: string } | null;
		};
		type NativeRequest = {
			action: string;
			provider?: string;
			code?: string;
			state?: string;
			code_verifier?: string;
		};

		const providerState: ProviderState = {
			signedIn: false,
			issuedSession: null,
		};
		const storage = new Map<string, unknown>();

		const globalRef = globalThis as typeof globalThis & {
			chrome: {
				runtime: {
					lastError: null;
					sendNativeMessage: (
						host: string,
						payload: NativeRequest,
						callback: (response: unknown) => void,
					) => void;
				};
				storage: {
					local: {
						set: (payload: Record<string, unknown>) => void;
						get: (
							keys: string[],
							callback: (value: Record<string, unknown>) => void,
						) => void;
						remove: (keys: string[]) => void;
					};
				};
			};
			open?: (...args: unknown[]) => unknown;
		};

		globalRef.open = () => null;

		globalRef.chrome = {
			runtime: {
				lastError: null,
				sendNativeMessage: (_host, payload, callback) => {
					const isCodex = payload.provider === "codex";
					if (!isCodex) {
						setTimeout(() => callback({ ok: true, data: {} }), 0);
						return;
					}

					if (payload.action === "auth_store.start_login") {
						providerState.issuedSession = {
							state: "codex-state",
							codeVerifier: "codex-verifier",
						};
						setTimeout(
							() =>
								callback({
									ok: true,
									data: {
										state: providerState.issuedSession?.state,
										code_verifier: providerState.issuedSession?.codeVerifier,
										callback_url: "http://localhost:18080/callback",
										login_url:
											"https://auth.example/codex/authorize?state=codex-state",
									},
								}),
							0,
						);
						return;
					}

					if (payload.action === "auth_store.complete_login_auto") {
						setTimeout(
							() =>
								callback({
									ok: false,
									error_code: "E_AUTH_FAILED",
									error_message: "auto callback timeout",
									retryable: false,
								}),
							0,
						);
						return;
					}

					if (payload.action === "auth_store.complete_login") {
						if (!providerState.issuedSession) {
							setTimeout(
								() =>
									callback({
										ok: false,
										error_code: "E_AUTH_REQUIRED",
										error_message: "missing session",
									}),
								0,
							);
							return;
						}
						if (payload.code === "denied-code") {
							setTimeout(
								() =>
									callback({
										ok: false,
										error_code: "E_AUTH_FAILED",
										error_message: "access_denied",
									}),
								0,
							);
							return;
						}
						if (payload.state !== providerState.issuedSession.state) {
							setTimeout(
								() =>
									callback({
										ok: false,
										error_code: "E_AUTH_FAILED",
										error_message: "state mismatch",
									}),
								0,
							);
							return;
						}
						if (
							payload.code_verifier !== providerState.issuedSession.codeVerifier
						) {
							setTimeout(
								() =>
									callback({
										ok: false,
										error_code: "E_AUTH_FAILED",
										error_message: "code verifier mismatch",
									}),
								0,
							);
							return;
						}
						providerState.signedIn = true;
						setTimeout(
							() =>
								callback({
									ok: true,
									data: {
										account: { email: "codex@example.com", tenant: "t" },
									},
								}),
							0,
						);
						return;
					}

					if (payload.action === "auth_store.logout") {
						providerState.signedIn = false;
						providerState.issuedSession = null;
						setTimeout(
							() => callback({ ok: true, data: { signed_out: true } }),
							0,
						);
						return;
					}

					if (payload.action === "auth_store.auth_status") {
						setTimeout(
							() =>
								callback({
									ok: true,
									data: {
										signed_in: providerState.signedIn,
										account: providerState.signedIn
											? { email: "codex@example.com", tenant: "t" }
											: null,
										pending_callback_received: false,
									},
								}),
							0,
						);
						return;
					}

					setTimeout(() => callback({ ok: true, data: {} }), 0);
				},
			},
			storage: {
				local: {
					set: (payload) => {
						for (const [key, value] of Object.entries(payload)) {
							storage.set(key, value);
						}
					},
					get: (keys, callback) => {
						const output: Record<string, unknown> = {};
						for (const key of keys) {
							output[key] = storage.get(key);
						}
						setTimeout(() => callback(output), 0);
					},
					remove: (keys) => {
						for (const key of keys) {
							storage.delete(key);
						}
					},
				},
			},
		};
	});

	const sidepanelPath = path.resolve("extension/sidepanel.html");
	await page.goto(`file://${sidepanelPath}`);

	await page.click("#codex-start-login");
	await page.fill(
		"#codex-auth-code",
		"http://localhost:18080/callback?code=abc&state=invalid-state",
	);
	await page.click("#codex-complete-login");
	await expect(page.locator("#codex-auth-status")).toContainText(
		"state가 현재 로그인 세션과 다릅니다",
	);

	await page.fill(
		"#codex-auth-code",
		"http://localhost:18080/callback?error=access_denied&state=codex-state",
	);
	await page.click("#codex-complete-login");
	await expect(page.locator("#codex-auth-status")).toContainText(
		"code를 입력하세요",
	);

	await page.fill("#codex-auth-code", "denied-code");
	await page.click("#codex-complete-login");
	await expect(page.locator("#codex-auth-status")).toContainText(
		"access_denied",
	);

	await page.click("#codex-logout");
	await page.fill(
		"#codex-auth-code",
		"http://localhost:18080/callback?code=after-logout&state=codex-state",
	);
	await page.click("#codex-complete-login");
	await expect(page.locator("#codex-auth-status")).toContainText(
		"start_login을 먼저 실행하세요",
	);

	await page.click("#codex-start-login");
	await page.fill(
		"#codex-auth-code",
		"http://localhost:18080/callback?code=manual-ok&state=codex-state",
	);
	await page.click("#codex-complete-login");
	await expect(page.locator("#codex-auth-status")).toContainText(
		"signed_in=true",
	);
});
