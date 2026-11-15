import { CinetPayClient, parseNotification, verifyNotification } from "cinetpay-js";
import { handleAdmin } from "./admin";
import { handleVideo } from "./video";
import { handleSocial } from "./social";
import { handleFacebook } from "./facebook";
import { handleTikTok } from "./tiktok";
import { handleBrowser } from "./browser";
import { handleAds } from "./ads";

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
  FAL_KEY?: string;
  MAGIC_HOUR_API_KEY?: string;
  VIDEO_ALLOW_PAID_FALLBACK?: string;
  FACEBOOK_APP_ID?: string;
  FACEBOOK_APP_SECRET?: string;
  FACEBOOK_GRAPH_VERSION?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
}
type AuthUser = { id: string; email?: string };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const serviceKey = (env: Env) => env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
const headers = (env: Env) => ({
  apikey: serviceKey(env),
  Authorization: `Bearer ${serviceKey(env)}`,
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
  let body: { plan_id?: string; first_name?: string; last_name?: string; phone?: string; native?: boolean };
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
      designation: `AQUI NET HELP - ${plan.name}`,
      clientEmail: user.email,
      clientFirstName: firstName,
      clientLastName: lastName,
      ...(phone ? { clientPhoneNumber: phone } : {}),
      successUrl: body.native ? `${base}/api/payments/return?status=return&native=1` : `${base}/?payment=return`,
      failedUrl: body.native ? `${base}/api/payments/return?status=failed&native=1` : `${base}/?payment=failed`,
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
    subscriptions: subscriptions.map(item => ({ ...item, plan_name: planNames[item.plan_id] || "Formule AQUI NET HELP" })),
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

const legalPage = (title: string, body: string) => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>${title} | AQUI NET HELP</title><style>body{font:16px/1.65 system-ui,sans-serif;max-width:850px;margin:40px auto;padding:0 20px;color:#172033}h1,h2{line-height:1.2}a{color:#1769aa}.brand{font-weight:800}</style></head><body><p class="brand"><a href="/">AQUI NET HELP</a></p><h1>${title}</h1><p><small>Dernière mise à jour : 15 novembre 2026</small></p>${body}<p><a href="/">Retour à AQUI NET HELP</a></p></body></html>`, {headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=3600"}});
const termsBody = `
<h2>1. Objet du service</h2><p>AQUI NET HELP est un outil d'analyse et d'optimisation des comptes TikTok, Facebook, Instagram et YouTube. Il fournit des indicateurs, des diagnostics et des recommandations à partir des données accessibles ou communiquées par l'utilisateur.</p>
<h2>2. Compte personnel</h2><p>Une adresse e-mail ne peut être associée qu'à un seul compte. L'utilisateur doit fournir des informations exactes, protéger ses identifiants et ne jamais communiquer son mot de passe de réseau social à AQUI NET HELP.</p>
<h2>3. Données et connexions sociales</h2><p>Les connexions TikTok et Facebook utilisent les API officielles et uniquement les autorisations accordées. Instagram et YouTube peuvent nécessiter une saisie manuelle de statistiques lorsque l'accès API correspondant n'est pas activé. Les données saisies manuellement ne sont pas certifiées par la plateforme sociale.</p>
<h2>4. Analyses et résultats</h2><p>Les scores et recommandations sont indicatifs et dépendent de la qualité, de la période et de l'exhaustivité des données. AQUI NET HELP ne garantit ni viralité, ni hausse d'abonnés, ni revenus, ni acceptation à un programme de monétisation.</p>
<h2>5. Essai gratuit et abonnements</h2><p>Chaque compte bénéficie de trois analyses gratuites. Après ces trois analyses, un abonnement actif est requis. Le prix, la durée, la devise et les moyens de paiement disponibles sont affichés avant la commande. L'accès payant est activé uniquement après confirmation du paiement par le prestataire et le serveur.</p>
<h2>6. Publicités, affiliation et services</h2><p>Les annonceurs garantissent disposer des droits sur leurs annonces et liens. Les campagnes peuvent être refusées ou suspendues si elles sont trompeuses, illégales ou contraires aux règles applicables. Les liens d'affiliation éventuels sont signalés. L'accompagnement à la monétisation ne garantit pas l'éligibilité ni l'approbation d'un compte.</p>
<h2>7. Utilisation acceptable</h2><p>La fraude, l'usurpation d'identité, la collecte non autorisée de données et toute tentative de compromettre le service sont interdites.</p>
<h2>8. Disponibilité et responsabilité</h2><p>Les fonctionnalités peuvent évoluer ou être temporairement indisponibles. Les API tierces restent soumises à leurs propres conditions et limites.</p>
<h2>9. Contact</h2><p>Assistance : +228 92 24 46 53, <a href="https://wa.me/22892244653">WhatsApp</a> ou <a href="mailto:kobonaquilas@gmail.com">kobonaquilas@gmail.com</a>.</p>`;
const privacyBody = `
<h2>1. Responsable et contact</h2><p>AQUI NET HELP est exploité depuis le Togo. Contact : <a href="mailto:kobonaquilas@gmail.com">kobonaquilas@gmail.com</a> · +228 92 24 46 53 · <a href="https://wa.me/22892244653">WhatsApp</a>.</p>
<h2>2. Données traitées</h2><p>Selon les fonctions utilisées, le service traite l'adresse e-mail, l'identifiant de compte, les informations de profil, les statistiques sociales autorisées ou saisies, les rapports d'analyse, les informations d'abonnement et les données nécessaires à la sécurité et à l'assistance.</p>
<h2>3. Finalités</h2><p>Les données sont utilisées pour authentifier les utilisateurs, exécuter les analyses demandées, gérer les quotas gratuits et abonnements, confirmer les paiements, assurer l'assistance, protéger la plateforme et mesurer les campagnes publicitaires.</p>
<h2>4. Connexions aux réseaux sociaux</h2><p>TikTok et Facebook sont connectés par leurs mécanismes officiels d'autorisation. Les jetons d'accès sont conservés côté serveur et peuvent être révoqués depuis l'espace AQUI NET HELP ou les paramètres du réseau concerné. Instagram et YouTube peuvent être analysés à partir de statistiques saisies manuellement lorsque leur connexion API n'est pas activée. Ne transmettez jamais vos mots de passe sociaux.</p>
<h2>5. Prestataires</h2><p>Le service s'appuie notamment sur Cloudflare pour l'hébergement, Supabase pour l'authentification et les données, ainsi que sur les prestataires sociaux et de paiement activés. Les données ne sont pas vendues aux annonceurs.</p>
<h2>6. Conservation et sécurité</h2><p>Les données sont conservées pendant la durée nécessaire aux finalités du service et aux obligations légales. Des mesures de sécurité techniques et organisationnelles sont mises en place ; aucun système ne peut toutefois garantir une sécurité absolue.</p>
<h2>7. Droits des utilisateurs</h2><p>Pour demander l'accès, la rectification ou la suppression des données associées à votre compte, contactez <a href="mailto:kobonaquilas@gmail.com">kobonaquilas@gmail.com</a> ou le +228 92 24 46 53. Certaines données peuvent être conservées lorsque la loi l'exige.</p>
<h2>8. Cookies et mises à jour</h2><p>Des mécanismes techniques peuvent être nécessaires au fonctionnement, à l'authentification et à la sécurité du site. La présente politique peut être mise à jour ; la date de révision figure en haut de page.</p>`;
async function runScheduledMaintenance(env: Env): Promise<void> {
  if (!env.SUPABASE_URL || !serviceKey(env)) {
    console.error("Scheduled maintenance skipped: Supabase service credentials are missing.");
    return;
  }
  const base = env.SUPABASE_URL + "/rest/v1/";
  const now = encodeURIComponent(new Date().toISOString());
  const [subscriptions, facebookOauthStates, tiktokOauthStates] = await Promise.all([
    fetch(`${base}hub_subscriptions?status=eq.active&ends_at=lte.${now}`, {
      method: "PATCH",
      headers: headers(env),
      body: JSON.stringify({ status: "expired" }),
    }),
    fetch(`${base}hub_facebook_oauth_states?expires_at=lt.${now}`, {
      method: "DELETE",
      headers: headers(env),
    }),
    fetch(`${base}hub_tiktok_oauth_states?expires_at=lt.${now}`, {
      method: "DELETE",
      headers: headers(env),
    }),
  ]);
  if (!subscriptions.ok || !facebookOauthStates.ok || !tiktokOauthStates.ok) {
    console.error("Scheduled maintenance failed.", {
      subscriptions_status: subscriptions.status,
      facebook_oauth_cleanup_status: facebookOauthStates.status,
      tiktok_oauth_cleanup_status: tiktokOauthStates.status,
    });
    throw new Error("Scheduled maintenance request failed.");
  }
  console.log("Scheduled maintenance completed.", {
    subscriptions_expired: subscriptions.headers.get("content-range") || "updated",
    facebook_oauth_cleanup_status: facebookOauthStates.status,
    tiktok_oauth_cleanup_status: tiktokOauthStates.status,
    executed_at: new Date().toISOString(),
  });
}

export default {
  scheduled(
    _controller: { cron: string; scheduledTime: number },
    env: Env,
    context: { waitUntil(promise: Promise<unknown>): void },
  ): void {
    context.waitUntil(runScheduledMaintenance(env));
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      const campaignEvent = url.pathname.match(/^\/api\/public\/campaigns\/([0-9a-f-]{36})\/(impression|click)$/i);
      if (campaignEvent && (
        (campaignEvent[2] === "impression" && request.method === "POST") ||
        (campaignEvent[2] === "click" && request.method === "GET")
      )) {
        const campaignResponse = await fetch(
          `${env.SUPABASE_URL}/rest/v1/hub_campaigns?id=eq.${encodeURIComponent(campaignEvent[1])}&is_active=eq.true&select=id,owner_user_id,destination_url,starts_at,ends_at&limit=1`,
          { headers: headers(env) },
        );
        if (!campaignResponse.ok) return json({ error: "Campagne indisponible." }, 502);
        const rows = await campaignResponse.json() as Array<{
          id: string; owner_user_id: string | null; destination_url: string | null;
          starts_at: string | null; ends_at: string | null;
        }>;
        const campaign = rows[0];
        const now = Date.now();
        if (!campaign ||
            (campaign.starts_at && new Date(campaign.starts_at).getTime() > now) ||
            (campaign.ends_at && new Date(campaign.ends_at).getTime() < now))
          return json({ error: "Campagne inactive ou expirée." }, 404);
        await fetch(`${env.SUPABASE_URL}/rest/v1/hub_ad_events`, {
          method: "POST",
          headers: headers(env),
          body: JSON.stringify({
            campaign_id: campaign.id,
            owner_user_id: campaign.owner_user_id,
            event_type: campaignEvent[2],
          }),
        });
        if (campaignEvent[2] === "click") {
          if (!campaign.destination_url || !campaign.destination_url.startsWith("https://"))
            return Response.redirect(new URL("/", request.url).toString(), 302);
          return Response.redirect(campaign.destination_url, 302);
        }
        return json({ ok: true });
      }
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
      const tiktokVerification = request.method === "GET" ? url.pathname.match(/^\/tiktok([A-Za-z0-9]+)\.txt$/) : null;
      if (tiktokVerification) return new Response(`tiktok-developers-site-verification=${tiktokVerification[1]}`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      if (request.method === "GET" && url.pathname === "/terms") return legalPage("Conditions d'utilisation", termsBody);
      if (request.method === "GET" && url.pathname === "/privacy") return legalPage("Politique de confidentialité", privacyBody);
      if (url.pathname.startsWith("/api/browser/")) return handleBrowser(request, env);
      if (url.pathname.startsWith("/api/facebook/")) return handleFacebook(request, env);
      if (url.pathname.startsWith("/api/tiktok/")) return handleTikTok(request, env);
      if (url.pathname.startsWith("/api/social/")) return handleSocial(request, env);
      if (url.pathname.startsWith("/api/ads/")) return handleAds(request, env);
      if (request.method === "GET" && url.pathname === "/api/health")
        return json({
          ok: true,
          health_schema: "2026-11-15-platform-automation-v2",
          video_engine: "Multi-provider (Magic Hour first, fal.ai optional paid fallback)",
          video_engine_configured: !!env.MAGIC_HOUR_API_KEY?.trim() || (!!env.FAL_KEY?.trim() && env.VIDEO_ALLOW_PAID_FALLBACK === "true"),
          video_provider_available: !!env.MAGIC_HOUR_API_KEY?.trim() || (!!env.FAL_KEY?.trim() && env.VIDEO_ALLOW_PAID_FALLBACK === "true"),
          magic_hour_api_key: !!env.MAGIC_HOUR_API_KEY?.trim(),
          fal_paid_fallback: !!env.FAL_KEY?.trim() && env.VIDEO_ALLOW_PAID_FALLBACK === "true",
          supabase: !!env.SUPABASE_URL && !!env.SUPABASE_ANON_KEY && !!serviceKey(env),
          supabase_url: !!env.SUPABASE_URL,
          supabase_anon_key: !!env.SUPABASE_ANON_KEY,
          supabase_service_key: !!serviceKey(env),
          cinetpay: !!env.CINETPAY_API_KEY && !!env.CINETPAY_API_PASSWORD,
          cinetpay_api_key: !!env.CINETPAY_API_KEY,
          cinetpay_api_password: !!env.CINETPAY_API_PASSWORD,
          browser_automation_available: !!env.GITHUB_TOKEN,
          github_actions_token_configured: !!env.GITHUB_TOKEN,
          fal_api_key: !!env.FAL_KEY?.trim(),
          facebook_oauth: !!env.FACEBOOK_APP_ID && !!env.FACEBOOK_APP_SECRET,
          facebook_app_id: !!env.FACEBOOK_APP_ID,
          tiktok_client_key_configured: !!env.TIKTOK_CLIENT_KEY?.trim(),
          tiktok_client_key_length: env.TIKTOK_CLIENT_KEY?.trim().length || 0,
          tiktok_client_secret_configured: !!env.TIKTOK_CLIENT_SECRET?.trim(),
        });
      if (url.pathname === "/api/video/jobs" && request.method === "POST")
        return handleVideo(request, env);
      if (url.pathname.startsWith("/api/video/jobs/") && request.method === "GET")
        return handleVideo(request, env);
      if (request.method === "POST" && url.pathname === "/api/payments/create")
        return createPayment(request, env);
      if (request.method === "GET" && url.pathname === "/api/payments/return") {
        const status = url.searchParams.get("status") === "failed" ? "failed" : "return";
        if (url.searchParams.get("native") === "1") {
          const deepLink = new URL("aquinet://oauth");
          deepLink.searchParams.set("payment", status);
          return Response.redirect(deepLink.toString(), 302);
        }
        const destination = new URL((env.APP_BASE_URL || url.origin) + "/");
        destination.searchParams.set("payment", status);
        return Response.redirect(destination.toString(), 302);
      }
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
      return json({ error: "Erreur interne du serveur." }, 500);
    }
  },
};
