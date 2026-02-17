const loadedAt = document.getElementById("loaded-at");

if (loadedAt) {
	loadedAt.textContent = `Loaded at: ${new Date().toLocaleString()}`;
}
