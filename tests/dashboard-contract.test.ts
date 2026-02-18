import { describe, expect, test } from "vitest";

import {
	DASHBOARD_CONTRACT_TOOL_NAMES,
	DASHBOARD_KPI_DRILLDOWN_DEFAULTS,
	DASHBOARD_OVERVIEW_KPI_KEYS,
	parseDashboardGetOverviewInput,
	parseDashboardGetOverviewOutput,
	parseSearchQueryInput,
	parseSearchQueryOutput,
	parseTimelineListInput,
	parseTimelineListOutput,
} from "../src/domain/dashboard-contract.js";

describe("Dashboard/Search/Timeline 계약 고정", () => {
	test("도구 이름 토큰이 고정된다", () => {
		expect(DASHBOARD_CONTRACT_TOOL_NAMES).toEqual([
			"dashboard.get_overview",
			"search.query",
			"timeline.list",
		]);
	});

	test("대시보드 KPI 필드가 요구사항대로 고정된다", () => {
		expect(DASHBOARD_OVERVIEW_KPI_KEYS).toEqual([
			"today_mail_count",
			"today_todo_count",
			"progress_status",
			"weekly_completed_count",
			"top_counterparties",
		]);
	});

	test("KPI drilldown 기본 매핑이 존재한다", () => {
		expect(DASHBOARD_KPI_DRILLDOWN_DEFAULTS.today_mail_count.target_tool).toBe(
			"search.query",
		);
		expect(DASHBOARD_KPI_DRILLDOWN_DEFAULTS.today_todo_count.target_tool).toBe(
			"search.query",
		);
		expect(DASHBOARD_KPI_DRILLDOWN_DEFAULTS.progress_status.target_tool).toBe(
			"timeline.list",
		);
		expect(
			DASHBOARD_KPI_DRILLDOWN_DEFAULTS.weekly_completed_count.payload.statuses,
		).toEqual(["done"]);
		expect(
			DASHBOARD_KPI_DRILLDOWN_DEFAULTS.top_counterparties.payload.bindings,
		).toEqual([{ token: "counterparty_id", target_field: "counterparty_ids" }]);
	});

	test("dashboard.get_overview input 계약을 검증한다", () => {
		const result = parseDashboardGetOverviewInput({
			date: "2026-02-18",
			timezone: "Asia/Seoul",
			top_counterparties_limit: 7,
			include_drilldowns: true,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(result.value.timezone).toBe("Asia/Seoul");
	});

	test("dashboard.get_overview output 은 KPI/드릴다운/범위를 강제한다", () => {
		const result = parseDashboardGetOverviewOutput({
			generated_at: "2026-02-18T01:00:00.000Z",
			range: {
				date: "2026-02-18",
				week_start: "2026-02-16",
				week_end: "2026-02-22",
				timezone: "Asia/Seoul",
			},
			kpis: {
				today_mail_count: 9,
				today_todo_count: 4,
				progress_status: {
					open_count: 2,
					in_progress_count: 1,
					done_count: 1,
					completion_rate: 0.25,
				},
				weekly_completed_count: 13,
				top_counterparties: [
					{
						contact_id: "contact:kim",
						display_name: "김지훈",
						message_count: 6,
						todo_count: 3,
						last_interaction_at: "2026-02-18T00:40:00.000Z",
					},
				],
			},
			drilldowns: DASHBOARD_KPI_DRILLDOWN_DEFAULTS,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}

		expect(result.value.kpis.progress_status.completion_rate).toBe(0.25);
		expect(result.value.drilldowns.progress_status.target_tool).toBe(
			"timeline.list",
		);
	});

	test("search.query input/output 계약은 evidence jump locator 를 강제한다", () => {
		const inputResult = parseSearchQueryInput({
			query: "예산 승인",
			scope: "mail",
			filters: {
				date_window: "today",
				has_evidence: true,
			},
			sort: "relevance",
			limit: 20,
		});

		expect(inputResult.ok).toBe(true);

		const outputResult = parseSearchQueryOutput({
			items: [
				{
					result_id: "search:1",
					source_type: "mail",
					source_id: "msg:42",
					thread_id: "thread:10",
					title: "예산 승인 요청",
					snippet: "첨부 엑셀 3장 승인 필요",
					score: 0.97,
					occurred_at: "2026-02-18T01:05:00.000Z",
					evidence_locators: [
						{
							evidence_id: "ev:1",
							source_kind: "attachment",
							source_id: "att:7",
							locator: {
								type: "xlsx",
								sheet: "예산",
								range: "B12:C20",
							},
						},
					],
					available_actions: ["open_source", "jump_evidence", "open_timeline"],
				},
			],
			next_cursor: "cursor:2",
			total_estimate: 1,
		});

		expect(outputResult.ok).toBe(true);
		if (!outputResult.ok) {
			return;
		}

		expect(
			outputResult.value.items[0]?.evidence_locators[0]?.locator.type,
		).toBe("xlsx");
	});

	test("timeline.list input/output 계약은 이벤트 스키마 필드를 강제한다", () => {
		const inputResult = parseTimelineListInput({
			entity_id: "todo:100",
			event_types: ["todo_created", "status_changed"],
			source_tools: ["workflow.upsert_todo", "timeline.list"],
			from: "2026-02-18T00:00:00.000Z",
			to: "2026-02-18T23:59:59.000Z",
			limit: 50,
			include_payload: true,
		});

		expect(inputResult.ok).toBe(true);

		const outputResult = parseTimelineListOutput({
			events: [
				{
					event_id: "event:1",
					event_type: "status_changed",
					source_tool: "workflow.upsert_todo",
					entity_id: "todo:100",
					at: "2026-02-18T09:00:00.000Z",
					payload: {
						before_status: "open",
						after_status: "in_progress",
						actor: "agent",
					},
				},
			],
			next_cursor: "cursor:timeline:2",
		});

		expect(outputResult.ok).toBe(true);
		if (!outputResult.ok) {
			return;
		}

		expect(outputResult.value.events[0]).toMatchObject({
			event_id: "event:1",
			event_type: "status_changed",
			source_tool: "workflow.upsert_todo",
			entity_id: "todo:100",
		});
	});

	test("계약 위반 시 명시적으로 실패한다", () => {
		const overviewInputInvalidLimit = parseDashboardGetOverviewInput({
			top_counterparties_limit: 0,
		});
		expect(overviewInputInvalidLimit.ok).toBe(false);
		if (!overviewInputInvalidLimit.ok) {
			expect(overviewInputInvalidLimit.errors[0]?.path).toBe(
				"top_counterparties_limit",
			);
		}

		const overviewInputInvalidBoolean = parseDashboardGetOverviewInput({
			include_drilldowns: "yes",
		});
		expect(overviewInputInvalidBoolean.ok).toBe(false);
		if (!overviewInputInvalidBoolean.ok) {
			expect(overviewInputInvalidBoolean.errors[0]?.path).toBe(
				"include_drilldowns",
			);
		}

		const overviewInputInvalidTimezone = parseDashboardGetOverviewInput({
			timezone: "   ",
		});
		expect(overviewInputInvalidTimezone.ok).toBe(false);
		if (!overviewInputInvalidTimezone.ok) {
			expect(overviewInputInvalidTimezone.errors[0]?.path).toBe("timezone");
		}

		const searchInvalid = parseSearchQueryOutput({
			items: [
				{
					result_id: "search:bad",
					source_type: "mail",
					source_id: "msg:bad",
					title: "broken",
					snippet: "broken",
					score: 1,
					occurred_at: "2026-02-18T01:05:00.000Z",
					evidence_locators: [
						{
							evidence_id: "ev:broken",
							source_kind: "attachment",
							source_id: "att:broken",
							locator: {
								type: "xlsx",
								sheet: "",
								range: "A1",
							},
						},
					],
					available_actions: ["jump_evidence"],
				},
			],
		});

		expect(searchInvalid.ok).toBe(false);
		if (searchInvalid.ok) {
			return;
		}
		expect(
			searchInvalid.errors.some((error) =>
				error.path.includes("evidence_locators[0].locator.sheet"),
			),
		).toBe(true);

		const timelineInvalid = parseTimelineListOutput({
			events: [
				{
					event_id: "event:bad",
					event_type: "status_changed",
					source_tool: "workflow.upsert_todo",
					entity_id: "todo:bad",
					at: "2026-02-18T09:00:00.000Z",
					payload: "invalid",
				},
			],
		});

		expect(timelineInvalid.ok).toBe(false);
		if (timelineInvalid.ok) {
			return;
		}
		expect(
			timelineInvalid.errors.some(
				(error) => error.path === "events[0].payload",
			),
		).toBe(true);

		const searchInvalidPdfLocator = parseSearchQueryOutput({
			items: [
				{
					result_id: "search:pdf-bad",
					source_type: "mail",
					source_id: "msg:pdf-bad",
					title: "broken-pdf",
					snippet: "broken-pdf",
					score: 1,
					occurred_at: "2026-02-18T01:05:00.000Z",
					evidence_locators: [
						{
							evidence_id: "ev:pdf-bad",
							source_kind: "attachment",
							source_id: "att:pdf-bad",
							locator: {
								type: "pdf",
							},
						},
					],
					available_actions: ["jump_evidence"],
				},
			],
		});

		expect(searchInvalidPdfLocator.ok).toBe(false);
		if (!searchInvalidPdfLocator.ok) {
			expect(
				searchInvalidPdfLocator.errors.some((error) =>
					error.path.includes("evidence_locators[0].locator.page"),
				),
			).toBe(true);
		}

		const searchInvalidOutlookQuoteLocator = parseSearchQueryOutput({
			items: [
				{
					result_id: "search:quote-bad",
					source_type: "mail",
					source_id: "msg:quote-bad",
					title: "broken-quote",
					snippet: "broken-quote",
					score: 1,
					occurred_at: "2026-02-18T01:05:00.000Z",
					evidence_locators: [
						{
							evidence_id: "ev:quote-bad",
							source_kind: "email",
							source_id: "msg:quote-bad",
							locator: {
								type: "outlook_quote",
							},
						},
					],
					available_actions: ["jump_evidence"],
				},
			],
		});

		expect(searchInvalidOutlookQuoteLocator.ok).toBe(false);
		if (!searchInvalidOutlookQuoteLocator.ok) {
			expect(
				searchInvalidOutlookQuoteLocator.errors.some((error) =>
					error.path.includes("evidence_locators[0].locator.text_quote"),
				),
			).toBe(true);
		}

		const timelineInvalidNextCursor = parseTimelineListOutput({
			events: [],
			next_cursor: "",
		});
		expect(timelineInvalidNextCursor.ok).toBe(false);
		if (!timelineInvalidNextCursor.ok) {
			expect(timelineInvalidNextCursor.errors[0]?.path).toBe("next_cursor");
		}

		const searchInvalidTotalEstimate = parseSearchQueryOutput({
			items: [],
			total_estimate: -1,
		});
		expect(searchInvalidTotalEstimate.ok).toBe(false);
		if (!searchInvalidTotalEstimate.ok) {
			expect(searchInvalidTotalEstimate.errors[0]?.path).toBe("total_estimate");
		}
	});
});
