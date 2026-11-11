type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
};

type User = { id: string };
type Trial = { started_at: string; ends_at: string };
type Subscription = { ends_at: string };

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const serviceKey = (env: Env) => env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
const dbHeaders = (env: Env) => ({
  apikey: serviceKey(env),
  Authorization: "Bearer " + serviceKey(env),
  "Content-Type": "application/json",
  Prefer: "return=representation",
});

async function currentUser(request: Request, env: Env): Promise<User | null> {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\\s+/i, "").trim();
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const response = await fetch(env.SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + token },
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: string };
  return user.id ? { id: user.id } : null;
}

function validPublicHttps(value: unknown, required = true): string | null | false {
  const raw = String(value || "").trim();
  if (!raw && !required) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^\\[|\\]$/g, "");
    const blocked = host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host === "0.0.0.0" || host === "::1" ||
      /^(10\\.|127\\.|169\\.254\\.|192\\.168\\.|172\\.(1[6-9]|2\\d|3[01])\\.)/.test(host) ||
      /^\\d{1,3}(\\.\\d{1,3}){3}$/.test(host);
    if (url.protocol !== "https:" || url.username || url.password || blocked || !host.includes(".")) return false;
    return url.toString();
  } catch { return false; }
}

async function activeSubscription(env: Env, userId: string): Promise<Subscription | null> {
  const now = encodeURIComponent(new Date().toISOString());
  const response = await fetch(
    env.SUPABASE_URL + "/rest/v1/hub_subscriptions?user_id=eq." + encodeURIComponent(userId) +
    "&status=eq.active&ends_at=gt." + now + "&select=ends_at&order=ends_at.desc&limit=1",
    { headers: dbHeaders(env) },
  );
  if (!response.ok) throw new Error("subscription_lookup_failed");
  const rows = await response.json() as Subscription[];
  return rows[0] || null;
}

async function getTrial(env: Env, userId: string): Promise<Trial | null> {
  const response = await fetch(
    env.SUPABASE_URL + "/rest/v1/hub_advertiser_trials?user_id=eq." + encodeURIComponent(userId) +
    "&select=started_at,ends_at&limit=1",
    { headers: dbHeaders(env) },
  );
  if (!response.ok) throw new Error("trial_lookup_failed");
  const rows = await response.json() as Trial[];
  return rows[0] || null;
}

async function ensureTrial(env: Env, userId: string): Promise<Trial> {
  let trial = await getTrial(env, userId);
  if (trial) return trial;
  const started = new Date();
  const ends = new Date(started.getTime() + 3 * 24 * 60 * 60 * 1000);
  const created = await fetch(env.SUPABASE_URL + "/rest/v1/hub_advertiser_trials?on_conflict=user_id", {
    method: "POST",
    headers: { ...dbHeaders(env), Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ user_id: userId, started_at: started.toISOString(), ends_at: ends.toISOString() }),
  });
  if (!created.ok) throw new Error("trial_creation_failed");
  trial = await getTrial(env, userId);
  if (!trial) throw new Error("trial_creation_failed");
  return trial;
}

async function campaignAccess(env: Env, userId: string): Promise<
  { allowed: true; endsAt: string; trial: Trial | null; subscription: Subscription | null } |
  { allowed: false; trial: Trial | null }
> {
  const subscription = await activeSubscription(env, userId);
  if (subscription) return { allowed: true, endsAt: subscription.ends_at, trial: await getTrial(env, userId), subscription };
  const trial = await ensureTrial(env, userId);
  if (new Date(trial.ends_at).getTime() > Date.now())
    return { allowed: true, endsAt: trial.ends_at, trial, subscription: null };
  return { allowed: false, trial };
}

async function listCampaigns(env: Env, userId: string): Promise<Response> {
  const response = await fetch(
    env.SUPABASE_URL + "/rest/v1/hub_campaigns?owner_user_id=eq." + encodeURIComponent(userId) +
    "&is_self_service=eq.true&select=id,title,description,destination_url,image_url,is_active,starts_at,ends_at,trial_started_at,created_at&order=created_at.desc&limit=100",
    { headers: dbHeaders(env) },
  );
  if (!response.ok) return json({ error: "Impossible de charger tes campagnes." }, 502);
  const campaigns = await response.json();
  const [trial, subscription] = await Promise.all([getTrial(env, userId), activeSubscription(env, userId)]);
  return json({ campaigns, trial, subscription_active: !!subscription });
}

