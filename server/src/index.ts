import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { getCrons } from "./odoo";

export interface Env {
  SSO_ISSUER: string;
  ODOO_URL: string;
  ODOO_DB: string;
  ODOO_USER: string;
  ODOO_PASSWORD: string;
  ALERT_EMAIL: string;
  MAILER: { fetch: (req: Request) => Promise<Response> };
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/crons", async (c) => {
  const session = getCookie(c, "session");
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  try {
    const crons = await getCrons(
      c.env.ODOO_URL,
      c.env.ODOO_DB,
      c.env.ODOO_USER,
      c.env.ODOO_PASSWORD
    );
    return c.json(crons);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Phục vụ frontend cho mọi route khác không phải /api
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const crons = await getCrons(
      env.ODOO_URL,
      env.ODOO_DB,
      env.ODOO_USER,
      env.ODOO_PASSWORD
    );

    const now = new Date();
    const delayedCrons = crons.filter((cron) => new Date(cron.nextcall + "Z") < now);

    if (delayedCrons.length > 0) {
      const body = `Có ${delayedCrons.length} cron bị trễ:\n` + 
        delayedCrons.map(c => `- ${c.name} (${c.nextcall})`).join("\n");

      await env.MAILER.fetch(new Request("https://mailer/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: env.ALERT_EMAIL,
          subject: `[Odoo Monitor] Cảnh báo Cron`,
          text: body
        })
      }));
    }
  },
};
