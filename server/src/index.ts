import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getCrons } from "./odoo";

export interface Env {
  SSO_ISSUER: string;
  ALERT_EMAIL: string;
  MAILER: { fetch: (req: Request) => Promise<Response> };
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

// SSO Configuration
const SSO_COOKIE = "huyab_sso";
let _jwks: any = null;

const getJWKS = (issuer: string) => {
  if (!_jwks) _jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return _jwks;
};

// Middleware check auth & lấy user email
const getAuthUser = async (c: any) => {
  const token = getCookie(c, SSO_COOKIE);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJWKS(c.env.SSO_ISSUER), {
      issuer: c.env.SSO_ISSUER,
    });
    return payload.email;
  } catch (e) {
    console.error("JWT Verify failed:", e);
    return null;
  }
};

app.get("/api/me", async (c) => {
  const email = await getAuthUser(c);
  if (!email) return c.json({ authenticated: false }, 401);
  return c.json({ email, authenticated: true });
});

// API Quản lý Odoo Configs
app.get("/api/configs", async (c) => {
  const email = await getAuthUser(c);
  if (!email) return c.json({ error: "Unauthorized" }, 401);
  const { results } = await c.env.DB.prepare("SELECT * FROM monitor_configs WHERE user_email = ?").bind(email).all();
  return c.json(results);
});

app.post("/api/configs", async (c) => {
  const email = await getAuthUser(c);
  if (!email) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json();
  await c.env.DB.prepare(
    "INSERT INTO monitor_configs (user_email, name, url, db, username, password) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(email, body.name, body.url, body.db, body.username, body.password).run();
  return c.json({ success: true });
});

app.get("/api/crons", async (c) => {
  const email = await getAuthUser(c);
  if (!email) return c.json({ error: "Unauthorized" }, 401);
  
  const configId = c.req.query("config_id");
  let config: any;
  
  if (configId) {
    config = await c.env.DB.prepare("SELECT * FROM monitor_configs WHERE id = ? AND user_email = ?").bind(configId, email).first();
  } else {
    config = await c.env.DB.prepare("SELECT * FROM monitor_configs WHERE user_email = ? ORDER BY id DESC LIMIT 1").bind(email).first();
  }

  if (!config) return c.json({ error: "No config found" }, 404);

  try {
    const crons = await getCrons(config.url, config.db, config.username, config.password);
    return c.json({ config_name: config.name, crons });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Phục vụ frontend cho mọi route khác không phải /api
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Check toàn bộ config của tất cả user
    const { results: configs } = await env.DB.prepare("SELECT * FROM monitor_configs WHERE alert_enabled = 1").all();
    
    for (const config of (configs as any[])) {
      try {
        const crons = await getCrons(config.url, config.db, config.username, config.password);
        const now = new Date();
        const delayedCrons = crons.filter((cron: any) => new Date(cron.nextcall + "Z") < now);

        if (delayedCrons.length > 0) {
          const body = `Odoo: ${config.name}\nCó ${delayedCrons.length} cron bị trễ:\n` + 
            delayedCrons.map((c: any) => `- ${c.name} (${c.nextcall})`).join("\n");

          await env.MAILER.fetch(new Request("https://mailer/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: config.user_email,
              subject: `[Odoo Monitor] Cảnh báo Cron - ${config.name}`,
              text: body
            })
          }));
        }
      } catch (e) {
        console.error(`Failed to check crons for ${config.name}:`, e);
      }
    }
  },
};
