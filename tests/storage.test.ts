import { describe, expect, test } from "vitest";

import type {
	MailStoreMessage,
	McpAttachmentRecord,
	McpRuntimeState,
} from "../src/domain/mcp.js";
import {
	MCP_STORAGE_KEYS,
	createMcpStorage,
	createStateStorageAdapter,
} from "../src/storage/interface.js";
import { createMemoryStorage } from "../src/storage/memory-adapter.js";

const createState = (): McpRuntimeState => ({
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
	},
});

const sampleMessage: MailStoreMessage = {
	message_pk: "msg_1",
	provider_message_id: "graph_msg_1",
	provider_thread_id: "thread_1",
	internet_message_id: "<msg_1@example.com>",
	web_link: "https://outlook.office.com/mail/msg_1",
	subject: "sample",
	from: "sender@local.test",
	to: ["to@local.test"],
	cc: [],
	received_at: new Date(0).toISOString(),
	body_text: "body",
	has_attachments: false,
	attachments: [],
};

const sampleAttachment: McpAttachmentRecord = {
	attachment_pk: "att_1",
	graph_message_id: "graph_msg_1",
	graph_attachment_id: "graph_att_1",
	message_pk: "msg_1",
	relative_path: "attachments/ab/hash.bin",
	size_bytes: 10,
	sha256: "abcdef",
};

