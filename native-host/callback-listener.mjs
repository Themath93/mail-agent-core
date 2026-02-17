#!/usr/bin/env node

import {
	closeSync,
	fsyncSync,
	openSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
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
	const nextState = `${JSON.stringify(state, null, 2)}\n`;
	const fd = openSync(stateFilePath, "w");
	try {
		writeFileSync(fd, nextState, "utf8");
		fsyncSync(fd);
	} finally {
		closeSync(fd);
	}
};

const responseHtml = (title, message) =>
	`<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title></head><body><h1>${title}</h1><p>${message}</p><p>자동으로 닫히지 않으면 이 창을 직접 닫아 주세요.</p><button type="button" onclick="window.close()">Close</button></body></html>`;

let serverClosed = false;

const closeServerAndExit = (exitCode, delayMs = 20) => {
	if (serverClosed) {
		return;
	}
	serverClosed = true;
	const shutdown = () => {
		server.close(() => process.exit(exitCode));
	};
	if (delayMs <= 0) {
		shutdown();
		return;
	}
	setTimeout(shutdown, delayMs);
};

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
			closeServerAndExit(0);
			return;
		}

		if (stateValue !== expectedState) {
			res.statusCode = 400;
			res.setHeader("Content-Type", "text/html; charset=utf-8");
			res.end(responseHtml("Login Failed", "state 값이 일치하지 않습니다."));
			closeServerAndExit(0);
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
		closeServerAndExit(0);
	} catch {
		res.statusCode = 500;
		res.end("error");
		closeServerAndExit(1);
	}
});

server.listen(listenPort, listenHost);

setTimeout(
	() => {
		closeServerAndExit(0, 0);
	},
	5 * 60 * 1000,
);
