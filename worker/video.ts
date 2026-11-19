type VideoEnv = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  FAL_KEY?: string;
  MAGIC_HOUR_API_KEY?: string;
  VIDEO_ALLOW_PAID_FALLBACK?: string;
};

const INPUT_BUCKET = "aqui-video-inputs";
const OUTPUT_BUCKET = "aqui-video-results";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY", "Permissions-Policy": "camera=(), microphone=(), geolocation=()" },
  });
}
const secret = (env: VideoEnv) => env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
function serviceHeaders(env: VideoEnv) {
  return {
    apikey: secret(env),
    Authorization: `Bearer ${secret(env)}`,
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
async function signedStorageUrl(env: VideoEnv, bucket: string, path: string, expiresIn = 3600) {
  const response = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`,
    { method: "POST", headers: { ...serviceHeaders(env), Prefer: "" }, body: JSON.stringify({ expiresIn }) },
  );
  if (!response.ok) throw new Error("Impossible de créer un lien média sécurisé.");
  const data = await response.json() as { signedURL?: string };
  if (!data.signedURL) throw new Error("Lien média sécurisé absent.");
  return data.signedURL.startsWith("http") ? data.signedURL : `${env.SUPABASE_URL}/storage/v1${data.signedURL}`;
}
async function updateJob(env: VideoEnv, requestId: string, values: Record<string, unknown>) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/hub_video_jobs?request_id=eq.${encodeURIComponent(requestId)}`,
    { method: "PATCH", headers: serviceHeaders(env), body: JSON.stringify(values) },
  );
  if (!response.ok) throw new Error("Mise à jour de la génération impossible.");
}
async function storeOutput(env: VideoEnv, userId: string, requestId: string, videoUrl: string) {
  const parsed = new URL(videoUrl);
  if (parsed.protocol !== "https:") throw new Error("URL vidéo du moteur invalide.");
  const media = await fetch(parsed.toString());
  if (!media.ok) throw new Error("Téléchargement de la vidéo générée impossible.");
  const bytes = await media.arrayBuffer();
  if (bytes.byteLength < 10000 || bytes.byteLength > 100 * 1024 * 1024)
    throw new Error("Taille du fichier vidéo généré invalide.");
  const path = `${userId}/${requestId}.mp4`;
  const upload = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${OUTPUT_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: secret(env), Authorization: `Bearer ${secret(env)}`,
      "Content-Type": "video/mp4", "x-upsert": "true",
    },
    body: bytes,
  });
  if (!upload.ok) throw new Error("Enregistrement sécurisé du MP4 impossible.");
  await updateJob(env, requestId, { status: "completed", storage_path: path, error_message: null });
  return signedStorageUrl(env, OUTPUT_BUCKET, path);
}


async function submitMagicHour(env: VideoEnv, mode: "text" | "image", prompt: string, duration: number, image: File | null) {
  const key = env.MAGIC_HOUR_API_KEY?.trim();
  if (!key) throw new Error("Magic Hour non configuré.");
  let imagePath = "";
  if (mode === "image" && image) {
    const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
    const uploadResponse = await fetch("https://api.magichour.ai/v1/files/upload-urls", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ type: "image", extension }] }),
    });
    const uploadData = await uploadResponse.json() as { items?: Array<{ upload_url?: string; file_path?: string }>; message?: string };
    const target = uploadData.items?.[0];
    if (!uploadResponse.ok || !target?.upload_url || !target.file_path)
      throw new Error(uploadData.message || "Magic Hour : préparation du téléversement impossible.");
    const put = await fetch(target.upload_url, { method: "PUT", headers: { "Content-Type": image.type }, body: await image.arrayBuffer() });
    if (!put.ok) throw new Error("Magic Hour : téléversement de l'image refusé.");
    imagePath = target.file_path;
  }
  const body: Record<string, unknown> = {
    end_seconds: duration,
    model: "ltx-2.5",
    resolution: "480p",
    audio: true,
    style: { prompt },
    ...(mode === "text" ? { aspect_ratio: "9:16" } : { assets: { image_file_path: imagePath } }),
  };
  const response = await fetch(`https://api.magichour.ai/v1/${mode}-to-video`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json() as { id?: string; message?: string; code?: string };
  if (!response.ok || !data.id) throw new Error(data.message || data.code || "Magic Hour n'a pas accepté la génération.");
  return data.id;
}

