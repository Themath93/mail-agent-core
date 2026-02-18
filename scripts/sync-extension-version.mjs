import { readFile, writeFile } from "node:fs/promises";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

const main = async () => {
	const packageJsonSource = await readFile("package.json", "utf8");
	const manifestSource = await readFile("extension/manifest.json", "utf8");

	const packageJson = JSON.parse(packageJsonSource);
	const manifestJson = JSON.parse(manifestSource);

	const packageVersion = packageJson.version;
	if (!SEMVER_PATTERN.test(String(packageVersion))) {
		throw new Error(
			`package.json version must be semver (x.y.z). Received: ${packageVersion}`,
		);
	}

	manifestJson.version = packageVersion;

	await writeFile(
		"extension/manifest.json",
		`${JSON.stringify(manifestJson, null, "\t")}\n`,
		"utf8",
	);

	console.log(`[version:sync] extension/manifest.json -> ${packageVersion}`);
};

main().catch((error) => {
	console.error(`[version:sync] FAILED: ${error.message}`);
	process.exit(1);
});
