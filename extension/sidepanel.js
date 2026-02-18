const loadedAt = document.getElementById("loaded-at");
const authStatus = document.getElementById("auth-status");
const loginUrlText = document.getElementById("login-url");
const resultView = document.getElementById("result");
const autoSyncStatus = document.getElementById("autosync-status");

const startLoginButton = document.getElementById("start-login");
const completeLoginButton = document.getElementById("complete-login");
const checkAuthStatusButton = document.getElementById("check-auth-status");
const logoutButton = document.getElementById("logout");
const authCodeInput = document.getElementById("auth-code");

const initialSyncButton = document.getElementById("initial-sync");
const deltaSyncButton = document.getElementById("delta-sync");
const syncFolderInput = document.getElementById("sync-folder");
const syncDaysInput = document.getElementById("sync-days");

const listMessagesButton = document.getElementById("list-messages");
const listThreadsButton = document.getElementById("list-threads");
const listLimitInput = document.getElementById("list-limit");
const messageSelect = document.getElementById("message-select");
const threadSelect = document.getElementById("thread-select");

const getMessageButton = document.getElementById("get-message");
const getThreadButton = document.getElementById("get-thread");
const messageIdInput = document.getElementById("message-id");
const threadIdInput = document.getElementById("thread-id");
const threadDepthInput = document.getElementById("thread-depth");

const listAttachmentsButton = document.getElementById("list-attachments");
const attachmentSelect = document.getElementById("attachment-select");
const downloadAttachmentButton = document.getElementById("download-attachment");
const attachmentMessageIdInput = document.getElementById(
	"attachment-message-id",
);
const attachmentIdInput = document.getElementById("attachment-id");
const attachmentMessagePkInput = document.getElementById(
	"attachment-message-pk",
);

const autosyncMinutesInput = document.getElementById("autosync-minutes");
const autosyncStartButton = document.getElementById("autosync-start");
const autosyncStopButton = document.getElementById("autosync-stop");

const autopilotModeInput = document.getElementById("autopilot-mode");
const autopilotSetModeButton = document.getElementById("autopilot-set-mode");
const autopilotStatusButton = document.getElementById("autopilot-status");
const autopilotTickButton = document.getElementById("autopilot-tick");
const autopilotPauseButton = document.getElementById("autopilot-pause");
const autopilotResumeButton = document.getElementById("autopilot-resume");
const autopilotFolderInput = document.getElementById("autopilot-folder");
const autopilotMaxMessagesInput = document.getElementById(
	"autopilot-max-messages",
);
const autopilotMaxAttachmentsInput = document.getElementById(
	"autopilot-max-attachments",
);
const autopilotStatusText = document.getElementById("autopilot-status-text");

const systemHealthButton = document.getElementById("system-health");
const resetSessionButton = document.getElementById("reset-session");
const resetSessionFullButton = document.getElementById("reset-session-full");

const evidenceMessagePkInput = document.getElementById("evidence-message-pk");
const evidenceSnippetInput = document.getElementById("evidence-snippet");
const evidenceConfidenceInput = document.getElementById("evidence-confidence");
const createEvidenceButton = document.getElementById("create-evidence");

const todoIdInput = document.getElementById("todo-id");
const todoTitleInput = document.getElementById("todo-title");
const todoStatusInput = document.getElementById("todo-status");
const todoEvidenceIdInput = document.getElementById("todo-evidence-id");
const upsertTodoButton = document.getElementById("upsert-todo");
const workflowListButton = document.getElementById("workflow-list");

const HOST_NAME = "com.themath93.mail_agent_core.host";
const STORAGE_KEYS = {
	state: "pending_login_state",
	codeVerifier: "pending_login_code_verifier",
};

const AUTO_COMPLETE_MAX_ATTEMPTS = 300;
const AUTO_COMPLETE_BASE_DELAY_MS = 1000;
const AUTO_COMPLETE_MAX_DELAY_MS = 3000;
const AUTO_COMPLETE_TIMEOUT_MS = 5 * 60 * 1000;

