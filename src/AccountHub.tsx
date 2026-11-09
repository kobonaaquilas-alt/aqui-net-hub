import { useCallback, useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

const db = createClient("https://xbobkysbtvtmepqgtnbt.supabase.co", "sb_publishable_AGtfBQyqyKbH5C_4f5cQgw_bm0MmusA");
type Service = "video" | "social" | "partners";
type Props = { service: Service; favorites: string[]; progress: string[]; lang: "fr" | "en"; onRemoteSync: (favorites: string[], progress: string[]) => void };
type Plan = { id: string; name: string; description: string; amount_xof: number; duration_days: number };
type Campaign = { id: string; title: string; description: string; destination_url: string | null };
type Subscription = { id: string; plan_id: string; plan_name: string; starts_at: string; ends_at: string; status: string };
type Payment = { id: string; merchant_transaction_id: string; amount_xof: number; currency: string; status: string; created_at: string; paid_at: string | null };
type AccountSummary = { subscriptions: Subscription[]; payments: Payment[] };

export default function AccountHub({ service, favorites, progress, lang, onRemoteSync }: Props) {
  const fr = lang === "fr";
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncReady, setSyncReady] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [ad, setAd] = useState({company_name:"",contact_name:"",email:"",phone:"",website:"",budget:"",message:""});
  const [partner, setPartner] = useState({organization:"",contact_name:"",email:"",phone:"",website:"",proposal:""});
  const [videoImageUrl, setVideoImageUrl] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoDuration, setVideoDuration] = useState("3");
  const [videoRequestId, setVideoRequestId] = useState("");
  const [videoStatus, setVideoStatus] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoNotice, setVideoNotice] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [socialGoal, setSocialGoal] = useState("");
  const [socialResult, setSocialResult] = useState("");
  const [socialName,setSocialName]=useState("");
  const [socialFollowers,setSocialFollowers]=useState("0");
  const [socialViews,setSocialViews]=useState("0");
  const [socialLikes,setSocialLikes]=useState("0");
  const [socialComments,setSocialComments]=useState("0");
  const [socialFrequency,setSocialFrequency]=useState("3");
  const [socialCount,setSocialCount]=useState(0);
  const [followStatus,setFollowStatus]=useState("none");
  const [socialSubscribed,setSocialSubscribed]=useState(false);
  const [tiktokProof,setTiktokProof]=useState("");
  const [facebookProof,setFacebookProof]=useState("");
  const [paymentBusy,setPaymentBusy]=useState(false);

  const refreshSummary = useCallback(async () => {
    if (!session?.access_token) return;
    setSummaryBusy(true);
    try {
      const response = await fetch("/api/account/summary", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json() as AccountSummary & { error?: string };
      if (!response.ok) throw new Error(data.error || "Account data unavailable");
      setSummary(data);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Account data unavailable");
    } finally {
      setSummaryBusy(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    db.auth.getSession().then(({data}) => setSession(data.session));
    const {data:{subscription}} = db.auth.onAuthStateChange((event,next) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      setSession(next);
      setSyncReady(false);
      setSummary(null);
    });
    db.from("hub_plans").select("id,name,description,amount_xof,duration_days").eq("is_active",true).then(({data}) => setPlans((data ?? []) as Plan[]));
    db.from("hub_campaigns").select("id,title,description,destination_url").eq("is_active",true).then(({data}) => setCampaigns((data ?? []) as Campaign[]));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user.id) { setSyncReady(false); return; }
    let active = true;
    db.from("hub_user_data").select("payload").eq("user_id",session.user.id).maybeSingle().then(({data}) => {
      if (!active) return;
      const saved = data?.payload as {favorites?:unknown;progress?:unknown} | undefined;
      if (Array.isArray(saved?.favorites) && Array.isArray(saved?.progress)) {
        localStorage.setItem("aqui-favorites",JSON.stringify(saved.favorites));
        localStorage.setItem("aqui-progress",JSON.stringify(saved.progress));
        onRemoteSync(saved.favorites as string[],saved.progress as string[]);
      }
      setSyncReady(true);
    });
    return () => { active = false; };
  }, [session?.user.id, onRemoteSync]);

  useEffect(() => {
    if (!session?.user.id || !syncReady) return;
    db.from("hub_user_data").upsert({user_id:session.user.id,payload:{favorites,progress},updated_at:new Date().toISOString()},{onConflict:"user_id"})
      .then(({error}) => { if (error) setNotice(fr ? "Synchronisation impossible : vérifie la migration Supabase." : "Sync failed: check the Supabase migration."); });
  }, [session?.user.id,syncReady,favorites,progress,fr]);

  useEffect(() => {
    if (!session) { setSummary(null); return; }
    void refreshSummary();
  }, [session?.user.id, refreshSummary]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("password") === "recovery") setRecoveryMode(true);
  }, []);

  useEffect(() => {
    const paymentState = new URLSearchParams(window.location.search).get("payment");
    if (paymentState === "return")
      setNotice(fr ? "Retour de paiement reçu. Le statut définitif apparaîtra après confirmation par CinetPay. Actualise les informations du compte." : "Payment return received. Final status will appear after CinetPay confirmation. Refresh your account details.");
    else if (paymentState === "failed")
      setNotice(fr ? "Le paiement n'a pas été confirmé. Consulte son statut ci-dessous." : "Payment was not confirmed. Check its status below.");
  }, [fr]);

  async function authenticate() {
    setBusy(true); setNotice("");
    try {
      const result = mode === "signup"
        ? await db.auth.signUp({email,password,options:{data:{full_name:fullName,phone}}})
        : await db.auth.signInWithPassword({email,password});
      if (result.error) setNotice(result.error.message);
      else if (mode === "signup" && !result.data.session) setNotice(fr ? "Compte créé : confirme ton adresse e-mail." : "Account created: confirm your email.");
      else setNotice(fr ? "Connexion réussie." : "Signed in.");
    } catch {
      setNotice(fr ? "Connexion impossible pour le moment. Vérifie ta connexion Internet puis réessaie." : "Unable to connect right now. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!email.trim()) {
      setNotice(fr ? "Saisis ton adresse e-mail pour recevoir le lien." : "Enter your email address to receive the reset link.");
      return;
    }
    setBusy(true); setNotice("");
    try {
      const {error} = await db.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/?password=recovery",
      });
      setNotice(error ? error.message : fr ? "Si cette adresse correspond à un compte, un lien de réinitialisation sera envoyé." : "If this address belongs to an account, a reset link will be sent.");
    } catch {
      setNotice(fr ? "Impossible d'envoyer le lien pour le moment. Réessaie plus tard." : "Unable to send the link right now. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword() {
    if (newPassword.length < 8) {
      setNotice(fr ? "Le nouveau mot de passe doit contenir au moins 8 caractères." : "The new password must contain at least 8 characters.");
      return;
    }
    setBusy(true); setNotice("");
    try {
      const {error} = await db.auth.updateUser({password:newPassword});
      if (error) setNotice(error.message);
      else { setNewPassword(""); setRecoveryMode(false); setNotice(fr ? "Mot de passe mis à jour." : "Password updated."); }
    } catch {
      setNotice(fr ? "Mise à jour impossible pour le moment. Réessaie plus tard." : "Unable to update the password right now. Please try again later.");
    } finally {
      setBusy(false);
    }
  }


  useEffect(()=>{
    if(!session?.access_token)return;
    fetch("/api/social/status",{headers:{Authorization:"Bearer "+session.access_token}})
      .then(r=>r.ok?r.json():Promise.reject())
      .then(d=>{setSocialCount(d.count||0);setFollowStatus(d.followStatus||"none");setSocialSubscribed(!!d.subscribed);})
      .catch(()=>{});
  },[session?.access_token]);
  async function startSocialAudit(){
    if(!session)return;
    let platform="Réseau social";
    try{const host=new URL(socialUrl).hostname.toLowerCase();if(host.includes("tiktok"))platform="TikTok";else if(host.includes("facebook")||host.includes("fb."))platform="Facebook";else if(host.includes("instagram"))platform="Instagram";else if(host.includes("youtube"))platform="YouTube";else if(host.includes("x.com")||host.includes("twitter"))platform="X";else if(host.includes("linkedin"))platform="LinkedIn";else throw new Error("Plateforme non reconnue.");}
    catch{setSocialResult("Lien de profil invalide ou réseau non pris en charge.");return;}
    setBusy(true);setSocialResult("");
    try{
      const r=await fetch("/api/social/audits",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({social_url:socialUrl,platform,account_name:socialName,followers:socialFollowers,average_views:socialViews,average_likes:socialLikes,average_comments:socialComments,posts_per_week:socialFrequency,goal:socialGoal})});
      const d=await r.json();
      if(!r.ok)setSocialResult(d.error||"Analyse impossible.");
      else{
        setSocialCount(d.count||socialCount+1);
        const x=d.report;
        setSocialResult("Analyse "+d.count+"/3 · Engagement déclaré : "+x.engagement_rate+"% · Vues/abonnés : "+x.views_to_followers_percent+"%\nPoints forts : "+(x.strengths.join(" ; ")||"À confirmer avec davantage de données.")+"\nÀ améliorer : "+(x.issues.join(" ; ")||"Aucun signal critique dans les chiffres déclarés.")+"\nActions : "+x.actions.join(" ; ")+"\n\n"+x.disclaimer);
      }
      const sr=await fetch("/api/social/status",{headers:{Authorization:"Bearer "+session.access_token}});
      if(sr.ok){const s=await sr.json();setSocialCount(s.count||0);setFollowStatus(s.followStatus||"none");setSocialSubscribed(!!s.subscribed);}
    }catch(e){setSocialResult(e instanceof Error?e.message:"Erreur d'analyse.");}
    finally{setBusy(false);}
  }
  async function submitFollowProof(){
    if(!session)return;setBusy(true);setSocialResult("");
    try{
      const r=await fetch("/api/social/follow-verification",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({account_name:socialName,tiktok_proof_url:tiktokProof,facebook_proof_url:facebookProof})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Envoi impossible.");
      setFollowStatus("pending");setSocialResult("Preuves envoyées. La validation sera effectuée par l'administrateur.");
    }catch(e){setSocialResult(e instanceof Error?e.message:"Erreur.");}finally{setBusy(false);}
  }
  async function startPayment(plan:Plan){
    if(!session?.access_token){setNotice("Connecte-toi pour payer.");return;}
    const parts=fullName.trim().split(/\s+/);const first_name=parts[0]||"Client";const last_name=parts.slice(1).join(" ")||"AQUI";
    setPaymentBusy(true);setNotice("");
    try{
      const r=await fetch("/api/payments/create",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({plan_id:plan.id,first_name,last_name,phone})});
      const d=await r.json();if(!r.ok||!d.payment_url)throw new Error(d.error||"Initialisation du paiement impossible.");
      window.location.assign(d.payment_url);
    }catch(e){setNotice(e instanceof Error?e.message:"Paiement indisponible.");}finally{setPaymentBusy(false);}
  }

  async function startVideo() {
    if (!session?.access_token) {
      setVideoNotice(fr ? "Connecte-toi pour utiliser le générateur." : "Sign in to use the generator.");
      return;
    }
    setVideoBusy(true); setVideoNotice(""); setVideoUrl(""); setVideoStatus("");
    try {
      const response = await fetch("/api/video/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ image_url: videoImageUrl.trim(), prompt: videoPrompt.trim(), duration: Number(videoDuration) }),
      });
      const data = await response.json() as { request_id?: string; status?: string; error?: string };
      if (!response.ok || !data.request_id) throw new Error(data.error || "Video request failed.");
      setVideoRequestId(data.request_id);
      setVideoStatus(data.status || "queued");
      setVideoNotice(fr ? "Demande envoyée. La génération peut prendre plusieurs minutes." : "Request submitted. Generation may take several minutes.");
    } catch (error) {
      setVideoNotice(error instanceof Error ? error.message : (fr ? "Impossible de lancer la génération." : "Unable to start generation."));
    } finally {
      setVideoBusy(false);
    }
  }

  useEffect(() => {
    if (!session?.access_token || !videoRequestId || videoStatus === "completed" || videoStatus === "failed") return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/video/jobs/${videoRequestId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json() as { status?: string; video_url?: string; error_message?: string; error?: string };
        if (!response.ok) throw new Error(data.error || "Status check failed.");
        if (!active) return;
        setVideoStatus(data.status || "running");
        if (data.video_url) setVideoUrl(data.video_url);
        if (data.status === "completed") setVideoNotice(fr ? "Vidéo prête. Le lien sécurisé reste valable une heure." : "Video ready. The secure link is valid for one hour.");
        else if (data.status === "failed") setVideoNotice(data.error_message || (fr ? "La génération a échoué." : "Generation failed."));
      } catch (error) {
        if (active) setVideoNotice(error instanceof Error ? error.message : "Status unavailable.");
      }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 7000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session?.access_token, videoRequestId, videoStatus, fr]);

  async function submit(kind:"ads"|"partners") {
    if (!session) return;
    setBusy(true); setNotice("");
    const table = kind === "ads" ? "hub_ad_requests" : "hub_partner_applications";
    const values = kind === "ads" ? ad : partner;
    try {
      const {error} = await db.from(table).insert({...values,user_id:session.user.id});
      if (error) setNotice(error.message);
      else {
        setNotice(fr ? "Demande envoyée à l'équipe AQUI NET HUB." : "Request sent to the AQUI NET HUB team.");
        if (kind === "ads") setAd({company_name:"",contact_name:"",email:"",phone:"",website:"",budget:"",message:""});
        else setPartner({organization:"",contact_name:"",email:"",phone:"",website:"",proposal:""});
      }
    } catch {
      setNotice(fr ? "Envoi impossible pour le moment. Vérifie ta connexion Internet puis réessaie." : "Unable to submit right now. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const input=(value:string,change:(v:string)=>void,placeholder:string,type="text",required=true)=><input type={type} value={value} onChange={e=>change(e.target.value)} placeholder={placeholder} required={required}/>;
  const date=(value:string)=>new Date(value).toLocaleDateString(fr?"fr-FR":"en-GB");
  const paymentLabel=(status:string)=>status==="paid"?(fr?"Payé":"Paid"):status==="failed"?(fr?"Échoué":"Failed"):(fr?"En attente":"Pending");
  return <section className="section account-hub" id="compte">
    <div className="section-heading"><div><span className="eyebrow">AQUI NET HUB · {service==="video"?"AQUI VIDEO AI":service==="social"?"SOCIAL AUDIT":"PARTENARIATS"}</span><h2>{service==="video"?(fr?"Génération vidéo IA":"AI video generation"):service==="social"?(fr?"Analyse de compte social":"Social account analysis"):(fr?"Partenariats et abonnements":"Partnerships and subscriptions")}</h2><p>{fr?"Connecte-toi pour accéder à ce service.":"Sign in to access this service."}</p></div></div>
    {!session ? <div className="account-card">
      <div className="account-tabs"><button type="button" className={mode==="login"?"active":""} onClick={()=>setMode("login")}>{fr?"Connexion":"Sign in"}</button><button type="button" className={mode==="signup"?"active":""} onClick={()=>setMode("signup")}>{fr?"Créer un compte":"Create account"}</button></div>
      {mode==="signup" && <>{input(fullName,setFullName,fr?"Nom complet":"Full name")}{input(phone,setPhone,fr?"Téléphone (facultatif)":"Phone (optional)","tel",false)}</>}
      {input(email,setEmail,"E-mail","email")}{input(password,setPassword,fr?"Mot de passe (8 caractères minimum)":"Password (8 characters minimum)","password")}
      <button className="primary-button" disabled={busy||!email||password.length<8} onClick={()=>void authenticate()}>{busy?"…":mode==="login"?(fr?"Se connecter":"Sign in"):(fr?"Créer mon compte":"Create account")}</button>
      {mode==="login" && <button type="button" className="text-button account-reset-link" disabled={busy} onClick={()=>void sendPasswordReset()}>{fr?"Mot de passe oublié ?":"Forgot password?"}</button>}
    </div> : <div className="account-card"><p>{fr?"Connecté avec":"Signed in as"} <strong>{session.user.email}</strong></p><p className="sync-status">{fr?"Favoris et progression synchronisés sur ce compte.":"Favorites and progress synced to this account."}</p><button className="filter-button" onClick={()=>void db.auth.signOut()}>{fr?"Se déconnecter":"Sign out"}</button></div>}
    {notice && <p className="account-message" role="status">{notice}</p>}

    {session && recoveryMode && <div className="account-card password-recovery-card"><h3>{fr?"Définir un nouveau mot de passe":"Set a new password"}</h3>{input(newPassword,setNewPassword,fr?"Nouveau mot de passe (8 caractères minimum)":"New password (at least 8 characters)","password")}<button type="button" className="primary-button" disabled={busy||newPassword.length<8} onClick={()=>void updatePassword()}>{busy?"…":fr?"Mettre à jour le mot de passe":"Update password"}</button></div>}

    {session && service==="partners" && <div className="account-card account-summary">
      <div className="account-summary-heading"><div><h3>{fr?"Mes abonnements et paiements":"My subscriptions and payments"}</h3><p>{fr?"Statuts confirmés par le serveur.":"Statuses confirmed by the server."}</p></div><button type="button" className="filter-button" disabled={summaryBusy} onClick={()=>void refreshSummary()}>{summaryBusy?"…":fr?"Actualiser":"Refresh"}</button></div>
      <h4>{fr?"Abonnements":"Subscriptions"}</h4>
      {summary?.subscriptions.length ? summary.subscriptions.map(item=>{
        const isActive=item.status==="active" && new Date(item.ends_at).getTime()>Date.now();
        return <article className="subscription-row" key={item.id}><div><strong>{item.plan_name}</strong><p>{fr?"Du":"From"} {date(item.starts_at)} {fr?"au":"to"} {date(item.ends_at)}</p></div><span className={isActive?"account-status active":"account-status"}>{isActive?(fr?"Actif":"Active"):(fr?"Expiré":"Expired")}</span></article>;
      }) : <p>{fr?"Aucun abonnement confirmé pour le moment.":"No confirmed subscription yet."}</p>}
      <h4>{fr?"Derniers paiements":"Recent payments"}</h4>
      {summary?.payments.length ? summary.payments.map(item=><article className="payment-row" key={item.id}><div><strong>{item.amount_xof.toLocaleString(fr?"fr-FR":"en-GB")} FCFA</strong><p>{date(item.created_at)} · {item.merchant_transaction_id}</p></div><span className={`account-status ${item.status==="paid"?"active":item.status==="failed"?"failed":""}`}>{paymentLabel(item.status)}</span></article>) : <p>{fr?"Aucun paiement enregistré.":"No payment recorded."}</p>}
    </div>}


    {session && service==="social" && <div className="account-card social-audit">
      <span className="eyebrow">AQUI SOCIAL AUDIT · {socialCount}/3 {fr?"analyses gratuites":"free reviews"}</span>
      <h3>{fr?"Diagnostic de ton compte":"Your account review"}</h3>
      <p>{fr?"Renseigne les chiffres visibles dans les statistiques de ton réseau. Le rapport est calculé à partir de ces données déclarées : AQUI NET HUB ne se connecte pas encore directement à ton compte social.":"Enter figures from your platform analytics. The report uses the figures you provide; AQUI NET HUB does not yet connect directly to your social account."}</p>
      {(socialCount<3 || (followStatus==="approved"&&socialSubscribed)) ? <>
        <input type="url" value={socialUrl} onChange={e=>setSocialUrl(e.target.value)} placeholder="Lien public du profil (HTTPS)" required/>
        <input value={socialName} onChange={e=>setSocialName(e.target.value)} placeholder={fr?"Nom exact du compte":"Exact account name"} required/>
        <div className="social-metrics-grid">
          <label>{fr?"Abonnés":"Followers"}<input type="number" min="0" value={socialFollowers} onChange={e=>setSocialFollowers(e.target.value)}/></label>
          <label>{fr?"Vues moyennes / vidéo":"Average views / video"}<input type="number" min="0" value={socialViews} onChange={e=>setSocialViews(e.target.value)}/></label>
          <label>{fr?"J'aime moyens":"Average likes"}<input type="number" min="0" value={socialLikes} onChange={e=>setSocialLikes(e.target.value)}/></label>
          <label>{fr?"Commentaires moyens":"Average comments"}<input type="number" min="0" value={socialComments} onChange={e=>setSocialComments(e.target.value)}/></label>
          <label>{fr?"Publications / semaine":"Posts / week"}<input type="number" min="0" step="0.5" value={socialFrequency} onChange={e=>setSocialFrequency(e.target.value)}/></label>
        </div>
        <input type="text" value={socialGoal} onChange={e=>setSocialGoal(e.target.value)} placeholder={fr?"Objectif : vues, abonnés, ventes…":"Goal: views, followers, sales…"}/>
        <button type="button" className="primary-button" disabled={busy||!socialUrl.trim()||!socialName.trim()} onClick={()=>void startSocialAudit()}>{busy?"…":fr?"Lancer l'analyse":"Run analysis"}</button>
      </>:<p className="account-message">{fr?"Tu as utilisé tes 3 analyses gratuites. Pour continuer, abonne-toi aux deux comptes ci-dessous et envoie les preuves.":"Your 3 free reviews are used. Follow both accounts below and submit proof to continue."}</p>}
      {socialCount>=3&&<div className="follow-gate">
        <h4>{fr?"Étape 1 — Abonne-toi aux deux comptes":"Step 1 — Follow both accounts"}</h4>
        <div className="follow-links"><a href="https://tiktok.com/@el.maestro907" target="_blank" rel="noreferrer">TikTok · @el.maestro907 ↗</a><a href="https://www.facebook.com/profile.php?id=61582777979597" target="_blank" rel="noreferrer">Facebook · S'abonner ↗</a></div>
        {followStatus!=="approved"?<><p>{followStatus==="pending"?(fr?"Preuves en attente de validation manuelle.":"Proof is awaiting manual review."):fr?"Indique ton nom de compte et colle deux liens HTTPS vers des captures montrant tes abonnements.":"Enter your account name and two HTTPS links to screenshots showing both follows."}</p>
          <input value={socialName} onChange={e=>setSocialName(e.target.value)} placeholder={fr?"Ton nom d'utilisateur sur les réseaux":"Your social username"}/>
          <input type="url" value={tiktokProof} onChange={e=>setTiktokProof(e.target.value)} placeholder={fr?"Lien de preuve TikTok (capture)":"TikTok follow proof URL"}/>
          <input type="url" value={facebookProof} onChange={e=>setFacebookProof(e.target.value)} placeholder={fr?"Lien de preuve Facebook (capture)":"Facebook follow proof URL"}/>
          <button className="primary-button" disabled={busy||!socialName.trim()||!tiktokProof.trim()||!facebookProof.trim()||followStatus==="pending"} onClick={()=>void submitFollowProof()}>{fr?"Envoyer pour vérification":"Submit for review"}</button>
        </>:<><p>{fr?"Abonnements validés. Étape 2 : active ton abonnement pour poursuivre les analyses.":"Follows verified. Step 2: activate a subscription to continue."}</p>{!socialSubscribed&&plans.map(p=><article className="plan-row" key={p.id}><div><strong>{p.name}</strong><p>{p.description} · {p.duration_days} {fr?"jours":"days"}</p><strong>{p.amount_xof.toLocaleString("fr-FR")} FCFA</strong></div><button type="button" className="filter-button" disabled={paymentBusy} onClick={()=>void startPayment(p)}>{paymentBusy?"…":fr?"S'abonner et payer":"Subscribe and pay"}</button></article>)}{socialSubscribed&&<p className="account-message">{fr?"Abonnement actif : les analyses supplémentaires sont débloquées.":"Active subscription: additional reviews are unlocked."}</p>}</>}
      </div>}
      {socialResult&&<pre className="account-message social-report" role="status">{socialResult}</pre>}
      <small className="account-footnote">{fr?"Les captures sont contrôlées manuellement. Les statistiques ne sont pas authentifiées automatiquement par TikTok ou Meta.":"Screenshots are reviewed manually. TikTok or Meta do not automatically authenticate these metrics here."}</small>
    </div>}
    {session && service==="video" && <div className="account-card video-studio">
      <span className="eyebrow">AQUI VIDEO AI</span>
      <h3>{fr ? "Créer une vidéo à partir d'une image" : "Create a video from an image"}</h3>
      <p>{fr ? "Moteur Wan 2.2 expérimental : clips de 2 à 5 secondes gratuits. Le modèle actuel est techniquement limité à 5 secondes ; les durées supérieures nécessitent un moteur compatible avant de pouvoir être proposées." : "Experimental Wan 2.2 engine. Currently: public HTTPS image URL and 2–5 second clips. Generation depends on service availability and quotas."}</p>
      <input type="url" value={videoImageUrl} onChange={e=>setVideoImageUrl(e.target.value)} placeholder={fr ? "Lien direct public de l'image (JPG, PNG, WEBP)" : "Public direct image URL (JPG, PNG, WEBP)"} required />
      <textarea value={videoPrompt} onChange={e=>setVideoPrompt(e.target.value)} placeholder={fr ? "Décris précisément le mouvement souhaité…" : "Describe the motion you want…"} required />
      <label>{fr ? "Durée du clip" : "Clip duration"}
        <select value={videoDuration} onChange={e=>setVideoDuration(e.target.value)}>
          <option value="2">2 secondes</option><option value="3">3 secondes</option><option value="4">4 secondes</option><option value="5">5 secondes</option>
        </select>
      </label>
      <button type="button" className="primary-button" disabled={videoBusy || !videoImageUrl.trim() || videoPrompt.trim().length<3} onClick={()=>void startVideo()}>
        {videoBusy ? "…" : (fr ? "Lancer la génération" : "Generate video")}
      </button>
      {videoRequestId && <p className="video-status">{fr ? "État :" : "Status:"} {videoStatus || "queued"} · {videoRequestId}</p>}
      {videoNotice && <p className="account-message" role="status">{videoNotice}</p>}
      {videoUrl && <div className="video-result"><video controls playsInline src={videoUrl} /><a href={videoUrl} target="_blank" rel="noreferrer">{fr ? "Ouvrir / enregistrer le MP4" : "Open / save MP4"} ↗</a></div>}
      <small className="account-footnote">{fr ? "L'audio IA, les sous-titres automatiques, les clips de 10 secondes et la tarification ne sont pas encore activés. Aucun paiement n'est déclenché ici." : "The current Wan 2.2 engine has a hard 5-second limit. Longer paid clips are not enabled until a compatible model is connected."}</small>
    </div>}

    {session && service==="partners" && <div className="account-grid">
      <form className="account-card" onSubmit={e=>{e.preventDefault();void submit("ads");}}><h3>AQUI NET ADS</h3><p>{fr?"Proposer une campagne publicitaire.":"Submit an advertising campaign."}</p>
        {input(ad.company_name,v=>setAd(s=>({...s,company_name:v})),fr?"Entreprise / marque":"Company / brand")}
        {input(ad.contact_name,v=>setAd(s=>({...s,contact_name:v})),fr?"Nom du contact":"Contact name")}
        {input(ad.email,v=>setAd(s=>({...s,email:v})),"E-mail","email")}
        {input(ad.phone,v=>setAd(s=>({...s,phone:v})),fr?"Téléphone":"Phone","tel",false)}
        {input(ad.website,v=>setAd(s=>({...s,website:v})),"Site web","url",false)}
        {input(ad.budget,v=>setAd(s=>({...s,budget:v})),fr?"Budget indicatif (FCFA)":"Indicative budget (XOF)","text",false)}
        <textarea required value={ad.message} onChange={e=>setAd(s=>({...s,message:e.target.value}))} placeholder={fr?"Décris ta campagne":"Describe your campaign"}/>
        <button className="primary-button" disabled={!session||busy}>{fr?"Envoyer la demande":"Send request"}</button>
      </form>
      <form className="account-card" onSubmit={e=>{e.preventDefault();void submit("partners");}}><h3>AQUI NET PARTNERS</h3><p>{fr?"Proposer une collaboration.":"Propose a partnership."}</p>
        {input(partner.organization,v=>setPartner(s=>({...s,organization:v})),fr?"Organisation":"Organization")}
        {input(partner.contact_name,v=>setPartner(s=>({...s,contact_name:v})),fr?"Nom du contact":"Contact name")}
        {input(partner.email,v=>setPartner(s=>({...s,email:v})),"E-mail","email")}
        {input(partner.phone,v=>setPartner(s=>({...s,phone:v})),fr?"Téléphone":"Phone","tel",false)}
        {input(partner.website,v=>setPartner(s=>({...s,website:v})),"Site web","url",false)}
        <textarea required value={partner.proposal} onChange={e=>setPartner(s=>({...s,proposal:e.target.value}))} placeholder={fr?"Présente ta proposition":"Describe your proposal"}/>
        <button className="primary-button" disabled={!session||busy}>{fr?"Envoyer la candidature":"Send application"}</button>
      </form>
    </div>}
    {session && service==="partners" && campaigns.length>0 && <div className="account-card"><h3>{fr?"Campagnes actives":"Active campaigns"}</h3>{campaigns.map(c=><article key={c.id}><strong>{c.title}</strong><p>{c.description}</p>{c.destination_url&&<a href={c.destination_url} target="_blank" rel="noreferrer">{fr?"Découvrir":"Learn more"} ↗</a>}</article>)}</div>}
    {service==="partners" && <div className="account-card"><h3>{fr?"Abonnements publicité et partenariat":"Advertising and partnership plans"}</h3>{plans.length?plans.map(p=><article className="plan-row" key={p.id}><div><strong>{p.name}</strong><p>{p.description} · {p.duration_days} {fr?"jours":"days"}</p><strong>{p.amount_xof.toLocaleString("fr-FR")} FCFA</strong></div><button type="button" className="filter-button" disabled={!session||paymentBusy} onClick={()=>void startPayment(p)}>{!session?(fr?"Connecte-toi pour payer":"Sign in to pay"):(paymentBusy?"…":fr?"Payer avec CinetPay":"Pay with CinetPay")}</button></article>):<p>{fr?"Aucune formule n'est publiée pour le moment.":"No plans are published yet."}</p>}</div>
    <small className="account-footnote">{fr?"500 FCFA / mois · 5 000 FCFA / an. Le paiement dépend de la configuration active du compte marchand CinetPay.":"500 XOF / month · 5,000 XOF / year. Payment requires an active CinetPay merchant setup."}</small></div>}
    {!session && <p className="account-footnote">{fr?"Connecte-toi pour utiliser le service sélectionné.":"Sign in to use the selected service."}</p>}
  </section>;
}
