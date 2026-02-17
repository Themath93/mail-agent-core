const loadedAt = document.getElementById("loaded-at");
const authStatus = document.getElementById("auth-status");
const checkAuthStatusButton = document.getElementById("check-auth-status");
const HOST_NAME = "com.themath93.mail_agent_core.host";

if (loadedAt) {
	loadedAt.textContent = `Loaded at: ${new Date().toLocaleString()}`;
}

const setAuthStatus = (value) => {
	if (!authStatus) {
		return;
	}
	authStatus.textContent = value;
};

const requestAuthStatus = () => {
	chrome.runtime.sendNativeMessage(
		HOST_NAME,
		{ action: "auth_status" },
		(response) => {
			if (chrome.runtime.lastError) {
				setAuthStatus(`Auth status error: ${chrome.runtime.lastError.message}`);
				return;
			}

			if (!response || response.ok !== true || !response.data) {
				setAuthStatus("Auth status error: invalid host response");
				return;
			}

			const account = response.data.account;
			const email =
				account && typeof account.email === "string" ? account.email : "-";
			setAuthStatus(
				`Auth status: signed_in=${Boolean(response.data.signed_in)} email=${email}`,
			);
		},
	);
};

if (checkAuthStatusButton) {
	checkAuthStatusButton.addEventListener("click", requestAuthStatus);
}