let autoCompleteTimer = null;
let autoCompleteAttempt = 0;
let autoCompleteStartedAt = 0;
let autoSyncTimer = null;
let latestMessages = [];
let latestThreads = [];
let latestAttachments = [];

if (loadedAt) {
	loadedAt.textContent = `Loaded at: ${new Date().toLocaleString()}`;
}

const setAuthStatus = (value) => {
	if (authStatus) {
		authStatus.textContent = value;
	}
};

const setLoginUrlText = (value) => {
	if (loginUrlText) {
		loginUrlText.textContent = value;
	}
};

const setResult = (payload) => {
	if (resultView) {
		resultView.textContent = JSON.stringify(payload, null, 2);
	}
};

const setAutoSyncStatus = (value) => {
	if (autoSyncStatus) {
		autoSyncStatus.textContent = value;
	}
};

const setAutopilotStatusText = (value) => {
	if (autopilotStatusText) {
		autopilotStatusText.textContent = value;
	}
};

const parseAuthInput = (rawInput) => {
	const trimmed = rawInput.trim();
	if (trimmed.length === 0) {
		return { code: "", state: null };
	}

	const parseQuery = (queryString) => {
		const params = new URLSearchParams(queryString);
		const code = params.get("code");
		const state = params.get("state");
		return {
			code: typeof code === "string" ? code.trim() : "",
			state: typeof state === "string" ? state : null,
		};
	};

	try {
		const callbackUrl = new URL(trimmed);
		return parseQuery(callbackUrl.search);
	} catch (error) {
		void error;
	}

	if (trimmed.startsWith("?")) {
		return parseQuery(trimmed);
	}

	if (trimmed.includes("code=")) {
		const queryStartIndex = trimmed.indexOf("?");
		if (queryStartIndex >= 0) {
			return parseQuery(trimmed.slice(queryStartIndex));
		}
		return parseQuery(trimmed);
	}

	return { code: trimmed, state: null };
};

const sendNativeMessage = (action, payload) =>
	new Promise((resolve, reject) => {
		chrome.runtime.sendNativeMessage(
			HOST_NAME,
			{ action, ...payload },
			(response) => {
				if (chrome.runtime.lastError) {
					reject(new Error(chrome.runtime.lastError.message));
					return;
				}
				resolve(response);
			},
		);
	});

const handleMcpResponse = (response) => {
	if (!response || typeof response !== "object") {
		throw new Error("invalid host response");
	}
	if (response.ok !== true) {
		throw new Error(
			typeof response.error_message === "string"
				? response.error_message
				: "unknown host error",
		);
	}
	if (!("data" in response)) {
		throw new Error("host response missing data");
	}
	return response.data;
};

const stopAutoCompleteLoop = () => {
	if (autoCompleteTimer) {
		clearTimeout(autoCompleteTimer);
		autoCompleteTimer = null;
	}
	autoCompleteAttempt = 0;
	autoCompleteStartedAt = 0;
};

const stopAutoSyncLoop = () => {
	if (autoSyncTimer) {
		clearInterval(autoSyncTimer);
		autoSyncTimer = null;
	}
	setAutoSyncStatus("Auto sync: stopped");
};

const selectValue = (selectElement) =>
	typeof selectElement?.value === "string" ? selectElement.value : "";

const setSelectOptions = (selectElement, options) => {
	if (!selectElement) {
		return;
	}
	selectElement.innerHTML = "";
	for (const option of options) {
		const node = document.createElement("option");
		node.value = option.value;
		node.textContent = option.label;
		selectElement.appendChild(node);
	}
};

const fillMessageInputsFromSelection = () => {
	const messagePk = selectValue(messageSelect);
	if (!messagePk) {
		return;
	}
	if (messageIdInput) {
		messageIdInput.value = messagePk;
	}
	if (attachmentMessagePkInput) {
		attachmentMessagePkInput.value = messagePk;
	}
	if (evidenceMessagePkInput) {
		evidenceMessagePkInput.value = messagePk;
	}
};

