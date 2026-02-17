const loadedAt = document.getElementById("loaded-at");
const authStatus = document.getElementById("auth-status");
const loginUrlText = document.getElementById("login-url");
const startLoginButton = document.getElementById("start-login");
const completeLoginButton = document.getElementById("complete-login");
const checkAuthStatusButton = document.getElementById("check-auth-status");
const authCodeInput = document.getElementById("auth-code");
const HOST_NAME = "com.themath93.mail_agent_core.host";
const STORAGE_KEYS = {
	state: "pending_login_state",
	codeVerifier: "pending_login_code_verifier",
};

if (loadedAt) {
	loadedAt.textContent = `Loaded at: ${new Date().toLocaleString()}`;
}

const setAuthStatus = (value) => {
	if (!authStatus) {
		return;
	}
	authStatus.textContent = value;
};

const setLoginUrlText = (value) => {
	if (!loginUrlText) {
		return;
	}
	loginUrlText.textContent = value;
};

const sendNativeMessage = (action, payload, onSuccess) => {
	chrome.runtime.sendNativeMessage(
		HOST_NAME,
		{ action, ...payload },
		(response) => {
			if (chrome.runtime.lastError) {
				setAuthStatus(`Auth status error: ${chrome.runtime.lastError.message}`);
				return;
			}

			if (!response || response.ok !== true || !response.data) {
				if (response && response.ok === false && response.error_message) {
					setAuthStatus(`Auth status error: ${response.error_message}`);
					return;
				}
				setAuthStatus("Auth status error: invalid host response");
				return;
			}

			onSuccess(response.data);
		},
	);
};

const requestAuthStatus = () => {
	sendNativeMessage("auth_store.auth_status", {}, (data) => {
		const account = data.account;
		const email =
			account && typeof account.email === "string" ? account.email : "-";
		setAuthStatus(
			`Auth status: signed_in=${Boolean(data.signed_in)} email=${email}`,
		);
	});
};

const startLogin = () => {
	startLoginButton?.setAttribute("disabled", "disabled");
	sendNativeMessage(
		"auth_store.start_login",
		{
			scopes: ["Mail.Read", "User.Read", "offline_access", "openid", "profile"],
		},
		(data) => {
			chrome.storage.local.set({
				[STORAGE_KEYS.state]: data.state,
				[STORAGE_KEYS.codeVerifier]: data.code_verifier,
			});

			setLoginUrlText(`Login URL: ${data.login_url}`);
			setAuthStatus("Auth status: 로그인 URL을 열었고 code 입력을 기다리는 중");
			window.open(data.login_url, "_blank", "noopener,noreferrer");
		},
	);
	startLoginButton?.removeAttribute("disabled");
};

const completeLogin = () => {
	const code =
		typeof authCodeInput?.value === "string" ? authCodeInput.value.trim() : "";
	if (code.length === 0) {
		setAuthStatus("Auth status error: code를 입력하세요.");
		return;
	}

	chrome.storage.local.get(
		[STORAGE_KEYS.state, STORAGE_KEYS.codeVerifier],
		(result) => {
			const state = result[STORAGE_KEYS.state];
			const codeVerifier = result[STORAGE_KEYS.codeVerifier];

			if (typeof state !== "string" || typeof codeVerifier !== "string") {
				setAuthStatus("Auth status error: start_login을 먼저 실행하세요.");
				return;
			}

			sendNativeMessage(
				"auth_store.complete_login",
				{ code, state, code_verifier: codeVerifier },
				(data) => {
					const account = data.account;
					const email =
						account && typeof account.email === "string" ? account.email : "-";
					setAuthStatus(`Auth status: signed_in=true email=${email}`);
					chrome.storage.local.remove([
						STORAGE_KEYS.state,
						STORAGE_KEYS.codeVerifier,
					]);
					if (authCodeInput) {
						authCodeInput.value = "";
					}
				},
			);
		},
	);
};

startLoginButton?.addEventListener("click", startLogin);
completeLoginButton?.addEventListener("click", completeLogin);
checkAuthStatusButton?.addEventListener("click", requestAuthStatus);