describe("storage/interface", () => {
	test("createStateStorageAdapter는 모든 storage key를 set/get/delete 한다", () => {
		const state = createState();
		const adapter = createStateStorageAdapter(state);

		expect(adapter.list()).toEqual([
			MCP_STORAGE_KEYS.auth.account,
			MCP_STORAGE_KEYS.auth.issued_session,
			MCP_STORAGE_KEYS.auth.signed_in,
			MCP_STORAGE_KEYS.auth.auth_token,
			MCP_STORAGE_KEYS.mail.messages,
			MCP_STORAGE_KEYS.mail.threadMessages,
			MCP_STORAGE_KEYS.attachment.attachments,
			MCP_STORAGE_KEYS.attachment.attachmentContentBySha,
			MCP_STORAGE_KEYS.delta.deltaLinks,
		]);

		const account = { email: "user@local", tenant: "default" };
		const issuedSession = {
			account,
			scopes: ["Mail.Read"],
			state: "state",
			code_verifier: "verifier",
			code_challenge: "challenge",
			issued_at: new Date(0).toISOString(),
		};
		const token = {
			access_token: "access",
			refresh_token: "refresh",
			token_type: "Bearer" as const,
			refresh_token_expires_at: new Date(Date.now() + 60_000).toISOString(),
			expires_at: new Date(Date.now() + 60_000).toISOString(),
			issued_at: new Date().toISOString(),
		};

		const messages = new Map([[sampleMessage.message_pk, sampleMessage]]);
		const threadMessages = new Map([["thread_1", [sampleMessage.message_pk]]]);
		const attachments = new Map([["lookup_1", sampleAttachment]]);
		const attachmentMeta = new Map([
			[
				sampleAttachment.sha256,
				{
					attachment_pk: sampleAttachment.attachment_pk,
					relative_path: sampleAttachment.relative_path,
					size_bytes: sampleAttachment.size_bytes,
					sha256: sampleAttachment.sha256,
				},
			],
		]);
		const deltaLinks = new Map([["inbox", "inbox_1_delta"]]);

		adapter.set(MCP_STORAGE_KEYS.auth.account, account);
		adapter.set(MCP_STORAGE_KEYS.auth.issued_session, issuedSession);
		adapter.set(MCP_STORAGE_KEYS.auth.signed_in, true);
		adapter.set(MCP_STORAGE_KEYS.auth.auth_token, token);
		adapter.set(MCP_STORAGE_KEYS.mail.messages, messages);
		adapter.set(MCP_STORAGE_KEYS.mail.threadMessages, threadMessages);
		adapter.set(MCP_STORAGE_KEYS.attachment.attachments, attachments);
		adapter.set(
			MCP_STORAGE_KEYS.attachment.attachmentContentBySha,
			attachmentMeta,
		);
		adapter.set(MCP_STORAGE_KEYS.delta.deltaLinks, deltaLinks);

		expect(adapter.get(MCP_STORAGE_KEYS.auth.account)).toEqual(account);
		expect(adapter.get(MCP_STORAGE_KEYS.auth.issued_session)).toEqual(
			issuedSession,
		);
		expect(adapter.get(MCP_STORAGE_KEYS.auth.signed_in)).toBe(true);
		expect(adapter.get(MCP_STORAGE_KEYS.auth.auth_token)).toEqual(token);
		expect(adapter.get(MCP_STORAGE_KEYS.mail.messages)).toBe(messages);
		expect(adapter.get(MCP_STORAGE_KEYS.mail.threadMessages)).toBe(
			threadMessages,
		);
		expect(adapter.get(MCP_STORAGE_KEYS.attachment.attachments)).toBe(
			attachments,
		);
		expect(
			adapter.get(MCP_STORAGE_KEYS.attachment.attachmentContentBySha),
		).toBe(attachmentMeta);
		expect(adapter.get(MCP_STORAGE_KEYS.delta.deltaLinks)).toBe(deltaLinks);

		expect(adapter.get("unknown.key")).toBeUndefined();
		expect(() => adapter.set("unknown.key", "value")).not.toThrow();
		expect(() => adapter.delete("unknown.key")).not.toThrow();

		adapter.delete(MCP_STORAGE_KEYS.auth.account);
		adapter.delete(MCP_STORAGE_KEYS.auth.issued_session);
		adapter.delete(MCP_STORAGE_KEYS.auth.signed_in);
		adapter.delete(MCP_STORAGE_KEYS.auth.auth_token);
		adapter.delete(MCP_STORAGE_KEYS.mail.messages);
		adapter.delete(MCP_STORAGE_KEYS.mail.threadMessages);
		adapter.delete(MCP_STORAGE_KEYS.attachment.attachments);
		adapter.delete(MCP_STORAGE_KEYS.attachment.attachmentContentBySha);
		adapter.delete(MCP_STORAGE_KEYS.delta.deltaLinks);

		expect(state.account).toBeNull();
		expect(state.issued_session).toBeNull();
		expect(state.signed_in).toBe(false);
		expect(state.auth_token).toBeNull();
		expect(state.messages).toBeUndefined();
		expect(state.threadMessages).toBeUndefined();
		expect(state.attachments).toBeUndefined();
		expect(state.attachmentContentBySha).toBeUndefined();
		expect(state.deltaLinks).toBeUndefined();
	});

	test("createMcpStorage wrapper는 auth/mail/attachment/delta accessor를 제공한다", () => {
		const state = createState();
		const adapter = createStateStorageAdapter(state);
		const storage = createMcpStorage(adapter);

		expect(storage.adapter).toBe(adapter);
		expect(storage.auth.getAccount()).toBeNull();
		expect(storage.auth.getIssuedSession()).toBeNull();
		expect(storage.auth.getSignedIn()).toBe(false);
		expect(storage.auth.getAuthToken()).toBeNull();

		storage.auth.setAccount({ email: "next@local", tenant: "tenant" });
		storage.auth.setIssuedSession({
			account: { email: "next@local", tenant: "tenant" },
			scopes: ["Mail.Read"],
			state: "state",
			code_verifier: "verifier",
			code_challenge: "challenge",
			issued_at: new Date(0).toISOString(),
		});
		storage.auth.setSignedIn(true);
		storage.auth.setAuthToken({
			access_token: "access",
			refresh_token: "refresh",
			token_type: "Bearer",
			refresh_token_expires_at: new Date(Date.now() + 60_000).toISOString(),
			expires_at: new Date(Date.now() + 60_000).toISOString(),
			issued_at: new Date().toISOString(),
		});

		expect(storage.auth.getAccount()).toEqual({
			email: "next@local",
			tenant: "tenant",
		});
		expect(storage.auth.getIssuedSession()).not.toBeNull();
		expect(storage.auth.getSignedIn()).toBe(true);
		expect(storage.auth.getAuthToken()).not.toBeNull();

		const messages = new Map([[sampleMessage.message_pk, sampleMessage]]);
		const threadMessages = new Map([["thread_1", [sampleMessage.message_pk]]]);
		const attachments = new Map([["lookup", sampleAttachment]]);
		const attachmentMeta = new Map([
			[
				sampleAttachment.sha256,
				{
					attachment_pk: sampleAttachment.attachment_pk,
					relative_path: sampleAttachment.relative_path,
					size_bytes: sampleAttachment.size_bytes,
					sha256: sampleAttachment.sha256,
				},
			],
		]);
		const deltaLinks = new Map([["inbox", "inbox_delta"]]);

		adapter.set(MCP_STORAGE_KEYS.mail.messages, messages);
		adapter.set(MCP_STORAGE_KEYS.mail.threadMessages, threadMessages);
		adapter.set(MCP_STORAGE_KEYS.attachment.attachments, attachments);
		adapter.set(
			MCP_STORAGE_KEYS.attachment.attachmentContentBySha,
			attachmentMeta,
		);
		adapter.set(MCP_STORAGE_KEYS.delta.deltaLinks, deltaLinks);

		expect(storage.mail.getMessagesStore()).toBe(messages);
		expect(storage.mail.getThreadMessagesStore()).toBe(threadMessages);
		expect(storage.attachment.getAttachmentsStore()).toBe(attachments);
		expect(storage.attachment.getAttachmentContentByShaStore()).toBe(
			attachmentMeta,
		);
		expect(storage.delta.getDeltaLinksStore()).toBe(deltaLinks);

		storage.auth.setSignedIn(false);
		storage.auth.setAccount(null);
		storage.auth.setIssuedSession(null);
		storage.auth.setAuthToken(null);

		expect(storage.auth.getSignedIn()).toBe(false);
		expect(storage.auth.getAccount()).toBeNull();
		expect(storage.auth.getIssuedSession()).toBeNull();
		expect(storage.auth.getAuthToken()).toBeNull();
	});
});

describe("storage adapters", () => {
	test("MemoryStorageAdapter는 CRUD/list/clear를 지원한다", () => {
		const adapter = createMemoryStorage();

		adapter.set("a", { value: 1 });
		adapter.set("b", [1, 2, 3]);
		expect(adapter.get<{ value: number }>("a")).toEqual({ value: 1 });
		expect(adapter.get<number[]>("b")).toEqual([1, 2, 3]);
		expect(adapter.list()).toEqual(["a", "b"]);

		adapter.delete("a");
		expect(adapter.get("a")).toBeUndefined();

		adapter.clear();
		expect(adapter.list()).toEqual([]);
	});
});
