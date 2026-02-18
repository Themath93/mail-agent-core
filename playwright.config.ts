import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "**/*.e2e.ts",
	fullyParallel: false,
	retries: 0,
	reporter: "line",
	use: {
		headless: true,
	},
});
