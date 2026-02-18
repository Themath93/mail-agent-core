import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, test } from "vitest";

type CodexAdapterOutcome = {
	ok: boolean;
	exit_code: number;
	duration_ms: number;
	stdout: string;
	stderr: string;
	failure_kind:
		| "timeout_retriable"
		| "exit_non_zero"
		| "spawn_error"
		| "signal_terminated"
		| null;
};

type CodexAdapterArgs = {
	executable?: string;
	args?: string[];
	timeout_ms?: number;
	cwd?: string;
	env?: NodeJS.ProcessEnv;
};

type CodexAdapterDeps = {
	spawnFn?: (
		command: string,
		args: string[],
		options: Record<string, unknown>,
	) => unknown;
	nowFn?: () => number;
	setTimeoutFn?: typeof setTimeout;
	clearTimeoutFn?: typeof clearTimeout;
	killFn?: (pid: number, signal: NodeJS.Signals | number) => void;
	platform?: NodeJS.Platform;
};

type CodexExecRuntimeContract = {
	flags: {
		codex_exec_enabled: boolean;
		codex_exec_shadow_mode: boolean;
		codex_exec_fallback_to_synthetic_on_error: boolean;
		opencode_connected_api_key_env: string;
		env_fallback_api_key_env: string;
		env_fallback_only_ci_headless: boolean;
	};
};

type CodexOAuthBrokerStateContract = {
	status: "idle" | "pending" | "authorized" | "error";
	oauth_session_id: string | null;
	authorize_url: string | null;
	last_error: string | null;
	updated_at: string | null;
};

type NativeHostStateLike = {
	codex_auth?: {
		oauth_broker?: CodexOAuthBrokerStateContract;
	};
};

type AnalyzeCandidateResult = {
	proposal: {
		message_pk: string;
		subject: string;
		from: string;
		received_at: string;
		snippet: string;
		confidence: number;
		todo_title: string;
	} | null;
	review_reason:
		| "codex_schema_invalid"
		| "codex_retriable_exhausted"
		| "analysis_failed"
		| null;
	failure_class?: "retriable" | "terminal";
	failure_kind?: "timeout" | "schema_fail" | "analysis_fail";
	attempt_count: number;
	failure_message?: string;
	parse_error?: {
		code: string;
		message: string;
	};
};

type AnalyzeCandidateInput = {
	message_pk: string;
	internet_message_id: string;
	received_at: string;
	subject: string;
	from: string;
	body_text: string;
	has_attachments: boolean;
	__codex_output_raw?: unknown;
	__codex_retry_plan?: {
		kind?: string;
		fail_attempts?: number;
		message?: string;
	};
};

const hostModule = (await import(
	new URL("../native-host/host.mjs", import.meta.url).href
)) as {
	__hostTestables: {
		buildCodexExecRuntimeContract: (config: {
			codex_exec?: Partial<{
				enabled: boolean;
				shadow_mode: boolean;
				fallback_to_synthetic_on_error: boolean;
				opencode_api_key_env: string;
				env_api_key_env: string;
				env_fallback_only_ci_headless: boolean;
			}>;
		}) => CodexExecRuntimeContract;
		resolveCodexExecAuth: (
			config: {
				codex_exec?: Partial<{
					opencode_api_key_env: string;
					env_api_key_env: string;
				}>;
			},
			runtimeContract: CodexExecRuntimeContract,
			state?: NativeHostStateLike,
		) =>
			| {
					ok: true;
					enabled: boolean;
					source?: string;
					redacted?: string;
			  }
			| {
					ok: false;
					error: {
						ok: false;
						error_code: string;
						error_message: string;
						retryable: boolean;
					};
					logMessage: string;
			  };
		analyzeAutopilotCandidate: (
			message: AnalyzeCandidateInput,
			runtimeContract: CodexExecRuntimeContract,
			deps?: {
				runCodexCliAdapterFn?: (
					args: CodexAdapterArgs,
				) => Promise<CodexAdapterOutcome>;
			},
		) => Promise<AnalyzeCandidateResult>;
		runCodexCliAdapter: (
			args: CodexAdapterArgs,
			deps?: CodexAdapterDeps,
		) => Promise<CodexAdapterOutcome>;
		redactSensitiveText: (value: string) => string;
		buildCodexAnalyzeInputPayload: (payload: Record<string, unknown>) => {
			schema_version: string;
			candidate: Record<string, unknown>;
			metadata: Record<string, unknown>;
		};
		sanitizeCodexExecContractForStatus: (
			runtimeContract: CodexExecRuntimeContract,
		) => CodexExecRuntimeContract;
	};
};
const { __hostTestables } = hostModule;

