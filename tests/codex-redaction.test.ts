import { describe, expect, test } from "vitest";

import {
	NON_TRANSLATABLE_CONTRACT_KEYS,
	isNonTranslatableContractToken,
} from "../src/domain/i18n-contract.js";

type HostState = {
	signed_in: boolean;
	account: null | { email: string; tenant: string };
	mailbox: {
		messages: Record<string, unknown>;
		thread_messages: Record<string, unknown>;
		attachments: Record<string, unknown>;
	};
	workflow: {
		evidences: Array<unknown>;
		todos: Array<unknown>;
	};
	logs: Array<Record<string, unknown>>;
	autopilot: {
		mode: string;
		status: string;
		paused: boolean;
		in_flight_run_id: string | null;
		last_error: string | null;
		consecutive_failures: number;
		last_tick_at: string | null;
		metrics: Record<string, number>;
		codex_stage: {
			started: number;
			success: number;
			fail: number;
			timeout: number;
			schema_fail: number;
			last_failure_reason: string | null;
			last_run_correlation: Array<unknown>;
		};
	};
};

const hostModule = (await import(
	new URL("../native-host/host.mjs", import.meta.url).href
)) as {
	__hostTestables: {
		redactSensitiveText: (value: string) => string;
		buildCodexAnalyzeInputPayload: (payload: Record<string, unknown>) => {
			schema_version: string;
			candidate: Record<string, unknown>;
			metadata: Record<string, unknown>;
		};
		getSystemHealth: (state: HostState) => {
			ok: boolean;
			data: {
				recent_logs: Array<{ message: string }>;
				autopilot: {
					last_error: string | null;
					codex_stage: { last_failure_reason: string | null };
				};
			};
		};
		getAutopilotStatus: (state: HostState) => {
			ok: boolean;
			data: {
				last_error: string | null;
				codex_last_failure_reason: string | null;
			};
		};
	};
};

const { __hostTestables } = hostModule;

const createBaseState = (): HostState => ({
	signed_in: true,
	account: { email: "user@example.com", tenant: "tenant" },
	mailbox: {
		messages: {},
		thread_messages: {},
		attachments: {},
	},
	workflow: {
		evidences: [],
		todos: [],
	},
	logs: [],
	autopilot: {
		mode: "review_first",
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
});

describe("codex redaction guardrails", () => {
	test("codex-stage 로그는 health payload에서 secret 값이 노출되지 않는다", () => {
		const secret = "sk-live-codex-secret-value-000111";
		const state = createBaseState();
		state.logs.push({
			at: "2026-02-18T00:00:00.000Z",
			level: "warn",
			event: "codex_auth",
			message: `Authorization: Bearer ${secret} api_key=${secret}`,
		});

		const health = __hostTestables.getSystemHealth(state);
		expect(health.ok).toBe(true);
		const message = health.data.recent_logs[0]?.message ?? "";
		expect(message).toContain("Authorization: [REDACTED]");
		expect(message).toContain("api_key=[REDACTED]");
		expect(message).not.toContain(secret);
	});

	test("autopilot status/health는 오류 문자열 내 auth env 값을 redaction 한다", () => {
		const secret = "sk-live-status-secret-value-222333";
		process.env.CODEX_API_KEY = secret;
		const state = createBaseState();
		state.autopilot.last_error = `CODEX_API_KEY=${secret}`;
		state.autopilot.codex_stage.last_failure_reason = `Bearer ${secret}`;

		const status = __hostTestables.getAutopilotStatus(state);
		const health = __hostTestables.getSystemHealth(state);

		expect(status.ok).toBe(true);
		expect(health.ok).toBe(true);
		expect(status.data.last_error).toContain("CODEX_API_KEY=[REDACTED]");
		expect(status.data.codex_last_failure_reason).toContain(
			"Bearer [REDACTED]",
		);
		expect(health.data.autopilot.last_error).toContain(
			"CODEX_API_KEY=[REDACTED]",
		);
		expect(health.data.autopilot.codex_stage.last_failure_reason).toContain(
			"Bearer [REDACTED]",
		);
		expect(JSON.stringify(status.data)).not.toContain(secret);
		expect(JSON.stringify(health.data)).not.toContain(secret);
	});

	test("codex analyze artifact는 candidate/metadata 분리 및 metadata allowlist를 강제한다", () => {
		const artifact = __hostTestables.buildCodexAnalyzeInputPayload({
			message_pk: "msg_guardrail_1",
			internet_message_id: "<guardrail@test>",
			received_at: "2026-02-18T00:00:00.000Z",
			subject: "Guardrail subject",
			from: "sender@example.com",
			body_text: "body",
			has_attachments: true,
			attempt: 1,
			max_attempts: 3,
			auth_token: "must-not-pass",
			env_api_key: "must-not-pass",
			metadata: { nested: "must-not-pass" },
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
		expect(artifact.metadata).not.toHaveProperty("env_api_key");
		expect(artifact.metadata).not.toHaveProperty("metadata");
	});
});

describe("i18n machine token boundaries", () => {
	test("머신 계약 토큰은 고정 키로 유지된다", () => {
		const requiredMachineTokens = [
			"manual",
			"review_first",
			"full_auto",
			"error_code",
			"message_pk",
			"mail_folder",
		] as const;

		for (const token of requiredMachineTokens) {
			expect(NON_TRANSLATABLE_CONTRACT_KEYS).toContain(token);
			expect(isNonTranslatableContractToken(token)).toBe(true);
			expect(token).toMatch(/^[a-z_]+$/);
		}
	});
});