const fillThreadInputFromSelection = () => {
	const threadPk = selectValue(threadSelect);
	if (!threadPk) {
		return;
	}
	if (threadIdInput) {
		threadIdInput.value = threadPk;
	}
};

const fillAttachmentInputsFromSelection = () => {
	const attachmentPk = selectValue(attachmentSelect);
	if (!attachmentPk) {
		return;
	}
	const item = latestAttachments.find(
		(row) => row.attachment_pk === attachmentPk,
	);
	if (!item) {
		return;
	}
	if (attachmentMessageIdInput) {
		attachmentMessageIdInput.value = item.graph_message_id;
	}
	if (attachmentIdInput) {
		attachmentIdInput.value = item.graph_attachment_id;
	}
	if (attachmentMessagePkInput && item.message_pk) {
		attachmentMessagePkInput.value = item.message_pk;
	}
};

const nextAutoCompleteDelayMs = (attempt) =>
	Math.min(
		AUTO_COMPLETE_BASE_DELAY_MS * (1 + Math.floor(attempt / 10)),
		AUTO_COMPLETE_MAX_DELAY_MS,
	);

const scheduleAutoComplete = (delayMs) => {
	autoCompleteTimer = setTimeout(() => {
		void runCompleteFromCallback();
	}, delayMs);
};

const setManualFallbackStatus = (message) => {
	if (message.length > 0) {
		setAuthStatus(
			`Auth status error: ${message}. callback URL 또는 code를 붙여넣고 로그인 완료를 수동 실행하세요.`,
		);
		return;
	}
	setAuthStatus(
		"Auth status: 자동완료 대기 시간이 초과되었습니다. callback URL 또는 code를 붙여넣고 로그인 완료를 수동 실행하세요.",
	);
};

