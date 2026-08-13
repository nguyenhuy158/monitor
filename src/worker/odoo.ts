export interface CronItem {
  id: number;
  name: string;
  nextcall: string;
  active: boolean;
  model_id: [number, string];
}

export async function getCrons(url: string, db: string, user: string, pass: string): Promise<CronItem[]> {
  const commonUrl = `${url}/xmlrpc/2/common`;
  const objectUrl = `${url}/xmlrpc/2/object`;

  // Authenticate (using a simple fetch for JSON-RPC 2.0 if possible, but Odoo often uses XML-RPC)
  // Actually, Odoo supports JSON-RPC at /jsonrpc or /web/dataset/call_kw
  // Let's use JSON-RPC 2.0 via /jsonrpc which is cleaner in JS.

  const authBody = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "common",
      method: "authenticate",
      args: [db, user, pass, {}],
    },
    id: 1,
  };

  const authRes = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(authBody),
  });

  const authData: any = await authRes.json();
  const uid = authData.result;

  if (!uid) throw new Error("Authentication failed");

  const queryBody = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        db,
        uid,
        pass,
        "ir.cron",
        "search_read",
        [[["active", "=", true]]],
        { fields: ["id", "name", "nextcall", "active", "model_id"] },
      ],
    },
    id: 2,
  };

  const queryRes = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(queryBody),
  });

  const queryData: any = await queryRes.json();
  return queryData.result;
}
