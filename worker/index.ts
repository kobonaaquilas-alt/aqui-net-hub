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
  PUBLIC_AD_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  AD_EVENT_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  ADS_USER_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  ADS_IP_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  BROWSER_TASK_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  SECURITY_ALERT_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  FACEBOOK_APP_ID?: string;
  FACEBOOK_APP_SECRET?: string;
  FACEBOOK_GRAPH_VERSION?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
}
type AuthUser = { id: string; email?: string };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY", "Permissions-Policy": "camera=(), microphone=(), geolocation=()" },
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
async function notifySecurityIncident(env: Env, incident: { ip: string; path: string; reason: string }): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    const allowed = await env.SECURITY_ALERT_LIMITER.limit({ key: incident.ip });
    if (!allowed.success) return;
    const message = [
      "🚨 ALERTE DE SÉCURITÉ — AQUI NET HUB",
      "Niveau : ÉLEVÉ",
      `Événement : ${incident.reason.slice(0, 160)}`,
      `Route : ${incident.path.slice(0, 160)}`,
      `IP source : ${incident.ip.slice(0, 80)}`,
      `Heure UTC : ${new Date().toISOString()}`,
      "",
      "Protection automatique : limitation de la requête."
    ].join("\\n");
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message,
        disable_web_page_preview: true
      })
    });
    if (!response.ok) {
      console.error("Telegram security notification failed.", { status: response.status });
    }
  } catch (error) {
    console.error("Telegram security notification error.", {
      message: error instanceof Error ? error.message : "unknown"
    });
  }
}
async function monitoredResponse(
  request: Request,
  env: Env,
  handler: (request: Request, env: Env) => Promise<Response>,
): Promise<Response> {
  const response = await handler(request, env);
  if (response.status === 429) {
    await notifySecurityIncident(env, {
      ip: request.headers.get("CF-Connecting-IP") || "unknown",
      path: new URL(request.url).pathname,
      reason: "Limitation automatique déclenchée sur une API",
    });
  }
  return response;
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
      designation: `AQUI NET HUB - ${plan.name}`,
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
async function manualPaymentConfig(env: Env) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/hub_site_settings?setting_key=eq.payment_number&select=setting_value&limit=1`, { headers: headers(env) });
  if (!response.ok) return json({ error: "Impossible de lire les paramètres de paiement." }, 502);
  const rows = await response.json() as Array<{ setting_value: string }>;
  return json({ payment_number: rows[0]?.setting_value || "", methods: { number: true, tmoney: false, flooz: false, bank: false, card: false, orange_money: false, wave: false } });
}
async function createManualPaymentOrder(request: Request, env: Env) {
  if (!env.SUPABASE_URL || !serviceKey(env)) return json({ error: "Backend non configuré." }, 503);
  const user = await authUser(request, env);
  if (!user) return json({ error: "Connexion requise." }, 401);
  let body: { plan_id?: string; proof_path?: string; reference?: string };
  try { body = await request.json() as typeof body; } catch { return json({ error: "Requête invalide." }, 400); }
  const proofPath = String(body.proof_path || "");
  if (!body.plan_id || !proofPath.startsWith(user.id + "/") || proofPath.length > 300)
    return json({ error: "Formule ou preuve de paiement invalide." }, 400);
  const proofCheck = await fetch(`${env.SUPABASE_URL}/storage/v1/object/hub-payment-proofs/${proofPath.split("/").map(encodeURIComponent).join("/")}`, { method: "HEAD", headers: { apikey: serviceKey(env), Authorization: `Bearer ${serviceKey(env)}` } });
  if (!proofCheck.ok) return json({ error: "Preuve introuvable dans le stockage sécurisé." }, 400);
  const planResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/hub_plans?id=eq.${encodeURIComponent(body.plan_id)}&is_active=eq.true&select=id,name,amount_xof,duration_days`, { headers: headers(env) });
  if (!planResponse.ok) return json({ error: "Lecture de la formule impossible." }, 502);
  const plans = await planResponse.json() as Array<{id:string;name:string;amount_xof:number;duration_days:number}>;
  const plan = plans[0];
  if (!plan) return json({ error: "Formule indisponible." }, 404);
  const merchantId = `MAN-${crypto.randomUUID().replace(/-/g,"").slice(0,20)}`;
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/hub_payment_orders`, {
    method: "POST", headers: headers(env),
    body: JSON.stringify({ user_id:user.id, plan_id:plan.id, plan_name:plan.name, duration_days:plan.duration_days, amount_xof:plan.amount_xof, currency:"XOF", merchant_transaction_id:merchantId, payment_method:"Paiement par numéro", manual_reference:String(body.reference||"").slice(0,120)||null, proof_path:proofPath, status:"pending" })
  });
  if (!response.ok) return json({ error: "Enregistrement de la demande de paiement impossible." }, 500);
  return json({ ok:true, status:"pending", merchant_transaction_id:merchantId }, 201);
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

const legalPage = (title: string, body: string) => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>${title} | AQUI NET HUB</title><style>body{font:16px/1.65 system-ui,sans-serif;max-width:850px;margin:40px auto;padding:0 20px;color:#172033}h1,h2{line-height:1.2}a{color:#1769aa}.brand{font-weight:800}</style></head><body><p class="brand"><a href="/">AQUI NET HUB</a></p><h1>${title}</h1><p><small>Dernière mise à jour : 15 novembre 2026</small></p>${body}<p><a href="/">Retour à AQUI NET HUB</a></p></body></html>`, {headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=3600","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","X-Frame-Options":"DENY","Permissions-Policy":"camera=(), microphone=(), geolocation=()"}});
const termsBody = `
<h2>1. Présentation</h2><p>AQUI NET HUB est une plateforme qui rassemble des outils numériques, des services d'intelligence artificielle, des ressources de formation, des idées et des opportunités destinées aux créateurs, entrepreneurs et utilisateurs du numérique.</p>
<h2>2. Compte utilisateur</h2><p>Certaines fonctionnalités nécessitent un compte. L'utilisateur doit fournir des informations exactes, protéger ses identifiants et signaler toute utilisation non autorisée de son compte. Les accès et fonctions disponibles peuvent dépendre de la formule choisie.</p>
<h2>3. Outils et services tiers</h2><p>Le catalogue peut présenter des services exploités par des tiers. Leur disponibilité, leurs quotas, leurs prix, leurs conditions d'utilisation et leurs politiques de confidentialité peuvent changer indépendamment d'AQUI NET HUB. L'utilisateur doit vérifier les conditions du fournisseur avant de créer un compte, téléverser un fichier ou utiliser un résultat à des fins commerciales. Un outil indiqué comme gratuit peut comporter des limites ou options payantes.</p>
<h2>4. Contenus générés et ressources</h2><p>Les résultats produits par des outils d'intelligence artificielle peuvent être inexacts, incomplets ou soumis aux conditions du fournisseur. L'utilisateur doit vérifier les résultats, respecter les droits d'auteur, les droits à l'image et les lois applicables. AQUI NET HUB ne garantit ni la disponibilité permanente d'un outil ni un résultat particulier.</p>
<h2>5. Publicités et abonnements</h2><p>Les campagnes publicitaires, essais gratuits, abonnements, prix, durées et moyens de paiement applicables sont présentés dans les espaces concernés avant validation. Une campagne peut être refusée ou suspendue si elle est trompeuse, illégale ou contraire aux règles de la plateforme. Les abonnements payants sont activés après confirmation du paiement selon le processus indiqué.</p>
<h2>6. Utilisation acceptable</h2><p>Il est interdit d'utiliser la plateforme pour diffuser des contenus illicites, trompeurs, portant atteinte aux droits d'autrui, ou pour tenter de compromettre ses systèmes, ses comptes ou ses données.</p>
<h2>7. Disponibilité et responsabilité</h2><p>Les fonctionnalités peuvent évoluer, être limitées ou temporairement indisponibles. Les services tiers restent soumis à leurs propres règles. Les informations et opportunités présentées sont fournies à titre informatif et ne constituent pas une garantie de revenus, de réussite commerciale ou de résultat.</p>
<h2>8. Contact</h2><p>Pour toute question, contacte l'équipe à <a href="mailto:kobonaquilas@gmail.com">kobonaquilas@gmail.com</a> ou au +228 92 24 46 53.</p>`;
const privacyBody = `
<h2>1. Responsable et contact</h2><p>AQUI NET HUB est exploité depuis le Togo. Contact : <a href="mailto:kobonaquilas@gmail.com">kobonaquilas@gmail.com</a> · +228 92 24 46 53 · <a href="https://wa.me/22892244653">WhatsApp</a>.</p>
<h2>2. Données susceptibles d'être traitées</h2><p>Selon les fonctions utilisées, la plateforme peut traiter l'adresse e-mail, l'identifiant de compte, les informations de profil, les préférences, les favoris, la progression, les demandes envoyées, les données nécessaires aux campagnes publicitaires, les informations d'abonnement et de paiement, ainsi que les journaux techniques et de sécurité.</p>
<h2>3. Finalités</h2><p>Ces données servent à créer et sécuriser les comptes, fournir les fonctionnalités demandées, enregistrer les préférences, traiter les demandes, gérer les campagnes et abonnements, confirmer les paiements, assurer l'assistance, prévenir les abus et améliorer le service.</p>
<h2>4. Outils et plateformes externes</h2><p>AQUI NET HUB référence des outils exploités par des tiers. Lorsque l'utilisateur ouvre un service externe ou choisit d'y transmettre un fichier ou une information, le traitement est soumis aux conditions et à la politique de confidentialité de ce fournisseur. Ne transmets que les données nécessaires et vérifie ses conditions avant utilisation.</p>
<h2>5. Prestataires et hébergement</h2><p>La plateforme peut s'appuyer sur Cloudflare pour l'hébergement et l'exécution, Supabase pour l'authentification et les données, ainsi que sur des prestataires de paiement, de génération de contenus et d'intégration lorsque ces services sont activés. Les données personnelles ne sont pas vendues aux annonceurs.</p>
<h2>6. Conservation et sécurité</h2><p>Les données sont conservées pendant la durée nécessaire aux finalités du service, à la sécurité et aux obligations applicables. Des mesures techniques et organisationnelles sont mises en place pour limiter les accès non autorisés ; aucun système ne peut garantir une sécurité absolue.</p>
<h2>7. Droits et demandes</h2><p>Pour demander l'accès, la rectification ou la suppression des données associées à ton compte, contacte <a href="mailto:kobonaquilas@gmail.com">kobonaquilas@gmail.com</a>. Certaines informations peuvent être conservées lorsqu'elles sont nécessaires à la sécurité, à la preuve d'une transaction ou à une obligation légale.</p>
<h2>8. Cookies et mises à jour</h2><p>Des mécanismes techniques peuvent être utilisés pour le fonctionnement, la sécurité et les préférences du site. Cette politique peut être mise à jour ; la date de révision figure en haut de la page.</p>`;
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
      const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
      const campaignEvent = url.pathname.match(/^\/api\/public\/campaigns\/([0-9a-f-]{36})\/(impression|click)$/i);
      const eventType = campaignEvent?.[2].toLowerCase();
      if (campaignEvent && (
        (eventType === "impression" && request.method === "POST") ||
        (eventType === "click" && request.method === "GET")
      )) {
        const rate = await env.AD_EVENT_LIMITER.limit({ key: clientIp });
        if (!rate.success) {
          await notifySecurityIncident(env, { ip: clientIp, path: url.pathname, reason: "Limite de sollicitations dépassée" });
          return json({ error: "Trop de sollicitations. Réessaie dans une minute." }, 429);
        }
      }
      if ((request.method === "GET" && url.pathname === "/api/public/campaigns") ||
          (request.method === "GET" && url.pathname === "/api/public/settings")) {
        const rate = await env.PUBLIC_AD_LIMITER.limit({ key: clientIp });
        if (!rate.success) {
          await notifySecurityIncident(env, { ip: clientIp, path: url.pathname, reason: "Limite de requêtes publiques dépassée" });
          return json({ error: "Trop de requêtes. Réessaie dans une minute." }, 429);
        }
      }
      if (campaignEvent && (
        (eventType === "impression" && request.method === "POST") ||
        (eventType === "click" && request.method === "GET")
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
        const eventResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/hub_ad_events`, {
          method: "POST",
          headers: headers(env),
          body: JSON.stringify({
            campaign_id: campaign.id,
            owner_user_id: campaign.owner_user_id,
            event_type: eventType,
          }),
        });
        if (!eventResponse.ok) {
          console.error("AQUI NET ADS event tracking failed.", {
            campaign_id: campaign.id,
            event_type: eventType,
            status: eventResponse.status,
          });
          if (eventType === "impression") return json({ error: "Enregistrement de l'impression impossible." }, 502);
        }
        if (eventType === "click") {
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
        return new Response(/^\d{16}$/.test(publisher) ? `google.com, pub-${publisher}, DIRECT, f08c47fec0942fa0\n` : "", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY" } });
      }
      const tiktokVerification = request.method === "GET" ? url.pathname.match(/^\/tiktok([A-Za-z0-9]+)\.txt$/) : null;
      if (tiktokVerification) return new Response(`tiktok-developers-site-verification=${tiktokVerification[1]}`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY" } });
      if (request.method === "GET" && url.pathname === "/terms") return legalPage("Conditions d'utilisation", termsBody);
      if (request.method === "GET" && url.pathname === "/privacy") return legalPage("Politique de confidentialité", privacyBody);
      if (url.pathname.startsWith("/api/browser/")) return monitoredResponse(request, env, handleBrowser);
      if (url.pathname.startsWith("/api/facebook/")) return monitoredResponse(request, env, handleFacebook);
      if (url.pathname.startsWith("/api/tiktok/")) return monitoredResponse(request, env, handleTikTok);
      if (url.pathname.startsWith("/api/social/")) return monitoredResponse(request, env, handleSocial);
      if (url.pathname.startsWith("/api/ads/")) return monitoredResponse(request, env, handleAds);
      if (request.method === "GET" && url.pathname === "/api/health")
        return json({
          ok: true,
          supabase: !!env.SUPABASE_URL && !!env.SUPABASE_ANON_KEY && !!serviceKey(env),
          video_provider_available: !!env.MAGIC_HOUR_API_KEY?.trim() || (!!env.FAL_KEY?.trim() && env.VIDEO_ALLOW_PAID_FALLBACK === "true"),
          cinetpay: !!env.CINETPAY_API_KEY && !!env.CINETPAY_API_PASSWORD,
          tiktok_oauth_configured: !!env.TIKTOK_CLIENT_KEY?.trim() && !!env.TIKTOK_CLIENT_SECRET?.trim(),
          facebook_oauth_configured: !!env.FACEBOOK_APP_ID?.trim() && !!env.FACEBOOK_APP_SECRET?.trim(),
        });
      if (url.pathname === "/api/video/jobs" && request.method === "POST")
        return monitoredResponse(request, env, handleVideo);
      if (url.pathname.startsWith("/api/video/jobs/") && request.method === "GET")
        return handleVideo(request, env);
      if (request.method === "GET" && url.pathname === "/api/payments/config") return manualPaymentConfig(env);
      if (request.method === "POST" && url.pathname === "/api/payments/manual-order") return createManualPaymentOrder(request, env);
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
