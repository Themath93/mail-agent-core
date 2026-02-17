const loadedAt = document.getElementById("loaded-at");
const authStatus = document.getElementById("auth-status");
const loginUrlText = document.getElementById("login-url");
const resultView = document.getElementById("result");

const startLoginButton = document.getElementById("start-login");
const completeLoginButton = document.getElementById("complete-login");
const checkAuthStatusButton = document.getElementById("check-auth-status");
const logoutButton = document.getElementById("logout");
const authCodeInput = document.getElementById("auth-code");

const initialSyncButton = document.getElementById("initial-sync");
const deltaSyncButton = document.getElementById("delta-sync");
const syncFolderInput = document.getElementById("sync-folder");
const syncDaysInput = document.getElementById("sync-days");

const getMessageButton = document.getElementById("get-message");
const getThreadButton = document.getElementById("get-thread");
const messageIdInput = document.getElementById("message-id");
const threadIdInput = document.getElementById("thread-id");
const threadDepthInput = document.getElementById("thread-depth");

const downloadAttachmentButton = document.getElementById("download-attachment");
const attachmentMessageIdInput = document.getElementById(
	"attachment-message-id",
);
const attachmentIdInput = document.getElementById("attachment-id");
const attachmentMessagePkInput = document.getElementById(
	"attachment-message-pk",
);

const HOST_NAME = "com.themath93.mail_agent_core.host";
const STORAGE_KEYS = {
	state: "pending_login_state",
	codeVerifier: "pending_login_code_verifier",
};

let autoCompleteTimer = null;

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
	} catch {}

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
		clearInterval(autoCompleteTimer);
		autoCompleteTimer = null;
	}
};

const runCompleteFromCallback = async () => {
	try {
		const response = await sendNativeMessage(
			"auth_store.complete_login_auto",
			{},
		);
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
		if (message.includes("자동 완료 대기 중인 callback code가 없습니다")) {
			return;
		}
		stopAutoCompleteLoop();
		setAuthStatus(`Auth status error: ${message}`);
	}
};

const startAutoCompleteLoop = () => {
	stopAutoCompleteLoop();
	autoCompleteTimer = setInterval(runCompleteFromCallback, 1000);
};

const requestAuthStatus = async () => {
	try {
		const response = await sendNativeMessage("auth_store.auth_status", {});
		const data = handleMcpResponse(response);
		const email = data?.account?.email ? data.account.email : "-";
		setAuthStatus(
			`Auth status: signed_in=${Boolean(data?.signed_in)} email=${email}`,
		);
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
			"Auth status: 로그인 URL을 열었고 callback 자동완료를 대기 중",
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
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		setAuthStatus(`Attachment error: ${message}`);
	}
};

startLoginButton?.addEventListener("click", startLogin);
completeLoginButton?.addEventListener("click", completeLoginManual);
checkAuthStatusButton?.addEventListener("click", requestAuthStatus);
logoutButton?.addEventListener("click", logout);
initialSyncButton?.addEventListener("click", initialSync);
deltaSyncButton?.addEventListener("click", deltaSync);
getMessageButton?.addEventListener("click", getMessage);
getThreadButton?.addEventListener("click", getThread);
downloadAttachmentButton?.addEventListener("click", downloadAttachment);
