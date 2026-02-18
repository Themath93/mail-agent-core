import { expect, test } from "@playwright/test";

test("e2e smoke bootstrap is wired", async ({ browserName }) => {
	expect(browserName.length).toBeGreaterThan(0);
});
