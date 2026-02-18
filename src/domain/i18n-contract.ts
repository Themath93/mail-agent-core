export const TRANSLATABLE_UI_TEXT = [
	"heading",
	"button_label",
	"status_text",
	"error_message",
	"placeholder_text",
	"help_text",
	"option_label",
] as const;

export const NON_TRANSLATABLE_CONTRACT_KEYS = [
	"action",
	"error_code",
	"manual",
	"review_first",
	"full_auto",
	"open",
	"in_progress",
	"done",
	"mail_folder",
	"message_pk",
] as const;

export type TranslatableUiTextCategory = (typeof TRANSLATABLE_UI_TEXT)[number];
export type NonTranslatableContractToken =
	(typeof NON_TRANSLATABLE_CONTRACT_KEYS)[number];

const NON_TRANSLATABLE_CONTRACT_KEY_SET = new Set<string>(
	NON_TRANSLATABLE_CONTRACT_KEYS,
);

export const isNonTranslatableContractToken = (
	value: string,
): value is NonTranslatableContractToken =>
	NON_TRANSLATABLE_CONTRACT_KEY_SET.has(value);
