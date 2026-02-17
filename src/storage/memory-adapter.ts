import type { StorageAdapter } from "./interface.js";

export class MemoryStorageAdapter implements StorageAdapter {
	private storage = new Map<string, unknown>();

	get<T>(key: string): T | undefined {
		return this.storage.get(key) as T | undefined;
	}

	set<T>(key: string, value: T): void {
		this.storage.set(key, value);
	}

	delete(key: string): void {
		this.storage.delete(key);
	}

	list(): string[] {
		return Array.from(this.storage.keys());
	}

	clear(): void {
		this.storage.clear();
	}
}

export function createMemoryStorage(): MemoryStorageAdapter {
	return new MemoryStorageAdapter();
}
