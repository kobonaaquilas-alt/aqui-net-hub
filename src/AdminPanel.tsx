import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

const db=createClient("https://xbobkysbtvtmepqgtnbt.supabase.co","sb_publishable_AGtfBQyqyKbH5C_4f5cQgw_bm0MmusA");
type RequestItem={id:string;user_id:string;contact_name:string;email:string;phone:string|null;website:string|null;status:string;created_at:string;company_name?:string;organization?:string;message?:string;proposal?:string;budget?:string|null};
type Campaign={id:string;title:string;description:string;destination_url:string|null;image_url:string|null;starts_at:string|null;ends_at:string|null;is_active:boolean;impressions_count?:number;clicks_count?:number;ctr_percent?:number};
type Follow={id:string;user_id:string;account_name:string;tiktok_proof_url:string;facebook_proof_url:string;status:string;created_at:string;admin_note:string|null};
type Audit={id:string;user_id:string;platform:string;account_name:string;social_url:string;followers:number;average_views:number;average_likes:number;average_comments:number;posts_per_week:number;goal:string;created_at:string};
type AdminPlan={id:string;name:string;amount_xof:number;duration_days:number};
type BrowserJob={request_id:string;status:string;error_message?:string|null;result?:{title?:string;final_url?:string;body_text?:string;steps?:unknown[]}|null};
type Data={ads:RequestItem[];partners:RequestItem[];follows:Follow[];audits:Audit[]};
export default function AdminPanel({lang}:{lang:"fr"|"en"}){
 const tr=(frText:string,enText:string)=>lang==="fr"?frText:enText;
 const [session,setSession]=useState<Session|null>(null),[authorized,setAuthorized]=useState(false),[checked,setChecked]=useState(false);
 const [data,setData]=useState<Data>({ads:[],partners:[],follows:[],audits:[]}),[campaigns,setCampaigns]=useState<Campaign[]>([]),[adminPlans,setAdminPlans]=useState<AdminPlan[]>([]);
 const [manualEmail,setManualEmail]=useState(""),[manualPlan,setManualPlan]=useState(""),[manualMethod,setManualMethod]=useState("TMoney"),[manualReference,setManualReference]=useState("");
 const [notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[adsense,setAdsense]=useState("");
 const [browserUrl,setBrowserUrl]=useState("https://");
 const [browserSelector,setBrowserSelector]=useState("body");
 const [browserAction,setBrowserAction]=useState<"page"|"extract_text"|"click_link"|"screenshot">("page");
 const [browserJob,setBrowserJob]=useState<BrowserJob|null>(null);
 const [browserBusy,setBrowserBusy]=useState(false);
 const [draft,setDraft]=useState({title:"",description:"",destination_url:"",image_url:"",starts_at:"",ends_at:"",is_active:true});
 const auth=useCallback(async(s:Session|null)=>{
  setSession(s);setAuthorized(false);setChecked(false);
  if(!s){setChecked(true);return;}
  try{const r=await fetch("/api/admin/me",{headers:{Authorization:`Bearer ${s.access_token}`}});setAuthorized(r.ok);}
  catch{setAuthorized(false);}finally{setChecked(true);}
 },[]);
 useEffect(()=>{db.auth.getSession().then(({data})=>void auth(data.session));const {data:{subscription}}=db.auth.onAuthStateChange((_e,s)=>void auth(s));return()=>subscription.unsubscribe();},[auth]);
 const request=useCallback(async(path:string,init:RequestInit={})=>{
  if(!session)throw new Error("Session administrateur absente.");
  const r=await fetch(path,{...init,headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`,...(init.headers||{})}});
  const d=await r.json();if(!r.ok)throw new Error(d.error||"Action impossible.");return d;
 },[session]);
 const load=useCallback(async()=>{
  if(!session||!authorized)return;setBusy(true);setNotice("");
  try{const [d,c,s,p]=await Promise.all([request("/api/admin/requests"),request("/api/admin/campaigns"),request("/api/admin/settings"),request("/api/admin/plans")]);setData(d);setCampaigns(c.campaigns||[]);setAdsense(s.adsense_client||"");setAdminPlans(p.plans||[]);setManualPlan(current=>current||(p.plans?.[0]?.id||""));}
  catch(e){setNotice(e instanceof Error?e.message:"Erreur de chargement.");}finally{setBusy(false);}
 },[session,authorized,request]);
 useEffect(()=>{if(authorized)void load();},[authorized,load]);
 useEffect(()=>{if(!authorized)return;const timer=window.setInterval(()=>void load(),30000);return()=>window.clearInterval(timer);},[authorized,load]);
 async function action(path:string,method:string,body?:unknown){
  setBusy(true);setNotice("");try{await request(path,{method,body:body===undefined?undefined:JSON.stringify(body)});await load();setNotice(tr("Modification enregistrée.","Changes saved."));}
  catch(e){setNotice(e instanceof Error?e.message:"Erreur.");}finally{setBusy(false);}
 }
 async function createCampaign(e:FormEvent){
  e.preventDefault();setBusy(true);setNotice("");
  try{await request("/api/admin/campaigns",{method:"POST",body:JSON.stringify({...draft,starts_at:draft.starts_at?new Date(draft.starts_at).toISOString():null,ends_at:draft.ends_at?new Date(draft.ends_at).toISOString():null})});setDraft({title:"",description:"",destination_url:"",image_url:"",starts_at:"",ends_at:"",is_active:true});await load();setNotice(tr("Publicité créée et enregistrée.","Ad campaign created and saved."));}
  catch(e){setNotice(e instanceof Error?e.message:"Création impossible.");}finally{setBusy(false);}
 }
 async function grantManualSubscription(e:FormEvent){
  e.preventDefault();setBusy(true);setNotice("");
  try{
   const result=await request("/api/admin/subscriptions/manual",{method:"POST",body:JSON.stringify({email:manualEmail,plan_id:manualPlan,payment_method:manualMethod,manual_reference:manualReference})});
   setManualEmail("");setManualReference("");
   await load();
   setNotice(tr("Abonnement activé après validation manuelle du paiement : ","Subscription activated after manual payment verification: ")+result.plan_name+" · "+Number(result.amount_xof).toLocaleString("fr-FR")+" FCFA");
  }catch(error){setNotice(error instanceof Error?error.message:"Activation impossible.");}
  finally{setBusy(false);}
 }
 async function saveAdsense(){await action("/api/admin/settings","PATCH",{adsense_client:adsense});}
 async function startBrowserTask(e:FormEvent){
  e.preventDefault();setBrowserBusy(true);setNotice("");
  try{
   const steps=browserAction==="page"?[]:browserAction==="screenshot"?[{action:"screenshot",full_page:true}]:[{action:browserAction,selector:browserSelector}];
   const result=await request("/api/browser/jobs",{method:"POST",body:JSON.stringify({target_url:browserUrl,steps})});
   setBrowserJob({request_id:result.request_id,status:result.status});
   setNotice(tr("Tâche navigateur envoyée.","Browser task submitted."));
  }catch(error){setNotice(error instanceof Error?error.message:"Tâche navigateur impossible.");}
  finally{setBrowserBusy(false);}
 }
 useEffect(()=>{
  if(!browserJob?.request_id||["completed","failed"].includes(browserJob.status))return;
  const timer=window.setInterval(async()=>{
   try{const result=await request(`/api/browser/jobs/${browserJob.request_id}`);setBrowserJob(result);}
   catch(error){setNotice(error instanceof Error?error.message:"Lecture du résultat impossible.");}
  },5000);
  return()=>window.clearInterval(timer);
 },[browserJob?.request_id,browserJob?.status,request]);

 if(!checked||!authorized)return null;
 const group=(kind:"ads"|"partners",items:RequestItem[])=> <div className="account-card"><h3>{tr(kind==="ads"?"Demandes publicitaires":"Demandes de partenariat",kind==="ads"?"Advertising requests":"Partnership requests")} · {items.length}</h3>{items.length===0&&<p>{tr("Aucune demande.","No requests.")}</p>}{items.map(x=><article className="admin-request-row" key={x.id}><div><strong>{kind==="ads"?x.company_name:x.organization}</strong><p>{x.contact_name} · {x.email} · {x.phone||""}</p>{x.website&&<p><a href={x.website} target="_blank" rel="noreferrer">{x.website}</a></p>}<p>{x.message||x.proposal}</p><small>{new Date(x.created_at).toLocaleString(lang==="fr"?"fr-FR":"en-GB")} · {x.status}</small></div><div className="admin-actions"><button disabled={busy} onClick={()=>void action(`/api/admin/requests/${kind}/${x.id}`,"PATCH",{status:"reviewing"})}>{tr("En cours","In progress")}</button><button disabled={busy} onClick={()=>void action(`/api/admin/requests/${kind}/${x.id}`,"PATCH",{status:"accepted"})}>{tr("Valider","Approve")}</button><button disabled={busy} onClick={()=>void action(`/api/admin/requests/${kind}/${x.id}`,"PATCH",{status:"declined"})}>{tr("Refuser","Decline")}</button></div></article>)}</div>;
 return <section className="section account-hub admin-private" id="admin-prive">
  <div className="section-heading"><span className="eyebrow">{tr("ESPACE PRIVÉ","PRIVATE AREA")}</span><h2>{tr("Administration AQUI NET HUB","AQUI NET HUB administration")}</h2><p>{tr("Connecté en tant que","Signed in as")} {session?.user.email}</p><button className="filter-button" disabled={busy} onClick={()=>void load()}>{busy?"…":tr("Actualiser","Refresh")}</button></div>
  {notice&&<p className="account-message" role="status">{notice}</p>}
  <div className="account-card browser-automation-card">
   <h3>{tr("Automatisation navigateur (Playwright)","Browser automation (Playwright)")}</h3>
   <p>{tr("Navigation automatisée en lecture seule : consulter une page publique, extraire du texte, ouvrir un lien ou faire une capture.","Read-only automated browsing: inspect a public page, extract text, open a link or take a screenshot.")}</p>
   <form className="admin-campaign-form" onSubmit={e=>void startBrowserTask(e)}>
    <input type="url" required value={browserUrl} onChange={e=>setBrowserUrl(e.target.value)} placeholder="https://exemple.com"/>
    <select value={browserAction} onChange={e=>setBrowserAction(e.target.value as typeof browserAction)}>
     <option value="page">{tr("Lire la page entière","Read full page")}</option>
     <option value="extract_text">{tr("Extraire un élément CSS","Extract a CSS element")}</option>
     <option value="click_link">{tr("Ouvrir un lien CSS","Open a CSS link")}</option>
     <option value="screenshot">{tr("Faire une capture complète","Take a full-page screenshot")}</option>
    </select>
    {browserAction!=="page"&&browserAction!=="screenshot"&&<input value={browserSelector} onChange={e=>setBrowserSelector(e.target.value)} placeholder={tr("Sélecteur CSS (ex. main, h1, a.next)","CSS selector (e.g. main, h1, a.next)")}/>}
    <button className="primary-button" disabled={browserBusy||!!(browserJob&&!["completed","failed"].includes(browserJob.status))}>{browserBusy?"…":tr("Exécuter la tâche","Run task")}</button>
   </form>
   {browserJob&&<div className="browser-job-result">
    <p><strong>{tr("État :","Status:")}</strong> {browserJob.status} · {browserJob.request_id}</p>
    {browserJob.error_message&&<p className="account-message">{browserJob.error_message}</p>}
    {browserJob.result&&<><strong>{browserJob.result.title||tr("Résultat","Result")}</strong>{browserJob.result.final_url&&<p><a href={browserJob.result.final_url} target="_blank" rel="noreferrer">{browserJob.result.final_url}</a></p>}<pre>{browserJob.result.body_text||JSON.stringify(browserJob.result.steps||[],null,2)}</pre></>}
   </div>}
  </div>
  <div className="account-card">
   <h3>{tr("Activation manuelle d'un abonnement","Manual subscription activation")}</h3>
   <p>{tr("À utiliser uniquement après avoir réellement vérifié le paiement reçu par TMoney, Flooz, virement bancaire ou autre moyen accepté. La référence est unique et ne peut servir qu'une fois.","Use only after you have independently confirmed receipt through TMoney, Flooz, bank transfer or another accepted method. Each payment reference can only be used once.")}</p>
   <form className="admin-campaign-form" onSubmit={e=>void grantManualSubscription(e)}>
    <input type="email" value={manualEmail} onChange={e=>setManualEmail(e.target.value)} placeholder={tr("E-mail du compte client","Customer account email")} required/>
    <select value={manualPlan} onChange={e=>setManualPlan(e.target.value)} required>
     {adminPlans.map(p=><option key={p.id} value={p.id}>{p.name} · {p.amount_xof.toLocaleString("fr-FR")} FCFA · {p.duration_days} j</option>)}
    </select>
    <select value={manualMethod} onChange={e=>setManualMethod(e.target.value)}>
     <option value="TMoney">TMoney</option><option value="Flooz">Flooz</option><option value="Virement bancaire">{tr("Virement bancaire","Bank transfer")}</option><option value="Carte/Autre">{tr("Carte / autre","Card / other")}</option><option value="Espèces">{tr("Espèces","Cash")}</option>
    </select>
    <input value={manualReference} onChange={e=>setManualReference(e.target.value)} placeholder={tr("Référence unique de transaction / reçu","Unique transaction / receipt reference")} minLength={3} maxLength={120} required/>
    <button className="primary-button" disabled={busy||!adminPlans.length||!manualPlan}>{tr("Confirmer le paiement et activer","Confirm payment and activate")}</button>
   </form>
  </div>
  {group("ads",data.ads)}{group("partners",data.partners)}
  <div className="account-card"><h3>{tr("Vérification des abonnements TikTok et Facebook","TikTok and Facebook follow verification")} · {data.follows.length}</h3>{data.follows.length===0&&<p>{tr("Aucune preuve reçue.","No proof submitted.")}</p>}{data.follows.map(f=><article className="admin-request-row" key={f.id}><div><strong>{f.account_name} · {f.status}</strong><p>{tr("Utilisateur :","User:")} {f.user_id}</p><p><a href={f.tiktok_proof_url} target="_blank" rel="noreferrer">{tr("Preuve TikTok","TikTok proof")}</a> · <a href={f.facebook_proof_url} target="_blank" rel="noreferrer">{tr("Preuve Facebook","Facebook proof")}</a></p><small>{new Date(f.created_at).toLocaleString(lang==="fr"?"fr-FR":"en-GB")}</small></div><div className="admin-actions"><button disabled={busy} onClick={()=>void action(`/api/admin/follows/${f.id}`,"PATCH",{status:"approved"})}>{tr("Valider","Approve")}</button><button disabled={busy} onClick={()=>void action(`/api/admin/follows/${f.id}`,"PATCH",{status:"rejected"})}>{tr("Refuser","Decline")}</button></div></article>)}</div>
  <div className="account-card"><h3>{tr("Analyses sociales","Social audits")} · {data.audits.length}</h3>{data.audits.map(a=><article className="admin-request-row" key={a.id}><div><strong>{a.platform} · {a.account_name}</strong><p><a href={a.social_url} target="_blank" rel="noreferrer">{tr("Profil","Profile")}</a> · {a.followers.toLocaleString(lang==="fr"?"fr-FR":"en-GB")} {tr("abonnés","followers")} · {a.average_views.toLocaleString(lang==="fr"?"fr-FR":"en-GB")} {tr("vues moyennes","average views")}</p><small>{a.user_id} · {new Date(a.created_at).toLocaleString(lang==="fr"?"fr-FR":"en-GB")}</small></div></article>)}</div>
  <div className="account-card"><h3>{tr("Publicités défilantes","Scrolling advertisements")}</h3><form className="admin-campaign-form" onSubmit={e=>void createCampaign(e)}>
   <input value={draft.title} onChange={e=>setDraft(s=>({...s,title:e.target.value}))} placeholder={tr("Titre de la publicité","Ad title")} required/>
   <textarea value={draft.description} onChange={e=>setDraft(s=>({...s,description:e.target.value}))} placeholder={tr("Description courte","Short description")} required/>
   <input type="url" value={draft.destination_url} onChange={e=>setDraft(s=>({...s,destination_url:e.target.value}))} placeholder={tr("Lien de destination HTTPS","HTTPS destination URL")}/>
   <input type="url" value={draft.image_url} onChange={e=>setDraft(s=>({...s,image_url:e.target.value}))} placeholder={tr("Image HTTPS (facultatif)","HTTPS image (optional)")}/>
   <label>{tr("Début de diffusion","Campaign start")} <input type="datetime-local" value={draft.starts_at} onChange={e=>setDraft(s=>({...s,starts_at:e.target.value}))}/></label>
   <label>{tr("Fin de diffusion","Campaign end")} <input type="datetime-local" value={draft.ends_at} onChange={e=>setDraft(s=>({...s,ends_at:e.target.value}))}/></label>
   <label><input type="checkbox" checked={draft.is_active} onChange={e=>setDraft(s=>({...s,is_active:e.target.checked}))}/> {tr("Activer la campagne","Activate campaign")}</label>
   <button className="primary-button" disabled={busy}>{tr("Créer la publicité","Create ad")}</button>
  </form>
  {campaigns.map(c=><article className="admin-request-row" key={c.id}><div><strong>{c.title}</strong><p>{c.description}</p><small>{c.is_active?tr("Active","Active"):tr("En pause","Paused")} · {tr("Début :","Start:")} {c.starts_at?new Date(c.starts_at).toLocaleString(lang==="fr"?"fr-FR":"en-GB") :tr("immédiat","immediately")} · {tr("Fin :","End:")} {c.ends_at?new Date(c.ends_at).toLocaleString(lang==="fr"?"fr-FR":"en-GB") :tr("non définie","not set")}</small><small>{tr("Impressions :","Impressions:")} {Number(c.impressions_count||0).toLocaleString(lang==="fr"?"fr-FR":"en-GB")} · {tr("Clics :","Clicks:")} {Number(c.clicks_count||0).toLocaleString(lang==="fr"?"fr-FR":"en-GB")} · CTR {Number(c.ctr_percent||0).toFixed(2)}%</small></div><div className="admin-actions"><button disabled={busy} onClick={()=>void action(`/api/admin/campaigns/${c.id}`,"PATCH",{is_active:!c.is_active})}>{c.is_active?tr("Suspendre","Pause"):tr("Activer","Activate")}</button><button disabled={busy} onClick={()=>void action(`/api/admin/campaigns/${c.id}`,"DELETE")}>{tr("Supprimer","Delete")}</button></div></article>)}</div>
  <div className="account-card"><h3>Google AdSense</h3><p>{tr("Ajoute ton identifiant éditeur après l’acceptation du site par Google. Les annonces ne s’afficheront qu’après validation AdSense.","Add your publisher ID after Google approves the site. Ads appear only after AdSense approval.")}</p><input value={adsense} onChange={e=>setAdsense(e.target.value)} placeholder="ca-pub-0000000000000000"/><button className="primary-button" disabled={busy} onClick={()=>void saveAdsense()}>{tr("Enregistrer l’identifiant","Save publisher ID")}</button><small>ads.txt file: /ads.txt</small></div>
 </section>;
}