const runCompleteFromCallback = async () => {
	autoCompleteTimer = null;
	if (autoCompleteStartedAt === 0) {
		autoCompleteStartedAt = Date.now();
	}
	autoCompleteAttempt += 1;
	const attempt = autoCompleteAttempt;
	const elapsedMs = Date.now() - autoCompleteStartedAt;

	try {
		const response = await sendNativeMessage(
			"auth_store.complete_login_auto",
			{},
		);
		if (!response || typeof response !== "object") {
			throw new Error("invalid host response");
		}

		if (response.ok !== true) {
			const errorCode =
				typeof response.error_code === "string"
					? response.error_code
					: "E_UNKNOWN";
			const errorMessage =
				typeof response.error_message === "string"
					? response.error_message
					: "unknown host error";

			if (errorCode === "E_NOT_FOUND") {
				if (
					attempt >= AUTO_COMPLETE_MAX_ATTEMPTS ||
					elapsedMs >= AUTO_COMPLETE_TIMEOUT_MS
				) {
					stopAutoCompleteLoop();
					setManualFallbackStatus("");
					setResult(response);
					return;
				}
				if (attempt % 20 === 0) {
					setAuthStatus(
						`Auth status: callback 자동완료 대기 중 (${attempt}/${AUTO_COMPLETE_MAX_ATTEMPTS})`,
					);
				}
				scheduleAutoComplete(nextAutoCompleteDelayMs(attempt));
				return;
			}

			if (response.retryable === true) {
				if (
					attempt >= AUTO_COMPLETE_MAX_ATTEMPTS ||
					elapsedMs >= AUTO_COMPLETE_TIMEOUT_MS
				) {
					stopAutoCompleteLoop();
					setManualFallbackStatus(errorMessage);
					setResult(response);
					return;
				}
				setAuthStatus(
					`Auth status: 자동완료 재시도 중 (${attempt}/${AUTO_COMPLETE_MAX_ATTEMPTS}) - ${errorMessage}`,
				);
				scheduleAutoComplete(nextAutoCompleteDelayMs(attempt));
				return;
			}

			stopAutoCompleteLoop();
			setManualFallbackStatus(errorMessage);
			setResult(response);
			return;
		}

		const data = handleMcpResponse(response);
		stopAutoCompleteLoop();
		chrome.storage.local.remove([
			STORAGE_KEYS.state,
			STORAGE_KEYS.codeVerifier,
		]);
		const email = data?.account?.email ? data.account.email : "-";
		setAuthStatus(`Auth status: signed_in=true email=${email}`);
		setResult(response);
		if (authCodeInput) {
			authCodeInput.value = "";
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (
			attempt >= AUTO_COMPLETE_MAX_ATTEMPTS ||
			elapsedMs >= AUTO_COMPLETE_TIMEOUT_MS
		) {
			stopAutoCompleteLoop();
			setManualFallbackStatus(message);
			return;
		}
		setAuthStatus(
			`Auth status: 자동완료 재시도 중 (${attempt}/${AUTO_COMPLETE_MAX_ATTEMPTS}) - ${message}`,
		);
		scheduleAutoComplete(nextAutoCompleteDelayMs(attempt));
	}
};

const startAutoCompleteLoop = () => {
	stopAutoCompleteLoop();
	autoCompleteStartedAt = Date.now();
	autoCompleteAttempt = 0;
	scheduleAutoComplete(0);
};

const requestAuthStatus = async () => {
	try {
		const response = await sendNativeMessage("auth_store.auth_status", {});
		const data = handleMcpResponse(response);
		const email = data?.account?.email ? data.account.email : "-";
		const signedIn = Boolean(data?.signed_in);
		if (!signedIn && data?.pending_callback_received === true) {
			setAuthStatus(
				`Auth status: signed_in=false email=${email} callback 수신됨 (로그인 완료 수동 실행 가능)`,
			);
		} else {
			setAuthStatus(`Auth status: signed_in=${signedIn} email=${email}`);
		}
		setResult(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Auth status error: ${message}`);
	}
};

const startLogin = async () => {
	startLoginButton?.setAttribute("disabled", "disabled");
	try {
		const response = await sendNativeMessage("auth_store.start_login", {
			scopes: ["Mail.Read", "User.Read", "offline_access", "openid", "profile"],
		});
		const data = handleMcpResponse(response);
		chrome.storage.local.set({
			[STORAGE_KEYS.state]: data.state,
			[STORAGE_KEYS.codeVerifier]: data.code_verifier,
		});
		setLoginUrlText(`Login URL: ${data.login_url}`);
		setAuthStatus(
			"Auth status: 로그인 URL을 열었고 callback 자동완료를 최대 5분 대기 중",
		);
		setResult(response);
		startAutoCompleteLoop();
		window.open(data.login_url, "_blank", "noopener,noreferrer");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Auth status error: ${message}`);
	} finally {
		startLoginButton?.removeAttribute("disabled");
	}
};

const completeLoginManual = async () => {
	const rawInput =
		typeof authCodeInput?.value === "string" ? authCodeInput.value : "";
	const parsedInput = parseAuthInput(rawInput);
	const code = parsedInput.code;
	if (code.length === 0) {
		setAuthStatus("Auth status error: code를 입력하세요.");
		return;
	}

	chrome.storage.local.get(
		[STORAGE_KEYS.state, STORAGE_KEYS.codeVerifier],
		async (result) => {
			const state = result[STORAGE_KEYS.state];
			const codeVerifier = result[STORAGE_KEYS.codeVerifier];
			if (typeof state !== "string" || typeof codeVerifier !== "string") {
				setAuthStatus("Auth status error: start_login을 먼저 실행하세요.");
				return;
			}

			if (
				typeof parsedInput.state === "string" &&
				parsedInput.state.length > 0 &&
				parsedInput.state !== state
			) {
				setAuthStatus(
					"Auth status error: URL의 state가 현재 로그인 세션과 다릅니다. 로그인 시작을 다시 실행하세요.",
				);
				return;
			}

			try {
				const response = await sendNativeMessage("auth_store.complete_login", {
					code,
					state,
					code_verifier: codeVerifier,
				});
				const data = handleMcpResponse(response);
				const email = data?.account?.email ? data.account.email : "-";
				setAuthStatus(`Auth status: signed_in=true email=${email}`);
				setResult(response);
				chrome.storage.local.remove([
					STORAGE_KEYS.state,
					STORAGE_KEYS.codeVerifier,
				]);
				if (authCodeInput) {
					authCodeInput.value = "";
				}
				stopAutoCompleteLoop();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				setAuthStatus(`Auth status error: ${message}`);
			}
		},
	);
};

const logout = async () => {
	try {
		const response = await sendNativeMessage("auth_store.logout", {});
		handleMcpResponse(response);
		chrome.storage.local.remove([
			STORAGE_KEYS.state,
			STORAGE_KEYS.codeVerifier,
		]);
		stopAutoCompleteLoop();
		setAuthStatus("Auth status: signed_in=false email=-");
		setResult(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Auth status error: ${message}`);
	}
};

const readSyncInputs = () => ({
	mail_folder:
		typeof syncFolderInput?.value === "string" &&
		syncFolderInput.value.trim().length > 0
			? syncFolderInput.value.trim()
			: "inbox",
	days_back:
		typeof syncDaysInput?.value === "string" && Number(syncDaysInput.value) > 0
			? Number(syncDaysInput.value)
			: 7,
});

const listMessages = async () => {
	const limit = Number(listLimitInput?.value ?? "50");
	const resolvedLimit = Number.isInteger(limit) && limit > 0 ? limit : 50;
	try {
		const response = await sendNativeMessage("mail_store.list_messages", {
			limit: resolvedLimit,
		});
		const data = handleMcpResponse(response);
		latestMessages = Array.isArray(data.items) ? data.items : [];
		setSelectOptions(
			messageSelect,
			latestMessages.map((row) => ({
				value: row.message_pk,
				label: `${row.received_at || ""} | ${row.subject || "(no subject)"}`,
			})),
		);
		fillMessageInputsFromSelection();
		setAuthStatus(`Query: list_messages 완료 (${latestMessages.length})`);
		setResult(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Query error: ${message}`);
	}
};

const listThreads = async () => {
	const limit = Number(listLimitInput?.value ?? "50");
	const resolvedLimit = Number.isInteger(limit) && limit > 0 ? limit : 50;
	try {
		const response = await sendNativeMessage("mail_store.list_threads", {
			limit: resolvedLimit,
		});
		const data = handleMcpResponse(response);
		latestThreads = Array.isArray(data.items) ? data.items : [];
		setSelectOptions(
			threadSelect,
			latestThreads.map((row) => ({
				value: row.thread_pk,
				label: `${row.message_count} msgs | ${row.thread_pk}`,
			})),
		);
		fillThreadInputFromSelection();
		setAuthStatus(`Query: list_threads 완료 (${latestThreads.length})`);
		setResult(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Query error: ${message}`);
	}
};

const initialSync = async () => {
	const base = readSyncInputs();
	try {
		const response = await sendNativeMessage("graph_mail_sync.initial_sync", {
			mail_folder: base.mail_folder,
			days_back: base.days_back,
			select: [
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
			],
		});
		setResult(response);
		handleMcpResponse(response);
		setAuthStatus("Sync: initial_sync 완료");
		await listMessages();
		await listThreads();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Sync error: ${message}`);
	}
};

const deltaSync = async () => {
	const base = readSyncInputs();
	try {
		const response = await sendNativeMessage("graph_mail_sync.delta_sync", {
			mail_folder: base.mail_folder,
		});
		setResult(response);
		handleMcpResponse(response);
		setAuthStatus("Sync: delta_sync 완료");
		await listMessages();
		await listThreads();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Sync error: ${message}`);
	}
};

const getMessage = async () => {
	const messageId =
		typeof messageIdInput?.value === "string"
			? messageIdInput.value.trim()
			: "";
	if (messageId.length === 0) {
		setAuthStatus("Query error: message id 입력 필요");
		return;
	}
	try {
		const response = await sendNativeMessage("mail_store.get_message", {
			message_pk: messageId,
		});
		setResult(response);
		handleMcpResponse(response);
		setAuthStatus("Query: get_message 완료");
		if (evidenceMessagePkInput) {
			evidenceMessagePkInput.value = messageId;
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Query error: ${message}`);
	}
};