const buildRuntimeContract = (enabled: boolean): CodexExecRuntimeContract =>
	__hostTestables.buildCodexExecRuntimeContract({
		codex_exec: {
			enabled,
		},
	});

type FakeChild = EventEmitter & {
	pid: number;
	stdout: PassThrough;
	stderr: PassThrough;
	kill: (signal?: NodeJS.Signals | number) => boolean;
};

const createFakeChild = (pid = 4242): FakeChild => {
	const child = new EventEmitter() as FakeChild;
	child.pid = pid;
	child.stdout = new PassThrough();
	child.stderr = new PassThrough();
	child.kill = () => true;
	return child;
};

describe("native host codex exec adapter", () => {
	test("args-array spawn으로 codex exec를 실행하고 구조화 결과를 반환한다", async () => {
		const spawnCalls: Array<{
			command: string;
			args: string[];
			options: Record<string, unknown>;
		}> = [];
		const child = createFakeChild();
		const spawnFn = (
			command: string,
			args: string[],
			options: Record<string, unknown>,
		) => {
			spawnCalls.push({ command, args, options });
			setTimeout(() => {
				child.stdout.write(
					Buffer.from('{"schema_version":"codex_proposal.v1"}'),
				);
				child.stderr.write("warning");
				child.emit("close", 0, null);
			}, 0);
			return child;
		};

		const result = await __hostTestables.runCodexCliAdapter(
			{
				args: ["--json", "--input", "hello; rm -rf /"],
				timeout_ms: 200,
			},
			{ spawnFn, platform: "darwin" },
		);

		expect(spawnCalls).toHaveLength(1);
		expect(spawnCalls[0]?.command).toBe("codex");
		expect(spawnCalls[0]?.args).toEqual([
			"exec",
			"--json",
			"--input",
			"hello; rm -rf /",
		]);
		expect(spawnCalls[0]?.options.shell).toBe(false);
		expect(result).toMatchObject({
			ok: true,
			exit_code: 0,
			failure_kind: null,
		});
		expect(result.duration_ms).toBeGreaterThanOrEqual(0);
		expect(result.stdout).toContain("schema_version");
		expect(result.stderr).toContain("warning");
	});

	test("non-zero exit는 schema/parse 실패와 분리된 failure_kind로 분류한다", async () => {
		const child = createFakeChild();
		const spawnFn = () => {
			setTimeout(() => {
				child.stderr.write("bad request");
				child.emit("close", 9, null);
			}, 0);
			return child;
		};

		const result = await __hostTestables.runCodexCliAdapter(
			{ args: ["--json"] },
			{ spawnFn, platform: "darwin" },
		);

		expect(result).toMatchObject({
			ok: false,
			exit_code: 9,
			failure_kind: "exit_non_zero",
		});
		expect(result.failure_kind).not.toBe("schema_fail");
		expect(result.failure_kind).not.toBe("parse_fail");
	});

	test("spawn 예외는 spawn_error로 분류하고 stderr에 원인을 남긴다", async () => {
		const result = await __hostTestables.runCodexCliAdapter(
			{ args: ["--json"] },
			{
				spawnFn: () => {
					throw new Error("spawn exploded");
				},
				platform: "darwin",
			},
		);

		expect(result.ok).toBe(false);
		expect(result.failure_kind).toBe("spawn_error");
		expect(result.stderr).toContain("spawn exploded");
	});

	test("signal 종료(close with signal)는 signal_terminated로 분류한다", async () => {
		const child = createFakeChild();
		const spawnFn = () => {
			setTimeout(() => {
				child.emit("close", null, "SIGTERM");
			}, 0);
			return child;
		};

		const result = await __hostTestables.runCodexCliAdapter(
			{ args: ["--json"] },
			{ spawnFn, platform: "darwin" },
		);

		expect(result.ok).toBe(false);
		expect(result.failure_kind).toBe("signal_terminated");
		expect(result.exit_code).toBe(-1);
	});

	test("timeout 시 kill ladder를 수행하고 retriable timeout으로 분류한다", async () => {
		const groupSignals: Array<{
			pid: number;
			signal: NodeJS.Signals | number;
		}> = [];
		const childSignals: Array<NodeJS.Signals | number | undefined> = [];
		const child = createFakeChild(9333);
		child.kill = (signal) => {
			childSignals.push(signal);
			if (signal === "SIGKILL") {
				child.emit("close", null, "SIGKILL");
			}
			return true;
		};
		const spawnFn = () => child;
		const killFn = (pid: number, signal: NodeJS.Signals | number) => {
			groupSignals.push({ pid, signal });
		};

		const result = await __hostTestables.runCodexCliAdapter(
			{ args: ["--json"], timeout_ms: 10 },
			{ spawnFn, killFn, platform: "darwin" },
		);

		expect(result).toMatchObject({
			ok: false,
			exit_code: 124,
			failure_kind: "timeout_retriable",
		});
		expect(childSignals).toEqual(
			expect.arrayContaining(["SIGTERM", "SIGKILL"]),
		);
		expect(groupSignals).toEqual(
			expect.arrayContaining([
				{ pid: -9333, signal: "SIGTERM" },
				{ pid: -9333, signal: "SIGKILL" },
			]),
		);
	});

	test("analysis stage는 codex_exec_enabled=false 일 때 기존 synthetic 경로를 유지한다", async () => {
		const adapterSpy = async () => {
			throw new Error("adapter should not be called");
		};
		const result = await __hostTestables.analyzeAutopilotCandidate(
			{
				message_pk: "msg_disabled_1",
				internet_message_id: "<disabled@test>",
				received_at: "2026-02-18T00:00:00.000Z",
				subject: "Disabled path",
				from: "sender@example.com",
				body_text: "기존 synthetic fallback 유지",
				has_attachments: false,
			},
			buildRuntimeContract(false),
			{ runCodexCliAdapterFn: adapterSpy },
		);

		expect(result.review_reason).toBeNull();
		expect(result.proposal).not.toBeNull();
		expect(result.attempt_count).toBe(1);
		expect(result.proposal?.todo_title).toContain("[AUTO]");
	});

	test("analysis stage는 codex_exec_enabled=true 일 때 adapter stdout을 strict schema로 파싱한다", async () => {
		const adapterCalls: CodexAdapterArgs[] = [];
		const adapter = async (
			args: CodexAdapterArgs,
		): Promise<CodexAdapterOutcome> => {
			adapterCalls.push(args);
			return {
				ok: true,
				exit_code: 0,
				duration_ms: 12,
				stdout: JSON.stringify({
					schema_version: "codex_proposal.v1",
					proposal: {
						snippet: "adapter proposal",
						confidence: 0.93,
						todo_title: "[AUTO] adapter",
					},
				}),
				stderr: "",
				failure_kind: null,
			};
		};

		const result = await __hostTestables.analyzeAutopilotCandidate(
			{
				message_pk: "msg_enabled_1",
				internet_message_id: "<enabled@test>",
				received_at: "2026-02-18T00:00:00.000Z",
				subject: "Enabled path",
				from: "sender@example.com",
				body_text: "adapter output should be parsed",
				has_attachments: false,
			},
			buildRuntimeContract(true),
			{ runCodexCliAdapterFn: adapter },
		);

		expect(adapterCalls.length).toBeGreaterThan(0);
		expect(result.review_reason).toBeNull();
		expect(result.proposal?.snippet).toBe("adapter proposal");
		expect(result.proposal?.confidence).toBe(0.93);
	});

	test("analysis stage는 enabled adapter 출력 schema 오류를 codex_schema_invalid로 fail-closed 처리한다", async () => {
		const adapter = async (): Promise<CodexAdapterOutcome> => ({
			ok: true,
			exit_code: 0,
			duration_ms: 8,
			stdout: "{ invalid-json",
			stderr: "",
			failure_kind: null,
		});

		const result = await __hostTestables.analyzeAutopilotCandidate(
			{
				message_pk: "msg_enabled_schema_fail",
				internet_message_id: "<schema@test>",
				received_at: "2026-02-18T00:00:00.000Z",
				subject: "schema fail",
				from: "sender@example.com",
				body_text: "schema fail closed",
				has_attachments: false,
			},
			buildRuntimeContract(true),
			{ runCodexCliAdapterFn: adapter },
		);

		expect(result.proposal).toBeNull();
		expect(result.review_reason).toBe("codex_schema_invalid");
		expect(result.failure_class).toBe("terminal");
		expect(result.failure_kind).toBe("schema_fail");
		expect(result.parse_error?.code).toBe("E_CODEX_OUTPUT_INVALID_JSON");
	});

	test("analysis stage는 enabled adapter의 schema_version 불일치를 codex_schema_invalid로 fail-closed 처리한다", async () => {
		const adapter = async (): Promise<CodexAdapterOutcome> => ({
			ok: true,
			exit_code: 0,
			duration_ms: 9,
			stdout: JSON.stringify({
				schema_version: "codex_proposal.v999",
				proposal: {
					snippet: "schema mismatch",
					confidence: 0.95,
					todo_title: "[AUTO] schema mismatch",
				},
			}),
			stderr: "",
			failure_kind: null,
		});

		const result = await __hostTestables.analyzeAutopilotCandidate(
			{
				message_pk: "msg_enabled_schema_version_fail",
				internet_message_id: "<schema-version@test>",
				received_at: "2026-02-18T00:00:00.000Z",
				subject: "schema version fail",
				from: "sender@example.com",
				body_text: "schema version fail closed",
				has_attachments: false,
			},
			buildRuntimeContract(true),
			{ runCodexCliAdapterFn: adapter },
		);

		expect(result.proposal).toBeNull();
		expect(result.review_reason).toBe("codex_schema_invalid");
		expect(result.failure_class).toBe("terminal");
		expect(result.failure_kind).toBe("schema_fail");
		expect(result.parse_error?.code).toBe("E_CODEX_OUTPUT_SCHEMA_VERSION");
	});

	test("analysis stage는 adapter failure_kind를 기존 retriable/terminal 라우팅 semantics로 매핑한다", async () => {
		const timeoutAdapter = async (): Promise<CodexAdapterOutcome> => ({
			ok: false,
			exit_code: 124,
			duration_ms: 1500,
			stdout: "",
			stderr: "adapter timeout",
			failure_kind: "timeout_retriable",
		});
		const terminalAdapter = async (): Promise<CodexAdapterOutcome> => ({
			ok: false,
			exit_code: 9,
			duration_ms: 11,
			stdout: "",
			stderr: "adapter terminal",
			failure_kind: "exit_non_zero",
		});

		const retriable = await __hostTestables.analyzeAutopilotCandidate(
			{
				message_pk: "msg_enabled_timeout",
				internet_message_id: "<timeout@test>",
				received_at: "2026-02-18T00:00:00.000Z",
				subject: "timeout",
				from: "sender@example.com",
				body_text: "retriable mapping",
				has_attachments: false,
			},
			buildRuntimeContract(true),
			{ runCodexCliAdapterFn: timeoutAdapter },
		);
		expect(retriable.review_reason).toBe("codex_retriable_exhausted");
		expect(retriable.failure_class).toBe("retriable");
		expect(retriable.failure_kind).toBe("timeout");
		expect(retriable.failure_message).toContain("attempts=3/3");

		const terminal = await __hostTestables.analyzeAutopilotCandidate(
			{
				message_pk: "msg_enabled_terminal",
				internet_message_id: "<terminal@test>",
				received_at: "2026-02-18T00:00:00.000Z",
				subject: "terminal",
				from: "sender@example.com",
				body_text: "terminal mapping",
				has_attachments: false,
			},
			buildRuntimeContract(true),
			{ runCodexCliAdapterFn: terminalAdapter },
		);
		expect(terminal.review_reason).toBe("analysis_failed");
		expect(terminal.failure_class).toBe("terminal");
		expect(terminal.failure_kind).toBe("analysis_fail");
		expect(terminal.failure_message).toContain("adapter terminal");
	});

	test("policy mapping: OAuth 세션 누락은 E_CODEX_AUTH_REQUIRED로 결정적으로 매핑된다", () => {
		const runtimeContract = __hostTestables.buildCodexExecRuntimeContract({
			codex_exec: {
				enabled: true,
				env_fallback_only_ci_headless: true,
			},
		});
		const result = __hostTestables.resolveCodexExecAuth(
			{},
			runtimeContract,
			{},
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.error_code).toBe("E_CODEX_AUTH_REQUIRED");
			expect(result.error.retryable).toBe(false);
		}
	});

	test("policy mapping: OAuth broker authorized 세션이면 codex exec auth가 성공한다", () => {
		const runtimeContract = __hostTestables.buildCodexExecRuntimeContract({
			codex_exec: {
				enabled: true,
			},
		});
		const result = __hostTestables.resolveCodexExecAuth({}, runtimeContract, {
			codex_auth: {
				oauth_broker: {
					status: "authorized",
					oauth_session_id: "sess_runtime_123",
					authorize_url: null,
					last_error: null,
					updated_at: "2026-02-18T00:00:00.000Z",
				},
			},
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.source).toBe("oauth_broker_session:authorized");
			expect(result.redacted).toBe("[REDACTED]");
		}
	});

	test("policy mapping: authorized 상태여도 oauth_session_id가 없으면 codex exec auth를 거부한다", () => {
		const runtimeContract = __hostTestables.buildCodexExecRuntimeContract({
			codex_exec: {
				enabled: true,
			},
		});
		const result = __hostTestables.resolveCodexExecAuth({}, runtimeContract, {
			codex_auth: {
				oauth_broker: {
					status: "authorized",
					oauth_session_id: null,
					authorize_url: null,
					last_error: null,
					updated_at: "2026-02-18T00:00:00.000Z",
				},
			},
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.error_code).toBe("E_CODEX_AUTH_REQUIRED");
			expect(result.error.retryable).toBe(false);
		}
	});

	test("policy mapping reliability matrix: oauth broker authorized + non-empty session은 happy path를 보장한다", () => {
		const runtimeContract = buildRuntimeContract(true);
		const result = __hostTestables.resolveCodexExecAuth({}, runtimeContract, {
			codex_auth: {
				oauth_broker: {
					status: "authorized",
					oauth_session_id: "sess_matrix_happy",
					authorize_url: null,
					last_error: null,
					updated_at: "2026-02-18T00:00:00.000Z",
				},
			},
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.source).toBe("oauth_broker_session:authorized");
			expect(result.redacted).toBe("[REDACTED]");
		}
	});

	test.each([
		{
			name: "missing state",
			state: undefined,
			expectedCode: "E_CODEX_AUTH_REQUIRED",
		},
		{
			name: "oauth_broker object missing",
			state: {
				codex_auth: {},
			},
			expectedCode: "E_CODEX_AUTH_REQUIRED",
		},
		{
			name: "idle status even with session",
			state: {
				codex_auth: {
					oauth_broker: {
						status: "idle",
						oauth_session_id: "sess_idle",
						authorize_url: null,
						last_error: null,
						updated_at: "2026-02-18T00:00:00.000Z",
					},
				},
			},
			expectedCode: "E_CODEX_AUTH_REQUIRED",
		},
		{
			name: "pending status",
			state: {
				codex_auth: {
					oauth_broker: {
						status: "pending",
						oauth_session_id: "sess_pending",
						authorize_url: "https://auth.example/codex",
						last_error: null,
						updated_at: "2026-02-18T00:00:00.000Z",
					},
				},
			},
			expectedCode: "E_CODEX_AUTH_REQUIRED",
		},
		{
			name: "error status after consent denied",
			state: {
				codex_auth: {
					oauth_broker: {
						status: "error",
						oauth_session_id: "sess_error",
						authorize_url: null,
						last_error: "access_denied",
						updated_at: "2026-02-18T00:00:00.000Z",
					},
				},
			},
			expectedCode: "E_CODEX_AUTH_REQUIRED",
		},
		{
			name: "authorized status with null session (stale)",
			state: {
				codex_auth: {
					oauth_broker: {
						status: "authorized",
						oauth_session_id: null,
						authorize_url: null,
						last_error: null,
						updated_at: "2026-02-18T00:00:00.000Z",
					},
				},
			},
			expectedCode: "E_CODEX_AUTH_REQUIRED",
		},
		{
			name: "authorized status with blank session",
			state: {
				codex_auth: {
					oauth_broker: {
						status: "authorized",
						oauth_session_id: "   ",
						authorize_url: null,
						last_error: null,
						updated_at: "2026-02-18T00:00:00.000Z",
					},
				},
			},
			expectedCode: "E_CODEX_AUTH_REQUIRED",
		},
	])(
		"policy mapping reliability matrix failure: $name",
		({ state, expectedCode }) => {
			const runtimeContract = buildRuntimeContract(true);
			const result = __hostTestables.resolveCodexExecAuth(
				{},
				runtimeContract,
				state as NativeHostStateLike | undefined,
			);

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.error_code).toBe(expectedCode);
				expect(result.error.retryable).toBe(false);
				expect(result.logMessage).toContain("oauth broker session");
			}
		},
	);

	test("codex-stage redaction은 auth/secret 값을 로그 문자열에서 제거한다", () => {
		process.env.CODEX_API_KEY = "sk-live-secret-value-123456";
		const redacted = __hostTestables.redactSensitiveText(
			"Authorization: Bearer sk-live-secret-value-123456 api_key=sk-live-secret-value-123456",
		);

		expect(redacted).not.toContain("sk-live-secret-value-123456");
		expect(redacted).toContain("Authorization: [REDACTED]");
		expect(redacted).toContain("api_key=[REDACTED]");
	});

	test("codex analyze request artifact는 허용된 metadata만 포함한다", () => {
		const artifact = __hostTestables.buildCodexAnalyzeInputPayload({
			message_pk: "msg_123",
			internet_message_id: "<msg@test>",
			received_at: "2026-02-18T00:00:00.000Z",
			subject: "Quarterly update",
			from: "sender@example.com",
			body_text: "request payload",
			has_attachments: true,
			attempt: 2,
			max_attempts: 3,
			auth_token: "should-not-pass",
			api_key: "should-not-pass",
		});

		expect(artifact.schema_version).toBe("codex_candidate.v1");
		expect(Object.keys(artifact.candidate).sort()).toEqual([
			"body_text",
			"from",
			"has_attachments",
			"internet_message_id",
			"message_pk",
			"received_at",
			"subject",
		]);
		expect(Object.keys(artifact.metadata).sort()).toEqual([
			"attempt",
			"has_attachments",
			"internet_message_id",
			"max_attempts",
			"message_pk",
			"received_at",
		]);
		expect(artifact.metadata).not.toHaveProperty("auth_token");
		expect(artifact.metadata).not.toHaveProperty("api_key");
	});

	test("autopilot status contract는 env/auth source 노출 시 안전한 env 이름만 유지한다", () => {
		const sanitized = __hostTestables.sanitizeCodexExecContractForStatus({
			flags: {
				codex_exec_enabled: true,
				codex_exec_shadow_mode: false,
				codex_exec_fallback_to_synthetic_on_error: true,
				opencode_connected_api_key_env: "OPENCODE_CODEX_API_KEY",
				env_fallback_api_key_env: "bad env name with spaces",
				env_fallback_only_ci_headless: true,
			},
		} as CodexExecRuntimeContract);

		expect(sanitized.flags.opencode_connected_api_key_env).toBe(
			"OPENCODE_CODEX_API_KEY",
		);
		expect(sanitized.flags.env_fallback_api_key_env).toBe("invalid_env_name");
	});
});
