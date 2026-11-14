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
  await expect(input).toHaveAttribute("contenteditable","true");
  await expect(input).toHaveText("Spent ₹120 on lunch");
  await expect(page.getByText("Money Tracker · example",{exact:true})).toHaveCount(0);
  await input.press("Shift+Enter");
  await input.press("a");
  await expect(input).toHaveText(/^Spent ₹120 on lunch\na$/, {useInnerText:true});
  await input.dispatchEvent("compositionstart");
  await input.press("Enter");
  await expect(input).not.toHaveText("");
  await input.dispatchEvent("compositionend");
  await page.getByRole("button",{name:"Simulate next send error",exact:true}).click();
  const retained = await input.innerText();
  await page.getByRole("button",{name:"Send",exact:true}).click();
  await expect(input).toHaveText(retained);
  await expect(page.getByRole("region",{name:"Chat entry",exact:true}).getByText(/Simulated send error/)).toBeVisible();
  await navigation(page).getByRole("link",{name:"Overview",exact:true}).click();
  await navigation(page).getByRole("link",{name:"Chat",exact:true}).click();
  await expect(input).toHaveText(retained);
  await input.press("Enter");
  await expect(input).toHaveText("");
  await expect(page.getByRole("log").getByText(/Example response:/)).toBeVisible();
  await page.getByRole("button",{name:"Show example history",exact:true}).click();
  await expect(page.getByRole("button",{name:"Show example history",exact:true})).toBeDisabled();
  await expect(page.getByRole("log").getByRole("region",{name:/^\d{1,2} \w+ \d{4}$/})).toHaveCount(2);
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
  await expect(input).toHaveText("Lunch 120");
  await expect.poll(() => input.textContent()).toBe("Lunch 120\n");
  await page.getByRole("button",{name:"Send",exact:true}).scrollIntoViewIfNeeded();
  const send=await page.getByRole("button",{name:"Send",exact:true}).boundingBox();
  expect(send!.y).toBeGreaterThanOrEqual(0);
  expect(send!.y+send!.height).toBeLessThanOrEqual(480);
  await page.getByRole("button",{name:"Send",exact:true}).click();
  await expect(input).toHaveText("");
  await expect(page.getByRole("button",{name:"Add manually",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

});

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox",{name:new RegExp(`^${label}`)}).click();
  await page.getByRole("option",{name:option,exact:true}).click();
}
async function sendExample(page: Page, text = "Spent ₹120 on lunch") {
  await page.getByRole("textbox",{name:"Expense or income",exact:true}).fill(text);
  await page.getByRole("button",{name:"Send",exact:true}).click();
}

