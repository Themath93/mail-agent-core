#!/usr/bin/env node

import { readFileSync } from "node:fs";

const statePath = new URL("./state.json", import.meta.url);

const readState = () => {
	try {
		const raw = readFileSync(statePath, "utf8");
		const parsed = JSON.parse(raw);
		return {
			signed_in: Boolean(parsed?.signed_in),
			account:
				parsed?.account && typeof parsed.account.email === "string"
					? {
							email: parsed.account.email,
							tenant:
								typeof parsed.account.tenant === "string"
									? parsed.account.tenant
									: "default",
						}
					: null,
		};
	} catch {
		return {
			signed_in: false,
			account: null,
		};
	}
};

const readMessage = () => {
	const header = process.stdin.read(4);
	if (!header) {
		return null;
	}

	const length = header.readUInt32LE(0);
	const body = process.stdin.read(length);
	if (!body) {
		return null;
	}

	try {
		return JSON.parse(body.toString("utf8"));
	} catch {
		return null;
	}
};

const sendMessage = (message) => {
	const payload = Buffer.from(JSON.stringify(message), "utf8");
	const header = Buffer.alloc(4);
	header.writeUInt32LE(payload.length, 0);
	process.stdout.write(Buffer.concat([header, payload]));
};

process.stdin.on("readable", () => {
	while (true) {
		const message = readMessage();
		if (!message) {
			break;
		}

		if (message.action === "auth_status") {
			sendMessage({ ok: true, data: readState() });
			continue;
		}

		sendMessage({
			ok: false,
			error_code: "E_UNKNOWN",
			error_message: "unsupported action",
			retryable: false,
		});
	}
});
