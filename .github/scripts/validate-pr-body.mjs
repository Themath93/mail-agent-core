const TITLE_PATTERN = /^v\d+\.\d+\.\d+\s*\|\s*.{1,}$/u;

const REQUIRED_SECTIONS = [
	"## 개요",
	"## 검증",
	"## 핵심 체크",
	"## 위험/롤백",
];

const REQUIRED_CHECKLIST_ITEMS = [
	"`main` 병합 전용 작업인지 확인",
	"브랜치에서 시작해 PR로 `main` 대상인지 확인",
	"커밋 메시지(한글) 및 롤백 포인트 명시",
];

const RESULT_PREFIX = {
	missing: "- [ ]",
	checked: "- [x]",
};

const rawBody = process.env.PR_BODY_JSON ?? "";
const prTitle = (process.env.PR_TITLE ?? "").trim();

const pullRequestBody = (() => {
	if (!rawBody) {
		return "";
	}

	try {
		const parsed = JSON.parse(rawBody);
		if (typeof parsed === "string") {
			return parsed;
		}
		if (parsed === null) {
			return "";
		}
	} catch {}

	return rawBody;
})();

const bodyLines = pullRequestBody.split(/\r?\n/);

const checklistByLabel = new Map();
for (const line of bodyLines) {
	const match = /^\s*-\s*\[(?<checked>[ xX])\]\s*(?<label>.+)\s*$/u.exec(line);
	if (!match?.groups) {
		continue;
	}

	const { checked, label } = match.groups;
	checklistByLabel.set(label.trim(), checked.toLowerCase() === "x");
}

const isSectionMissing = (sectionHeading) =>
	!bodyLines.some((line) =>
		line.trim().toLowerCase().startsWith(sectionHeading.toLowerCase()),
	);

const missingChecklistItems = REQUIRED_CHECKLIST_ITEMS.filter((label) => {
	const matchByLabel = [...checklistByLabel.entries()].find(
		([key]) => key.includes(label) || label.includes(key),
	);

	return matchByLabel === undefined || matchByLabel[1] === false;
}).map((label) => `- ${label}`);

const result = [];

if (!TITLE_PATTERN.test(prTitle)) {
	result.push(`- PR 제목 형식을 다시 확인하세요: ${prTitle || "(비어 있음)"}`);
}

if (pullRequestBody.trim().length === 0) {
	result.push("- PR 본문이 비어 있습니다.");
}

for (const section of REQUIRED_SECTIONS) {
	if (isSectionMissing(section)) {
		result.push(`- 필수 섹션 누락: ${section}`);
	}
}

for (const item of missingChecklistItems) {
	result.push(`- 핵심 체크 누락: ${item}`);
}

if (result.length > 0) {
	console.error("[검증 실패] PR 템플릿 규칙 위반");
	console.error("아래 항목을 체크하거나 완료 후 다시 시도하세요.");
	console.error("");
	console.error(`- PR 제목: ${prTitle || "(비어 있음)"}`);
	console.error(
		`- 확인 항목 (${RESULT_PREFIX.checked}/${RESULT_PREFIX.missing}):`,
	);
	console.error(`  ${REQUIRED_CHECKLIST_ITEMS.join("\n  ")}`);
	for (const item of result) {
		console.error(item);
	}

	process.exit(1);
}

process.exit(0);