async function createCampaign(request: Request, env: Env, user: User): Promise<Response> {
  let body: { title?: string; description?: string; destination_url?: string; image_url?: string };
  try { body = await request.json() as typeof body; }
  catch { return json({ error: "Corps de requête invalide." }, 400); }

  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const destination = validPublicHttps(body.destination_url);
  const image = validPublicHttps(body.image_url, false);
  if (title.length < 4 || title.length > 80 || description.length < 10 || description.length > 500)
    return json({ error: "Le titre doit contenir 4 à 80 caractères et la description 10 à 500 caractères." }, 400);
  if (!destination || image === false)
    return json({ error: "Les liens de destination et d'image doivent être des URL HTTPS publiques valides." }, 400);

  const access = await campaignAccess(env, user.id);
  if (!access.allowed) return json({
    error: "Ton essai publicitaire gratuit de 3 jours est terminé. Active un abonnement pour relancer une campagne.",
    code: "AD_TRIAL_EXPIRED",
    trial_ends_at: access.trial?.ends_at || null,
  }, 402);

  const row = {
    owner_user_id: user.id,
    is_self_service: true,
    title,
    description,
    destination_url: destination,
    image_url: image,
    starts_at: new Date().toISOString(),
    ends_at: access.endsAt,
    trial_started_at: access.trial?.started_at || null,
    is_active: true,
  };
  const saved = await fetch(env.SUPABASE_URL + "/rest/v1/hub_campaigns", {
    method: "POST",
    headers: dbHeaders(env),
    body: JSON.stringify(row),
  });
  if (!saved.ok) return json({ error: "Impossible de publier cette campagne." }, 502);
  const rows = await saved.json() as Array<Record<string, unknown>>;
  return json({
    ok: true,
    campaign: rows[0] || null,
    trial: access.trial,
    subscription_active: !!access.subscription,
  }, 201);
}

async function updateCampaign(request: Request, env: Env, user: User, campaignId: string): Promise<Response> {
  let body: { is_active?: boolean };
  try { body = await request.json() as typeof body; }
  catch { return json({ error: "Corps de requête invalide." }, 400); }
  if (typeof body.is_active !== "boolean") return json({ error: "Statut de campagne invalide." }, 400);

  let patch: Record<string, unknown> = { is_active: body.is_active };
  if (body.is_active) {
    const access = await campaignAccess(env, user.id);
    if (!access.allowed) return json({
      error: "Ton essai publicitaire est terminé. Abonne-toi pour réactiver cette campagne.",
      code: "AD_TRIAL_EXPIRED",
      trial_ends_at: access.trial?.ends_at || null,
    }, 402);
    patch.ends_at = access.endsAt;
  }
  const response = await fetch(
    env.SUPABASE_URL + "/rest/v1/hub_campaigns?id=eq." + encodeURIComponent(campaignId) +
    "&owner_user_id=eq." + encodeURIComponent(user.id) + "&is_self_service=eq.true",
    { method: "PATCH", headers: dbHeaders(env), body: JSON.stringify(patch) },
  );
  if (!response.ok) return json({ error: "Mise à jour de la campagne impossible." }, 502);
  const rows = await response.json() as unknown[];
  return rows.length ? json({ ok: true }) : json({ error: "Campagne introuvable." }, 404);
}

async function deleteCampaign(env: Env, user: User, campaignId: string): Promise<Response> {
  const response = await fetch(
    env.SUPABASE_URL + "/rest/v1/hub_campaigns?id=eq." + encodeURIComponent(campaignId) +
    "&owner_user_id=eq." + encodeURIComponent(user.id) + "&is_self_service=eq.true",
    { method: "DELETE", headers: dbHeaders(env) },
  );
  if (!response.ok) return json({ error: "Suppression de la campagne impossible." }, 502);
  return json({ ok: true });
}

export async function handleAds(request: Request, env: Env): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !serviceKey(env))
    return json({ error: "Service publicitaire non configuré." }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: "Connexion requise." }, 401);
  try {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/ads/campaigns")
      return await listCampaigns(env, user.id);
    if (request.method === "POST" && url.pathname === "/api/ads/campaigns")
      return await createCampaign(request, env, user);
    const match = url.pathname.match(/^\\/api\\/ads\\/campaigns\\/([0-9a-f-]{36})$/i);
    if (match && request.method === "PATCH")
      return await updateCampaign(request, env, user, match[1]);
    if (match && request.method === "DELETE")
      return await deleteCampaign(env, user, match[1]);
    return json({ error: "Route publicitaire introuvable." }, 404);
  } catch (error) {
    console.error("AQUI NET ADS error", error);
    return json({ error: "Erreur pendant la gestion de la campagne." }, 500);
  }
}