test("example preview validates edits and waits for acknowledgment through an unknown save", async ({page}, info) => {
  const writes: string[]=[];
  page.on("request", request=>{if(request.method()==="POST") writes.push(request.url());});
  await page.goto("/chat/");
  await sendExample(page);
  const preview=page.getByRole("region",{name:"Example transaction preview",exact:true});
  await expect(preview.getByRole("heading",{name:"Review transaction",exact:true})).toBeVisible();
  await expect(preview.getByText("Not saved yet · INR",{exact:true})).toBeVisible();
  await preview.getByRole("button",{name:"Edit transaction",exact:true}).click();
  const amount=preview.getByRole("textbox",{name:"Example amount (INR)",exact:true});
  await expect(amount).toBeFocused();
  await amount.fill("0");
  await expect(preview.getByRole("button",{name:"Review changes",exact:true})).toBeDisabled();
  await amount.fill("17.50");
  await choose(page,"Example type","Income");
  await choose(page,"Example category","Salary");
  await choose(page,"Example type","Expense");
  await choose(page,"Example category","Groceries");
  const date=preview.getByRole("textbox",{name:"Example date (YYYY-MM-DD)",exact:true});
  await date.fill("2026-02-30");
  await expect(preview.getByRole("button",{name:"Review changes",exact:true})).toBeDisabled();
  await date.fill("2026-11-13");
  await preview.getByRole("textbox",{name:"Example description",exact:true}).fill("Weekly groceries");
  await preview.getByRole("button",{name:"Review changes",exact:true}).click();
  await expect(preview.getByText("Expense · ₹17.50 · INR",{exact:true})).toBeVisible();
  await expect(preview.getByText("Groceries · 13 November 2026",{exact:true})).toBeVisible();
  await preview.getByRole("button",{name:"Confirm example save",exact:true}).click();
  await expect(preview.getByRole("heading",{name:"Saving…",exact:true})).toBeVisible();
  await expect(preview.getByRole("heading",{name:"Example saved receipt",exact:true})).toHaveCount(0);
  await expect(preview.getByRole("button",{name:"Confirm example save",exact:true})).toHaveCount(0);
  await preview.getByRole("button",{name:"Simulate lost response",exact:true}).click();
  await expect(preview.getByRole("heading",{name:"Save status unknown",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Send",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Start separate entry",exact:true})).toHaveCount(0);
  await navigation(page).getByRole("link",{name:"Overview",exact:true}).click();
  await navigation(page).getByRole("link",{name:"Chat",exact:true}).click();
  await preview.getByRole("button",{name:"Check example save status",exact:true}).click();
  await expect(preview.getByRole("heading",{name:"Checking save status…",exact:true})).toBeVisible();
  await expect(preview.getByRole("heading",{name:"Example saved receipt",exact:true})).toHaveCount(0);
  await preview.getByRole("button",{name:"Acknowledge existing example save",exact:true}).click();
  await expect(preview.getByRole("heading",{name:"Example saved receipt",exact:true})).toBeVisible();
  await preview.getByRole("button",{name:"View example transaction",exact:true}).click();
  await expect(preview.getByText(/This sample transaction exists only in chat/)).toBeVisible();
  await expect(page.getByRole("complementary",{name:"Month at a glance"}).getByText("No entries to show",{exact:true})).toBeVisible();
  expect(writes).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.screenshot({path:info.outputPath("example-receipt.png")});
});