export async function handleVideo(request: Request, env: VideoEnv): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !secret(env))
    return reply({ error: "Backend Supabase non configuré." }, 503);
  const magicHourReady = !!env.MAGIC_HOUR_API_KEY?.trim();
  const falReady = !!env.FAL_KEY?.trim() && env.VIDEO_ALLOW_PAID_FALLBACK === "true";
  if (!magicHourReady && !falReady)
    return reply({ error: "Aucun moteur vidéo utilisable : ajoute MAGIC_HOUR_API_KEY (crédits d'essai) ou active explicitement le moteur payant fal.ai." }, 503);
  const user = await currentUser(request, env);
  if (!user) return reply({ error: "Connexion requise." }, 401);

  if (request.method === "POST") {
    let mode = "text";
    let prompt = "";
    let duration = 5;
    let image: File | null = null;
    try {
      const form = await request.formData();
      mode = String(form.get("mode") || "text");
      prompt = String(form.get("prompt") || "").trim();
      duration = Number(form.get("duration") || 5);
      const candidate = form.get("image");
      if (candidate instanceof File && candidate.size > 0) image = candidate;
    } catch {
      return reply({ error: "Formulaire de génération invalide." }, 400);
    }
    if (mode !== "text" && mode !== "image") return reply({ error: "Mode de génération invalide." }, 400);
    if (prompt.length < 3 || prompt.length > 1200)
      return reply({ error: "La description doit contenir entre 3 et 1 200 caractères." }, 400);
    if (mode === "image" && !image) return reply({ error: "Téléverse une image pour lancer le mode image vers vidéo." }, 400);
    if (mode === "text" && image) return reply({ error: "Retire l'image ou choisis le mode image vers vidéo." }, 400);
    if (image && (!["image/jpeg", "image/png", "image/webp"].includes(image.type) || image.size > MAX_IMAGE_BYTES))
      return reply({ error: "Formats acceptés : JPG, PNG ou WEBP, 8 Mo maximum." }, 400);
    if (![2, 5, 10, 15].includes(duration))
      return reply({ error: "Durées disponibles : 2, 5, 10 ou 15 secondes." }, 400);

    if (duration > 2) {
      const access = await fetch(
        `${env.SUPABASE_URL}/rest/v1/hub_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=1`,
        { headers: serviceHeaders(env) },
      );
      if (!access.ok) return reply({ error: "Vérification de l'abonnement impossible." }, 502);
      const active = await access.json() as unknown[];
      if (!active.length) return reply({
        error: "Un abonnement AQUI NET HUB actif est requis pour les vidéos de plus de 2 secondes.",
        code: "PAYMENT_REQUIRED",
      }, 402);
    }

    const jobsUrl = `${env.SUPABASE_URL}/rest/v1/hub_video_jobs`;
    const activeJobs = await fetch(
      `${jobsUrl}?user_id=eq.${encodeURIComponent(user.id)}&status=in.(queued,running)&select=request_id&limit=1`,
      { headers: serviceHeaders(env) },
    );
    if (!activeJobs.ok) return reply({ error: "Impossible de vérifier les demandes en cours." }, 502);
    if ((await activeJobs.json() as unknown[]).length)
      return reply({ error: "Une génération est déjà en cours sur ce compte." }, 429);

    const requestId = crypto.randomUUID();
    let imageUrl = "";
    let inputPath: string | null = null;
    if (image) {
      inputPath = `${user.id}/${requestId}-source.${image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg"}`;
      const uploaded = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${INPUT_BUCKET}/${inputPath}`, {
        method: "POST",
        headers: {
          apikey: secret(env), Authorization: `Bearer ${secret(env)}`,
          "Content-Type": image.type, "x-upsert": "true",
        },
        body: await image.arrayBuffer(),
      });
      if (!uploaded.ok) return reply({ error: "Téléversement de l'image impossible. Vérifie le stockage Supabase." }, 502);
      try { imageUrl = await signedStorageUrl(env, INPUT_BUCKET, inputPath, 3600); }
      catch (error) { return reply({ error: error instanceof Error ? error.message : "Lien image impossible." }, 502); }
    }

    const saved = await fetch(jobsUrl, {
      method: "POST",
      headers: serviceHeaders(env),
      body: JSON.stringify({
        user_id: user.id, request_id: requestId, prompt, image_url: imageUrl,
        duration_seconds: duration, status: "queued", mode, input_storage_path: inputPath,
      }),
    });
    if (!saved.ok) return reply({ error: "Impossible d'enregistrer la demande vidéo. Applique la migration vidéo AQUI NET HUB." }, 500);

    if (magicHourReady) {
      try {
        const providerRequestId = await submitMagicHour(env, mode as "text" | "image", prompt, duration, image);
        const statusUrl = `https://api.magichour.ai/v1/video-projects/${providerRequestId}`;
        await updateJob(env, requestId, {
          fal_request_id: providerRequestId, fal_status_url: "magichour", fal_response_url: statusUrl, status: "running",
        });
        return reply({ request_id: requestId, status: "running", duration_seconds: duration, mode, provider: "Magic Hour" }, 202);
      } catch (error) {
        if (!falReady) {
          const message = error instanceof Error ? error.message : "Magic Hour indisponible.";
          await updateJob(env, requestId, { status: "failed", error_message: message });
          return reply({ error: message, provider: "Magic Hour" }, 502);
        }
      }
    }
    if (!falReady) {
      await updateJob(env, requestId, { status: "failed", error_message: "Aucun moteur de secours autorisé." });
      return reply({ error: "Aucun moteur de secours disponible." }, 503);
    }
    const endpoint = mode === "image" ? "minimax/h3-max/image-to-video" : "minimax/h3-max/text-to-video";
    const input: Record<string, unknown> = {
      prompt, prompt_expansion_mode: "balanced", duration,
      resolution: "768P", enable_safety_checker: true,
      ...(mode === "text" ? { aspect_ratio: "9:16" } : {}),
    };
    if (mode === "image") input.image_url = imageUrl;
    const submitted = await fetch(`https://queue.fal.run/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Key ${env.FAL_KEY?.trim() || ""}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const queue = await submitted.json() as {
      request_id?: string; status_url?: string; response_url?: string; detail?: string; error?: string;
    };
    if (!submitted.ok || !queue.request_id || !queue.status_url || !queue.response_url) {
      await updateJob(env, requestId, { status: "failed", error_message: "Le moteur vidéo a refusé la demande." });
      const detail = queue.detail || queue.error;
      return reply({ error: detail ? `Moteur vidéo : ${String(detail).slice(0, 300)}` : "Le moteur vidéo a refusé la demande. Vérifie la clé FAL_KEY et ses autorisations." }, 502);
    }
    await updateJob(env, requestId, {
      fal_request_id: queue.request_id, fal_status_url: queue.status_url,
      fal_response_url: queue.response_url, status: "running",
    });
    return reply({ request_id: requestId, status: "running", duration_seconds: duration, mode }, 202);
  }

  const requestId = new URL(request.url).pathname.split("/").pop() || "";
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return reply({ error: "Identifiant invalide." }, 400);
  const jobsUrl = `${env.SUPABASE_URL}/rest/v1/hub_video_jobs`;
  const lookup = await fetch(
    `${jobsUrl}?request_id=eq.${requestId}&user_id=eq.${encodeURIComponent(user.id)}&select=request_id,status,duration_seconds,storage_path,error_message,fal_request_id,fal_status_url,fal_response_url,created_at&limit=1`,
    { headers: serviceHeaders(env) },
  );
  if (!lookup.ok) return reply({ error: "Lecture du statut impossible." }, 502);
  const jobs = await lookup.json() as Array<{
    request_id: string; status: string; duration_seconds: number; storage_path: string | null;
    error_message: string | null; fal_request_id: string | null; fal_status_url: string | null;
    fal_response_url: string | null; created_at: string;
  }>;
  const job = jobs[0];
  if (!job) return reply({ error: "Demande vidéo introuvable." }, 404);
  if (job.status === "failed") return reply(job);
  if (job.status === "completed" && job.storage_path) {
    try { return reply({ ...job, video_url: await signedStorageUrl(env, OUTPUT_BUCKET, job.storage_path) }); }
    catch { return reply({ ...job, status: "completed" }); }
  }
  if (!job.fal_status_url || !job.fal_response_url) return reply({ ...job, status: "queued" });

  if (job.fal_status_url === "magichour") {
    const response = await fetch(job.fal_response_url, { headers: { Authorization: `Bearer ${env.MAGIC_HOUR_API_KEY?.trim() || ""}` } });
    if (!response.ok) return reply({ error: "Impossible de lire le statut Magic Hour." }, 502);
    const project = await response.json() as {
      status?: string;
      error?: string | { code?: string; message?: string };
      downloads?: Array<{ url?: string }>;
    };
    if (project.status === "queued" || project.status === "rendering" || project.status === "draft")
      return reply({ ...job, status: "running", provider: "Magic Hour" });
    if (project.status === "error" || project.status === "canceled") {
      const providerError = typeof project.error === "string"
        ? project.error
        : project.error?.message || project.error?.code;
      const message = providerError || "Magic Hour n'a pas pu terminer la génération.";
      await updateJob(env, requestId, { status: "failed", error_message: message });
      return reply({ ...job, status: "failed", error_message: message, provider: "Magic Hour" });
    }
    const output = project.downloads?.find(item => item.url)?.url;
    if (project.status !== "complete" || !output)
      return reply({ ...job, status: "running", provider: "Magic Hour" });
    try {
      const videoUrl = await storeOutput(env, user.id, requestId, output);
      return reply({ ...job, status: "completed", video_url: videoUrl, provider: "Magic Hour" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Enregistrement vidéo impossible.";
      await updateJob(env, requestId, { status: "failed", error_message: message });
      return reply({ ...job, status: "failed", error_message: message, provider: "Magic Hour" });
    }
  }
  const auth = { Authorization: `Key ${env.FAL_KEY?.trim() || ""}` };
  const statusResponse = await fetch(job.fal_status_url, { headers: auth });
  if (!statusResponse.ok) return reply({ error: "Impossible de lire le statut du moteur vidéo." }, 502);
  const status = await statusResponse.json() as { status?: string; error?: string };
  if (status.status === "IN_QUEUE" || status.status === "IN_PROGRESS")
    return reply({ ...job, status: "running" });
  if (status.status !== "COMPLETED") return reply({ ...job, status: "running" });

  const resultResponse = await fetch(job.fal_response_url, { headers: auth });
  if (!resultResponse.ok) {
    const detail = await resultResponse.text();
    await updateJob(env, requestId, { status: "failed", error_message: detail.slice(0, 400) || "Résultat vidéo indisponible." });
    return reply({ ...job, status: "failed", error_message: "Le moteur n'a pas fourni le résultat vidéo." });
  }
  const result = await resultResponse.json() as { video?: { url?: string }; output?: { video?: { url?: string } }; error?: string };
  const outputUrl = result.video?.url || result.output?.video?.url;
  if (!outputUrl) {
    await updateJob(env, requestId, { status: "failed", error_message: result.error || "Fichier vidéo absent du résultat du moteur." });
    return reply({ ...job, status: "failed", error_message: "Le moteur n'a pas renvoyé de fichier vidéo exploitable." });
  }
  try {
    const videoUrl = await storeOutput(env, user.id, requestId, outputUrl);
    return reply({ ...job, status: "completed", video_url: videoUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enregistrement vidéo impossible.";
    await updateJob(env, requestId, { status: "failed", error_message: message });
    return reply({ ...job, status: "failed", error_message: message });
  }
}
