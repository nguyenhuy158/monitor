// E2E smoke test cho Odoo Monitor bang Chromium (playwright-core).
//
// Hai phan:
// 1. Chua dang nhap - CHI DOC (chay ca tren prod): GET trang chu, kiem tra
//    man login render, GET /api/me + /api/configs phai 401, GET favicon.
// 2. Da dang nhap - chi chay khi co E2E_SSO_TOKEN (do e2e/run.mjs cap) va
//    E2E_BASE_URL la localhost: them instance vao D1 local, kiem tra Stats,
//    Dashboard, tim kiem, chi tiet cron, sua instance, Settings.
//
// `pnpm e2e` = build + wrangler dev local + ca 2 phan.
// `pnpm e2e:prod` = chi phan 1 tren https://alert.huyab.click.
//
// Bien moi truong:
// - E2E_BASE_URL: mac dinh http://127.0.0.1:8795
// - E2E_SSO_TOKEN, E2E_ODOO_URL: do e2e/run.mjs truyen vao
// - PLAYWRIGHT_CHROMIUM_PATH: xem e2e/chromium.mjs
import { chromium } from "playwright-core";
import { findChromium } from "./chromium.mjs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:8795";
const SSO_TOKEN = process.env.E2E_SSO_TOKEN;
const ODOO_URL = process.env.E2E_ODOO_URL;
const WAIT = { timeout: 15000 };
const IS_LOCAL = ["127.0.0.1", "localhost"].includes(new URL(BASE).hostname);

if (SSO_TOKEN && !IS_LOCAL) {
  throw new Error("E2E_SSO_TOKEN chi dung cho server local; e2e:prod phai chi doc");
}

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  console.log(`PASS ${name}`);
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ executablePath: findChromium() });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => {
  pageErrors.push(error.message);
  console.log("PAGE ERROR:", error.message);
});

try {
  // ---- Phan 1: chi doc, an toan cho prod ----
  const home = await page.goto(BASE + "/");
  expect(home?.ok(), `GET / tra ${home?.status()}`);
  await page.getByRole("button", { name: "Tiếp tục với Google" }).waitFor(WAIT);
  ok("logged-out home renders the SSO login screen");

  const me = await page.request.get(BASE + "/api/me");
  expect(me.status() === 401, `/api/me phai 401, got ${me.status()}`);
  expect((await me.json()).authenticated === false, "/api/me phai authenticated:false");
  const configs = await page.request.get(BASE + "/api/configs");
  expect(configs.status() === 401, `/api/configs phai 401, got ${configs.status()}`);
  ok("API rejects anonymous requests");

  const favicon = await page.request.get(BASE + "/favicon.svg");
  expect(favicon.ok(), `GET /favicon.svg tra ${favicon.status()}`);
  ok("static assets are served");

  // ---- Phan 2: chi local, co ghi D1 local ----
  if (SSO_TOKEN) {
    const instanceName = `E2E Odoo ${Date.now()}`;
    await context.addCookies([{ name: "huyab_sso", value: SSO_TOKEN, url: BASE }]);
    await page.goto(BASE + "/");
    await page.getByText("Thống kê Cron trễ theo môi trường").waitFor(WAIT);
    ok("SSO cookie logs in and lands on Stats");

    await page.getByRole("button", { name: "Add Odoo Instance" }).click();
    const addDialog = page.getByRole("dialog");
    await addDialog.getByLabel("Instance Name").fill(instanceName);
    await addDialog.getByLabel("URL").fill(ODOO_URL);
    await addDialog.getByLabel("Database").fill("e2e");
    await addDialog.getByLabel("Username").fill("admin");
    await addDialog.getByLabel("Password").fill("admin");
    await addDialog.getByRole("button", { name: "Lưu" }).click();
    await page.getByText("Đã thêm instance thành công").waitFor(WAIT);
    ok("add instance via modal");

    const delayedCard = page.locator("button", { hasText: "Tổng Trễ" });
    await delayedCard.getByText("2", { exact: true }).waitFor(WAIT);
    await delayedCard.click();
    const delayedDialog = page.getByRole("dialog", { name: "Tất cả Cron đang trễ" });
    await delayedDialog.getByText("E2E late cron alpha").waitFor(WAIT);
    await delayedDialog.getByText("E2E late cron beta").waitFor(WAIT);
    expect(
      (await delayedDialog.getByText("E2E on-time cron").count()) === 0,
      "cron dung gio khong duoc nam trong danh sach tre",
    );
    await delayedDialog.getByRole("button", { name: "Đóng" }).click();
    ok("Stats counts delayed crons and lists them");

    await page.locator("nav").getByRole("button", { name: "Dashboard" }).click();
    const combobox = page.getByRole("combobox");
    await combobox.waitFor(WAIT);
    await combobox.click();
    await page.getByRole("option", { name: instanceName }).click();
    await page.getByText("E2E on-time cron").waitFor(WAIT);
    const delayedMetric = page.locator("div", { has: page.getByText("Delayed", { exact: true }) }).last();
    await delayedMetric.getByText("2", { exact: true }).waitFor(WAIT);
    ok("Dashboard picks instance and shows delayed count");

    await page.getByRole("button", { name: "Search crons" }).click();
    await page.getByPlaceholder("Tìm kiếm cron...").fill("beta");
    await page.getByText("E2E on-time cron").waitFor({ state: "detached", ...WAIT });
    await page.getByText("E2E late cron beta").waitFor(WAIT);
    ok("cron search filters the table");

    await page.getByText("E2E late cron beta").click();
    const detail = page.getByRole("dialog", { name: "Chi tiết Cron Job" });
    await detail.getByText("Active", { exact: true }).waitFor(WAIT);
    await detail.getByRole("button", { name: "Đóng" }).click();
    ok("cron detail modal opens");

    await page.locator("nav").getByRole("button", { name: "Instances" }).click();
    const card = page.locator("div.p-3", { hasText: instanceName });
    await card.getByRole("button", { name: "Edit instance" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit Odoo Instance" });
    const editedName = await editDialog.getByLabel("Instance Name").inputValue();
    expect(editedName === instanceName, `modal sua phai nap "${instanceName}", got "${editedName}"`);
    await editDialog.getByRole("button", { name: "Hủy" }).click();
    ok("edit modal loads the clicked instance");

    await page.locator("nav").getByRole("button", { name: "Settings" }).click();
    await page.getByText("Hệ thống sẽ gửi mail khi có ít nhất 1 cron trễ từ").waitFor(WAIT);
    await page.locator('main input[type="number"]').fill("45");
    await page.locator("main").getByRole("button", { name: "Lưu" }).click();
    await page.getByText("Đã lưu cài đặt").waitFor(WAIT);
    const saved = await page.evaluate(() => fetch("/api/me").then((response) => response.json()));
    expect(saved.settings?.alert_delay_minutes === 45, `settings phai luu 45, got ${JSON.stringify(saved.settings)}`);
    ok("settings threshold saves");
  }

  expect(pageErrors.length === 0, `co ${pageErrors.length} loi JS tren trang`);
  ok("no uncaught page errors");
} catch (error) {
  failed += 1;
  console.log("FAIL:", error.message);
  await page.screenshot({ path: "e2e-failure.png" }).catch(() => {});
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
