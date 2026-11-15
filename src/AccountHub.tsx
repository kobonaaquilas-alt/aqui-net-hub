import { useCallback, useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import AdvertiserHub from "./AdvertiserHub";

const db = createClient("https://xbobkysbtvtmepqgtnbt.supabase.co", "sb_publishable_AGtfBQyqyKbH5C_4f5cQgw_bm0MmusA");
type Service = "video" | "social" | "partners";
type Props = { service: Service; favorites: string[]; progress: string[]; lang: "fr" | "en"; onRemoteSync: (favorites: string[], progress: string[]) => void; authOnly?: boolean };
type Plan = { id: string; name: string; description: string; amount_xof: number; duration_days: number };
type Campaign = { id: string; title: string; description: string; destination_url: string | null };
type Subscription = { id: string; plan_id: string; plan_name: string; starts_at: string; ends_at: string; status: string };
type Payment = { id: string; merchant_transaction_id: string; amount_xof: number; currency: string; status: string; created_at: string; paid_at: string | null };
type AccountSummary = { subscriptions: Subscription[]; payments: Payment[] };

export default function AccountHub({ service, favorites, progress, lang, onRemoteSync, authOnly = false }: Props) {
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
  const [videoMode, setVideoMode] = useState<"image" | "text">("image");
  const [videoImageFile, setVideoImageFile] = useState<File | null>(null);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoDuration, setVideoDuration] = useState("2");
  const [videoRequestId, setVideoRequestId] = useState("");
  const [videoStatus, setVideoStatus] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoNotice, setVideoNotice] = useState("");
  const [videoPaywall,setVideoPaywall]=useState(false);
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
  const [tiktokBusy,setTiktokBusy]=useState(false);
  const [tiktokNotice,setTiktokNotice]=useState("");
  const [tiktokData,setTiktokData]=useState<any>(null);
  const [tiktokProof,setTiktokProof]=useState("");
  const [facebookBusy,setFacebookBusy]=useState(false);
  const [facebookNotice,setFacebookNotice]=useState("");
  const [facebookPages,setFacebookPages]=useState<Array<{page_id:string;page_name:string}>>([]);
  const [facebookPageId,setFacebookPageId]=useState("");
  const [facebookAudit,setFacebookAudit]=useState<any>(null);
  const [facebookProof,setFacebookProof]=useState("");
  const [paymentBusy,setPaymentBusy]=useState(false);
  const [backendReady,setBackendReady]=useState(false);
  const [videoReady,setVideoReady]=useState(false);
  const [cinetpayReady,setCinetpayReady]=useState(false);

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
    fetch("/api/health").then(r=>r.ok?r.json():Promise.reject()).then(d=>{setBackendReady(!!d.supabase);setVideoReady(!!d.supabase&&!!d.video_provider_available);setCinetpayReady(!!d.cinetpay);}).catch(()=>{setBackendReady(false);setVideoReady(false);setCinetpayReady(false);});
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
    if(!session?.access_token||service!=="social")return;
    const state=new URLSearchParams(window.location.search).get("tiktok");
    if(state){const messages:Record<string,string>={connected:fr?"TikTok connecté. Chargement des statistiques…":"TikTok connected. Loading statistics…",denied:fr?"Autorisation TikTok refusée.":"TikTok authorization denied.",expired:fr?"Session TikTok expirée. Recommence la connexion.":"TikTok session expired. Reconnect.",save_error:fr?"Impossible d'enregistrer la connexion TikTok.":"Could not save TikTok connection.",invalid:fr?"Réponse TikTok invalide.":"Invalid TikTok response."};setTiktokNotice(messages[state]||"");const clean=new URL(window.location.href);clean.searchParams.delete("tiktok");window.history.replaceState({}, "", clean.toString());}
    void loadTikTok();
  },[session?.access_token,service,fr]);
  useEffect(() => {
    if(!session?.access_token||service!=="social")return;
    const state=new URLSearchParams(window.location.search).get("facebook");
    if(state){
      const messages:Record<string,string>={
        connected:fr?"Facebook connecté. Chargement des Pages…":"Facebook connected. Loading Pages…",
        denied:fr?"Autorisation Facebook refusée.":"Facebook authorization denied.",
        expired:fr?"Session Facebook expirée. Recommence la connexion.":"Facebook session expired. Reconnect.",
        no_pages:fr?"Aucune Page Facebook administrée n'a été trouvée.":"No managed Facebook Page was found.",
        save_error:fr?"Impossible d'enregistrer la connexion Facebook.":"Could not save Facebook connection.",
        invalid:fr?"Réponse Facebook invalide.":"Invalid Facebook response."
      };
      setFacebookNotice(messages[state]||"");
      const clean=new URL(window.location.href);clean.searchParams.delete("facebook");window.history.replaceState({}, "", clean.toString());
    }
    void loadFacebookPages();
  },[session?.access_token,service,fr]);
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
        ? await db.auth.signUp({email:email.trim().toLowerCase(),password,options:{data:{full_name:fullName.trim(),phone:phone.trim()}}})
        : await db.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
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
    if(!backendReady){setSocialResult("Service temporairement indisponible : la clé privée Supabase du Worker doit être configurée.");return;}
    let platform="Réseau social";
    try{const host=new URL(socialUrl).hostname.toLowerCase();if(host.includes("tiktok"))platform="TikTok";else if(host.includes("facebook")||host.includes("fb."))platform="Facebook";else if(host.includes("instagram"))platform="Instagram";else if(host.includes("youtube"))platform="YouTube";else throw new Error("Seuls TikTok, Facebook, Instagram et YouTube sont pris en charge.");}
    catch{setSocialResult("Lien de profil invalide ou réseau non pris en charge.");return;}
    setBusy(true);setSocialResult("");
    try{
      const r=await fetch("/api/social/audits",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({social_url:socialUrl,platform,account_name:socialName,followers:socialFollowers,average_views:socialViews,average_likes:socialLikes,average_comments:socialComments,posts_per_week:socialFrequency,goal:socialGoal})});
      const d=await r.json();
      if(!r.ok)setSocialResult(d.error||"Analyse impossible.");
      else{
        setSocialCount(d.count||socialCount+1);
        const x=d.report;
        setSocialResult("Analyse "+d.count+"/3 · Indice : "+x.health_score+"/100 · Engagement/vues : "+x.engagement_rate_by_views+"% · Vues/abonnés : "+x.views_to_followers_percent+"%\nPoints forts : "+(x.strengths.join(" ; ")||"À confirmer avec davantage de données.")+"\nÀ améliorer : "+(x.issues.join(" ; ")||"Aucun signal critique dans les chiffres déclarés.")+"\nActions : "+x.actions.join(" ; ")+"\n\n"+x.disclaimer);
      }
      const sr=await fetch("/api/social/status",{headers:{Authorization:"Bearer "+session.access_token}});
      if(sr.ok){const s=await sr.json();setSocialCount(s.count||0);setFollowStatus(s.followStatus||"none");setSocialSubscribed(!!s.subscribed);}
    }catch(e){setSocialResult(e instanceof Error?e.message:"Erreur d'analyse.");}
    finally{setBusy(false);}
  }
  async function loadTikTok(){
    if(!session?.access_token)return;
    setTiktokBusy(true);setTiktokNotice("");
    try{const r=await fetch("/api/tiktok/me",{headers:{Authorization:"Bearer "+session.access_token}});const d=await r.json();if(!r.ok)throw new Error(d.error||"Lecture TikTok impossible.");setTiktokData(d.connected?d:null);}
    catch(e){setTiktokNotice(e instanceof Error?e.message:"Erreur TikTok.");}finally{setTiktokBusy(false);}
  }
  function applyTikTokStats(){
    if(!tiktokData?.profile)return;
    const videos=Array.isArray(tiktokData.videos)?tiktokData.videos:[];
    const average=(field:string)=>videos.length
      ?Math.round(videos.reduce((sum:number,item:any)=>sum+Number(item[field]||0),0)/videos.length)
      :0;
    const profile=tiktokData.profile;
    setSocialName(profile.display_name||profile.username||"TikTok");
    if(profile.profile_deep_link)setSocialUrl(profile.profile_deep_link);
    setSocialFollowers(String(profile.follower_count||0));
    setSocialViews(String(average("view_count")));
    setSocialLikes(String(average("like_count")));
    setSocialComments(String(average("comment_count")));
    setTiktokNotice(fr?"Statistiques transférées dans le formulaire AQUI NET HELP · SOCIAL AUDIT. Vérifie le lien du profil puis lance l'analyse.":"Metrics copied into the AQUI NET HELP · SOCIAL AUDIT form. Check the profile link, then run the audit.");
  }
  async function connectTikTok(){
    if(!session?.access_token){setTiktokNotice(fr?"Connecte-toi d'abord à AQUI NET HELP.":"Sign in to AQUI NET HELP first.");return;}
    setTiktokBusy(true);setTiktokNotice("");
    try{const r=await fetch("/api/tiktok/connect",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({native:Capacitor.isNativePlatform()})});const d=await r.json();if(!r.ok||!d.authorization_url)throw new Error(d.error||"Connexion TikTok indisponible.");if(Capacitor.isNativePlatform()){await Browser.open({url:d.authorization_url,toolbarColor:"#101C32"});setTiktokBusy(false);}else window.location.assign(d.authorization_url);}
    catch(e){setTiktokNotice(e instanceof Error?e.message:"Connexion TikTok impossible.");setTiktokBusy(false);}
  }
  async function disconnectTikTok(){
    if(!session?.access_token)return;setTiktokBusy(true);
    try{const r=await fetch("/api/tiktok/disconnect",{method:"DELETE",headers:{Authorization:"Bearer "+session.access_token}});const d=await r.json();if(!r.ok)throw new Error(d.error||"Déconnexion impossible.");setTiktokData(null);setTiktokNotice(fr?"Compte TikTok déconnecté.":"TikTok account disconnected.");}
    catch(e){setTiktokNotice(e instanceof Error?e.message:"Erreur.");}finally{setTiktokBusy(false);}
  }
  async function loadFacebookPages(){
    if(!session?.access_token)return;
    setFacebookBusy(true);
    try{
      const r=await fetch("/api/facebook/pages",{headers:{Authorization:"Bearer "+session.access_token}});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Lecture des Pages Facebook impossible.");
      const pages=d.pages||[];
      setFacebookPages(pages);
      setFacebookPageId(current=>pages.some((p:{page_id:string})=>p.page_id===current)?current:pages[0]?.page_id||"");
    }catch(e){setFacebookNotice(e instanceof Error?e.message:"Erreur Facebook.");}
    finally{setFacebookBusy(false);}
  }
  async function connectFacebook(){
    if(!session?.access_token){setFacebookNotice(fr?"Connecte-toi d'abord à AQUI NET HELP.":"Sign in to AQUI NET HELP first.");return;}
    setFacebookBusy(true);setFacebookNotice("");
    try{
      const r=await fetch("/api/facebook/connect",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({native:Capacitor.isNativePlatform()})});
      const d=await r.json();
      if(!r.ok||!d.authorization_url)throw new Error(d.error||"Connexion Facebook indisponible.");
      if(Capacitor.isNativePlatform()){await Browser.open({url:d.authorization_url,toolbarColor:"#101C32"});setFacebookBusy(false);}
      else window.location.assign(d.authorization_url);
    }catch(e){setFacebookNotice(e instanceof Error?e.message:"Connexion Facebook impossible.");setFacebookBusy(false);}
  }
  async function disconnectFacebook(){
    if(!session?.access_token)return;
    setFacebookBusy(true);
    try{
      const r=await fetch("/api/facebook/disconnect",{method:"DELETE",headers:{Authorization:"Bearer "+session.access_token}});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Déconnexion impossible.");
      setFacebookPages([]);setFacebookPageId("");setFacebookAudit(null);
      setFacebookNotice(fr?"Compte Facebook déconnecté.":"Facebook account disconnected.");
    }catch(e){setFacebookNotice(e instanceof Error?e.message:"Erreur Facebook.");}
    finally{setFacebookBusy(false);}
  }
  async function syncFacebookStats(){
    if(!session?.access_token||!facebookPageId)return;
    setFacebookBusy(true);setFacebookNotice("");
    try{
      const r=await fetch("/api/facebook/audit",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({page_id:facebookPageId})});
      const d=await r.json();if(!r.ok||!d.report)throw new Error(d.error||"Analyse Facebook impossible.");
      const report=d.report;setFacebookAudit(report);
      setSocialName(report.page_name||"Facebook");
      setSocialUrl("https://www.facebook.com/"+report.page_id);
      setSocialFollowers(String(report.followers||0));
      setSocialLikes(String(report.average_likes||0));
      setSocialComments(String(report.average_comments||0));
      setFacebookNotice(fr?"Statistiques récupérées depuis Meta. Tu peux maintenant lancer l'analyse AQUI NET HELP · SOCIAL AUDIT.":"Statistics retrieved from Meta. You can now run the AQUI NET HELP · SOCIAL AUDIT analysis.");
    }catch(e){setFacebookNotice(e instanceof Error?e.message:"Erreur pendant la lecture des statistiques Facebook.");}
    finally{setFacebookBusy(false);}
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
    if(!cinetpayReady){setNotice("Paiement indisponible : les clés API CinetPay ne sont pas encore configurées.");return;}
    const parts=fullName.trim().split(/\s+/);const first_name=parts[0]||"Client";const last_name=parts.slice(1).join(" ")||"AQUI";
    setPaymentBusy(true);setNotice("");
    try{
      const r=await fetch("/api/payments/create",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({plan_id:plan.id,first_name,last_name,phone,native:Capacitor.isNativePlatform()})});
      const d=await r.json();if(!r.ok||!d.payment_url)throw new Error(d.error||"Initialisation du paiement impossible.");
      if(Capacitor.isNativePlatform()) await Browser.open({url:d.payment_url,toolbarColor:"#101C32"}); else window.location.assign(d.payment_url);
    }catch(e){setNotice(e instanceof Error?e.message:"Paiement indisponible.");}finally{setPaymentBusy(false);}
  }

  async function startVideo() {
    if (!session?.access_token) {
      setVideoNotice(fr ? "Connecte-toi pour utiliser le générateur." : "Sign in to use the generator.");
      return;
    }
    if(!videoReady){setVideoNotice("Générateur indisponible : aucun moteur vidéo disponible : configure MAGIC_HOUR_API_KEY dans Cloudflare.");return;}
    if(videoMode==="image"&&!videoImageFile){setVideoNotice(fr?"Téléverse d’abord une image.":"Upload an image first.");return;}
    setVideoBusy(true); setVideoNotice(""); setVideoUrl(""); setVideoStatus("");
    try {
      const form = new FormData();
      form.append("mode", videoMode);
      form.append("prompt", videoPrompt.trim());
      form.append("duration", videoDuration);
      if (videoMode === "image" && videoImageFile) form.append("image", videoImageFile, videoImageFile.name);
      const response = await fetch("/api/video/jobs", {
        method: "POST",
        headers: { Authorization: "Bearer " + session.access_token },
        body: form,
      });
      const data = await response.json() as { request_id?: string; status?: string; error?: string; code?: string };
      if (response.status === 402 || data.code === "PAYMENT_REQUIRED") {
        setVideoPaywall(true);
        setVideoNotice(data.error || (fr ? "Un abonnement AQUI NET HELP actif est requis pour utiliser le générateur." : "An active AQUI NET HELP subscription is required to use the generator."));
        return;
      }
      if (!response.ok || !data.request_id) throw new Error(data.error || "Video request failed.");
      setVideoPaywall(false);
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
        setNotice(fr ? "Demande envoyée à l'équipe AQUI NET HELP." : "Request sent to the AQUI NET HELP team.");
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
  const hasActiveSubscription=!!summary?.subscriptions.some(item=>item.status==="active"&&new Date(item.ends_at).getTime()>Date.now());
  const date=(value:string)=>new Date(value).toLocaleDateString(fr?"fr-FR":"en-GB");
  const paymentLabel=(status:string)=>status==="paid"?(fr?"Payé":"Paid"):status==="failed"?(fr?"Échoué":"Failed"):(fr?"En attente":"Pending");
  if (authOnly) return <section className="section account-hub account-access" id="account-access">
    <div className="section-heading"><div><span className="eyebrow">AQUI NET HELP · ESPACE MEMBRE</span><h2>{fr?"Créer un compte ou se connecter":"Create an account or sign in"}</h2><p>{fr?"Un compte est nécessaire pour utiliser les trois services protégés.":"An account is required to use the three protected services."}</p></div></div>
    {!session ? <div className="account-card">
      <div className="account-tabs"><button type="button" className={mode==="login"?"active":""} onClick={()=>setMode("login")}>{fr?"Connexion":"Sign in"}</button><button type="button" className={mode==="signup"?"active":""} onClick={()=>setMode("signup")}>{fr?"Créer un compte":"Create account"}</button></div>
      {mode==="signup" && <>{input(fullName,setFullName,fr?"Nom complet":"Full name")}{input(phone,setPhone,fr?"Téléphone (facultatif)":"Phone (optional)","tel",false)}</>}
      {input(email,setEmail,"E-mail","email")}{input(password,setPassword,fr?"Mot de passe (8 caractères minimum)":"Password (8 characters minimum)","password")}
      <button className="primary-button" disabled={busy||!email||password.length<8} onClick={()=>void authenticate()}>{busy?"…":mode==="login"?(fr?"Se connecter":"Sign in"):(fr?"Créer mon compte":"Create account")}</button>
      {mode==="login" && <button type="button" className="text-button account-reset-link" disabled={busy} onClick={()=>void sendPasswordReset()}>{fr?"Mot de passe oublié ?":"Forgot password?"}</button>}
      {notice && <p className="account-message" role="status">{notice}</p>}
    </div> : <div className="account-card"><p>{fr?"Connecté avec":"Signed in as"} <strong>{session.user.email}</strong></p><button className="filter-button" onClick={()=>void db.auth.signOut()}>{fr?"Se déconnecter":"Sign out"}</button></div>}
  </section>;

  return <section className="section account-hub" id="diagnostic">
    <div className="section-heading"><div><span className="eyebrow">AQUI NET HELP · {service==="video"?"AQUI VIDEO AI":service==="social"?"SOCIAL AUDIT":"PARTENARIATS"}</span><h2>{service==="video"?(fr?"Génération vidéo IA":"AI video generation"):service==="social"?(fr?"Analyse de compte social":"Social account analysis"):(fr?"Partenariats et abonnements":"Partnerships and subscriptions")}</h2><p>{fr?"Connecte-toi pour accéder à ce service.":"Sign in to access this service."}</p></div></div>
    {!session ? <div className="account-card">
      <div className="account-tabs"><button type="button" className={mode==="login"?"active":""} onClick={()=>setMode("login")}>{fr?"Connexion":"Sign in"}</button><button type="button" className={mode==="signup"?"active":""} onClick={()=>setMode("signup")}>{fr?"Créer un compte":"Create account"}</button></div>
      {mode==="signup" && <>{input(fullName,setFullName,fr?"Nom complet":"Full name")}{input(phone,setPhone,fr?"Téléphone (facultatif)":"Phone (optional)","tel",false)}</>}
      {input(email,setEmail,"E-mail","email")}{input(password,setPassword,fr?"Mot de passe (8 caractères minimum)":"Password (8 characters minimum)","password")}
      <button className="primary-button" disabled={busy||!email||password.length<8} onClick={()=>void authenticate()}>{busy?"…":mode==="login"?(fr?"Se connecter":"Sign in"):(fr?"Créer mon compte":"Create account")}</button>
      {mode==="login" && <button type="button" className="text-button account-reset-link" disabled={busy} onClick={()=>void sendPasswordReset()}>{fr?"Mot de passe oublié ?":"Forgot password?"}</button>}
    </div> : <div className="account-card"><p>{fr?"Connecté avec":"Signed in as"} <strong>{session.user.email}</strong></p><p className="sync-status">{fr?"Favoris et progression synchronisés sur ce compte.":"Favorites and progress synced to this account."}</p><button className="filter-button" onClick={()=>void db.auth.signOut()}>{fr?"Se déconnecter":"Sign out"}</button></div>}
    {notice && <p className="account-message" role="status">{notice}</p>}
    {session && !hasActiveSubscription && service==="partners" && <div className="account-card subscription-required"><span className="eyebrow">AQUI NET HELP · ABONNEMENT</span><h3>{fr?"Abonnement requis":"Subscription required"}</h3><p>{fr?"Pour prolonger la diffusion après l’essai publicitaire gratuit de 3 jours ou débloquer les fonctions payantes, choisis une formule ci-dessous.":"Choose a plan to continue campaigns after the 3-day free ad trial or unlock paid features."}</p>{plans.length?plans.map(p=><article className="plan-row" key={p.id}><div><strong>{p.name}</strong><p>{p.description} · {p.duration_days} {fr?"jours":"days"}</p><strong>{p.amount_xof.toLocaleString("fr-FR")} FCFA</strong></div><button type="button" className="filter-button" disabled={!cinetpayReady||paymentBusy} onClick={()=>void startPayment(p)}>{!cinetpayReady?(fr?"Paiement bientôt disponible":"Payment coming soon"):paymentBusy?"…":fr?"S’abonner et payer":"Subscribe and pay"}</button></article>):<p>{fr?"Les formules d’abonnement seront affichées ici dès leur activation.":"Subscription plans will appear here when activated."}</p>}</div>}

    {session && recoveryMode && <div className="account-card password-recovery-card"><h3>{fr?"Définir un nouveau mot de passe":"Set a new password"}</h3>{input(newPassword,setNewPassword,fr?"Nouveau mot de passe (8 caractères minimum)":"New password (at least 8 characters)","password")}<button type="button" className="primary-button" disabled={busy||newPassword.length<8} onClick={()=>void updatePassword()}>{busy?"…":fr?"Mettre à jour le mot de passe":"Update password"}</button></div>}

    {session && service==="partners" && <AdvertiserHub accessToken={session.access_token} lang={lang} />}

    {session && hasActiveSubscription && service==="partners" && <div className="account-card account-summary">
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
      <span className="eyebrow">AQUI NET HELP · SOCIAL AUDIT · {socialCount}/3 {fr?"analyses gratuites":"free reviews"}</span>
      <h3>{fr?"Diagnostic de ton compte":"Your account review"}</h3>
      <p>{fr?"Analyse Facebook sans autorisation Meta : relève les chiffres dans Meta Business Suite, puis AQUI NET HELP calcule les indicateurs et conseils. Pour les autres réseaux, saisis les statistiques disponibles.":"Analyze Facebook without Meta permissions: get the figures from Meta Business Suite, then AQUI NET HELP calculates indicators and recommendations. Enter available metrics for other networks."}</p>
      <div className="social-connect-grid">
        <article className="follow-gate">
          <h4>{fr?"Connexion officielle TikTok":"Official TikTok connection"}</h4>
          <p>{fr?"Autorise l'accès aux statistiques et vidéos que l'API TikTok permet de consulter.":"Authorize access to the profile statistics and videos made available by TikTok's API."}</p>
          <button type="button" className="primary-button" disabled={tiktokBusy||!backendReady} onClick={()=>void connectTikTok()}>{tiktokBusy?"…":tiktokData?(fr?"Reconnecter TikTok":"Reconnect TikTok"):(fr?"Connecter TikTok":"Connect TikTok")}</button>
          {tiktokData&&<button type="button" className="filter-button" disabled={tiktokBusy} onClick={()=>void loadTikTok()}>{fr?"Actualiser les statistiques":"Refresh statistics"}</button>}
          {tiktokNotice&&<p className="account-message" role="status">{tiktokNotice}</p>}
          {tiktokData?.profile&&<div className="social-report">
            <strong>{tiktokData.profile.display_name||"TikTok"}</strong>
            <p>{fr?"Abonnés :":"Followers: "} {Number(tiktokData.profile.follower_count||0).toLocaleString()}</p>
            <p>{fr?"J'aime :":"Likes: "} {Number(tiktokData.profile.likes_count||0).toLocaleString()} · {fr?"Vidéos :":"Videos: "} {Number(tiktokData.profile.video_count||0).toLocaleString()}</p>
            <small>{fr?"Données renvoyées par l'API officielle, selon les autorisations accordées.":"Official API data, subject to granted permissions."}</small>
            <button type="button" className="filter-button" disabled={tiktokBusy} onClick={applyTikTokStats}>{fr?"Utiliser ces statistiques":"Use these statistics"}</button>
            <button type="button" className="filter-button" disabled={tiktokBusy} onClick={()=>void disconnectTikTok()}>{fr?"Déconnecter TikTok":"Disconnect TikTok"}</button>
          </div>}
        </article>
        <article className="follow-gate">
          <h4>{fr?"Connexion officielle Facebook":"Official Facebook connection"}</h4>
          <p>{fr?"Connecte une Page que tu administres pour récupérer les statistiques autorisées par Meta.":"Connect a Page you manage to retrieve the statistics authorized by Meta."}</p>
          <button type="button" className="primary-button" disabled={facebookBusy||!backendReady} onClick={()=>void connectFacebook()}>{facebookBusy?"…":facebookPages.length?(fr?"Reconnecter Facebook":"Reconnect Facebook"):(fr?"Connecter Facebook":"Connect Facebook")}</button>
          {facebookPages.length>0&&<>
            <label>{fr?"Page Facebook":"Facebook Page"}
              <select value={facebookPageId} onChange={e=>setFacebookPageId(e.target.value)}>
                {facebookPages.map(page=><option key={page.page_id} value={page.page_id}>{page.page_name}</option>)}
              </select>
            </label>
            <button type="button" className="filter-button" disabled={facebookBusy||!facebookPageId} onClick={()=>void syncFacebookStats()}>{fr?"Charger les statistiques":"Load statistics"}</button>
            <button type="button" className="filter-button" disabled={facebookBusy} onClick={()=>void disconnectFacebook()}>{fr?"Déconnecter Facebook":"Disconnect Facebook"}</button>
          </>}
          {facebookNotice&&<p className="account-message" role="status">{facebookNotice}</p>}
          {facebookAudit&&<div className="social-report">
            <strong>{facebookAudit.page_name}</strong>
            <p>{fr?"Abonnés :":"Followers: "} {Number(facebookAudit.followers||0).toLocaleString()}</p>
            <p>{fr?"Publications analysées :":"Posts analyzed: "} {facebookAudit.posts_analyzed}</p>
            <p>{fr?"Interactions moyennes :":"Average interactions: "} {facebookAudit.average_likes} · {facebookAudit.average_comments}</p>
            <p>{fr?"Impressions sur 28 jours :":"28-day impressions: "} {facebookAudit.impressions_28d??(fr?"indisponibles":"unavailable")}</p>
            <small>{facebookAudit.disclaimer}</small>
          </div>}
        </article>
      </div>

      <div className="manual-audit-panel">
        <h4>{fr?"Analyse assistée Instagram, YouTube et autres comptes":"Assisted audit for Instagram, YouTube and other accounts"}</h4>
        <p>{fr?"Pour Instagram et YouTube, saisis les chiffres visibles dans les statistiques natives de la plateforme. Pour Facebook, tu peux aussi utiliser Meta Business Suite. AQUI NET HELP calcule les ratios et construit les recommandations à partir de ces données.":"For Instagram and YouTube, enter the figures shown in the platform's native analytics. For Facebook, you can also use Meta Business Suite. AQUI NET HELP calculates ratios and builds recommendations from those metrics."}</p>
        <a className="filter-button" href="https://business.facebook.com/latest/insights" target="_blank" rel="noreferrer">{fr?"Ouvrir Meta Business Suite":"Open Meta Business Suite"} ↗</a>
      </div>

      {(socialCount<3 || socialSubscribed) ? <>
        <div className="social-metrics-grid">
          <label>{fr?"Lien du profil":"Profile URL"}<input type="url" value={socialUrl} onChange={e=>setSocialUrl(e.target.value)} placeholder="https://…" required/></label>
          <label>{fr?"Réseau / nom du compte":"Network / account name"}<input value={socialName} onChange={e=>setSocialName(e.target.value)} placeholder={fr?"Nom exact du compte":"Exact account name"} required/></label>
          <label>{fr?"Abonnés":"Followers"}<input type="number" min="0" value={socialFollowers} onChange={e=>setSocialFollowers(e.target.value)}/></label>
          <label>{fr?"Vues moyennes / contenu":"Average views / post"}<input type="number" min="0" value={socialViews} onChange={e=>setSocialViews(e.target.value)}/></label>
          <label>{fr?"J'aime moyens":"Average likes"}<input type="number" min="0" value={socialLikes} onChange={e=>setSocialLikes(e.target.value)}/></label>
          <label>{fr?"Commentaires moyens":"Average comments"}<input type="number" min="0" value={socialComments} onChange={e=>setSocialComments(e.target.value)}/></label>
          <label>{fr?"Publications / semaine":"Posts / week"}<input type="number" min="0" step="0.5" value={socialFrequency} onChange={e=>setSocialFrequency(e.target.value)}/></label>
        </div>
        <input type="text" value={socialGoal} onChange={e=>setSocialGoal(e.target.value)} placeholder={fr?"Objectif : vues, abonnés, ventes…":"Goal: views, followers, sales…"} />
        <button type="button" className="primary-button" disabled={busy||!backendReady||!socialUrl.trim()||!socialName.trim()} onClick={()=>void startSocialAudit()}>{busy?"…":fr?"Lancer l'analyse":"Run analysis"}</button>
      </> : <div className="account-card subscription-required">
        <span className="eyebrow">{fr?"ESSAI TERMINÉ · ACCÈS PRO":"TRIAL COMPLETED · PRO ACCESS"}</span>
        <h3>{fr?"Tes 3 analyses gratuites sont utilisées":"Your 3 free analyses have been used"}</h3>
        <p>{fr?"Choisis un abonnement pour continuer les diagnostics sans limite pendant sa durée. Aucun abonnement n'est créé avant confirmation du paiement par le serveur.":"Choose a subscription to continue running audits during its validity period. No subscription is activated until the server confirms payment."}</p>
        {plans.length ? plans.map(p=><article className="plan-row" key={p.id}>
          <div><strong>{p.name}</strong><p>{p.description} · {p.duration_days} {fr?"jours":"days"}</p><strong>{p.amount_xof.toLocaleString("fr-FR")} FCFA</strong></div>
          {cinetpayReady
            ? <button type="button" className="filter-button" disabled={paymentBusy} onClick={()=>void startPayment(p)}>{paymentBusy?"…":fr?"Payer en FCFA":"Pay in XOF"}</button>
            : <a className="filter-button" href={`https://wa.me/22892244653?text=${encodeURIComponent((fr?"Je souhaite m'abonner à ":"I want to subscribe to ")+p.name+" ("+p.amount_xof+" FCFA).")}`} target="_blank" rel="noreferrer">{fr?"Demander le paiement par WhatsApp":"Request payment via WhatsApp"}</a>}
        </article>) : <p>{fr?"Les formules seront affichées dès leur activation.":"Plans will appear when activated."}</p>}
        <small>{fr?"Le paiement actuellement configuré est en FCFA via CinetPay. Les paiements directs en USD/EUR et les cartes internationales nécessitent l'activation d'un prestataire compatible.":"The currently configured checkout is in XOF through CinetPay. Direct USD/EUR and international card payments require an enabled compatible provider."}</small>
      </div>}
      {socialResult&&<pre className="account-message social-report" role="status">{socialResult}</pre>}
      <small className="account-footnote">{fr?"Les captures sont contrôlées manuellement. Les statistiques saisies manuellement ne sont pas authentifiées automatiquement. Facebook connecté utilise les données autorisées par Meta.":"Screenshots are reviewed manually. TikTok or Meta do not automatically authenticate these metrics here."}</small>
    </div>}
    {session && service==="video" && <div className="account-card video-studio">
      <span className="eyebrow">AQUI VIDEO AI · MULTI-MOTEUR</span>
      <h3>{fr ? "Crée une vidéo avec l’IA" : "Create an AI video"}</h3>
      <p>{fr ? "Téléverse une image depuis ton téléphone ou génère directement à partir d’un texte. Aucun lien d’image externe n’est nécessaire." : "Upload an image from your phone or generate directly from a text prompt. No external image link is needed."}</p>
      <div className="account-tabs">
        <button type="button" className={videoMode==="image"?"active":""} onClick={()=>{setVideoMode("image");setVideoPaywall(false);}}>{fr?"Image → Vidéo":"Image → Video"}</button>
        <button type="button" className={videoMode==="text"?"active":""} onClick={()=>{setVideoMode("text");setVideoPaywall(false);}}>{fr?"Texte → Vidéo":"Text → Video"}</button>
      </div>
      {videoMode==="image" && <div className="video-upload-area">
        <label>{fr?"Image de départ (JPG, PNG ou WEBP · 8 Mo max.)":"Starting image (JPG, PNG or WEBP · max 8 MB)"}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0]||null;setVideoImageFile(file);setVideoNotice("");}} />
        </label>
        {videoImageFile && <p className="account-message">{fr?"Image sélectionnée : ":"Selected image: "}{videoImageFile.name} · {(videoImageFile.size/1024/1024).toFixed(2)} Mo</p>}
      </div>}
      <label>{fr?"Décris la scène et le mouvement souhaité":"Describe the scene and desired motion"}
        <textarea maxLength={1200} value={videoPrompt} onChange={e=>setVideoPrompt(e.target.value)} placeholder={videoMode==="image"?(fr?"Ex. : la personne sourit, tourne doucement la tête et marche vers la caméra…":"E.g. the person smiles, slowly turns their head and walks toward the camera…"):(fr?"Ex. : un lion majestueux traverse une savane africaine au coucher du soleil, plan cinématographique…":"E.g. a majestic lion walks across an African savanna at sunset, cinematic shot…")} required />
      </label>
      <label>{fr ? "Durée de la vidéo" : "Video duration"}
        <select value={videoDuration} onChange={e=>{setVideoDuration(e.target.value);setVideoPaywall(false);}}>
          <option value="2">2 secondes · {fr?"sans abonnement":"no subscription"}</option><option value="5">5 secondes</option><option value="10">10 secondes</option><option value="15">15 secondes</option>
        </select>
      </label>
      <small className="account-footnote">{fr?"Les clips de 2 secondes sont accessibles sans abonnement. Les durées de 5 à 15 secondes nécessitent un abonnement actif. Le moteur IA peut appliquer des limites ou des frais selon les crédits disponibles.":"2-second clips are available without a subscription. 5–15-second clips require an active subscription. The AI provider may apply limits or charges depending on available credits."}</small>
      <button type="button" className="primary-button" disabled={videoBusy || !videoReady || (videoMode==="image"&&!videoImageFile) || videoPrompt.trim().length<3} onClick={()=>void startVideo()}>{videoBusy ? "…" : (fr ? "Générer ma vidéo" : "Generate my video")}</button>
      {videoRequestId && <p className="video-status">{fr ? "État :" : "Status:"} {videoStatus || "queued"} · {videoRequestId}</p>}
      {videoNotice && <p className="account-message" role="status">{videoNotice}</p>}
      {videoPaywall && <div className="follow-gate"><h4>{fr?"Choisis ton abonnement pour débloquer les vidéos longues":"Choose a subscription to unlock longer videos"}</h4>{plans.map(p=><article className="plan-row" key={p.id}><div><strong>{p.name}</strong><p>{p.duration_days} {fr?"jours":"days"}</p><strong>{p.amount_xof.toLocaleString("fr-FR")} FCFA</strong></div><button type="button" className="filter-button" disabled={!cinetpayReady||paymentBusy} onClick={()=>void startPayment(p)}>{!cinetpayReady?(fr?"Paiement bientôt disponible":"Payment coming soon"):paymentBusy?"…":fr?"Payer avec CinetPay":"Pay with CinetPay"}</button></article>)}</div>}
      {videoUrl && <div className="video-result"><video controls playsInline src={videoUrl} /><a href={videoUrl} target="_blank" rel="noreferrer">{fr ? "Ouvrir / enregistrer le MP4" : "Open / save MP4"} ↗</a></div>}
      <small className="account-footnote">{fr?"Moteur : Magic Hour en priorité ; moteur de secours fal.ai uniquement s’il est activé. Image source privée et résultat MP4 conservé dans le stockage sécurisé du compte.":"Engine: Magic Hour first; fal.ai fallback only when explicitly enabled. Source image is private and the MP4 result is stored securely in the account."}</small>
    </div>}

    {session && service==="partners" && <div className="account-grid">
      <form className="account-card" onSubmit={e=>{e.preventDefault();void submit("ads");}}><h3>AQUI NET ADS · {fr?"Accompagnement":"Assisted setup"}</h3><p>{fr?"Tu préfères être accompagné ? Envoie une demande à l’équipe.":"Prefer help? Send a request to the team."}</p>
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
    {session && hasActiveSubscription && service==="partners" && campaigns.length>0 && <div className="account-card"><h3>{fr?"Campagnes actives":"Active campaigns"}</h3>{campaigns.map(c=><article key={c.id}><strong>{c.title}</strong><p>{c.description}</p>{c.destination_url&&<a href={c.destination_url} target="_blank" rel="noreferrer">{fr?"Découvrir":"Learn more"} ↗</a>}</article>)}</div>}
    {session && hasActiveSubscription && service==="partners" && <div className="account-card"><h3>{fr?"Abonnements publicité et partenariat":"Advertising and partnership plans"}</h3>{plans.length?plans.map(p=><article className="plan-row" key={p.id}><div><strong>{p.name}</strong><p>{p.description} · {p.duration_days} {fr?"jours":"days"}</p><strong>{p.amount_xof.toLocaleString("fr-FR")} FCFA</strong></div><button type="button" className="filter-button" disabled={!session||!cinetpayReady||paymentBusy} onClick={()=>void startPayment(p)}>{!session?(fr?"Connecte-toi pour payer":"Sign in to pay"):(paymentBusy?"…":fr?"Payer avec CinetPay":"Pay with CinetPay")}</button></article>):<p>{fr?"Aucune formule n'est publiée pour le moment.":"No plans are published yet."}</p>}
    <small className="account-footnote">{fr?"500 FCFA / mois · 5 000 FCFA / an. Le paiement dépend de la configuration active du compte marchand CinetPay.":"500 XOF / month · 5,000 XOF / year. Payment requires an active CinetPay merchant setup."}</small></div>}
    {!session && <p className="account-footnote">{fr?"Connecte-toi pour utiliser le service sélectionné.":"Sign in to use the selected service."}</p>}
  </section>;
}
