export async function getCrons(url: string, db: string, user: string, pass: string) {
  const authRes = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service: "common", method: "authenticate", args: [db, user, pass, {}] },
      id: 1,
    }),
  });

  const authData: any = await authRes.json();
  const uid = authData.result;
  if (!uid) throw new Error("Odoo Authentication failed");

  const queryRes = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [db, uid, pass, "ir.cron", "search_read", [[["active", "=", true]]], { fields: ["id", "name", "nextcall", "active", "model_id"] }],
      },
      id: 2,
    }),
  });

  const queryData: any = await queryRes.json();
  return queryData.result;
}