const getThread = async () => {
	const threadId =
		typeof threadIdInput?.value === "string" ? threadIdInput.value.trim() : "";
	const depth =
		typeof threadDepthInput?.value === "string" &&
		Number(threadDepthInput.value) > 0
			? Number(threadDepthInput.value)
			: 10;
	if (threadId.length === 0) {
		setAuthStatus("Query error: thread id 입력 필요");
		return;
	}
	try {
		const response = await sendNativeMessage("mail_store.get_thread", {
			thread_pk: threadId,
			depth,
		});
		setResult(response);
		handleMcpResponse(response);
		setAuthStatus("Query: get_thread 완료");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Query error: ${message}`);
	}
};

const listAttachments = async () => {
	const messagePk =
		typeof attachmentMessagePkInput?.value === "string"
			? attachmentMessagePkInput.value.trim()
			: "";
	if (!messagePk) {
		setAuthStatus("Attachment error: message_pk 입력 필요");
		return;
	}
	try {
		const response = await sendNativeMessage("mail_store.list_attachments", {
			message_pk: messagePk,
		});
		const data = handleMcpResponse(response);
		latestAttachments = Array.isArray(data.items)
			? data.items.map((item) => ({ ...item, message_pk: messagePk }))
			: [];
		setSelectOptions(
			attachmentSelect,
			latestAttachments.map((item) => ({
				value: item.attachment_pk,
				label: `${item.attachment_pk} (${item.size_bytes || 0} bytes)`,
			})),
		);
		fillAttachmentInputsFromSelection();
		setResult(response);
		setAuthStatus(
			`Attachment: list_attachments 완료 (${latestAttachments.length})`,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Attachment error: ${message}`);
	}
};

