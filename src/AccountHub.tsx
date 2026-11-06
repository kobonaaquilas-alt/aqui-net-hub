import { useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

const db = createClient("https://xbobkysbtvtmepqgtnbt.supabase.co", "sb_publishable_AGtfBQyqyKbH5C_4f5cQgw_bm0MmusA");
type Props = { favorites: string[]; progress: string[]; lang: "fr" | "en"; onRemoteSync: (favorites: string[], progress: string[]) => void };
type Plan = { id: string; name: string; description: string; amount_xof: number; duration_days: number };
type Campaign = { id: string; title: string; description: string; destination_url: string | null };

export default function AccountHub({ favorites, progress, lang, onRemoteSync }: Props) {
  const fr = lang === "fr";
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncReady, setSyncReady] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ad, setAd] = useState({company_name:"",contact_name:"",email:"",phone:"",website:"",budget:"",message:""});
  const [partner, setPartner] = useState({organization:"",contact_name:"",email:"",phone:"",website:"",proposal:""});

  useEffect(() => {
    db.auth.getSession().then(({data}) => setSession(data.session));
    const {data:{subscription}} = db.auth.onAuthStateChange((_event,next) => { setSession(next); setSyncReady(false); });
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

  async function authenticate() {
    setBusy(true); setNotice("");
    const result = mode === "signup"
      ? await db.auth.signUp({email,password,options:{data:{full_name:fullName,phone}}})
      : await db.auth.signInWithPassword({email,password});
    setBusy(false);
    if (result.error) setNotice(result.error.message);
    else if (mode === "signup" && !result.data.session) setNotice(fr ? "Compte créé : confirme ton adresse e-mail." : "Account created: confirm your email.");
    else setNotice(fr ? "Connexion réussie." : "Signed in.");
  }

  async function submit(kind:"ads"|"partners") {
    if (!session) return;
    setBusy(true); setNotice("");
    const table = kind === "ads" ? "hub_ad_requests" : "hub_partner_applications";
    const values = kind === "ads" ? ad : partner;
    const {error} = await db.from(table).insert({...values,user_id:session.user.id});
    setBusy(false);
    if (error) setNotice(error.message);
    else {
      setNotice(fr ? "Demande envoyée à l'équipe AQUI NET HUB." : "Request sent to the AQUI NET HUB team.");
      if (kind === "ads") setAd({company_name:"",contact_name:"",email:"",phone:"",website:"",budget:"",message:""});
      else setPartner({organization:"",contact_name:"",email:"",phone:"",website:"",proposal:""});
    }
  }

  async function pay(plan:Plan) {
    if (!session) { setNotice(fr ? "Connecte-toi d'abord." : "Sign in first."); return; }
    setBusy(true); setNotice("");
    try {
      const r = await fetch("/api/payments/create",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({plan_id:plan.id,first_name:fullName || session.user.user_metadata?.full_name || "Client",last_name:"Hub",phone})});
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Payment unavailable");
      window.location.assign(data.payment_url);
    } catch(e) { setNotice(e instanceof Error ? e.message : "Payment error"); setBusy(false); }
  }

  const input=(value:string,change:(v:string)=>void,placeholder:string,type="text",required=true)=><input type={type} value={value} onChange={e=>change(e.target.value)} placeholder={placeholder} required={required}/>;
  return <section className="section account-hub" id="compte">
    <div className="section-heading"><div><span className="eyebrow">AQUI NET · MEMBER SPACE</span><h2>{fr ? "Espace membre" : "Member area"}</h2><p>{fr ? "Compte, sauvegarde, publicité et partenariats." : "Account, sync, advertising and partnerships."}</p></div></div>
    {!session ? <div className="account-card">
      <div className="account-tabs"><button type="button" className={mode==="login"?"active":""} onClick={()=>setMode("login")}>{fr?"Connexion":"Sign in"}</button><button type="button" className={mode==="signup"?"active":""} onClick={()=>setMode("signup")}>{fr?"Créer un compte":"Create account"}</button></div>
      {mode==="signup" && <>{input(fullName,setFullName,fr?"Nom complet":"Full name")}{input(phone,setPhone,fr?"Téléphone (facultatif)":"Phone (optional)","tel",false)}</>}
      {input(email,setEmail,"E-mail","email")}{input(password,setPassword,fr?"Mot de passe (8 caractères minimum)":"Password (8 characters minimum)","password")}
      <button className="primary-button" disabled={busy||!email||password.length<8} onClick={()=>void authenticate()}>{busy?"…":mode==="login"?(fr?"Se connecter":"Sign in"):(fr?"Créer mon compte":"Create account")}</button>
    </div> : <div className="account-card"><p>{fr?"Connecté avec":"Signed in as"} <strong>{session.user.email}</strong></p><p className="sync-status">{fr?"Favoris et progression synchronisés sur ce compte.":"Favorites and progress synced to this account."}</p><button className="filter-button" onClick={()=>void db.auth.signOut()}>{fr?"Se déconnecter":"Sign out"}</button></div>}
    {notice && <p className="account-message" role="status">{notice}</p>}
    <div className="account-grid">
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
    </div>
    {campaigns.length>0 && <div className="account-card"><h3>{fr?"Campagnes actives":"Active campaigns"}</h3>{campaigns.map(c=><article key={c.id}><strong>{c.title}</strong><p>{c.description}</p>{c.destination_url&&<a href={c.destination_url} target="_blank" rel="noreferrer">{fr?"Découvrir":"Learn more"} ↗</a>}</article>)}</div>}
    <div className="account-card"><h3>{fr?"Formules disponibles":"Available plans"}</h3>{plans.length?plans.map(p=><article className="plan-row" key={p.id}><div><strong>{p.name}</strong><p>{p.description} · {p.duration_days} {fr?"jours":"days"}</p><strong>{p.amount_xof.toLocaleString("fr-FR")} FCFA</strong></div><button type="button" className="primary-button" disabled={!session||busy} onClick={()=>void pay(p)}>{fr?"Payer":"Pay"}</button></article>):<p>{fr?"Aucune formule n'est publiée pour le moment.":"No plans are published yet."}</p>}</div>
    <small className="account-footnote">{fr?"Les paiements réels nécessitent un compte marchand vérifié, géré par son titulaire adulte.":"Live payments require a verified merchant account managed by its adult holder."}</small>
  </section>;
}
