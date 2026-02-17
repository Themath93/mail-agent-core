import type {
	MailStoreMessage,
	McpAttachmentRecord,
	McpAuthAccount,
	McpAuthSession,
	McpAuthToken,
	McpRuntimeState,
} from "../domain/mcp.js";

export interface StorageAdapter {
	get<T>(key: string): T | undefined;
	set<T>(key: string, value: T): void;
	delete(key: string): void;
	list(): string[];
}

export type AttachmentContentMeta = {
	attachment_pk: string;
	relative_path: string;
	size_bytes: number;
	sha256: string;
};

export interface AuthState {
	account: McpAuthAccount | null;
	issued_session: McpAuthSession | null;
	signed_in: boolean;
	auth_token: McpAuthToken | null;
}

export interface MailState {
	messages: Map<string, MailStoreMessage>;
	threadMessages: Map<string, string[]>;
}

export interface AttachmentState {
	attachments: Map<string, McpAttachmentRecord>;
	attachmentContentBySha: Map<string, AttachmentContentMeta>;
}

export interface DeltaState {
	deltaLinks: Map<string, string>;
}

export const MCP_STORAGE_KEYS = {
	auth: {
		account: "auth.account",
		issued_session: "auth.issued_session",
		signed_in: "auth.signed_in",
		auth_token: "auth.auth_token",
	},
	mail: {
		messages: "mail.messages",
		threadMessages: "mail.threadMessages",
	},
	attachment: {
		attachments: "attachment.attachments",
		attachmentContentBySha: "attachment.attachmentContentBySha",
	},
	delta: {
		deltaLinks: "delta.deltaLinks",
	},
} as const;

export type McpStorageKey =
	| (typeof MCP_STORAGE_KEYS)["auth"][keyof (typeof MCP_STORAGE_KEYS)["auth"]]
	| (typeof MCP_STORAGE_KEYS)["mail"][keyof (typeof MCP_STORAGE_KEYS)["mail"]]
	| (typeof MCP_STORAGE_KEYS)["attachment"][keyof (typeof MCP_STORAGE_KEYS)["attachment"]]
	| (typeof MCP_STORAGE_KEYS)["delta"][keyof (typeof MCP_STORAGE_KEYS)["delta"]];

export type McpStorage = {
	adapter: StorageAdapter;
	auth: {
		getAccount: () => McpAuthAccount | null;
		setAccount: (account: McpAuthAccount | null) => void;
		getIssuedSession: () => McpAuthSession | null;
		setIssuedSession: (session: McpAuthSession | null) => void;
		getSignedIn: () => boolean;
		setSignedIn: (signedIn: boolean) => void;
		getAuthToken: () => McpAuthToken | null;
		setAuthToken: (token: McpAuthToken | null) => void;
	};
	mail: {
		getMessagesStore: () => unknown;
		getThreadMessagesStore: () => unknown;
	};
	attachment: {
		getAttachmentsStore: () => unknown;
		getAttachmentContentByShaStore: () => unknown;
	};
	delta: {
		getDeltaLinksStore: () => unknown;
	};
};

const asBoolean = (value: unknown): boolean => value === true;