const downloadAttachment = async () => {
	const graphMessageId =
		typeof attachmentMessageIdInput?.value === "string"
			? attachmentMessageIdInput.value.trim()
			: "";
	const graphAttachmentId =
		typeof attachmentIdInput?.value === "string"
			? attachmentIdInput.value.trim()
			: "";
	const messagePk =
		typeof attachmentMessagePkInput?.value === "string"
			? attachmentMessagePkInput.value.trim()
			: "";
	if (!graphMessageId || !graphAttachmentId || !messagePk) {
		setAuthStatus(
			"Attachment error: graph_message_id/graph_attachment_id/message_pk 모두 입력",
		);
		return;
	}
	try {
		const response = await sendNativeMessage(
			"graph_mail_sync.download_attachment",
			{
				graph_message_id: graphMessageId,
				graph_attachment_id: graphAttachmentId,
				message_pk: messagePk,
			},
		);
		setResult(response);
		handleMcpResponse(response);
		setAuthStatus("Attachment: download_attachment 완료");
		await listAttachments();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Attachment error: ${message}`);
	}
};

const runDeltaSyncOnce = async () => {
	await runAutopilotTickOnce();
};

const startAutoSyncLoop = () => {
	stopAutoSyncLoop();
	const minutesRaw = Number(autosyncMinutesInput?.value ?? "10");
	const minutes =
		Number.isInteger(minutesRaw) && minutesRaw > 0 ? minutesRaw : 10;
	const ms = minutes * 60 * 1000;
	setAutoSyncStatus(`Auto sync: running every ${minutes} minute(s)`);
	autoSyncTimer = setInterval(() => {
		runDeltaSyncOnce().catch((error) => {
			const message = error instanceof Error ? error.message : String(error);
			setAuthStatus(`Auto sync error: ${message}`);
		});
	}, ms);
};

const getSystemHealth = async () => {
	try {
		const response = await sendNativeMessage("system.health", {});
		handleMcpResponse(response);
		setResult(response);
		setAuthStatus("System: health 조회 완료");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`System error: ${message}`);
	}
};

const resetSession = async (clearMailbox) => {
	try {
		const response = await sendNativeMessage("system.reset_session", {
			clear_mailbox: clearMailbox,
		});
		handleMcpResponse(response);
		setResult(response);
		setAuthStatus("System: reset_session 완료");
		stopAutoCompleteLoop();
		if (clearMailbox) {
			latestMessages = [];
			latestThreads = [];
			latestAttachments = [];
			setSelectOptions(messageSelect, []);
			setSelectOptions(threadSelect, []);
			setSelectOptions(attachmentSelect, []);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`System error: ${message}`);
	}
};

const readAutopilotInputs = () => {
	const mailFolder =
		typeof autopilotFolderInput?.value === "string" &&
		autopilotFolderInput.value.trim().length > 0
			? autopilotFolderInput.value.trim()
			: "inbox";
	const maxMessagesRaw = Number(autopilotMaxMessagesInput?.value ?? "30");
	const maxAttachmentsRaw = Number(autopilotMaxAttachmentsInput?.value ?? "10");
	return {
		mail_folder: mailFolder,
		max_messages_per_tick:
			Number.isInteger(maxMessagesRaw) && maxMessagesRaw > 0
				? maxMessagesRaw
				: 30,
		max_attachments_per_tick:
			Number.isInteger(maxAttachmentsRaw) && maxAttachmentsRaw > 0
				? maxAttachmentsRaw
				: 10,
	};
};

const refreshAutopilotStatus = async () => {
	try {
		const response = await sendNativeMessage("autopilot.status", {});
		const data = handleMcpResponse(response);
		setResult(response);
		setAutopilotStatusText(
			`Autopilot: mode=${data.mode} status=${data.status} paused=${Boolean(data.paused)}`,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAutopilotStatusText(`Autopilot error: ${message}`);
	}
};

const setAutopilotMode = async () => {
	const mode =
		typeof autopilotModeInput?.value === "string"
			? autopilotModeInput.value
			: "manual";
	try {
		const response = await sendNativeMessage("autopilot.set_mode", { mode });
		handleMcpResponse(response);
		setResult(response);
		setAuthStatus(`Autopilot: mode 설정 완료 (${mode})`);
		await refreshAutopilotStatus();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Autopilot error: ${message}`);
	}
};

