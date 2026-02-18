export const DASHBOARD_CONTRACT_TOOL_NAMES = [
	"dashboard.get_overview",
	"search.query",
	"timeline.list",
] as const;

export type DashboardContractToolName =
	(typeof DASHBOARD_CONTRACT_TOOL_NAMES)[number];

export const DASHBOARD_OVERVIEW_KPI_KEYS = [
	"today_mail_count",
	"today_todo_count",
	"progress_status",
	"weekly_completed_count",
	"top_counterparties",
] as const;

export type DashboardOverviewKpiKey =
	(typeof DASHBOARD_OVERVIEW_KPI_KEYS)[number];

export const DASHBOARD_DATE_WINDOWS = [
	"today",
	"current_week",
	"last_7_days",
] as const;

export const TODO_STATUS_VALUES = ["open", "in_progress", "done"] as const;

export const SEARCH_QUERY_SCOPE_VALUES = [
	"all",
	"mail",
	"attachment",
	"work_item",
	"timeline_event",
] as const;

export const SEARCH_QUERY_SORT_VALUES = [
	"relevance",
	"newest",
	"oldest",
] as const;

export const SEARCH_RESULT_SOURCE_TYPE_VALUES = [
	"mail",
	"attachment",
	"work_item",
	"timeline_event",
] as const;

export const SEARCH_RESULT_ACTION_VALUES = [
	"open_source",
	"jump_evidence",
	"open_timeline",
] as const;

export const EVIDENCE_SOURCE_KIND_VALUES = ["email", "attachment"] as const;

export const EVIDENCE_LOCATOR_TYPE_VALUES = [
	"outlook_quote",
	"pdf",
	"pptx",
	"docx",
	"xlsx",
	"image",
] as const;

export const TIMELINE_EVENT_TYPE_VALUES = [
	"message_synced",
	"attachment_synced",
	"evidence_created",
	"todo_created",
	"todo_updated",
	"status_changed",
	"deep_link_opened",
] as const;

export const TIMELINE_SOURCE_TOOL_VALUES = [
	"graph_mail_sync.initial_sync",
	"graph_mail_sync.delta_sync",
	"graph_mail_sync.download_attachment",
	"workflow.create_evidence",
	"workflow.upsert_todo",
	"mail_store.get_message",
	"mail_store.get_thread",
	"dashboard.get_overview",
	"search.query",
	"timeline.list",
] as const;

export const DASHBOARD_DRILLDOWN_TARGET_TOOL_VALUES = [
	"search.query",
	"timeline.list",
] as const;

export const DASHBOARD_DRILLDOWN_BINDING_TOKEN_VALUES = [
	"counterparty_id",
	"kpi_date",
] as const;

export type DashboardDateWindow = (typeof DASHBOARD_DATE_WINDOWS)[number];
export type TodoStatus = (typeof TODO_STATUS_VALUES)[number];
export type SearchQueryScope = (typeof SEARCH_QUERY_SCOPE_VALUES)[number];
export type SearchQuerySort = (typeof SEARCH_QUERY_SORT_VALUES)[number];
export type SearchResultSourceType =
	(typeof SEARCH_RESULT_SOURCE_TYPE_VALUES)[number];
export type SearchResultAction = (typeof SEARCH_RESULT_ACTION_VALUES)[number];
export type EvidenceSourceKind = (typeof EVIDENCE_SOURCE_KIND_VALUES)[number];
export type EvidenceLocatorType = (typeof EVIDENCE_LOCATOR_TYPE_VALUES)[number];
export type TimelineEventType = (typeof TIMELINE_EVENT_TYPE_VALUES)[number];
export type TimelineSourceTool = (typeof TIMELINE_SOURCE_TOOL_VALUES)[number];
export type DashboardDrilldownTargetTool =
	(typeof DASHBOARD_DRILLDOWN_TARGET_TOOL_VALUES)[number];
export type DashboardDrilldownBindingToken =
	(typeof DASHBOARD_DRILLDOWN_BINDING_TOKEN_VALUES)[number];