export const createStateStorageAdapter = (
	state: McpRuntimeState,
): StorageAdapter => {
	const registry: Record<
		McpStorageKey,
		{
			get: () => unknown;
			set: (value: unknown) => void;
			del: () => void;
		}
	> = {
		[MCP_STORAGE_KEYS.auth.account]: {
			get: () => state.account,
			set: (value) => {
				state.account = value as McpAuthAccount | null;
			},
			del: () => {
				state.account = null;
			},
		},
		[MCP_STORAGE_KEYS.auth.issued_session]: {
			get: () => state.issued_session,
			set: (value) => {
				state.issued_session = value as McpAuthSession | null;
			},
			del: () => {
				state.issued_session = null;
			},
		},
		[MCP_STORAGE_KEYS.auth.signed_in]: {
			get: () => state.signed_in,
			set: (value) => {
				state.signed_in = asBoolean(value);
			},
			del: () => {
				state.signed_in = false;
			},
		},
		[MCP_STORAGE_KEYS.auth.auth_token]: {
			get: () => state.auth_token,
			set: (value) => {
				state.auth_token = value as McpAuthToken | null;
			},
			del: () => {
				state.auth_token = null;
			},
		},
		[MCP_STORAGE_KEYS.mail.messages]: {
			get: () => state.messages,
			set: (value) => {
				state.messages = value as Map<string, MailStoreMessage>;
			},
			del: () => {
				state.messages = undefined as unknown as Map<string, MailStoreMessage>;
			},
		},
		[MCP_STORAGE_KEYS.mail.threadMessages]: {
			get: () => state.threadMessages,
			set: (value) => {
				state.threadMessages = value as Map<string, string[]>;
			},
			del: () => {
				state.threadMessages = undefined as unknown as Map<string, string[]>;
			},
		},
		[MCP_STORAGE_KEYS.attachment.attachments]: {
			get: () => state.attachments,
			set: (value) => {
				state.attachments = value as Map<string, McpAttachmentRecord>;
			},
			del: () => {
				state.attachments = undefined as unknown as Map<
					string,
					McpAttachmentRecord
				>;
			},
		},
		[MCP_STORAGE_KEYS.attachment.attachmentContentBySha]: {
			get: () => state.attachmentContentBySha,
			set: (value) => {
				state.attachmentContentBySha = value as Map<
					string,
					AttachmentContentMeta
				>;
			},
			del: () => {
				state.attachmentContentBySha = undefined as unknown as Map<
					string,
					AttachmentContentMeta
				>;
			},
		},
		[MCP_STORAGE_KEYS.delta.deltaLinks]: {
			get: () => state.deltaLinks,
			set: (value) => {
				state.deltaLinks = value as Map<string, string>;
			},
			del: () => {
				state.deltaLinks = undefined as unknown as Map<string, string>;
			},
		},
	};

	return {
		get: (key) => registry[key as McpStorageKey]?.get() as never,
		set: (key, value) => {
			const entry = registry[key as McpStorageKey];
			if (!entry) {
				return;
			}
			entry.set(value);
		},
		delete: (key) => {
			const entry = registry[key as McpStorageKey];
			entry?.del();
		},
		list: () => Object.keys(registry),
	};
};

export const createMcpStorage = (adapter: StorageAdapter): McpStorage => {
	return {
		adapter,
		auth: {
			getAccount: () =>
				adapter.get<McpAuthAccount | null>(MCP_STORAGE_KEYS.auth.account) ??
				null,
			setAccount: (account) => {
				adapter.set(MCP_STORAGE_KEYS.auth.account, account);
			},
			getIssuedSession: () =>
				adapter.get<McpAuthSession | null>(
					MCP_STORAGE_KEYS.auth.issued_session,
				) ?? null,
			setIssuedSession: (session) => {
				adapter.set(MCP_STORAGE_KEYS.auth.issued_session, session);
			},
			getSignedIn: () =>
				asBoolean(adapter.get<boolean>(MCP_STORAGE_KEYS.auth.signed_in)),
			setSignedIn: (signedIn) => {
				adapter.set(MCP_STORAGE_KEYS.auth.signed_in, signedIn);
			},
			getAuthToken: () =>
				adapter.get<McpAuthToken | null>(MCP_STORAGE_KEYS.auth.auth_token) ??
				null,
			setAuthToken: (token) => {
				adapter.set(MCP_STORAGE_KEYS.auth.auth_token, token);
			},
		},
		mail: {
			getMessagesStore: () => adapter.get(MCP_STORAGE_KEYS.mail.messages),
			getThreadMessagesStore: () =>
				adapter.get(MCP_STORAGE_KEYS.mail.threadMessages),
		},
		attachment: {
			getAttachmentsStore: () =>
				adapter.get(MCP_STORAGE_KEYS.attachment.attachments),
			getAttachmentContentByShaStore: () =>
				adapter.get(MCP_STORAGE_KEYS.attachment.attachmentContentBySha),
		},
		delta: {
			getDeltaLinksStore: () => adapter.get(MCP_STORAGE_KEYS.delta.deltaLinks),
		},
	};
};
