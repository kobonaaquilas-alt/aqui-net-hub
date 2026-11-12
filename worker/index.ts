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

const legalPage = (title: string, body: string) => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>${title} | AQUI NET HUB</title><style>body{font:16px/1.65 system-ui,sans-serif;max-width:850px;margin:40px auto;padding:0 20px;color:#172033}h1,h2{line-height:1.2}a{color:#1769aa}.brand{font-weight:800}</style></head><body><p class="brand"><a href="/">AQUI NET HUB</a></p><h1>${title}</h1><p><small>Dernière mise à jour : 11 novembre 2026</small></p>${body}<p><a href="/">Retour à AQUI NET HUB</a></p></body></html>`, {headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=3600"}});
const termsBody = `
<h2>1. Objet</h2><p>AQUI NET HUB présente des outils numériques, des ressources de formation et des services de création et d'analyse de contenu. Certaines fonctions peuvent nécessiter un compte ou un abonnement.</p>
<h2>2. Compte</h2><p>Fournissez des informations exactes et protégez vos identifiants. Vous êtes responsable des activités réalisées depuis votre compte.</p>
<h2>3. Utilisation</h2><p>Vous vous engagez à respecter les lois applicables, les droits des tiers et la sécurité de la plateforme. Toute utilisation frauduleuse, abusive ou perturbatrice est interdite.</p>
<h2>4. Services tiers</h2><p>Les outils externes sont indépendants et soumis à leurs propres conditions. AQUI NET HUB ne garantit ni leur disponibilité, ni leurs prix, ni leurs fonctionnalités.</p>
<h2>5. Abonnements et paiements</h2><p>Le prix, la durée et les conditions d'un abonnement sont affichés avant la commande. Les fonctions payantes sont activées après confirmation du paiement. Les remboursements sont soumis au droit applicable et aux conditions présentées lors de l'achat.</p>
<h2>6. Contenus et analyses</h2><p>Vous restez responsable des contenus que vous fournissez. Les analyses et recommandations sont informatives et ne garantissent aucun résultat en matière de visibilité, d'audience ou de revenus.</p>
<h2>7. Publicité et essai</h2><p>Les campagnes AQUI NET ADS sont soumises par les annonceurs, qui garantissent disposer des droits nécessaires et respecter la loi ainsi que les règles de la plateforme. La première campagne peut bénéficier d’un essai gratuit de 3 jours par compte. Aucun paiement automatique n’est effectué à la fin de l’essai : la diffusion prend fin jusqu’à la souscription d’une formule payante. AQUI NET HUB peut suspendre une campagne illégale, trompeuse ou contraire aux règles.</p>
<h2>8. Disponibilité</h2><p>Les fonctionnalités peuvent évoluer ou être temporairement suspendues pour maintenance, sécurité ou amélioration.</p>
<h2>9. Contact</h2><p>Assistance : +228 92 24 46 53 ou <a href="https://wa.me/22892244653">WhatsApp</a>.</p>`;
const privacyBody = `
<h2>1. Responsable et contact</h2><p>AQUI NET HUB fournit ce service depuis le Togo. Contact : +228 92 24 46 53 ou <a href="https://wa.me/22892244653">WhatsApp</a>.</p>
<h2>2. Données traitées</h2><p>Selon les fonctions utilisées, nous pouvons traiter les informations de compte (notamment adresse e-mail et identifiant), les demandes d'assistance, les informations de commande et d'abonnement, les données des campagnes publicitaires (titre, description, liens, visuel, dates d'essai et de diffusion), ainsi que les contenus que vous choisissez de transmettre.</p>
<h2>3. Réseaux sociaux</h2><p>La connexion Facebook, lorsqu'elle est configurée, utilise l'authentification officielle Meta et ne demande jamais votre mot de passe à AQUI NET HUB. Après autorisation, le service peut lire les Pages que vous administrez et les statistiques permises par Meta. Vous pouvez retirer l'accès depuis les paramètres de votre compte Facebook. Les données sont conservées pour fournir le service et supprimées sur demande, sous réserve des obligations légales. TikTok n'est pas encore connecté directement.</p>
<h2>4. Finalités</h2><p>Les données servent à créer et sécuriser les comptes, fournir les fonctions demandées, gérer les abonnements et paiements, répondre aux demandes, prévenir les abus et améliorer le service.</p>
<h2>5. Prestataires et partage</h2><p>Des prestataires techniques nécessaires au service peuvent traiter des données, notamment Cloudflare pour l'hébergement et Supabase pour la base de données. Le traitement des paiements peut impliquer le prestataire de paiement activé. Les données ne sont pas vendues à des annonceurs.</p>
<h2>6. Conservation et sécurité</h2><p>Les données sont conservées pendant la durée nécessaire aux finalités décrites, sous réserve des obligations légales. Des mesures raisonnables de sécurité sont mises en œuvre, sans qu'une sécurité absolue puisse être garantie.</p>
<h2>7. Vos demandes</h2><p>Vous pouvez demander l'accès, la rectification ou la suppression des données associées à votre compte, sous réserve des obligations légales, en contactant l'assistance. Vous pouvez retirer les autorisations accordées à un service tiers depuis les paramètres de ce service.</p>
<h2>8. Cookies et modifications</h2><p>Des mécanismes techniques peuvent être utilisés pour le fonctionnement et la sécurité du site. Cette politique peut être mise à jour ; sa date figure en haut de page.</p>`;

async function runScheduledMaintenance(env: Env): Promise<void> {
  if (!env.SUPABASE_URL || !serviceKey(env)) {
    console.error("Scheduled maintenance skipped: Supabase service credentials are missing.");
    return;
  }
  const base = env.SUPABASE_URL + "/rest/v1/";
  const now = encodeURIComponent(new Date().toISOString());
  const [subscriptions, oauthStates] = await Promise.all([
    fetch(`${base}hub_subscriptions?status=eq.active&ends_at=lte.${now}`, {
      method: "PATCH",
      headers: headers(env),
      body: JSON.stringify({ status: "expired" }),
    }),
    fetch(`${base}hub_facebook_oauth_states?expires_at=lt.${now}`, {
      method: "DELETE",
      headers: headers(env),
    }),
  ]);
  if (!subscriptions.ok || !oauthStates.ok) {
    console.error("Scheduled maintenance failed.", {
      subscriptions_status: subscriptions.status,
      oauth_cleanup_status: oauthStates.status,
    });
    throw new Error("Scheduled maintenance request failed.");
  }
  console.log("Scheduled maintenance completed.", {
    subscriptions_expired: subscriptions.headers.get("content-range") || "updated",
    oauth_states_cleanup: oauthStates.status,
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
          health_schema: "2026-11-10-facebook-oauth-v1",
          supabase: !!env.SUPABASE_URL && !!env.SUPABASE_ANON_KEY && !!serviceKey(env),
          supabase_url: !!env.SUPABASE_URL,
          supabase_anon_key: !!env.SUPABASE_ANON_KEY,
          supabase_service_key: !!serviceKey(env),
          cinetpay: !!env.CINETPAY_API_KEY && !!env.CINETPAY_API_PASSWORD,
          cinetpay_api_key: !!env.CINETPAY_API_KEY,
          cinetpay_api_password: !!env.CINETPAY_API_PASSWORD,
          video_github_token: !!env.GITHUB_TOKEN,
          facebook_oauth: !!env.FACEBOOK_APP_ID && !!env.FACEBOOK_APP_SECRET,
          facebook_app_id: !!env.FACEBOOK_APP_ID,
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
      return json({ error: "Erreur interne du serveur." }, 500);
    }
  },
};
