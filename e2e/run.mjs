// Chay ca bo E2E dev mot lenh: build FE -> ap schema D1 local -> bat SSO +
// Odoo gia -> bat `wrangler dev` -> chay smoke suite -> tat het.
//
// SSO that (auth.huyab.click) va Odoo that khong dung duoc trong test, nen
// script tu dung mot server nho dong vai ca hai:
// - GET /.well-known/jwks.json: JWKS cua cap khoa sinh luc chay; worker duoc
//   bat voi SSO_ISSUER tro ve day nen cookie `huyab_sso` ky boi khoa nay hop le.
// - POST /jsonrpc: Odoo JSON-RPC toi gian (authenticate + ir.cron search_read).
//
// Bien moi truong:
// - E2E_PORT: cong cho wrangler dev (mac dinh 8795)
// - E2E_FAKE_PORT: cong cho SSO/Odoo gia (mac dinh 8794)
// - E2E_SKIP_BUILD=1: bo qua `pnpm build` (dung khi ./dist da moi)
// - PLAYWRIGHT_CHROMIUM_PATH: chi dinh Chromium cu the
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { SignJWT, exportJWK, generateKeyPair } from "jose";

const PORT = process.env.E2E_PORT || "8795";
const FAKE_PORT = Number(process.env.E2E_FAKE_PORT || "8794");
const BASE = `http://127.0.0.1:${PORT}`;
const FAKE_ORIGIN = `http://127.0.0.1:${FAKE_PORT}`;
const E2E_EMAIL = "e2e@monitor.local";
const SERVER_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 500;
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

/** Chay mot lenh den khi ket thuc; loi thi nem. */
function run(command, args, label, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${label} that bai (exit ${code})`)),
    );
  });
}

/** Doi tan worker tra loi trang chu, hoac nem khi qua han. */
async function waitForServer(child) {
  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`wrangler dev tat som (exit ${child.exitCode})`);
    try {
      const response = await fetch(BASE + "/");
      if (response.ok) return;
    } catch {
      // Server chua san sang, thu lai.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`wrangler dev khong len sau ${SERVER_TIMEOUT_MS}ms`);
}

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "e2e", alg: "RS256", use: "sig" };
const token = await new SignJWT({ email: E2E_EMAIL })
  .setProtectedHeader({ alg: "RS256", kid: "e2e" })
  .setIssuer(FAKE_ORIGIN)
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(privateKey);

const fake = createServer(async (req, res) => {
  const send = (body) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method === "GET" && req.url === "/.well-known/jwks.json") return send({ keys: [jwk] });
  if (req.method === "POST" && req.url === "/jsonrpc") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const { id, params } = JSON.parse(raw);
    const result = params.service === "common" ? 7 : FAKE_CRONS;
    return send({ jsonrpc: "2.0", id, result });
  }
  res.writeHead(404).end();
});
await new Promise((resolve) => fake.listen(FAKE_PORT, "127.0.0.1", resolve));

if (process.env.E2E_SKIP_BUILD !== "1") {
  await run("pnpm", ["build"], "build");
}
await run(
  "pnpm",
  ["exec", "wrangler", "d1", "execute", "DB", "--local", "--file", "schema.sql"],
  "schema D1",
);
// Xoa du lieu cua user E2E tu lan chay truoc de so lieu Stats co dinh.
await run(
  "pnpm",
  [
    "exec", "wrangler", "d1", "execute", "DB", "--local", "--command",
    `DELETE FROM monitor_configs WHERE user_email = '${E2E_EMAIL}'; ` +
      `DELETE FROM monitor_user_settings WHERE user_email = '${E2E_EMAIL}'`,
  ],
  "reset D1 E2E data",
);

// `detached` cho server mot process group rieng: `pnpm exec` sinh them tang
// node con, kill rieng PID cha se bo mo coi wrangler/workerd giu cong.
const server = spawn(
  "pnpm",
  [
    "exec", "wrangler", "dev",
    "--ip", "127.0.0.1",
    "--port", PORT,
    "--var", `SSO_ISSUER:${FAKE_ORIGIN}`,
  ],
  { stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, CI: "1" }, detached: true },
);

/** Gui signal toi ca process group cua server (bo qua neu da tat). */
function killServer(signal) {
  try {
    process.kill(-server.pid, signal);
  } catch {
    // Group da tat.
  }
}

// Group tach rieng nen Ctrl-C khong toi server: tu don truoc khi thoat.
process.once("SIGINT", () => {
  killServer("SIGKILL");
  process.exit(130);
});

let failed = false;
try {
  await waitForServer(server);
  console.log(`\nServer san sang tai ${BASE}, bat dau smoke suite\n`);
  await run("node", ["e2e/ui-smoke.mjs"], "smoke suite", {
    ...process.env,
    E2E_BASE_URL: BASE,
    E2E_SSO_TOKEN: token,
    E2E_ODOO_URL: FAKE_ORIGIN,
  });
} catch (error) {
  failed = true;
  console.error("E2E FAIL:", error.message);
} finally {
  const exited = new Promise((resolve) => server.once("exit", () => resolve(true)));
  killServer("SIGTERM");
  // Cho wrangler don dep; qua han thi ket lieu de process khong treo.
  const stopped = server.exitCode !== null || (await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
  ]));
  // Ket lieu ca group: wrangler co the tat truoc khi workerd con kip don.
  killServer("SIGKILL");
  if (!stopped) console.error("wrangler khong tat sau SIGTERM, da SIGKILL");
  fake.close();
}

process.exit(failed ? 1 : 0);
