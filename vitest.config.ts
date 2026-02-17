import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary"],
			reportsDirectory: "coverage",
			exclude: ["extension/**", "native-host/**"],
			thresholds: {
				lines: 85,
				functions: 85,
				branches: 85,
				statements: 85,
			},
		},
	},
});