test("one clarification context retains invalid replies, cancels, and permits a separate entry", async ({page}) => {
  await page.goto("/chat/");
  await choose(page,"Example response scenario","Missing amount");
  await sendExample(page,"Spent on lunch");
  const preview=page.getByRole("region",{name:"Example transaction preview",exact:true});
  await expect(preview.getByRole("heading",{name:"More details needed",exact:true})).toBeVisible();
  await expect(page.getByText("Replying to: Lunch expense",{exact:true})).toHaveCount(1);
  await expect(preview.getByRole("button",{name:"Confirm example save",exact:true})).toHaveCount(0);
  await sendExample(page,"not an amount");
  await expect(page.getByRole("textbox",{name:"Expense or income",exact:true})).toHaveText("not an amount");
  await expect(preview.getByText(/Reply with a positive amount/)).toBeVisible();
  await expect(page.getByRole("region",{name:"Example transaction preview",exact:true})).toHaveCount(1);
  await sendExample(page,"120.50");
  await expect(preview.getByRole("heading",{name:"Review transaction",exact:true})).toBeVisible();
  await expect(preview.getByText("Expense · ₹120.50 · INR",{exact:true})).toBeVisible();
  await expect(page.getByText("Replying to: Lunch expense",{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Start separate entry",exact:true}).click();
  await expect(preview.getByRole("heading",{name:"Draft cancelled",exact:true})).toBeVisible();
  await expect(page.getByRole("textbox",{name:"Expense or income",exact:true})).toBeFocused();
  await choose(page,"Example response scenario","Salary income");
  await sendExample(page,"Salary today");
  const second=page.getByRole("region",{name:"Example transaction preview",exact:true}).last();
  await expect(second.getByText("Income · ₹25,000.00 · INR",{exact:true})).toBeVisible();
  await second.getByRole("button",{name:"Cancel draft",exact:true}).click();
  await expect(second.getByRole("heading",{name:"Draft cancelled",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Add manually",exact:true})).toBeEnabled();
});

test("rejected example saves retain edits and unavailable responses offer manual fallback", async ({page}) => {
  await page.goto("/chat/");
  await sendExample(page);
  const preview=page.getByRole("region",{name:"Example transaction preview",exact:true});
  await preview.getByRole("button",{name:"Edit transaction",exact:true}).click();
  await preview.getByRole("textbox",{name:"Example amount (INR)",exact:true}).fill("42.25");
  await preview.getByRole("button",{name:"Review changes",exact:true}).click();
  await preview.getByRole("button",{name:"Confirm example save",exact:true}).click();
  await preview.getByRole("button",{name:"Simulate rejected save",exact:true}).click();
  await expect(preview.getByText(/Example save was rejected/)).toBeVisible();
  await expect(preview.getByText("Expense · ₹42.25 · INR",{exact:true})).toBeVisible();
  await preview.getByRole("button",{name:"Confirm example save",exact:true}).click();
  await preview.getByRole("button",{name:"Acknowledge example save",exact:true}).click();
  await expect(preview.getByRole("heading",{name:"Example saved receipt",exact:true})).toBeVisible();
  await choose(page,"Example response scenario","Service unavailable");
  await sendExample(page,"Lunch");
  await expect(page.getByRole("heading",{name:"Chat entry unavailable",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Add manually",exact:true})).toBeEnabled();
});

test("live AI candidate requires confirmation and saves edited extracted values", async ({page}) => {
  const draftId = "5d768d9e-8ebe-4aef-8aa7-2935dd165ab8";
  let writes = 0;
  await page.route("**/api/parse", async route => {
    expect(route.request().postDataJSON().text).toBe("Received 45000 salary");
    await route.fulfill({json:{status:"candidate",draftId,entry:{
      type:"income",amount:"45000",category:"salary",date:"2026-11-14",description:"Salary",
    }}});
  });
  await page.route("**/api/transactions", async route => {
    if(route.request().method() !== "POST") {await route.fallback();return;}
    const payload = route.request().postDataJSON();
    expect(payload.draftId).toBe(draftId);
    expect(payload.entry.amount).toBe("45001");
    writes++;
    await route.fulfill({json:{transaction:{...payload.entry,id:"saved-ai",amount_minor:4500100,created_at:Date.now()}}});
  });
  await page.goto("/chat/");
  await page.getByRole("textbox",{name:"Expense or income"}).fill("Received 45000 salary");
  await page.getByRole("button",{name:"Send",exact:true}).click();
  const dialog = page.getByRole("dialog",{name:"Review AI suggestion",exact:true});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox",{name:"Amount (INR)"})).toHaveValue("45000");
  expect(writes).toBe(0);
  await dialog.getByRole("textbox",{name:"Amount (INR)"}).fill("45001");
  await dialog.getByRole("button",{name:"Confirm and save",exact:true}).click();
  await expect(dialog).not.toBeVisible();
  expect(writes).toBe(1);
});

test("live AI unavailable retry retains text and uses a fresh completed operation", async ({page}) => {
  const keys: string[] = [];
  await page.route("**/api/parse",async route => {
    keys.push(route.request().postDataJSON().requestId);
    await route.fulfill({json:{status:"unavailable",draftId:crypto.randomUUID(),message:"AI is unavailable. Retry or add manually."}});
  });
  await page.goto("/chat/");
  const input=page.getByRole("textbox",{name:"Expense or income"});
  await input.fill("Spent 75 on taxi");
  await page.getByRole("button",{name:"Send",exact:true}).click();
  await expect(input).toHaveText("Spent 75 on taxi");
  await expect(page.getByRole("button",{name:"Send",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Send",exact:true}).click();
  await expect.poll(()=>keys.length).toBe(2);
  expect(keys[0]).not.toBe(keys[1]);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button",{name:"Add manually",exact:true})).toBeEnabled();
});
