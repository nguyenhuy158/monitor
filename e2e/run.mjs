// Chay ca bo E2E dev mot lenh: build FE -> ap schema D1 local -> bat SSO +
// Odoo gia -> bat `wrangler dev` -> chay smoke suite -> tat het.
//
// SSO that (auth.huyab.click) va Odoo that khong dung duoc trong test:
// - SSO gia: `startSsoMock` cua @huyab/e2e (JWKS + token ky bang khoa sinh luc
//   chay); worker duoc bat voi SSO_ISSUER tro ve day nen cookie `huyab_sso`
//   hop le.
// - Odoo gia: POST /jsonrpc toi gian (authenticate + ir.cron search_read).
//
// Bien moi truong:
// - E2E_PORT: cong cho wrangler dev (mac dinh: mot cong trong)
// - E2E_SKIP_BUILD=1: bo qua `pnpm build` (dung khi ./dist da moi)
// - PLAYWRIGHT_CHROMIUM_PATH: chi dinh Chromium cu the
import { createServer } from "node:http";
import { freePort, run, startServer, startSsoMock } from "@huyab/e2e";

const PORT = process.env.E2E_PORT || (await freePort());
const BASE = `http://127.0.0.1:${PORT}`;
const E2E_EMAIL = "e2e@monitor.local";
const HOUR_MS = 3_600_000;

/** Gio UTC dang Odoo tra ve: "YYYY-MM-DD HH:MM:SS", khong co 'Z'. */
function odooTime(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString().slice(0, 19).replace("T", " ");
}

// 2 cron tre + 1 cron dung gio: smoke suite dua vao so nay.
const FAKE_CRONS = [
  { id: 1, name: "E2E late cron alpha", nextcall: odooTime(-2 * HOUR_MS), active: true },
  { id: 2, name: "E2E late cron beta", nextcall: odooTime(-72 * HOUR_MS), active: true },
  { id: 3, name: "E2E on-time cron", nextcall: odooTime(HOUR_MS), active: true },
];

const odoo = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/jsonrpc") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const { id, params } = JSON.parse(raw);
    const result = params.service === "common" ? 7 : FAKE_CRONS;
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
  }
  res.writeHead(404).end();
});
await new Promise((resolve) => odoo.listen(0, "127.0.0.1", resolve));
const ODOO_URL = `http://127.0.0.1:${odoo.address().port}`;
const sso = await startSsoMock();

if (process.env.E2E_SKIP_BUILD !== "1") {
  await run("pnpm", ["build"], { label: "build" });
}
await run(
  "pnpm",
  ["exec", "wrangler", "d1", "execute", "DB", "--local", "--file", "schema.sql"],
  { label: "schema D1" },
);
// Xoa du lieu cua user E2E tu lan chay truoc de so lieu Stats co dinh.
await run(
  "pnpm",
  [
    "exec", "wrangler", "d1", "execute", "DB", "--local", "--command",
    `DELETE FROM monitor_configs WHERE user_email = '${E2E_EMAIL}'; ` +
      `DELETE FROM monitor_user_settings WHERE user_email = '${E2E_EMAIL}'`,
  ],
  { label: "reset D1 E2E data" },
);

const server = await startServer({
  command: "pnpm",
  args: ["exec", "wrangler", "dev", "--ip", "127.0.0.1", "--port", PORT, "--var", `SSO_ISSUER:${sso.issuer}`],
  readyUrl: `${BASE}/`,
});

let failed = false;
try {
  console.log(`\nServer san sang tai ${BASE}, bat dau smoke suite\n`);
  await run("node", ["e2e/ui-smoke.mjs"], {
    label: "smoke suite",
    env: { E2E_BASE_URL: BASE, E2E_SSO_TOKEN: sso.mintToken(E2E_EMAIL), E2E_ODOO_URL: ODOO_URL },
  });
} catch (error) {
  failed = true;
  console.error("E2E FAIL:", error.message);
} finally {
  await server.stop();
  sso.close();
  odoo.close();
}

process.exit(failed ? 1 : 0);