const runAutopilotTickOnce = async () => {
	const payload = readAutopilotInputs();
	const response = await sendNativeMessage("autopilot.tick", payload);
	const data = handleMcpResponse(response);
	setResult(response);
	setAuthStatus(
		`Autopilot tick 완료: evidences=${data.auto_evidence_created ?? 0} todos=${data.auto_todo_created ?? 0} attachments=${data.auto_attachment_saved ?? 0}`,
	);
	await listMessages();
	await listThreads();
	await refreshAutopilotStatus();
};

const runAutopilotTick = async () => {
	try {
		await runAutopilotTickOnce();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Autopilot error: ${message}`);
		await refreshAutopilotStatus();
	}
};

const pauseAutopilot = async () => {
	try {
		const response = await sendNativeMessage("autopilot.pause", {});
		handleMcpResponse(response);
		setResult(response);
		setAuthStatus("Autopilot: pause 완료");
		await refreshAutopilotStatus();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Autopilot error: ${message}`);
	}
};

const resumeAutopilot = async () => {
	try {
		const response = await sendNativeMessage("autopilot.resume", {});
		handleMcpResponse(response);
		setResult(response);
		setAuthStatus("Autopilot: resume 완료");
		await refreshAutopilotStatus();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Autopilot error: ${message}`);
	}
};

const createEvidence = async () => {
	const messagePk =
		typeof evidenceMessagePkInput?.value === "string"
			? evidenceMessagePkInput.value.trim()
			: "";
	const snippet =
		typeof evidenceSnippetInput?.value === "string"
			? evidenceSnippetInput.value.trim()
			: "";
	const confidence = Number(evidenceConfidenceInput?.value ?? "0.7");
	if (!messagePk || !snippet) {
		setAuthStatus("Workflow error: message_pk/snippet 입력 필요");
		return;
	}
	try {
		const response = await sendNativeMessage("workflow.create_evidence", {
			message_pk: messagePk,
			snippet,
			confidence,
		});
		const data = handleMcpResponse(response);
		if (todoEvidenceIdInput && data?.evidence?.evidence_id) {
			todoEvidenceIdInput.value = data.evidence.evidence_id;
		}
		setResult(response);
		setAuthStatus("Workflow: create_evidence 완료");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Workflow error: ${message}`);
	}
};

