import { SSO_COOKIE, verifySsoToken } from "@huyab/sso";
import { type Context, Hono, type MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { getCrons } from "./odoo";

export interface Env {
  SSO_ISSUER: string;
  MAILER_KEY: string;
  MAILER: { fetch: (req: Request) => Promise<Response> };
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  DB: D1Database;
}

type AppEnv = { Bindings: Env; Variables: { email: string } };

const app = new Hono<AppEnv>();

// Chi doc cookie `huyab_sso` (khong nhan Bearer), nen khong dung requireUser
// cua @huyab/sso/hono.
const getAuthUser = async (c: Context<AppEnv>) => {
  const token = getCookie(c, SSO_COOKIE);
  if (!token) return null;
  const claims = await verifySsoToken(token, c.env.SSO_ISSUER);
  return claims?.email ?? null;
};

// Chan route khi chua dang nhap; route doc email qua c.get("email").
const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const email = await getAuthUser(c);
  if (!email) return c.json({ error: "Unauthorized" }, 401);
  c.set("email", email);
  await next();
};

const findConfig = (db: D1Database, id: string, email: string) =>
  db.prepare("SELECT * FROM monitor_configs WHERE id = ? AND user_email = ?").bind(id, email).first<any>();

const sendMail = (env: Env, mail: { to: string; subject: string; text: string }) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.MAILER_KEY) {
    headers["Authorization"] = `Bearer ${env.MAILER_KEY}`;
  }
  return env.MAILER.fetch(new Request("https://mailer/send", {
    method: "POST",
    headers,
    body: JSON.stringify(mail),
  }));
};

app.get("/api/me", async (c) => {
  const email = await getAuthUser(c);
  if (!email) return c.json({ authenticated: false }, 401);
  
  try {
    // Lấy hoặc tạo settings mặc định
    let settings: any = await c.env.DB.prepare("SELECT * FROM monitor_user_settings WHERE user_email = ?").bind(email).first();
    if (!settings) {
      await c.env.DB.prepare("INSERT INTO monitor_user_settings (user_email) VALUES (?)").bind(email).run();
      settings = { alert_delay_minutes: 30 };
    }
    return c.json({ email, authenticated: true, settings });
  } catch (e) {
    console.error("Failed to get/create settings:", e);
    // Vẫn cho login dù lỗi settings
    return c.json({ email, authenticated: true, settings: { alert_delay_minutes: 30 } });
  }
});

app.put("/api/settings", requireUser, async (c) => {
  const email = c.get("email");
  const body = await c.req.json();
  const delay = parseInt(body.alert_delay_minutes);
  
  if (isNaN(delay) || delay < 0) return c.json({ error: "Invalid delay" }, 400);

  await c.env.DB.prepare(
    "INSERT INTO monitor_user_settings (user_email, alert_delay_minutes, updated_at) VALUES (?, ?, (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))) ON CONFLICT(user_email) DO UPDATE SET alert_delay_minutes = excluded.alert_delay_minutes, updated_at = excluded.updated_at"
  ).bind(email, delay).run();

  return c.json({ success: true });
});

// API Quản lý Odoo Configs
app.get("/api/configs", requireUser, async (c) => {
  const email = c.get("email");
  const { results } = await c.env.DB.prepare("SELECT * FROM monitor_configs WHERE user_email = ? ORDER BY sort_order ASC, id ASC").bind(email).all();
  return c.json(results);
});

const ENVS = ["dev", "preprod", "prod"];