export interface DashboardContractValidationError {
	path: string;
	message: string;
}

export type DashboardContractValidationResult<TValue> =
	| { ok: true; value: TValue }
	| { ok: false; errors: DashboardContractValidationError[] };

export interface DashboardDrilldownBinding {
	token: DashboardDrilldownBindingToken;
	target_field: "counterparty_ids" | "entity_id" | "from" | "to" | "query";
}

export interface DashboardEvidenceJumpLocator {
	type: EvidenceLocatorType;
	page?: number;
	slide?: number;
	sheet?: string;
	range?: string;
	paragraph_index?: number;
	bbox?: [number, number, number, number];
	text_quote?: string;
	text_hash?: string;
	anchor?: string;
}

export interface EvidenceJumpReference {
	evidence_id: string;
	source_kind: EvidenceSourceKind;
	source_id: string;
	thread_id?: string;
	locator: DashboardEvidenceJumpLocator;
	web_link?: string;
}

export interface SearchQueryFilters {
	date_window?: DashboardDateWindow;
	statuses?: readonly TodoStatus[];
	counterparty_ids?: readonly string[];
	event_types?: readonly TimelineEventType[];
	source_tools?: readonly TimelineSourceTool[];
	has_evidence?: boolean;
	from?: string;
	to?: string;
}

export interface SearchQueryInput {
	query: string;
	scope?: SearchQueryScope;
	filters?: SearchQueryFilters;
	sort?: SearchQuerySort;
	limit?: number;
	cursor?: string;
}

export interface SearchQueryResultItem {
	result_id: string;
	source_type: SearchResultSourceType;
	source_id: string;
	thread_id?: string;
	title: string;
	snippet: string;
	score: number;
	occurred_at: string;
	evidence_locators: readonly EvidenceJumpReference[];
	available_actions: readonly SearchResultAction[];
}

export interface SearchQueryOutput {
	items: readonly SearchQueryResultItem[];
	next_cursor?: string;
	total_estimate?: number;
}

export interface TimelineListInput {
	entity_id?: string;
	event_types?: readonly TimelineEventType[];
	source_tools?: readonly TimelineSourceTool[];
	from?: string;
	to?: string;
	limit?: number;
	cursor?: string;
	include_payload?: boolean;
}

export interface TimelineEvent {
	event_id: string;
	event_type: TimelineEventType;
	source_tool: TimelineSourceTool;
	entity_id: string;
	at: string;
	payload: Record<string, unknown>;
}

export interface TimelineListOutput {
	events: readonly TimelineEvent[];
	next_cursor?: string;
}

export interface DashboardOverviewProgressStatus {
	open_count: number;
	in_progress_count: number;
	done_count: number;
	completion_rate: number;
}

export interface DashboardTopCounterparty {
	contact_id: string;
	display_name: string;
	message_count: number;
	todo_count: number;
	last_interaction_at?: string;
}

export interface DashboardOverviewKpis {
	today_mail_count: number;
	today_todo_count: number;
	progress_status: DashboardOverviewProgressStatus;
	weekly_completed_count: number;
	top_counterparties: readonly DashboardTopCounterparty[];
}

export interface DashboardDrilldownPayload {
	query?: string;
	entity_id?: string;
	scope?: SearchQueryScope;
	date_window?: DashboardDateWindow;
	statuses?: readonly TodoStatus[];
	counterparty_ids?: readonly string[];
	event_types?: readonly TimelineEventType[];
	source_tools?: readonly TimelineSourceTool[];
	has_evidence?: boolean;
	from?: string;
	to?: string;
	limit?: number;
	bindings?: readonly DashboardDrilldownBinding[];
}

export interface DashboardKpiDrilldownTarget {
	target_tool: DashboardDrilldownTargetTool;
	payload: DashboardDrilldownPayload;
}

export type DashboardKpiDrilldowns = Record<
	DashboardOverviewKpiKey,
	DashboardKpiDrilldownTarget
>;

export interface DashboardGetOverviewInput {
	date?: string;
	timezone?: string;
	top_counterparties_limit?: number;
	include_drilldowns?: boolean;
}

