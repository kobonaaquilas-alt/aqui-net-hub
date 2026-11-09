import { CinetPayClient, parseNotification, verifyNotification } from "cinetpay-js";
import { handleAdmin } from "./admin";
import { handleVideo } from "./video";
import { handleSocial } from "./social";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  CINETPAY_API_KEY: string;
  CINETPAY_API_PASSWORD: string;
  APP_BASE_URL?: string;
  GITHUB_TOKEN: string;
  VIDEO_WORKFLOW_REF?: string;
}
type AuthUser = { id: string; email?: string };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const serviceKey = (env: Env) => env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
const headers = (env: Env) => ({
  apikey: serviceKey(env),
  "Content-Type": "application/json",
  Prefer: "return=representation",
});
async function authUser(request: Request, env: Env): Promise<AuthUser | null> {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = await response.json() as AuthUser;
  return user?.id ? user : null;
}
async function createPayment(request: Request, env: Env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !serviceKey(env))
    return json({ error: "Backend Supabase non configuré." }, 503);
  if (!env.CINETPAY_API_KEY || !env.CINETPAY_API_PASSWORD)
    return json({ error: "Paiement non configuré : identifiants marchands absents." }, 503);
  const user = await authUser(request, env);
  if (!user) return json({ error: "Connexion requise." }, 401);
  let body: { plan_id?: string; first_name?: string; last_name?: string; phone?: string };
  try { body = await request.json() as typeof body; }
  catch { return json({ error: "Corps de requête invalide." }, 400); }
  const firstName = body.first_name?.trim();
  const lastName = body.last_name?.trim();
  const phone = body.phone?.trim();
  if (!body.plan_id || !firstName || firstName.length < 2 || !lastName || lastName.length < 2 || !user.email)
    return json({ error: "Informations de paiement incomplètes." }, 400);
  const planResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/hub_plans?id=eq.${encodeURIComponent(body.plan_id)}&is_active=eq.true&select=id,name,amount_xof,duration_days`,
    { headers: headers(env) },
  );
  if (!planResponse.ok) return json({ error: "Lecture des formules impossible." }, 502);
  const plans = await planResponse.json() as Array<{ id: string; name: string; amount_xof: number; duration_days: number }>;
  const plan = plans[0];
  if (!plan) return json({ error: "Formule indisponible." }, 404);
  if (!Number.isInteger(plan.amount_xof) || plan.amount_xof < 100 || plan.amount_xof > 2_500_000 ||
      !Number.isInteger(plan.duration_days) || plan.duration_days < 1)
    return json({ error: "Configuration de formule invalide." }, 422);

  const merchantId = `ANH-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const orderResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/hub_payment_orders`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({
      user_id: user.id,
      plan_id: plan.id,
      plan_name: plan.name,
      duration_days: plan.duration_days,
      amount_xof: plan.amount_xof,
      merchant_transaction_id: merchantId,
    }),
  });
  if (!orderResponse.ok) return json({ error: "Création de commande impossible." }, 500);

  try {
    const client = new CinetPayClient({
      credentials: { TG: { apiKey: env.CINETPAY_API_KEY, apiPassword: env.CINETPAY_API_PASSWORD } },
    });
    const base = env.APP_BASE_URL || new URL(request.url).origin;
    const payment = await client.payment.initialize({
      currency: "XOF",
      merchantTransactionId: merchantId,
      amount: plan.amount_xof,
      lang: "fr",
      designation: `AQUI NET HUB - ${plan.name}`,
      clientEmail: user.email,
      clientFirstName: firstName,
      clientLastName: lastName,
      ...(phone ? { clientPhoneNumber: phone } : {}),
      successUrl: `${base}/?payment=return`,
      failedUrl: `${base}/?payment=failed`,
      notifyUrl: `${base}/api/payments/webhook`,
      channel: "PUSH",
    }, "TG");
    if (!payment.paymentUrl || !payment.notifyToken || !payment.transactionId ||
        payment.merchantTransactionId !== merchantId)
      throw new Error("Réponse CinetPay incomplète ou incohérente.");
    const saved = await fetch(
      `${env.SUPABASE_URL}/rest/v1/hub_payment_orders?merchant_transaction_id=eq.${encodeURIComponent(merchantId)}`,
      {
        method: "PATCH",
        headers: headers(env),
        body: JSON.stringify({
          payment_url: payment.paymentUrl,
          notify_token: payment.notifyToken,
          cinetpay_transaction_id: payment.transactionId,
        }),
      },
    );
    if (!saved.ok) throw new Error("Impossible d'enregistrer les métadonnées du paiement.");
    return json({ payment_url: payment.paymentUrl });
  } catch {
    await fetch(
      `${env.SUPABASE_URL}/rest/v1/hub_payment_orders?merchant_transaction_id=eq.${encodeURIComponent(merchantId)}`,
      { method: "PATCH", headers: headers(env), body: JSON.stringify({ status: "failed" }) },
    );
    return json({ error: "CinetPay n'a pas pu initialiser le paiement." }, 502);
  }
}
async function accountSummary(request: Request, env: Env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !serviceKey(env))
    return json({ error: "Backend Supabase non configuré." }, 503);
  const user = await authUser(request, env);
  if (!user) return json({ error: "Connexion requise." }, 401);
  const base = env.SUPABASE_URL + "/rest/v1/";
  const [subscriptionResponse, paymentResponse] = await Promise.all([
    fetch(`${base}hub_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=id,plan_id,starts_at,ends_at,status&order=ends_at.desc&limit=10`, { headers: headers(env) }),
    fetch(`${base}hub_payment_orders?user_id=eq.${encodeURIComponent(user.id)}&select=id,merchant_transaction_id,amount_xof,currency,status,created_at,paid_at&order=created_at.desc&limit=5`, { headers: headers(env) }),
  ]);
  if (!subscriptionResponse.ok || !paymentResponse.ok)
    return json({ error: "Impossible de charger les informations du compte." }, 502);
  const subscriptions = await subscriptionResponse.json() as Array<{
    id: string; plan_id: string; starts_at: string; ends_at: string; status: string;
  }>;
  const payments = await paymentResponse.json() as Array<{
    id: string; merchant_transaction_id: string; amount_xof: number; currency: string;
    status: string; created_at: string; paid_at: string | null;
  }>;
  const planIds = [...new Set(subscriptions.map(item => item.plan_id))];
  let planNames: Record<string, string> = {};
  if (planIds.length) {
    const inFilter = planIds.map(id => `"${id}"`).join(",");
    const plansResponse = await fetch(
      `${base}hub_plans?select=id,name&id=in.(${encodeURIComponent(inFilter)})`,
      { headers: headers(env) },
    );
    if (plansResponse.ok) {
      const plans = await plansResponse.json() as Array<{ id: string; name: string }>;
      planNames = Object.fromEntries(plans.map(plan => [plan.id, plan.name]));
    }
  }
  return json({
    subscriptions: subscriptions.map(item => ({ ...item, plan_name: planNames[item.plan_id] || "Formule AQUI NET HUB" })),
    payments,
  });
}
async function webhook(request: Request, env: Env) {
  if (!env.SUPABASE_URL || !serviceKey(env) ||
      !env.CINETPAY_API_KEY || !env.CINETPAY_API_PASSWORD)
    return json({ error: "Service de paiement non configuré." }, 503);
  let payload: unknown;
  try {
    const contentType = request.headers.get("Content-Type") || "";
    const raw = await request.text();
    payload = contentType.includes("application/json")
      ? JSON.parse(raw)
      : Object.fromEntries(new URLSearchParams(raw));
  } catch { return json({ error: "Notification illisible." }, 400); }
  let notification;
  try { notification = parseNotification(payload); }
  catch { return json({ error: "Notification invalide." }, 400); }

  const orderResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/hub_payment_orders?merchant_transaction_id=eq.${encodeURIComponent(notification.merchantTransactionId)}&select=id,amount_xof,notify_token,cinetpay_transaction_id,status`,
    { headers: headers(env) },
  );
  if (!orderResponse.ok) return json({ error: "Lecture de commande impossible." }, 502);
  const rows = await orderResponse.json() as Array<{
    id: string; amount_xof: number; notify_token: string | null;
    cinetpay_transaction_id: string | null; status: string;
  }>;
  const order = rows[0];
  if (!order || !order.notify_token ||
      !verifyNotification(order.notify_token, notification.notifyToken))
    return json({ error: "Notification invalide." }, 401);
  if (order.status === "paid") return json({ received: true });
  if (order.cinetpay_transaction_id !== notification.transactionId)
    return json({ error: "Identifiant de transaction incohérent." }, 409);

  const client = new CinetPayClient({
    credentials: { TG: { apiKey: env.CINETPAY_API_KEY, apiPassword: env.CINETPAY_API_PASSWORD } },
  });
  const verified = await client.payment.getStatus(notification.transactionId, "TG");
  if (verified.merchantTransactionId !== notification.merchantTransactionId ||
      verified.transactionId !== notification.transactionId)
    return json({ error: "Réponse CinetPay incohérente." }, 409);

  if (verified.status === "SUCCESS") {
    const confirmed = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/confirm_hub_payment`, {
      method: "POST",
      headers: headers(env),
      body: JSON.stringify({ p_order_id: order.id, p_transaction_id: notification.transactionId }),
    });
    if (!confirmed.ok) return json({ error: "Confirmation interne impossible." }, 500);
    const result = await confirmed.json();
    if (result !== true) return json({ error: "Commande non confirmée." }, 409);
  } else if (verified.status === "FAILED") {
    const failed = await fetch(`${env.SUPABASE_URL}/rest/v1/hub_payment_orders?id=eq.${order.id}&status=eq.pending`, {
      method: "PATCH",
      headers: headers(env),
      body: JSON.stringify({ status: "failed" }),
    });
    if (!failed.ok) return json({ error: "Mise à jour de commande impossible." }, 500);
  }
  return json({ received: true });
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/api/public/campaigns") {
        const response = await fetch(`${env.SUPABASE_URL}/rest/v1/hub_campaigns?is_active=eq.true&select=id,title,description,destination_url,image_url,starts_at,ends_at&order=created_at.desc&limit=100`, { headers: { apikey: env.SUPABASE_ANON_KEY } });
        if (!response.ok) return json({ error: "Publicités indisponibles." }, 502);
        const campaigns = await response.json() as Array<{ starts_at: string | null; ends_at: string | null }>;
        const now = Date.now();
        return json({ campaigns: campaigns.filter(c => (!c.starts_at || new Date(c.starts_at).getTime() <= now) && (!c.ends_at || new Date(c.ends_at).getTime() >= now)) });
      }
      if (request.method === "GET" && url.pathname === "/api/public/settings") {
        const response = await fetch(`${env.SUPABASE_URL}/rest/v1/hub_site_settings?setting_key=eq.adsense_client&select=setting_value&limit=1`, { headers: { apikey: env.SUPABASE_ANON_KEY } });
        if (!response.ok) return json({ adsense_client: "" });
        const rows = await response.json() as Array<{ setting_value: string }>;
        return json({ adsense_client: rows[0]?.setting_value || "" });
      }
      if (request.method === "GET" && url.pathname === "/ads.txt") {
        const response = await fetch(`${env.SUPABASE_URL}/rest/v1/hub_site_settings?setting_key=eq.adsense_client&select=setting_value&limit=1`, { headers: { apikey: env.SUPABASE_ANON_KEY } });
        const rows = response.ok ? await response.json() as Array<{ setting_value: string }> : [];
        const publisher = (rows[0]?.setting_value || "").replace(/^ca-pub-/, "");
        return new Response(/^\d{16}$/.test(publisher) ? `google.com, pub-${publisher}, DIRECT, f08c47fec0942fa0\n` : "", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" } });
      }
      if (url.pathname.startsWith("/api/social/")) return handleSocial(request, env);
      if (request.method === "GET" && url.pathname === "/api/health")
        return json({
          ok: true,
          supabase: !!env.SUPABASE_URL && !!env.SUPABASE_ANON_KEY && !!serviceKey(env),
          supabase_url: !!env.SUPABASE_URL,
          supabase_anon_key: !!env.SUPABASE_ANON_KEY,
          supabase_service_key: !!serviceKey(env),
          cinetpay: !!env.CINETPAY_API_KEY && !!env.CINETPAY_API_PASSWORD,
          cinetpay_api_key: !!env.CINETPAY_API_KEY,
          cinetpay_api_password: !!env.CINETPAY_API_PASSWORD,
        });
      if (url.pathname === "/api/video/jobs" && request.method === "POST")
        return handleVideo(request, env);
      if (url.pathname.startsWith("/api/video/jobs/") && request.method === "GET")
        return handleVideo(request, env);
      if (request.method === "POST" && url.pathname === "/api/payments/create")
        return createPayment(request, env);
      if (request.method === "POST" && url.pathname === "/api/payments/webhook")
        return webhook(request, env);
      if (request.method === "GET" && url.pathname === "/api/account/summary")
        return accountSummary(request, env);
      if (url.pathname.startsWith("/api/admin/")) {
        const user = await authUser(request, env);
        if (!user) return json({ error: "Connexion requise." }, 401);
        return handleAdmin(request, env, user);
      }
      if (url.pathname.startsWith("/api/")) return json({ error: "Route introuvable." }, 404);
      return env.ASSETS.fetch(request);
    } catch {
      return json({ error: "Erreur interne du service." }, 500);
    }
  },
};
