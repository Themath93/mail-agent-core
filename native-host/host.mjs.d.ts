export declare const __hostTestables: {
	buildCodexCliSpawnArgs: (args: string[]) => string[];
	runCodexCliAdapter: (
		args: {
			executable?: string;
			args?: string[];
			timeout_ms?: number;
			cwd?: string;
			env?: NodeJS.ProcessEnv;
		},
		deps?: {
			spawnFn?: (
				command: string,
				argv: string[],
				options: Record<string, unknown>,
			) => unknown;
			nowFn?: () => number;
			setTimeoutFn?: typeof setTimeout;
			clearTimeoutFn?: typeof clearTimeout;
			killFn?: (pid: number, signal: NodeJS.Signals | number) => void;
			platform?: NodeJS.Platform;
		},
	) => Promise<{
		ok: boolean;
		exit_code: number;
		duration_ms: number;
		stdout: string;
		stderr: string;
		failure_kind:
			| "timeout_retriable"
			| "exit_non_zero"
			| "spawn_error"
			| "signal_terminated"
			| null;
	}>;
};
