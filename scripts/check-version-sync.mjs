import { readFile } from "node:fs/promises";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

const readJson = async (path) => {
	const source = await readFile(path, "utf8");
	return JSON.parse(source);
};

const normalizeTag = (rawTag) => {
	if (!rawTag) {
		return null;
	}

	return rawTag.replace(/^refs\/tags\//, "");
};

const main = async () => {
	const packageJson = await readJson("package.json");
	const manifestJson = await readJson("extension/manifest.json");

	const packageVersion = packageJson.version;
	const extensionVersion = manifestJson.version;

	if (!SEMVER_PATTERN.test(String(packageVersion))) {
		throw new Error(
			`package.json version must be semver (x.y.z). Received: ${packageVersion}`,
		);
	}

	if (!SEMVER_PATTERN.test(String(extensionVersion))) {
		throw new Error(
			`extension/manifest.json version must be semver (x.y.z). Received: ${extensionVersion}`,
		);
	}

	if (packageVersion !== extensionVersion) {
		throw new Error(
			`Version mismatch: package.json(${packageVersion}) != extension/manifest.json(${extensionVersion}). Run: bun run version:sync`,
		);
	}

	const releaseTag = normalizeTag(process.env.RELEASE_TAG);
	if (releaseTag) {
		const expectedTag = `v${packageVersion}`;
		if (releaseTag !== expectedTag) {
			throw new Error(
				`Release tag mismatch: RELEASE_TAG(${releaseTag}) != ${expectedTag}`,
			);
		}
	}

	console.log(
		`[version:check] OK package=${packageVersion} extension=${extensionVersion}${releaseTag ? ` tag=${releaseTag}` : ""}`,
	);
};

main().catch((error) => {
	console.error(`[version:check] FAILED: ${error.message}`);
	process.exit(1);
});
