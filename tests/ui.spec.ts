import { expect, test, type Page } from "@playwright/test";

// UI scenarios use a mocked account/API boundary. Real signed-session and
// cross-account authorization are covered by auth.test.mjs against the Worker.
test.beforeEach(async ({ page }) => {
  let signedIn = true;
  const rows: Record<string, unknown>[] = [];
  await page.route("**/api/session", route => route.fulfill({json:{configured:true,user:signedIn?{id:"ui-user",name:"UI User",email:"ui@example.test"}:null}}));
  await page.route("**/api/auth/sign-out", route => {signedIn=false;return route.fulfill({json:{success:true}});});
  await page.route("**/api/transactions*", async route => {
    if(route.request().method()==="POST") {
      const {entry}=route.request().postDataJSON();
      const transaction={...entry,id:String(rows.length+1),amount_minor:Math.round(Number(entry.amount)*100),created_at:Date.now()};
      rows.push(transaction);await route.fulfill({status:201,json:{transaction}});return;
    }
    await route.fulfill({json:{transactions:rows,month:"2026-11",summary:{
      income:rows.filter(row=>row.type==="income").reduce((total,row)=>total+Number(row.amount_minor),0),
      expenses:rows.filter(row=>row.type==="expense").reduce((total,row)=>total+Number(row.amount_minor),0),
    }}});
  });
});

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
  const profile = page.getByRole("dialog", { name: "Your profile" });
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


test("signed-out visitors see Google login instead of a private ledger", async ({ page }) => {
  await page.route("**/api/session", route=>route.fulfill({json:{configured:true,user:null}}));
  await page.goto("/transactions/");
  await expect(page.getByRole("button",{name:"Continue with Google",exact:true})).toBeEnabled();
  await expect(page.getByRole("heading",{name:"Every little entry."})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Profile",exact:true})).toHaveCount(0);
});

test("sign out clears displayed account data and gates protected routes", async ({ page }) => {
  await page.goto("/chat/");
  await page.getByRole("button",{name:"Profile",exact:true}).click();
  await page.getByRole("button",{name:"Sign out",exact:true}).click();
  await expect(page.getByRole("button",{name:"Continue with Google",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Small entries. A clearer picture."})).toHaveCount(0);
});

test("missing OAuth configuration disables sign in and offers no browser-demo bypass", async ({ page }) => {
  await page.route("**/api/session", route=>route.fulfill({json:{configured:false,user:null}}));
  await page.goto("/login/");
  await expect(page.getByRole("button",{name:"Continue with Google",exact:true})).toBeDisabled();
  await expect(page.getByText("Google sign-in setup is pending.",{exact:false})).toBeVisible();
  await expect(page.getByRole("link",{name:/browser demo/})).toHaveCount(0);
});

test("chat prompts, multiline and IME input, retry, and grouped fixture history", async ({ page }) => {
  let parseCalls = 0;
  await page.route("**/api/parse", route => {parseCalls++;return route.abort();});
  await page.goto("/chat/");
  const input = page.getByRole("textbox", {name:"Expense or income",exact:true});
  await page.getByRole("button", {name:"Spent ₹120 on lunch",exact:true}).click();
  await expect(input).toHaveValue("Spent ₹120 on lunch");
  await expect(page.getByText("Money Tracker · example",{exact:true})).toHaveCount(0);
  await input.press("Shift+Enter");
  await input.press("a");
  await expect(input).toHaveValue("Spent ₹120 on lunch\na");
  await input.dispatchEvent("compositionstart");
  await input.press("Enter");
  await expect(input).not.toHaveValue("");
  await input.dispatchEvent("compositionend");
  await page.getByRole("button",{name:"Simulate next send error",exact:true}).click();
  const retained = await input.inputValue();
  await page.getByRole("button",{name:"Send message",exact:true}).click();
  await expect(input).toHaveValue(retained);
  await expect(page.getByRole("region",{name:"Chat entry",exact:true}).getByText(/Simulated send error/)).toBeVisible();
  await navigation(page).getByRole("link",{name:"Overview",exact:true}).click();
  await navigation(page).getByRole("link",{name:"Chat",exact:true}).click();
  await expect(input).toHaveValue(retained);
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await expect(page.getByRole("log").getByText(/Example response:/)).toBeVisible();
  await page.getByRole("button",{name:"Show example history",exact:true}).click();
  await expect(page.getByRole("button",{name:"Show example history",exact:true})).toBeDisabled();
  expect(await page.getByRole("log").locator("section").count()).toBe(2);
  expect(parseCalls).toBe(0);
});

test.describe("touch keyboard", () => {
  test.use({hasTouch:true});

test("composer controls remain reachable in a reduced mobile viewport", async ({page}) => {
  await page.setViewportSize({width:390,height:480});
  await page.goto("/chat/");
  const input=page.getByRole("textbox",{name:"Expense or income",exact:true});
  await input.fill("Lunch 120");
  await input.press("Enter");
  await expect(input).toHaveValue("Lunch 120\n");
  await page.getByRole("button",{name:"Send message",exact:true}).scrollIntoViewIfNeeded();
  const send=await page.getByRole("button",{name:"Send message",exact:true}).boundingBox();
  expect(send!.y).toBeGreaterThanOrEqual(0);
  expect(send!.y+send!.height).toBeLessThanOrEqual(480);
  await page.getByRole("button",{name:"Send message",exact:true}).click();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("button",{name:"Add manually",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

});
