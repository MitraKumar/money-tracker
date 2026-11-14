import { expect, test, type Page } from "@playwright/test";

function navigation(page: Page) {
  return page.getByRole("navigation", { name: page.viewportSize()!.width < 768 ? "Mobile navigation" : "Primary navigation", exact: true });
}

test("static routes, current destination, mobile navigation, and profile links", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [route, heading] of [
    ["/chat/", "Small entries. A clearer picture."],
    ["/overview/", "A month in perspective."],
    ["/transactions/", "Every little entry."],
    ["/settings/", "Keep things simple."],
    ["/login/", "Your own little corner."],
    ["/setup/", "A few simple defaults."],
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(navigation(page)).toBeVisible();
    expect(await navigation(page).locator("a").evaluateAll((links) => links.some((link) =>
      [...link.querySelectorAll("span")].some((node) => getComputedStyle(node).textOverflow === "ellipsis" && node.scrollWidth > node.clientWidth + 1),
    ))).toBe(false);
    if (["/chat/", "/overview/", "/transactions/"].includes(route)) {
      await expect(navigation(page).locator('[aria-current="page"]')).toHaveAttribute("href", route);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  const profile = page.getByRole("dialog", { name: "Your demo profile" });
  await expect(profile).toBeVisible();
  await profile.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Keep things simple." })).toBeVisible();
  await page.goto("/chat/");
  await page.screenshot({ path: info.outputPath("chat.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("unsaved draft survives navigation and saved entries reconcile across views", async ({ page }) => {
  await page.goto("/chat/");
  await expect(page.getByRole("button", { name: "Add manually", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Add manually", exact: true }).click();
  await page.getByRole("textbox", { name: "Amount (INR)", exact: true }).fill("17.50");
  await page.getByRole("textbox", { name: "Description", exact: true }).fill("UI shell lunch");
  await navigation(page).getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A month in perspective." })).toBeVisible();
  await navigation(page).getByRole("link", { name: "Chat", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Amount (INR)", exact: true })).toHaveValue("17.50");
  await page.getByRole("button", { name: "Confirm and save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved ₹17.50" })).toBeVisible();
  await navigation(page).getByRole("link", { name: /Transactions/ }).click();
  await expect(page.getByText("UI shell lunch", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search descriptions" }).fill("no such entry");
  await expect(page.getByText("No matches in this month.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByText("UI shell lunch", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("UI shell lunch", { exact: true })).toBeVisible();
  await navigation(page).getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByText("−₹17.50", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
