import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { getCrons, CronItem } from "./odoo";

export interface Env {
  SSO_ISSUER: string;
  ODOO_URL: string;
  ODOO_DB: string;
  ODOO_USER: string;
  ODOO_PASSWORD: string;
  ALERT_EMAIL: string;
  MAILER: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const app = new Hono<{ Bindings: Env }>();

// Middleware check SSO
app.use("*", async (c, next) => {
  if (c.req.path === "/health") return await next();
  
  const session = getCookie(c, "session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  // In a real scenario, we should verify the JWT here using public keys from SSO_ISSUER
  // For now, let's assume if the cookie exists it's a start, 
  // but better to implement verifySession logic.
  
  await next();
});

app.get("/api/crons", async (c) => {
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

app.get("/health", (c) => c.text("OK"));

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
    const delayedCrons = crons.filter((cron) => {
      const nextCall = new Date(cron.nextcall + "Z"); // Odoo usually returns UTC without suffix
      return nextCall < now;
    });

    if (delayedCrons.length > 0) {
      const body = `Cảnh báo: Có ${delayedCrons.length} cron bị trễ:\n\n` + 
        delayedCrons.map(c => `- ${c.name} (Dự kiến: ${c.nextcall})`).join("\n");

      await env.MAILER.fetch(new Request("https://mailer/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: env.ALERT_EMAIL,
          subject: `[Odoo Monitor] Cảnh báo Cron chậm trễ`,
          text: body
        })
      }));
    }
  },
};