const upsertTodo = async () => {
	const todoId =
		typeof todoIdInput?.value === "string" ? todoIdInput.value.trim() : "";
	const title =
		typeof todoTitleInput?.value === "string"
			? todoTitleInput.value.trim()
			: "";
	const status =
		typeof todoStatusInput?.value === "string" ? todoStatusInput.value : "open";
	const evidenceId =
		typeof todoEvidenceIdInput?.value === "string"
			? todoEvidenceIdInput.value.trim()
			: "";
	if (!title) {
		setAuthStatus("Workflow error: todo title 입력 필요");
		return;
	}
	try {
		const response = await sendNativeMessage("workflow.upsert_todo", {
			todo_id: todoId,
			title,
			status,
			evidence_id: evidenceId,
		});
		handleMcpResponse(response);
		setResult(response);
		setAuthStatus("Workflow: upsert_todo 완료");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Workflow error: ${message}`);
	}
};

const listWorkflow = async () => {
	try {
		const response = await sendNativeMessage("workflow.list", {});
		handleMcpResponse(response);
		setResult(response);
		setAuthStatus("Workflow: list 완료");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Workflow error: ${message}`);
	}
};

startLoginButton?.addEventListener("click", startLogin);
completeLoginButton?.addEventListener("click", completeLoginManual);
checkAuthStatusButton?.addEventListener("click", requestAuthStatus);
logoutButton?.addEventListener("click", logout);

initialSyncButton?.addEventListener("click", initialSync);
deltaSyncButton?.addEventListener("click", deltaSync);

listMessagesButton?.addEventListener("click", listMessages);
listThreadsButton?.addEventListener("click", listThreads);
messageSelect?.addEventListener("change", fillMessageInputsFromSelection);
threadSelect?.addEventListener("change", fillThreadInputFromSelection);

getMessageButton?.addEventListener("click", getMessage);
getThreadButton?.addEventListener("click", getThread);

listAttachmentsButton?.addEventListener("click", listAttachments);
attachmentSelect?.addEventListener("change", fillAttachmentInputsFromSelection);
downloadAttachmentButton?.addEventListener("click", downloadAttachment);

autosyncStartButton?.addEventListener("click", startAutoSyncLoop);
autosyncStopButton?.addEventListener("click", stopAutoSyncLoop);

autopilotSetModeButton?.addEventListener("click", setAutopilotMode);
autopilotStatusButton?.addEventListener("click", refreshAutopilotStatus);
autopilotTickButton?.addEventListener("click", runAutopilotTick);
autopilotPauseButton?.addEventListener("click", pauseAutopilot);
autopilotResumeButton?.addEventListener("click", resumeAutopilot);

systemHealthButton?.addEventListener("click", getSystemHealth);
resetSessionButton?.addEventListener("click", () => resetSession(false));
resetSessionFullButton?.addEventListener("click", () => resetSession(true));

createEvidenceButton?.addEventListener("click", createEvidence);
upsertTodoButton?.addEventListener("click", upsertTodo);
workflowListButton?.addEventListener("click", listWorkflow);

requestAuthStatus().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	setAuthStatus(`Auth status error: ${message}`);
});

refreshAutopilotStatus().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	setAutopilotStatusText(`Autopilot error: ${message}`);
});
