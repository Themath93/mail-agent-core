#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const [, , stateFilePath, redirectUriRaw, expectedState] = process.argv;

if (
	typeof stateFilePath !== "string" ||
	typeof redirectUriRaw !== "string" ||
	typeof expectedState !== "string"
) {
	process.exit(1);
}

const redirectUri = new URL(redirectUriRaw);
const listenPort = Number(redirectUri.port || "80");
const listenHost = redirectUri.hostname;
const callbackPath = redirectUri.pathname;

const readState = () => {
	try {
		return JSON.parse(readFileSync(stateFilePath, "utf8"));
	} catch {
		return {
			signed_in: false,
			account: null,
			issued_session: null,
			auth_token: null,
			pending_callback: null,
			mailbox: {
				messages: {},
				thread_messages: {},
				delta_links: {},
				attachments: {},
			},
			logs: [],
		};
	}
};

const writeState = (state) => {
	writeFileSync(stateFilePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

const responseHtml = (title, message) =>
	`<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title></head><body><h1>${title}</h1><p>${message}</p><script>window.close && window.close();</script></body></html>`;

const server = createServer((req, res) => {
	try {
		const reqUrl = new URL(req.url ?? "/", redirectUri.origin);
		if (reqUrl.pathname !== callbackPath) {
			res.statusCode = 404;
			res.end("not found");
			return;
		}

		const code = reqUrl.searchParams.get("code") ?? "";
		const stateValue = reqUrl.searchParams.get("state") ?? "";

		if (code.length === 0 || stateValue.length === 0) {
			res.statusCode = 400;
			res.setHeader("Content-Type", "text/html; charset=utf-8");
			res.end(responseHtml("Login Failed", "code/state 가 누락되었습니다."));
			setTimeout(() => server.close(() => process.exit(0)), 10);
			return;
		}

		if (stateValue !== expectedState) {
			res.statusCode = 400;
			res.setHeader("Content-Type", "text/html; charset=utf-8");
			res.end(responseHtml("Login Failed", "state 값이 일치하지 않습니다."));
			setTimeout(() => server.close(() => process.exit(0)), 10);
			return;
		}

		const current = readState();
		current.pending_callback = {
			code,
			state: stateValue,
			received_at: new Date().toISOString(),
		};
		writeState(current);

		res.statusCode = 200;
		res.setHeader("Content-Type", "text/html; charset=utf-8");
		res.end(
			responseHtml(
				"Login Received",
				"브라우저 창을 닫고 확장 프로그램으로 돌아가세요.",
			),
		);
		setTimeout(() => server.close(() => process.exit(0)), 10);
	} catch {
		res.statusCode = 500;
		res.end("error");
		setTimeout(() => server.close(() => process.exit(1)), 10);
	}
});

server.listen(listenPort, listenHost);

setTimeout(
	() => {
		server.close(() => process.exit(0));
	},
	5 * 60 * 1000,
);
