chrome.runtime.onInstalled.addListener(async () => {
	if (!chrome.sidePanel?.setPanelBehavior) {
		return;
	}

	try {
		await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
	} catch {}
});