app.post("/api/configs", requireUser, async (c) => {
  const email = c.get("email");
  const body = await c.req.json();
  const env = ENVS.includes(body.env) ? body.env : "prod";
  await c.env.DB.prepare(
    "INSERT INTO monitor_configs (user_email, name, url, db, username, password, env) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(email, body.name, body.url, body.db, body.username, body.password, env).run();
  return c.json({ success: true });
});

app.put("/api/configs/:id", requireUser, async (c) => {
  const email = c.get("email");
  const id = c.req.param("id");
  const body = await c.req.json();
  const env = ENVS.includes(body.env) ? body.env : "prod";

  const { success } = await c.env.DB.prepare(
    "UPDATE monitor_configs SET name = ?, url = ?, db = ?, username = ?, password = ?, env = ? WHERE id = ? AND user_email = ?"
  ).bind(body.name, body.url, body.db, body.username, body.password, env, id, email).run();

  if (!success) return c.json({ error: "Failed to update or not found" }, 404);
  return c.json({ success: true });
});

app.post("/api/configs/reorder", requireUser, async (c) => {
  const email = c.get("email");
  const { ids } = await c.req.json();
  
  if (!Array.isArray(ids)) return c.json({ error: "Invalid IDs" }, 400);

  const statements = ids.map((id, index) => 
    c.env.DB.prepare("UPDATE monitor_configs SET sort_order = ? WHERE id = ? AND user_email = ?").bind(index, id, email)
  );
  
  await c.env.DB.batch(statements);
  return c.json({ success: true });
});

app.post("/api/configs/:id/duplicate", requireUser, async (c) => {
  const email = c.get("email");
  const original = await findConfig(c.env.DB, c.req.param("id"), email);
  if (!original) return c.json({ error: "Not found" }, 404);

  await c.env.DB.prepare(
    "INSERT INTO monitor_configs (user_email, name, url, db, username, password, env, alert_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    email,
    `${original.name} (copy)`,
    original.url,
    original.db,
    original.username,
    original.password,
    original.env,
    original.alert_enabled,
  ).run();
  return c.json({ success: true });
});

app.post("/api/configs/:id/test-email", requireUser, async (c) => {
  const email = c.get("email");
  const config = await findConfig(c.env.DB, c.req.param("id"), email);
  if (!config) return c.json({ error: "Not found" }, 404);

  try {
    const res = await sendMail(c.env, {
      to: email,
      subject: `[Odoo Monitor] Test email - ${config.name}`,
      text: `Đây là email test cho instance "${config.name}" (${config.env}). Nếu bạn nhận được email này, cấu hình gửi mail đang hoạt động bình thường.`,
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Mailer failed with status ${res.status}:`, errorText);
      return c.json({ error: `Mailer failed: ${res.status}` }, 502);
    }
    return c.json({ success: true });
  } catch (e: any) {
    console.error("Mailer fetch crash:", e);
    return c.json({ error: e.message }, 500);
  }
});

app.get("/api/crons", requireUser, async (c) => {
  const email = c.get("email");
  
  const configId = c.req.query("config_id");
  let config: any;
  
  if (configId) {
    config = await findConfig(c.env.DB, configId, email);
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
    
    // Lấy toàn bộ settings của tất cả user để tránh query trong loop
    const { results: allSettings } = await env.DB.prepare("SELECT * FROM monitor_user_settings").all();
    const settingsMap = new Map((allSettings as any[]).map(s => [s.user_email, s.alert_delay_minutes]));

    for (const config of (configs as any[])) {
      try {
        const crons = await getCrons(config.url, config.db, config.username, config.password);
        const now = new Date();
        
        // Lấy ngưỡng trễ của user, mặc định 30p
        const delayLimit = settingsMap.get(config.user_email) ?? 30;
        
        const delayedCrons = crons.filter((cron: any) => {
          const nextCall = new Date(cron.nextcall + "Z");
          const diffMins = (now.getTime() - nextCall.getTime()) / 60000;
          return diffMins >= delayLimit;
        });

        if (delayedCrons.length > 0) {
          const body = `Odoo: ${config.name}\nCó ${delayedCrons.length} cron bị trễ:\n` + 
            delayedCrons.map((c: any) => `- ${c.name} (${c.nextcall})`).join("\n");

          await sendMail(env, {
            to: config.user_email,
            subject: `[Odoo Monitor] Cảnh báo Cron - ${config.name}`,
            text: body
          });
        }
      } catch (e) {
        console.error(`Failed to check crons for ${config.name}:`, e);
      }
    }
  },
};
