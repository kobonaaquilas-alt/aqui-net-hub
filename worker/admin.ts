type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};
type AuthUser = { id: string };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
// Supabase sb_secret_* keys are API keys, not JWTs: send them only as apikey.
const headers = (env: Env) => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  "Content-Type": "application/json",
  Prefer: "return=representation",
});
async function isAdmin(env: Env, userId: string): Promise<boolean> {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/hub_admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`,
    { headers: headers(env) },
  );
  if (!response.ok) throw new Error("Admin authorization lookup failed");
  const rows = await response.json() as Array<{ user_id: string }>;
  return rows.length === 1;
}
export async function handleAdmin(
  request: Request,
  env: Env,
  user: AuthUser,
): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    return json({ error: "Backend non configuré." }, 503);
  try {
    if (!await isAdmin(env, user.id)) return json({ error: "Accès administrateur refusé." }, 403);
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/admin/requests") {
      const [ads, partners] = await Promise.all([
        fetch(`${env.SUPABASE_URL}/rest/v1/hub_ad_requests?select=id,user_id,company_name,contact_name,email,phone,website,budget,message,status,created_at&order=created_at.desc&limit=200`, { headers: headers(env) }),
        fetch(`${env.SUPABASE_URL}/rest/v1/hub_partner_applications?select=id,user_id,organization,contact_name,email,phone,website,proposal,status,created_at&order=created_at.desc&limit=200`, { headers: headers(env) }),
      ]);
      if (!ads.ok || !partners.ok) return json({ error: "Impossible de charger les demandes." }, 502);
      return json({ ads: await ads.json(), partners: await partners.json() });
    }
    const match = url.pathname.match(/^\/api\/admin\/requests\/(ads|partners)\/([0-9a-f-]{36})$/i);
    if (request.method === "PATCH" && match) {
      let body: { status?: string };
      try { body = await request.json() as typeof body; }
      catch { return json({ error: "Requête invalide." }, 400); }
      if (!["received", "reviewing", "accepted", "declined"].includes(body.status || ""))
        return json({ error: "Statut invalide." }, 400);
      const table = match[1].toLowerCase() === "ads" ? "hub_ad_requests" : "hub_partner_applications";
      const response = await fetch(
        `${env.SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(match[2])}`,
        { method: "PATCH", headers: headers(env), body: JSON.stringify({ status: body.status }) },
      );
      if (!response.ok) return json({ error: "Mise à jour impossible." }, 502);
      const rows = await response.json() as unknown[];
      if (!rows.length) return json({ error: "Demande introuvable." }, 404);
      return json({ ok: true, request: rows[0] });
    }
    return json({ error: "Route administrateur introuvable." }, 404);
  } catch {
    return json({ error: "Erreur de contrôle administrateur." }, 500);
  }
}
