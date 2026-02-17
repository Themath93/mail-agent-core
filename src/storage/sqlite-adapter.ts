import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { Database } from "bun:sqlite";

import type { StorageAdapter } from "./interface.js";

export class SQLiteStorageAdapter implements StorageAdapter {
	private db: Database;

	constructor(dbPath = "./data/mcp-state.sqlite") {
		const dir = dirname(dbPath);
		if (dir !== ".") {
			mkdirSync(dir, { recursive: true });
		}

		this.db = new Database(dbPath);
		this.initTables();
	}

	private initTables(): void {
		this.db.run(`
			CREATE TABLE IF NOT EXISTS storage (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`);
	}

	get<T>(key: string): T | undefined {
		const stmt = this.db.query("SELECT value FROM storage WHERE key = ?");
		const row = stmt.get(key) as { value: string } | undefined;

		if (!row || typeof row.value !== "string") {
			return undefined;
		}

		try {
			return JSON.parse(row.value) as T;
		} catch {
			return undefined;
		}
	}

	set<T>(key: string, value: T): void {
		const serialized = JSON.stringify(value);
		const stmt = this.db.query(`
			INSERT INTO storage (key, value) 
			VALUES (?, ?) 
			ON CONFLICT(key) DO UPDATE SET 
				value = excluded.value,
				updated_at = CURRENT_TIMESTAMP
		`);
		stmt.run(key, serialized);
	}

	delete(key: string): void {
		const stmt = this.db.query("DELETE FROM storage WHERE key = ?");
		stmt.run(key);
	}

	list(): string[] {
		const stmt = this.db.query("SELECT key FROM storage ORDER BY key");
		const rows = stmt.all() as { key: string }[];
		return rows.map((r) => r.key);
	}

	close(): void {
		this.db.close();
	}
}

export function createSQLiteStorage(dbPath?: string): SQLiteStorageAdapter {
	return new SQLiteStorageAdapter(dbPath);
}
