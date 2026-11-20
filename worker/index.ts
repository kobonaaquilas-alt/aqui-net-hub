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

const guidePages: Record<string,{title:string;description:string;body:string}> = {
"/guides":{title:"Guides pratiques du numérique",description:"Des méthodes concrètes pour créer, apprendre et développer un projet numérique.",body:"<h2>Choisir un outil gratuit</h2><p>Compare les quotas, les exports, les filigranes, les droits et la compatibilité avant de créer un compte.</p><p><a href='/guides/choisir-outil-gratuit'>Lire le guide complet</a></p><h2>Créer une vidéo courte</h2><p>Prépare une accroche, une démonstration et une conclusion avant de filmer.</p><p><a href='/guides/video-courte-telephone'>Lire le guide complet</a></p><h2>Améliorer une photo</h2><p>Corrige la lumière et le cadrage sans dénaturer le sujet.</p><p><a href='/guides/ameliorer-photo'>Lire le guide complet</a></p><h2>Développer une présence en ligne</h2><p>Présente une offre claire, des coordonnées exactes et des informations fiables.</p><p><a href='/guides/presence-en-ligne'>Lire le guide complet</a></p><h2>Utiliser l'IA en sécurité</h2><p>Protège tes données et vérifie les réponses importantes.</p><p><a href='/guides/securite-outils-ia'>Lire le guide complet</a></p>"},
"/guides/choisir-outil-gratuit":{title:"Comment choisir un outil numérique vraiment gratuit",description:"Méthode de comparaison des offres gratuites, quotas et conditions.",body:"<p>Le mot gratuit peut désigner un logiciel libre, une formule gratuite permanente, un essai temporaire ou quelques crédits offerts. Ces modèles ne donnent pas les mêmes droits.</p><h2>1. Définis le résultat attendu</h2><p>Précise le fichier final, le format, ton appareil et la fréquence d'utilisation. Une vidéo verticale, un logo transparent et un site publié nécessitent des fonctions différentes.</p><h2>2. Vérifie les limites</h2><ul><li>Nombre de crédits et fréquence de renouvellement.</li><li>Durée de l'essai et prix après expiration.</li><li>Filigrane, résolution et formats d'export.</li><li>Carte bancaire éventuellement exigée.</li><li>Disponibilité dans ton pays et compatibilité mobile.</li></ul><h2>3. Vérifie les droits</h2><p>Lis les conditions sur l'usage commercial, les licences des contenus et la propriété des fichiers générés. Ne suppose pas qu'un résultat gratuit peut automatiquement être utilisé dans une publicité.</p><h2>4. Fais un test réel</h2><p>Teste un petit projet sans données confidentielles. Télécharge le résultat, ouvre-le sur ton appareil et vérifie sa qualité. Note le temps nécessaire et les limites rencontrées.</p><h2>5. Compare le coût total</h2><p>Un outil gratuit avec filigrane peut être moins utile qu'un logiciel libre. Un abonnement peut être rentable si son gain de temps est réel. Consulte toujours les tarifs et conditions officiels : ils changent.</p>"},
"/guides/video-courte-telephone":{title:"Préparer une vidéo courte de qualité avec un téléphone",description:"Un processus simple pour écrire, filmer, monter et publier une vidéo verticale.",body:"<p>Un téléphone suffit pour commencer. La clarté de l'idée, la qualité du son et la structure comptent davantage que les effets.</p><h2>1. Écris une idée en une phrase</h2><p>Exemples : « Je montre comment… », « Voici pourquoi… » ou « Trois erreurs à éviter… ». Une idée par vidéo facilite la compréhension.</p><h2>2. Prépare trois moments</h2><ol><li><strong>Accroche :</strong> annonce le problème ou le résultat dès le début.</li><li><strong>Démonstration :</strong> montre deux ou trois étapes concrètes.</li><li><strong>Conclusion :</strong> résume le résultat ou pose une question pertinente.</li></ol><h2>3. Filme proprement</h2><ul><li>Nettoie l'objectif et stabilise le téléphone.</li><li>Place-toi face à une lumière douce.</li><li>Évite le bruit et rapproche le micro de la voix.</li><li>Filme verticalement pour TikTok, Reels et Shorts.</li></ul><h2>4. Monte et vérifie</h2><p>Supprime les silences inutiles, ajoute des sous-titres relus et vérifie leur lisibilité sur un petit écran. Assure-toi d'avoir le droit d'utiliser les musiques et images choisies.</p><h2>5. Apprends des statistiques</h2><p>Observe la rétention, la durée moyenne de visionnage, les partages et les commentaires. Compare plusieurs vidéos similaires : une seule publication ne permet pas de conclure.</p><p>Des outils comme <a href='https://www.capcut.com/'>CapCut</a> et <a href='https://clipchamp.com/'>Clipchamp</a> proposent des fonctions de montage ; leurs quotas et conditions évoluent.</p>"},
"/guides/ameliorer-photo":{title:"Améliorer une photo sans dénaturer le sujet",description:"Corriger la lumière, le cadrage et la netteté avant de publier une image.",body:"<p>Une bonne retouche améliore la lisibilité d'une photo sans modifier artificiellement ce qu'elle représente.</p><h2>1. Garde une copie originale</h2><p>Duplique le fichier avant de commencer afin de pouvoir revenir à l'image initiale.</p><h2>2. Corrige le cadrage</h2><p>Redresse l'horizon, retire les distractions et laisse de l'espace autour du sujet. Vérifie le recadrage sur téléphone.</p><h2>3. Ajuste la lumière</h2><p>Commence par l'exposition, les hautes lumières et les ombres. Corrige ensuite la balance des blancs par petites étapes.</p><h2>4. Évite la sur-retouche</h2><p>Une accentuation excessive crée des contours artificiels. Les outils de netteté ne recréent pas les détails absents. Évite les filtres qui changent l'apparence réelle d'une personne.</p><h2>5. Exporte correctement</h2><p>Utilise JPEG pour une photo classique et PNG si la transparence est nécessaire. Choisis une résolution adaptée et vérifie le poids du fichier. Retire les métadonnées privées inutiles, comme une position GPS.</p><p><a href='https://www.photopea.com/'>Photopea</a> et <a href='https://www.canva.com/'>Canva</a> proposent des outils d'édition ; leurs fonctions gratuites varient.</p><h2>Respecte les personnes</h2><p>Obtiens les autorisations nécessaires avant de publier le portrait d'autrui. N'utilise pas la retouche pour fabriquer une preuve ou tromper le public.</p>"},
"/guides/presence-en-ligne":{title:"Lancer une présence en ligne pour une petite activité",description:"Les bases pour présenter une activité, rassurer les visiteurs et recevoir des demandes.",body:"<p>Une présence en ligne doit permettre de comprendre ce que tu proposes, à qui tu t'adresses et comment te contacter. Une page simple et exacte vaut mieux qu'un site complexe incomplet.</p><h2>1. Clarifie ton offre</h2><p>Décris ton produit ou service en une phrase. Indique le public concerné, la zone desservie et le besoin auquel tu réponds. Évite les promesses impossibles à vérifier.</p><h2>2. Prépare les informations</h2><ul><li>Nom et présentation cohérents.</li><li>Photos authentiques et nettes.</li><li>Liste claire des produits ou services.</li><li>Prix ou méthode transparente pour obtenir un devis.</li><li>Coordonnées réellement suivies.</li></ul><h2>3. Choisis le bon canal</h2><p>Une page sociale peut suffire pour tester une offre. Un site vitrine est utile pour présenter plusieurs services et publier des informations durables. <a href='https://sites.google.com/'>Google Sites</a> et <a href='https://wordpress.com/'>WordPress.com</a> ont des offres et limites différentes.</p><h2>4. Rassure tes visiteurs</h2><p>Présente clairement les conditions de vente si tu vends en ligne. Si tu collectes des données, explique leur usage. Ne publie pas de faux avis, de fausses adresses ou de certifications inexistantes.</p><h2>5. Mesure les résultats</h2><p>Note les demandes reçues, les questions fréquentes et les ventes réellement conclues. Améliore la page à partir de ces observations et sécurise tes comptes avec des mots de passe uniques et la double authentification.</p>"},
"/guides/securite-outils-ia":{title:"Utiliser les outils d'intelligence artificielle avec prudence",description:"Protéger ses informations et vérifier les résultats générés par les services IA.",body:"<p>Avant d'envoyer un texte, une image ou un fichier à un service IA, vérifie si ces données sont nécessaires et comment elles seront traitées.</p><h2>1. Évite les données sensibles</h2><p>N'envoie pas de mots de passe, pièces d'identité, coordonnées bancaires, dossiers médicaux ou documents confidentiels. Remplace les noms réels par des données fictives lorsqu'un exemple suffit.</p><h2>2. Lis la politique de confidentialité</h2><p>Vérifie les données collectées, leur durée de conservation, leur éventuelle utilisation pour améliorer les modèles et les moyens de demander leur suppression. Les garanties varient selon le fournisseur et le type de compte.</p><h2>3. Contrôle les permissions</h2><p>Lorsqu'un service demande l'accès à un compte Google ou social, examine les autorisations et n'accorde que celles qui sont nécessaires. Retire les accès devenus inutiles.</p><h2>4. Vérifie les réponses</h2><p>Une réponse fluide peut être fausse. Pour les informations importantes, consulte les sources originales, les documents officiels et leur date de mise à jour.</p><h2>5. Respecte les droits</h2><p>Vérifie les droits sur les images, musiques, textes et marques. Une génération par IA ne garantit pas que le résultat est libre de toute restriction.</p><h2>6. Sécurise ton compte</h2><ul><li>Mot de passe unique et robuste.</li><li>Double authentification activée.</li><li>Clés API et liens privés jamais partagés.</li><li>Vérification régulière des appareils et applications autorisés.</li></ul>"}
};
const guidePage=(path:string)=>{
 const page=guidePages[path];if(!page)return null;
 const html="<!doctype html><html lang='fr'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='robots' content='index,follow'><meta name='description' content='"+page.description+"'><link rel='canonical' href='https://aqui-net-hub.kobonaaquilas.workers.dev"+path+"'><title>"+page.title+" | AQUI NET HUB</title><style>body{font:16px/1.72 system-ui,sans-serif;max-width:850px;margin:36px auto;padding:0 22px;color:#172033}h1,h2{line-height:1.25;color:#10243e}h1{font-size:2rem}h2{margin-top:2rem;font-size:1.25rem}a{color:#075ca8}li{margin:.45rem 0}.brand{font-weight:800}.meta{color:#526174;font-size:.9rem}.content{margin-top:2rem}.related{border-top:1px solid #d6deea;margin-top:2rem;padding-top:1rem}</style></head><body><p class='brand'><a href='/'>AQUI NET HUB</a> · <a href='/guides'>Guides pratiques</a></p><main><h1>"+page.title+"</h1><p class='meta'>Guide pratique · Mis à jour le 20 novembre 2026</p><p>"+page.description+"</p><article class='content'>"+page.body+"</article><nav class='related'><p><a href='/guides'>← Tous les guides</a></p><p><a href='/about'>À propos</a> · <a href='/privacy'>Confidentialité</a> · <a href='/terms'>Conditions d’utilisation</a></p><p>Une erreur ou une suggestion ? <a href='mailto:kobonaaquilas@gmail.com'>kobonaaquilas@gmail.com</a>.</p></nav></main></body></html>";
 return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=3600","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","X-Frame-Options":"DENY"}});
};

