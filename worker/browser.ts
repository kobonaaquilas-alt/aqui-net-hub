import { unzipSync } from "fflate";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  GITHUB_TOKEN: string;
};
type User = { id: string };
type Step =
  | { action: "extract_text"; selector: string }
  | { action: "click_link"; selector: string }
  | { action: "wait"; milliseconds: number }
  | { action: "screenshot"; full_page?: boolean };

const REPO = "kobonaaquilas-alt/aqui-net-hub";
const WORKFLOW = "browser-automation.yml";
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const serviceKey = (env: Env) => env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
const dbHeaders = (env: Env) => ({
  apikey: serviceKey(env),
  Authorization: `Bearer ${serviceKey(env)}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
});
const githubHeaders = (env: Env) => ({
  Authorization: `Bearer ${env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "AQUI-NET-HUB",
});
async function currentUser(request: Request, env: Env): Promise<User | null> {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\\s+/i, "").trim();
  if (!token) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: string };
  return user.id ? { id: user.id } : null;
}
function publicHttpsUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase().replace(/^\\[|\\]$/g, "");
    const blocked = host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host === "0.0.0.0" || host === "::1" ||
      /^(10\\.|127\\.|169\\.254\\.|192\\.168\\.|172\\.(1[6-9]|2\\d|3[01])\\.)/.test(host) ||
      /^\\d{1,3}(\\.\\d{1,3}){3}$/.test(host) || host.includes(":");
    if (url.protocol !== "https:" || url.username || url.password || blocked || !host.includes(".")) return null;
    return url.toString();
  } catch { return null; }
}
function validateSteps(value: unknown): Step[] | null {
  if (!Array.isArray(value) || value.length > 15) return null;
  const steps: Step[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    if (item.action === "extract_text" || item.action === "click_link") {
      const selector = String(item.selector || "").trim();
      if (!selector || selector.length > 300) return null;
      steps.push({ action: item.action, selector });
    } else if (item.action === "wait") {
      const milliseconds = Number(item.milliseconds);
      if (!Number.isInteger(milliseconds) || milliseconds < 0 || milliseconds > 5000) return null;
      steps.push({ action: "wait", milliseconds });
    } else if (item.action === "screenshot") {
      steps.push({ action: "screenshot", full_page: item.full_page === true });
    } else return null;
  }
  return steps;
}
async function isAdmin(env: Env, userId: string): Promise<boolean> {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/hub_admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`,
    { headers: dbHeaders(env) },
  );
  if (!response.ok) throw new Error("Admin authorization lookup failed.");
  return ((await response.json()) as Array<{ user_id: string }>).length === 1;
}
const jobsUrl = (env: Env) => `${env.SUPABASE_URL}/rest/v1/hub_browser_jobs`;
async function createJob(request: Request, env: Env, user: User): Promise<Response> {
  let body: { target_url?: string; steps?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return reply({ error: "Corps de requête invalide." }, 400); }
  const targetUrl = publicHttpsUrl(body.target_url);
  const steps = validateSteps(body.steps ?? []);
  if (!targetUrl) return reply({ error: "Adresse HTTPS publique invalide." }, 400);
  if (!steps) return reply({ error: "Étapes invalides : 15 maximum, extraction de texte, clic sur liens, attente ou capture d'écran uniquement." }, 400);

  const active = await fetch(
    `${jobsUrl(env)}?user_id=eq.${encodeURIComponent(user.id)}&status=in.(queued,running)&select=request_id&limit=1`,
    { headers: dbHeaders(env) },
  );
  if (!active.ok) return reply({ error: "Vérification des tâches en cours impossible." }, 502);
  if (((await active.json()) as unknown[]).length) return reply({ error: "Une tâche navigateur est déjà en cours." }, 429);

  const requestId = crypto.randomUUID();
  const saved = await fetch(jobsUrl(env), {
    method: "POST",
    headers: dbHeaders(env),
    body: JSON.stringify({
      user_id: user.id, request_id: requestId, target_url: targetUrl, steps, status: "queued",
    }),
  });
  if (!saved.ok) return reply({ error: "Enregistrement de la tâche impossible." }, 500);

  const dispatch = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: { ...githubHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: "main",
        inputs: { request_id: requestId, target_url: targetUrl, steps_json: JSON.stringify(steps) },
      }),
    },
  );
  if (!dispatch.ok) {
    await fetch(`${jobsUrl(env)}?request_id=eq.${requestId}`, {
      method: "PATCH", headers: dbHeaders(env),
      body: JSON.stringify({ status: "failed", error_message: "GitHub Actions a refusé la tâche." }),
    });
    return reply({ error: "Le moteur navigateur n'a pas accepté la tâche." }, 502);
  }
  return reply({ request_id: requestId, status: "queued" }, 202);
}
async function getJob(request: Request, env: Env, user: User, requestId: string): Promise<Response> {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return reply({ error: "Identifiant invalide." }, 400);
  const lookup = await fetch(
    `${jobsUrl(env)}?request_id=eq.${requestId}&user_id=eq.${encodeURIComponent(user.id)}&select=request_id,target_url,status,github_run_id,result,error_message,created_at&limit=1`,
    { headers: dbHeaders(env) },
  );
  if (!lookup.ok) return reply({ error: "Lecture du statut impossible." }, 502);
  const rows = await lookup.json() as Array<{
    request_id: string; target_url: string; status: string; github_run_id: number | null;
    result: unknown; error_message: string | null; created_at: string;
  }>;
  const job = rows[0];
  if (!job) return reply({ error: "Tâche introuvable." }, 404);
  if (job.status === "completed" || job.status === "failed") return reply(job);

  const gh = githubHeaders(env);
  let run: any = null;
  if (job.github_run_id) {
    const response = await fetch(`https://api.github.com/repos/${REPO}/actions/runs/${job.github_run_id}`, { headers: gh });
    if (response.ok) run = await response.json();
  } else {
    const response = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=50`,
      { headers: gh },
    );
    if (!response.ok) return reply({ error: "Impossible de vérifier l'exécution navigateur." }, 502);
    const data = await response.json() as { workflow_runs?: any[] };
    run = (data.workflow_runs || []).find(item =>
      String(item.display_title || item.name || "").includes(requestId)
    ) || null;
  }
  if (!run) return reply({ ...job, status: "queued" });
  if (run.status !== "completed") {
    await fetch(`${jobsUrl(env)}?request_id=eq.${requestId}`, {
      method: "PATCH", headers: dbHeaders(env),
      body: JSON.stringify({ status: "running", github_run_id: run.id, updated_at: new Date().toISOString() }),
    });
    return reply({ ...job, status: "running", github_run_id: run.id });
  }
  if (run.conclusion !== "success") {
    const message = "La navigation automatisée a échoué. Consulte les journaux GitHub Actions.";
    await fetch(`${jobsUrl(env)}?request_id=eq.${requestId}`, {
      method: "PATCH", headers: dbHeaders(env),
      body: JSON.stringify({ status: "failed", github_run_id: run.id, error_message: message }),
    });
    return reply({ ...job, status: "failed", error_message: message });
  }

  const artifactsResponse = await fetch(
    `https://api.github.com/repos/${REPO}/actions/runs/${run.id}/artifacts`, { headers: gh },
  );
  if (!artifactsResponse.ok) return reply({ error: "Résultat navigateur indisponible." }, 502);
  const artifactData = await artifactsResponse.json() as {
    artifacts?: Array<{ name: string; archive_download_url: string; expired: boolean }>;
  };
  const artifact = (artifactData.artifacts || []).find(item =>
    item.name === `browser-result-${requestId}` && !item.expired
  );
  if (!artifact) return reply({ ...job, status: "running", github_run_id: run.id });
  const archive = await fetch(artifact.archive_download_url, { headers: gh });
  if (!archive.ok) return reply({ error: "Téléchargement du résultat impossible." }, 502);
  const zip = new Uint8Array(await archive.arrayBuffer());
  if (zip.byteLength > 15 * 1024 * 1024) return reply({ error: "Résultat navigateur trop volumineux." }, 413);
  let extracted: Record<string, Uint8Array>;
  try { extracted = unzipSync(zip); }
  catch { return reply({ error: "Archive du résultat illisible." }, 502); }
  const resultFile = Object.entries(extracted).find(([name]) => name.endsWith("result.json"));
  if (!resultFile) return reply({ error: "Fichier de résultat absent." }, 502);
  let result: unknown;
  try { result = JSON.parse(new TextDecoder().decode(resultFile[1])); }
  catch { return reply({ error: "Résultat JSON invalide." }, 502); }
  const update = await fetch(`${jobsUrl(env)}?request_id=eq.${requestId}`, {
    method: "PATCH", headers: dbHeaders(env),
    body: JSON.stringify({ status: "completed", github_run_id: run.id, result, updated_at: new Date().toISOString() }),
  });
  if (!update.ok) return reply({ error: "Enregistrement du résultat impossible." }, 502);
  return reply({ request_id: requestId, status: "completed", result });
}
export async function handleBrowser(request: Request, env: Env): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !serviceKey(env) || !env.GITHUB_TOKEN)
    return reply({ error: "Service navigateur non configuré." }, 503);
  const user = await currentUser(request, env);
  if (!user) return reply({ error: "Connexion requise." }, 401);
  try {
    if (!await isAdmin(env, user.id)) return reply({ error: "Accès administrateur réservé." }, 403);
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/browser/jobs")
      return await createJob(request, env, user);
    const match = url.pathname.match(/^\\/api\\/browser\\/jobs\\/([0-9a-f-]{36})$/i);
    if (request.method === "GET" && match) return await getJob(request, env, user, match[1]);
    return reply({ error: "Route navigateur introuvable." }, 404);
  } catch {
    return reply({ error: "Erreur du moteur navigateur." }, 500);
  }
}
