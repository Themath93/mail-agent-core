import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

type VersionedJson = {
	version?: unknown;
};

const readJson = (path: string): VersionedJson => {
	const source = readFileSync(path, "utf8");
	return JSON.parse(source) as VersionedJson;
};

describe("version sync contract", () => {
	test("package.json 버전과 extension manifest 버전이 일치한다", () => {
		const packageJson = readJson("package.json");
		const manifestJson = readJson("extension/manifest.json");

		expect(packageJson.version).toBe(manifestJson.version);
	});

	test("버전 문자열은 semver 3자리 형식이다", () => {
		const packageJson = readJson("package.json");
		const manifestJson = readJson("extension/manifest.json");

		expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
		expect(manifestJson.version).toMatch(/^\d+\.\d+\.\d+$/);
	});
});