export interface DashboardGetOverviewOutput {
	generated_at: string;
	range: {
		date: string;
		week_start: string;
		week_end: string;
		timezone: string;
	};
	kpis: DashboardOverviewKpis;
	drilldowns: DashboardKpiDrilldowns;
}

export const DASHBOARD_KPI_DRILLDOWN_DEFAULTS: DashboardKpiDrilldowns = {
	today_mail_count: {
		target_tool: "search.query",
		payload: {
			date_window: "today",
			limit: 50,
		},
	},
	today_todo_count: {
		target_tool: "search.query",
		payload: {
			scope: "work_item",
			date_window: "today",
			limit: 50,
		},
	},
	progress_status: {
		target_tool: "timeline.list",
		payload: {
			date_window: "today",
			event_types: ["status_changed"],
			limit: 100,
		},
	},
	weekly_completed_count: {
		target_tool: "search.query",
		payload: {
			scope: "work_item",
			date_window: "current_week",
			statuses: ["done"],
			limit: 50,
		},
	},
	top_counterparties: {
		target_tool: "search.query",
		payload: {
			scope: "all",
			date_window: "last_7_days",
			limit: 100,
			bindings: [
				{ token: "counterparty_id", target_field: "counterparty_ids" },
			],
		},
	},
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === "string" && value.trim().length > 0;

const isIsoDateTime = (value: unknown): boolean =>
	typeof value === "string" && Number.isFinite(Date.parse(value));

const isPositiveInteger = (value: unknown): boolean =>
	typeof value === "number" && Number.isInteger(value) && value > 0;

const isNonNegativeInteger = (value: unknown): boolean =>
	typeof value === "number" && Number.isInteger(value) && value >= 0;

const hasKeys = (
	value: Record<string, unknown>,
	keys: readonly string[],
): boolean => keys.every((key) => key in value);

const fail = <TValue>(
	path: string,
	message: string,
): DashboardContractValidationResult<TValue> => ({
	ok: false,
	errors: [{ path, message }],
});

const oneOf = <TValue extends string>(
	value: unknown,
	allowed: readonly TValue[],
): value is TValue =>
	typeof value === "string" && (allowed as readonly string[]).includes(value);

const validateLocator = (
	locator: unknown,
): DashboardContractValidationResult<DashboardEvidenceJumpLocator> => {
	if (
		!isRecord(locator) ||
		!oneOf(locator.type, EVIDENCE_LOCATOR_TYPE_VALUES)
	) {
		return fail("locator", "locator.type 은 허용된 값이어야 합니다.");
	}

	if (locator.type === "xlsx") {
		if (!isNonEmptyString(locator.sheet)) {
			return fail("locator.sheet", "xlsx locator 는 sheet 가 필요합니다.");
		}
		if (!isNonEmptyString(locator.range)) {
			return fail("locator.range", "xlsx locator 는 range 가 필요합니다.");
		}
	}

	if (locator.type === "pdf" && !isPositiveInteger(locator.page)) {
		return fail("locator.page", "pdf locator 는 page 가 필요합니다.");
	}

	if (
		locator.type === "outlook_quote" &&
		!isNonEmptyString(locator.text_quote)
	) {
		return fail(
			"locator.text_quote",
			"outlook_quote locator 는 text_quote 가 필요합니다.",
		);
	}

	return {
		ok: true,
		value: locator as unknown as DashboardEvidenceJumpLocator,
	};
};

export const parseDashboardGetOverviewInput = (
	raw: unknown,
): DashboardContractValidationResult<DashboardGetOverviewInput> => {
	if (!isRecord(raw)) {
		return fail("root", "input 은 객체여야 합니다.");
	}

	if (
		raw.top_counterparties_limit !== undefined &&
		!isPositiveInteger(raw.top_counterparties_limit)
	) {
		return fail(
			"top_counterparties_limit",
			"top_counterparties_limit 는 양의 정수여야 합니다.",
		);
	}

	if (
		raw.include_drilldowns !== undefined &&
		typeof raw.include_drilldowns !== "boolean"
	) {
		return fail(
			"include_drilldowns",
			"include_drilldowns 는 boolean 이어야 합니다.",
		);
	}

	if (raw.date !== undefined && !isNonEmptyString(raw.date)) {
		return fail("date", "date 는 빈 값일 수 없습니다.");
	}

	if (raw.timezone !== undefined && !isNonEmptyString(raw.timezone)) {
		return fail("timezone", "timezone 은 빈 값일 수 없습니다.");
	}

	return { ok: true, value: raw as unknown as DashboardGetOverviewInput };
};

export const parseDashboardGetOverviewOutput = (
	raw: unknown,
): DashboardContractValidationResult<DashboardGetOverviewOutput> => {
	if (
		!isRecord(raw) ||
		!isRecord(raw.range) ||
		!isRecord(raw.kpis) ||
		!isRecord(raw.drilldowns)
	) {
		return fail(
			"root",
			"output 은 range/kpis/drilldowns 를 포함한 객체여야 합니다.",
		);
	}

	if (!isIsoDateTime(raw.generated_at)) {
		return fail("generated_at", "generated_at 은 ISO-8601 이어야 합니다.");
	}

	if (!hasKeys(raw.range, ["date", "week_start", "week_end", "timezone"])) {
		return fail(
			"range",
			"range 는 date/week_start/week_end/timezone 을 포함해야 합니다.",
		);
	}

	if (!hasKeys(raw.kpis, DASHBOARD_OVERVIEW_KPI_KEYS)) {
		return fail("kpis", "kpis 는 고정 KPI 키를 모두 포함해야 합니다.");
	}

	if (
		!isNonNegativeInteger(raw.kpis.today_mail_count) ||
		!isNonNegativeInteger(raw.kpis.today_todo_count) ||
		!isNonNegativeInteger(raw.kpis.weekly_completed_count)
	) {
		return fail("kpis", "count KPI 값은 0 이상의 정수여야 합니다.");
	}

	if (!isRecord(raw.kpis.progress_status)) {
		return fail("kpis.progress_status", "progress_status 는 객체여야 합니다.");
	}

	if (
		!hasKeys(raw.kpis.progress_status, [
			"open_count",
			"in_progress_count",
			"done_count",
			"completion_rate",
		])
	) {
		return fail(
			"kpis.progress_status",
			"progress_status 는 고정 필드를 모두 포함해야 합니다.",
		);
	}

	if (!Array.isArray(raw.kpis.top_counterparties)) {
		return fail(
			"kpis.top_counterparties",
			"top_counterparties 는 배열이어야 합니다.",
		);
	}

	for (const counterparty of raw.kpis.top_counterparties) {
		if (!isRecord(counterparty)) {
			return fail(
				"kpis.top_counterparties",
				"counterparty 항목은 객체여야 합니다.",
			);
		}
		if (
			!hasKeys(counterparty, [
				"contact_id",
				"display_name",
				"message_count",
				"todo_count",
			])
		) {
			return fail(
				"kpis.top_counterparties",
				"counterparty 항목은 고정 필드를 포함해야 합니다.",
			);
		}
	}

	if (!hasKeys(raw.drilldowns, DASHBOARD_OVERVIEW_KPI_KEYS)) {
		return fail(
			"drilldowns",
			"drilldowns 는 KPI별 매핑을 모두 포함해야 합니다.",
		);
	}

	for (const kpiKey of DASHBOARD_OVERVIEW_KPI_KEYS) {
		const drilldown = raw.drilldowns[kpiKey];
		if (
			!isRecord(drilldown) ||
			!oneOf(drilldown.target_tool, DASHBOARD_DRILLDOWN_TARGET_TOOL_VALUES)
		) {
			return fail(
				`drilldowns.${kpiKey}`,
				"drilldown.target_tool 은 search.query 또는 timeline.list 여야 합니다.",
			);
		}
		if (!isRecord(drilldown.payload)) {
			return fail(
				`drilldowns.${kpiKey}.payload`,
				"drilldown payload 는 객체여야 합니다.",
			);
		}
	}

	return { ok: true, value: raw as unknown as DashboardGetOverviewOutput };
};

export const parseSearchQueryInput = (
	raw: unknown,
): DashboardContractValidationResult<SearchQueryInput> => {
	if (!isRecord(raw) || !isNonEmptyString(raw.query)) {
		return fail("query", "query 는 빈 값일 수 없습니다.");
	}

	if (raw.scope !== undefined && !oneOf(raw.scope, SEARCH_QUERY_SCOPE_VALUES)) {
		return fail("scope", "scope 은 허용된 검색 범위여야 합니다.");
	}

	if (raw.sort !== undefined && !oneOf(raw.sort, SEARCH_QUERY_SORT_VALUES)) {
		return fail("sort", "sort 는 허용된 정렬 값이어야 합니다.");
	}

	if (raw.limit !== undefined && !isPositiveInteger(raw.limit)) {
		return fail("limit", "limit 은 양의 정수여야 합니다.");
	}

	if (raw.cursor !== undefined && !isNonEmptyString(raw.cursor)) {
		return fail("cursor", "cursor 는 빈 값일 수 없습니다.");
	}

	if (raw.filters !== undefined) {
		if (!isRecord(raw.filters)) {
			return fail("filters", "filters 는 객체여야 합니다.");
		}
		if (
			raw.filters.date_window !== undefined &&
			!oneOf(raw.filters.date_window, DASHBOARD_DATE_WINDOWS)
		) {
			return fail(
				"filters.date_window",
				"date_window 은 허용된 기간이어야 합니다.",
			);
		}
		if (
			raw.filters.has_evidence !== undefined &&
			typeof raw.filters.has_evidence !== "boolean"
		) {
			return fail(
				"filters.has_evidence",
				"has_evidence 는 boolean 이어야 합니다.",
			);
		}
	}

	return { ok: true, value: raw as unknown as SearchQueryInput };
};

export const parseSearchQueryOutput = (
	raw: unknown,
): DashboardContractValidationResult<SearchQueryOutput> => {
	if (!isRecord(raw) || !Array.isArray(raw.items)) {
		return fail(
			"items",
			"search.query output 은 items 배열을 포함해야 합니다.",
		);
	}

	for (const [index, item] of raw.items.entries()) {
		if (!isRecord(item)) {
			return fail(`items[${index}]`, "검색 결과 항목은 객체여야 합니다.");
		}
		if (
			!hasKeys(item, [
				"result_id",
				"source_type",
				"source_id",
				"title",
				"snippet",
				"score",
				"occurred_at",
				"evidence_locators",
				"available_actions",
			])
		) {
			return fail(`items[${index}]`, "검색 결과 항목 필드가 누락되었습니다.");
		}
		if (!Array.isArray(item.evidence_locators)) {
			return fail(
				`items[${index}].evidence_locators`,
				"evidence_locators 는 배열이어야 합니다.",
			);
		}

		for (const [locatorIndex, locatorRef] of item.evidence_locators.entries()) {
			if (!isRecord(locatorRef) || !isRecord(locatorRef.locator)) {
				return fail(
					`items[${index}].evidence_locators[${locatorIndex}]`,
					"evidence locator 참조는 locator 객체를 포함해야 합니다.",
				);
			}
			const locatorResult = validateLocator(locatorRef.locator);
			if (!locatorResult.ok) {
				return fail(
					`items[${index}].evidence_locators[${locatorIndex}].${locatorResult.errors[0]?.path ?? "locator"}`,
					locatorResult.errors[0]?.message ?? "잘못된 locator 입니다.",
				);
			}
		}
	}

	if (raw.next_cursor !== undefined && !isNonEmptyString(raw.next_cursor)) {
		return fail("next_cursor", "next_cursor 는 빈 값일 수 없습니다.");
	}

	if (
		raw.total_estimate !== undefined &&
		!isNonNegativeInteger(raw.total_estimate)
	) {
		return fail(
			"total_estimate",
			"total_estimate 는 0 이상의 정수여야 합니다.",
		);
	}

	return { ok: true, value: raw as unknown as SearchQueryOutput };
};

export const parseTimelineListInput = (
	raw: unknown,
): DashboardContractValidationResult<TimelineListInput> => {
	if (!isRecord(raw)) {
		return fail("root", "timeline.list input 은 객체여야 합니다.");
	}

	if (raw.entity_id !== undefined && !isNonEmptyString(raw.entity_id)) {
		return fail("entity_id", "entity_id 는 빈 값일 수 없습니다.");
	}

	if (raw.limit !== undefined && !isPositiveInteger(raw.limit)) {
		return fail("limit", "limit 은 양의 정수여야 합니다.");
	}

	if (raw.from !== undefined && !isIsoDateTime(raw.from)) {
		return fail("from", "from 은 ISO-8601 이어야 합니다.");
	}

	if (raw.to !== undefined && !isIsoDateTime(raw.to)) {
		return fail("to", "to 는 ISO-8601 이어야 합니다.");
	}

	if (raw.cursor !== undefined && !isNonEmptyString(raw.cursor)) {
		return fail("cursor", "cursor 는 빈 값일 수 없습니다.");
	}

	if (
		raw.include_payload !== undefined &&
		typeof raw.include_payload !== "boolean"
	) {
		return fail("include_payload", "include_payload 는 boolean 이어야 합니다.");
	}

	if (
		raw.event_types !== undefined &&
		(!Array.isArray(raw.event_types) ||
			!raw.event_types.every((value) =>
				oneOf(value, TIMELINE_EVENT_TYPE_VALUES),
			))
	) {
		return fail(
			"event_types",
			"event_types 는 허용된 이벤트 타입 배열이어야 합니다.",
		);
	}

	if (
		raw.source_tools !== undefined &&
		(!Array.isArray(raw.source_tools) ||
			!raw.source_tools.every((value) =>
				oneOf(value, TIMELINE_SOURCE_TOOL_VALUES),
			))
	) {
		return fail(
			"source_tools",
			"source_tools 는 허용된 source_tool 배열이어야 합니다.",
		);
	}

	return { ok: true, value: raw as unknown as TimelineListInput };
};

export const parseTimelineListOutput = (
	raw: unknown,
): DashboardContractValidationResult<TimelineListOutput> => {
	if (!isRecord(raw) || !Array.isArray(raw.events)) {
		return fail(
			"events",
			"timeline.list output 은 events 배열을 포함해야 합니다.",
		);
	}

	for (const [index, event] of raw.events.entries()) {
		if (!isRecord(event)) {
			return fail(`events[${index}]`, "이벤트 항목은 객체여야 합니다.");
		}
		if (
			!hasKeys(event, [
				"event_id",
				"event_type",
				"source_tool",
				"entity_id",
				"at",
				"payload",
			])
		) {
			return fail(`events[${index}]`, "이벤트 필드가 누락되었습니다.");
		}
		if (!isRecord(event.payload)) {
			return fail(`events[${index}].payload`, "payload 는 객체여야 합니다.");
		}
		if (!oneOf(event.event_type, TIMELINE_EVENT_TYPE_VALUES)) {
			return fail(
				`events[${index}].event_type`,
				"event_type 은 허용된 값이어야 합니다.",
			);
		}
		if (!oneOf(event.source_tool, TIMELINE_SOURCE_TOOL_VALUES)) {
			return fail(
				`events[${index}].source_tool`,
				"source_tool 은 허용된 값이어야 합니다.",
			);
		}
		if (!isIsoDateTime(event.at)) {
			return fail(`events[${index}].at`, "at 은 ISO-8601 이어야 합니다.");
		}
	}

	if (raw.next_cursor !== undefined && !isNonEmptyString(raw.next_cursor)) {
		return fail("next_cursor", "next_cursor 는 빈 값일 수 없습니다.");
	}

	return { ok: true, value: raw as unknown as TimelineListOutput };
};
