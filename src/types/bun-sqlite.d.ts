declare module "bun:sqlite" {
	export interface SQLiteStatement {
		get(...params: unknown[]): unknown;
		all(...params: unknown[]): unknown[];
		run(...params: unknown[]): {
			changes: number;
			lastInsertRowid: number | bigint;
		};
	}

	export class Database {
		constructor(
			filename?: string,
			options?: {
				readonly?: boolean;
				create?: boolean;
				readwrite?: boolean;
				strict?: boolean;
				safeIntegers?: boolean;
			},
		);
		query(sql: string): SQLiteStatement;
		run(sql: string): void;
		close(): void;
	}
}