const legalPage = (title: string, body: string) => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow"><title>${title} | AQUI NET HUB</title><style>body{font:16px/1.65 system-ui,sans-serif;max-width:850px;margin:40px auto;padding:0 20px;color:#172033}h1,h2{line-height:1.2}a{color:#1769aa}.brand{font-weight:800}</style></head><body><p class="brand"><a href="/">AQUI NET HUB</a></p><h1>${title}</h1><p><small>Dernière mise à jour : 15 novembre 2026</small></p>${body}<p><a href="/">Retour à AQUI NET HUB</a></p></body></html>`, {headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=3600","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","X-Frame-Options":"DENY","Permissions-Policy":"camera=(), microphone=(), geolocation=()"}});
const aboutBody = `
<h2>Notre mission</h2><p>AQUI NET HUB est une plateforme indépendante créée pour aider les internautes, les créateurs de contenu, les étudiants et les entrepreneurs à découvrir des ressources numériques utiles, notamment en Afrique francophone. Notre objectif est de rendre les outils numériques plus faciles à repérer et à utiliser, sans promettre de résultats financiers ou techniques garantis.</p>
<h2>Ce que vous trouverez ici</h2><p>Le catalogue présente des outils de création assistée par intelligence artificielle, de montage vidéo, de retouche photo, de productivité, de formation et de création de sites web. Des guides pratiques expliquent les principales étapes pour démarrer, comparer les possibilités et éviter les erreurs courantes.</p>
<h2>Notre méthode de présentation</h2><p>Les services référencés sont exploités par leurs éditeurs respectifs. AQUI NET HUB n'en est pas propriétaire et ne prétend pas les représenter. Les offres gratuites peuvent être limitées par des crédits, des quotas, des filigranes ou des conditions qui évoluent. Nous encourageons chaque visiteur à consulter les conditions officielles avant de créer un compte, de transmettre un fichier ou d'utiliser un résultat à des fins commerciales.</p>
<h2>Indépendance et transparence</h2><p>La présence d'un service dans le catalogue ne constitue pas une garantie, une certification ou une approbation de son éditeur. Les contenus sponsorisés et les campagnes publicitaires, lorsqu'ils sont activés, doivent être distingués des recommandations éditoriales. Nous cherchons à maintenir des informations utiles, claires et régulièrement améliorées.</p>
<h2>Contact</h2><p>Pour signaler une erreur, proposer une ressource ou poser une question, écrivez à <a href="mailto:kobonaaquilas@gmail.com">kobonaaquilas@gmail.com</a> ou contactez-nous au +228 92 24 46 53. Vous pouvez également nous joindre sur <a href="https://wa.me/22892244653">WhatsApp</a>.</p>`;
 
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
<h2>8. Cookies, publicité et mises à jour</h2><p>Des mécanismes techniques peuvent être utilisés pour le fonctionnement, la sécurité et les préférences du site. Si des annonces Google AdSense ou d’autres publicités personnalisées sont activées, Google et ses partenaires pourront utiliser des cookies ou technologies similaires pour diffuser, mesurer et personnaliser les annonces conformément à leurs propres règles et aux choix de confidentialité proposés aux visiteurs. Les visiteurs pourront consulter les paramètres de publicité et les options de confidentialité de Google. Cette politique sera actualisée si les traitements réellement mis en œuvre évoluent ; la date de révision figure en haut de la page.</p>`;
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
      if (request.method === "GET" && guidePages[url.pathname]) return guidePage(url.pathname)!;
      if (request.method === "GET" && url.pathname === "/about") return legalPage("À propos d’AQUI NET HUB", aboutBody);
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
