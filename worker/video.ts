import { unzipSync } from "fflate";

type VideoEnv = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  GITHUB_TOKEN: string;
  VIDEO_WORKFLOW_REF?: string;
};

const VIDEO_REPO = "kobonaaquilas-alt/aqui-video-ai.";
const WORKFLOW = "generate-video.yml";

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
function serviceHeaders(env: VideoEnv) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "",
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}
async function currentUser(request: Request, env: VideoEnv): Promise<{ id: string } | null> {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: string };
  return user.id ? { id: user.id } : null;
}
const githubHeaders = (env: VideoEnv) => ({
  Authorization: `Bearer ${env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "AQUI-NET-HUB",
});

export async function handleVideo(request: Request, env: VideoEnv): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY) || !env.GITHUB_TOKEN)
    return reply({ error: "Service vidéo non configuré." }, 503);
  const user = await currentUser(request, env);
  if (!user) return reply({ error: "Connexion requise." }, 401);

  if (request.method === "POST") {
    let body: { image_url?: string; prompt?: string; duration?: number };
    try { body = await request.json() as typeof body; }
    catch { return reply({ error: "Corps de requête invalide." }, 400); }
    const prompt = body.prompt?.trim() || "";
    const imageUrl = body.image_url?.trim() || "";
    const duration = Number(body.duration);
    let parsed: URL;
    try { parsed = new URL(imageUrl); }
    catch { return reply({ error: "URL d'image invalide." }, 400); }
    const host = parsed.hostname.toLowerCase();
    const privateIpv4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
        host === "localhost" || host.endsWith(".localhost") || privateIpv4 ||
        host === "0.0.0.0" || host === "::1")
      return reply({ error: "Utilise une URL HTTPS publique directe vers une image." }, 400);
    if (prompt.length < 3 || prompt.length > 1200)
      return reply({ error: "La description doit contenir entre 3 et 1 200 caractères." }, 400);
    if (![2, 3, 4, 5, 6, 8, 10].includes(duration))
      return reply({ error: "Durées disponibles : 2, 3, 4, 5, 6, 8 ou 10 secondes." }, 400);
    if (duration > 5) {
      const access = await fetch(
        `${env.SUPABASE_URL}/rest/v1/hub_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=1`,
        { headers: serviceHeaders(env) },
      );
      if (!access.ok) return reply({ error: "Vérification de l'abonnement impossible." }, 502);
      const active = await access.json() as unknown[];
      if (!active.length) return reply({
        error: "Les vidéos de plus de 5 secondes nécessitent un abonnement AQUI NET HUB (500 FCFA/mois ou 5 000 FCFA/an).",
        code: "PAYMENT_REQUIRED",
      }, 402);
    }

    const jobsUrl = `${env.SUPABASE_URL}/rest/v1/hub_video_jobs`;
    const activeJobs = await fetch(
      `${jobsUrl}?user_id=eq.${user.id}&status=in.(queued,running)&select=request_id&limit=1`,
      { headers: serviceHeaders(env) },
    );
    if (!activeJobs.ok) return reply({ error: "Impossible de vérifier les demandes en cours." }, 502);
    const active = await activeJobs.json() as Array<{ request_id: string }>;
    if (active.length) return reply({ error: "Une génération est déjà en cours sur ce compte. Attends sa fin avant d'en lancer une autre." }, 429);

    const requestId = crypto.randomUUID();
    const saved = await fetch(jobsUrl, {
      method: "POST",
      headers: serviceHeaders(env),
      body: JSON.stringify({
        user_id: user.id, request_id: requestId, prompt, image_url: imageUrl,
        duration_seconds: duration, status: "queued",
      }),
    });
    if (!saved.ok) return reply({ error: "Impossible d'enregistrer la demande vidéo." }, 500);

    const dispatch = await fetch(
      `https://api.github.com/repos/${VIDEO_REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: { ...githubHeaders(env), "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: env.VIDEO_WORKFLOW_REF || "main",
          inputs: { request_id: requestId, image_url: imageUrl, prompt, duration: String(duration) },
        }),
      },
    );
    if (!dispatch.ok) {
      await fetch(`${jobsUrl}?request_id=eq.${requestId}`, {
        method: "PATCH", headers: serviceHeaders(env),
        body: JSON.stringify({ status: "failed", error_message: "Le moteur vidéo a refusé la demande." }),
      });
      return reply({ error: "Le moteur vidéo a refusé la demande. Vérifie les autorisations GitHub Actions." }, 502);
    }
    return reply({ request_id: requestId, status: "queued", duration_seconds: duration }, 202);
  }

  const requestId = new URL(request.url).pathname.split("/").pop() || "";
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return reply({ error: "Identifiant invalide." }, 400);
  const jobsUrl = `${env.SUPABASE_URL}/rest/v1/hub_video_jobs`;
  const lookup = await fetch(
    `${jobsUrl}?request_id=eq.${requestId}&user_id=eq.${user.id}&select=request_id,status,duration_seconds,github_run_id,storage_path,error_message,created_at&limit=1`,
    { headers: serviceHeaders(env) },
  );
  if (!lookup.ok) return reply({ error: "Lecture du statut impossible." }, 502);
  const jobs = await lookup.json() as Array<{
    request_id: string; status: string; duration_seconds: number; github_run_id: number | null;
    storage_path: string | null; error_message: string | null; created_at: string;
  }>;
  const job = jobs[0];
  if (!job) return reply({ error: "Demande vidéo introuvable." }, 404);
  if (job.status === "failed") return reply(job);

  const gh = githubHeaders(env);
  let run: any = null;
  if (job.github_run_id) {
    const response = await fetch(
      `https://api.github.com/repos/${VIDEO_REPO}/actions/runs/${job.github_run_id}`, { headers: gh },
    );
    if (response.ok) run = await response.json();
  } else {
    const response = await fetch(
      `https://api.github.com/repos/${VIDEO_REPO}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=100`,
      { headers: gh },
    );
    if (!response.ok) return reply({ error: "Impossible de vérifier la génération vidéo." }, 502);
    const data = await response.json() as { workflow_runs?: any[] };
    run = (data.workflow_runs || []).find(item =>
      String(item.display_title || item.name || "").includes(requestId)
    ) || null;
  }
  if (!run) return reply({ ...job, status: "queued" });
  if (run.status !== "completed") {
    await fetch(`${jobsUrl}?request_id=eq.${requestId}`, {
      method: "PATCH", headers: serviceHeaders(env),
      body: JSON.stringify({ status: "running", github_run_id: run.id }),
    });
    return reply({ ...job, status: "running", github_run_id: run.id });
  }
  if (run.conclusion !== "success") {
    const message = "La génération vidéo a échoué. Réessaie avec une autre image ou description.";
    await fetch(`${jobsUrl}?request_id=eq.${requestId}`, {
      method: "PATCH", headers: serviceHeaders(env),
      body: JSON.stringify({ status: "failed", github_run_id: run.id, error_message: message }),
    });
    return reply({ ...job, status: "failed", error_message: message });
  }

  const artifactsResponse = await fetch(
    `https://api.github.com/repos/${VIDEO_REPO}/actions/runs/${run.id}/artifacts`, { headers: gh },
  );
  if (!artifactsResponse.ok) return reply({ error: "Artefact vidéo indisponible." }, 502);
  const artifactData = await artifactsResponse.json() as {
    artifacts?: Array<{ name: string; archive_download_url: string; expired: boolean }>;
  };
  const artifact = (artifactData.artifacts || []).find(item => item.name === "aqui-video-mp4" && !item.expired);
  if (!artifact) return reply({ ...job, status: "running", github_run_id: run.id });

  const archive = await fetch(artifact.archive_download_url, { headers: gh });
  if (!archive.ok) return reply({ error: "Téléchargement du MP4 impossible." }, 502);
  const zip = new Uint8Array(await archive.arrayBuffer());
  if (zip.byteLength > 100 * 1024 * 1024) return reply({ error: "Archive vidéo trop volumineuse." }, 413);
  let extracted: Record<string, Uint8Array>;
  try { extracted = unzipSync(zip); }
  catch { return reply({ error: "Archive vidéo illisible." }, 502); }
  const mp4 = Object.entries(extracted).find(([name, data]) => name.endsWith("output.mp4") && data.byteLength > 10000);
  if (!mp4) return reply({ error: "Fichier MP4 absent de l'archive." }, 502);

  const path = `${user.id}/${requestId}.mp4`;
  const upload = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/aqui-video-results/${path}`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "",
        "Content-Type": "video/mp4",
        "x-upsert": "true",
      },
      body: new Blob([mp4[1]], { type: "video/mp4" }),
    },
  );
  if (!upload.ok) return reply({ error: "Enregistrement sécurisé du MP4 impossible." }, 502);
  const update = await fetch(`${jobsUrl}?request_id=eq.${requestId}`, {
    method: "PATCH", headers: serviceHeaders(env),
    body: JSON.stringify({ status: "completed", github_run_id: run.id, storage_path: path, error_message: null }),
  });
  if (!update.ok) return reply({ error: "Mise à jour du résultat vidéo impossible." }, 502);

  const signed = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/sign/aqui-video-results/${path}`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    },
  );
  if (!signed.ok) return reply({ request_id: requestId, status: "completed", storage_path: path });
  const result = await signed.json() as { signedURL?: string };
  const videoUrl = result.signedURL?.startsWith("http")
    ? result.signedURL
    : result.signedURL ? `${env.SUPABASE_URL}/storage/v1${result.signedURL}` : null;
  return reply({ request_id: requestId, status: "completed", storage_path: path, video_url: videoUrl });
}
