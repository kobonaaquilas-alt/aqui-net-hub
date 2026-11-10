import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

const db=createClient("https://xbobkysbtvtmepqgtnbt.supabase.co","sb_publishable_AGtfBQyqyKbH5C_4f5cQgw_bm0MmusA");
type RequestItem={id:string;user_id:string;contact_name:string;email:string;phone:string|null;website:string|null;status:string;created_at:string;company_name?:string;organization?:string;message?:string;proposal?:string;budget?:string|null};
type Campaign={id:string;title:string;description:string;destination_url:string|null;image_url:string|null;starts_at:string|null;ends_at:string|null;is_active:boolean};
type Follow={id:string;user_id:string;account_name:string;tiktok_proof_url:string;facebook_proof_url:string;status:string;created_at:string;admin_note:string|null};
type Audit={id:string;user_id:string;platform:string;account_name:string;social_url:string;followers:number;average_views:number;average_likes:number;average_comments:number;posts_per_week:number;goal:string;created_at:string};
type BrowserJob={request_id:string;status:string;error_message?:string|null;result?:{title?:string;final_url?:string;body_text?:string;steps?:unknown[]}|null};
type Data={ads:RequestItem[];partners:RequestItem[];follows:Follow[];audits:Audit[]};
export default function AdminPanel(){
 const [session,setSession]=useState<Session|null>(null),[authorized,setAuthorized]=useState(false),[checked,setChecked]=useState(false);
 const [data,setData]=useState<Data>({ads:[],partners:[],follows:[],audits:[]}),[campaigns,setCampaigns]=useState<Campaign[]>([]);
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
  try{const [d,c,s]=await Promise.all([request("/api/admin/requests"),request("/api/admin/campaigns"),request("/api/admin/settings")]);setData(d);setCampaigns(c.campaigns||[]);setAdsense(s.adsense_client||"");}
  catch(e){setNotice(e instanceof Error?e.message:"Erreur de chargement.");}finally{setBusy(false);}
 },[session,authorized,request]);
 useEffect(()=>{if(authorized)void load();},[authorized,load]);
 useEffect(()=>{if(!authorized)return;const timer=window.setInterval(()=>void load(),30000);return()=>window.clearInterval(timer);},[authorized,load]);
 async function action(path:string,method:string,body?:unknown){
  setBusy(true);setNotice("");try{await request(path,{method,body:body===undefined?undefined:JSON.stringify(body)});await load();setNotice("Modification enregistrée.");}
  catch(e){setNotice(e instanceof Error?e.message:"Erreur.");}finally{setBusy(false);}
 }
 async function createCampaign(e:FormEvent){
  e.preventDefault();setBusy(true);setNotice("");
  try{await request("/api/admin/campaigns",{method:"POST",body:JSON.stringify({...draft,starts_at:draft.starts_at?new Date(draft.starts_at).toISOString():null,ends_at:draft.ends_at?new Date(draft.ends_at).toISOString():null})});setDraft({title:"",description:"",destination_url:"",image_url:"",starts_at:"",ends_at:"",is_active:true});await load();setNotice("Publicité créée et enregistrée.");}
  catch(e){setNotice(e instanceof Error?e.message:"Création impossible.");}finally{setBusy(false);}
 }
 async function saveAdsense(){await action("/api/admin/settings","PATCH",{adsense_client:adsense});}
 async function startBrowserTask(e:FormEvent){
  e.preventDefault();setBrowserBusy(true);setNotice("");
  try{
   const steps=browserAction==="page"?[]:browserAction==="screenshot"?[{action:"screenshot",full_page:true}]:[{action:browserAction,selector:browserSelector}];
   const result=await request("/api/browser/jobs",{method:"POST",body:JSON.stringify({target_url:browserUrl,steps})});
   setBrowserJob({request_id:result.request_id,status:result.status});
   setNotice("Tâche navigateur envoyée.");
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
 const group=(kind:"ads"|"partners",items:RequestItem[])=> <div className="account-card"><h3>{kind==="ads"?"Demandes publicitaires":"Demandes de partenariat"} · {items.length}</h3>{items.length===0&&<p>Aucune demande.</p>}{items.map(x=><article className="admin-request-row" key={x.id}><div><strong>{kind==="ads"?x.company_name:x.organization}</strong><p>{x.contact_name} · {x.email} · {x.phone||""}</p>{x.website&&<p><a href={x.website} target="_blank" rel="noreferrer">{x.website}</a></p>}<p>{x.message||x.proposal}</p><small>{new Date(x.created_at).toLocaleString("fr-FR")} · {x.status}</small></div><div className="admin-actions"><button disabled={busy} onClick={()=>void action(`/api/admin/requests/${kind}/${x.id}`,"PATCH",{status:"reviewing"})}>En cours</button><button disabled={busy} onClick={()=>void action(`/api/admin/requests/${kind}/${x.id}`,"PATCH",{status:"accepted"})}>Valider</button><button disabled={busy} onClick={()=>void action(`/api/admin/requests/${kind}/${x.id}`,"PATCH",{status:"declined"})}>Refuser</button></div></article>)}</div>;
 return <section className="section account-hub admin-private" id="admin-prive">
  <div className="section-heading"><span className="eyebrow">ESPACE PRIVÉ</span><h2>Administration AQUI NET HUB</h2><p>Connecté en tant que {session?.user.email}</p><button className="filter-button" disabled={busy} onClick={()=>void load()}>{busy?"…":"Actualiser"}</button></div>
  {notice&&<p className="account-message" role="status">{notice}</p>}
  <div className="account-card browser-automation-card">
   <h3>Agent navigateur AQUI NET HUB</h3>
   <p>Navigation automatisée en lecture seule : consulter une page publique, extraire du texte, ouvrir un lien ou faire une capture.</p>
   <form className="admin-campaign-form" onSubmit={e=>void startBrowserTask(e)}>
    <input type="url" required value={browserUrl} onChange={e=>setBrowserUrl(e.target.value)} placeholder="https://exemple.com"/>
    <select value={browserAction} onChange={e=>setBrowserAction(e.target.value as typeof browserAction)}>
     <option value="page">Lire la page entière</option>
     <option value="extract_text">Extraire un élément CSS</option>
     <option value="click_link">Ouvrir un lien CSS</option>
     <option value="screenshot">Faire une capture complète</option>
    </select>
    {browserAction!=="page"&&browserAction!=="screenshot"&&<input value={browserSelector} onChange={e=>setBrowserSelector(e.target.value)} placeholder="Sélecteur CSS (ex. main, h1, a.next)"/>}
    <button className="primary-button" disabled={browserBusy||!!(browserJob&&!["completed","failed"].includes(browserJob.status))}>{browserBusy?"…":"Exécuter la tâche"}</button>
   </form>
   {browserJob&&<div className="browser-job-result">
    <p><strong>État :</strong> {browserJob.status} · {browserJob.request_id}</p>
    {browserJob.error_message&&<p className="account-message">{browserJob.error_message}</p>}
    {browserJob.result&&<><strong>{browserJob.result.title||"Résultat"}</strong>{browserJob.result.final_url&&<p><a href={browserJob.result.final_url} target="_blank" rel="noreferrer">{browserJob.result.final_url}</a></p>}<pre>{browserJob.result.body_text||JSON.stringify(browserJob.result.steps||[],null,2)}</pre></>}
   </div>}
  </div>
  {group("ads",data.ads)}{group("partners",data.partners)}
  <div className="account-card"><h3>Vérification des abonnements TikTok et Facebook · {data.follows.length}</h3>{data.follows.length===0&&<p>Aucune preuve reçue.</p>}{data.follows.map(f=><article className="admin-request-row" key={f.id}><div><strong>{f.account_name} · {f.status}</strong><p>Utilisateur : {f.user_id}</p><p><a href={f.tiktok_proof_url} target="_blank" rel="noreferrer">Preuve TikTok</a> · <a href={f.facebook_proof_url} target="_blank" rel="noreferrer">Preuve Facebook</a></p><small>{new Date(f.created_at).toLocaleString("fr-FR")}</small></div><div className="admin-actions"><button disabled={busy} onClick={()=>void action(`/api/admin/follows/${f.id}`,"PATCH",{status:"approved"})}>Valider</button><button disabled={busy} onClick={()=>void action(`/api/admin/follows/${f.id}`,"PATCH",{status:"rejected"})}>Refuser</button></div></article>)}</div>
  <div className="account-card"><h3>Analyses sociales · {data.audits.length}</h3>{data.audits.map(a=><article className="admin-request-row" key={a.id}><div><strong>{a.platform} · {a.account_name}</strong><p><a href={a.social_url} target="_blank" rel="noreferrer">Profil</a> · {a.followers.toLocaleString("fr-FR")} abonnés · {a.average_views.toLocaleString("fr-FR")} vues moyennes</p><small>{a.user_id} · {new Date(a.created_at).toLocaleString("fr-FR")}</small></div></article>)}</div>
  <div className="account-card"><h3>Publicités défilantes</h3><form className="admin-campaign-form" onSubmit={e=>void createCampaign(e)}>
   <input value={draft.title} onChange={e=>setDraft(s=>({...s,title:e.target.value}))} placeholder="Titre de la publicité" required/>
   <textarea value={draft.description} onChange={e=>setDraft(s=>({...s,description:e.target.value}))} placeholder="Description courte" required/>
   <input type="url" value={draft.destination_url} onChange={e=>setDraft(s=>({...s,destination_url:e.target.value}))} placeholder="Lien de destination HTTPS"/>
   <input type="url" value={draft.image_url} onChange={e=>setDraft(s=>({...s,image_url:e.target.value}))} placeholder="Image HTTPS (facultatif)"/>
   <label>Début de diffusion <input type="datetime-local" value={draft.starts_at} onChange={e=>setDraft(s=>({...s,starts_at:e.target.value}))}/></label>
   <label>Fin de diffusion <input type="datetime-local" value={draft.ends_at} onChange={e=>setDraft(s=>({...s,ends_at:e.target.value}))}/></label>
   <label><input type="checkbox" checked={draft.is_active} onChange={e=>setDraft(s=>({...s,is_active:e.target.checked}))}/> Activer la campagne</label>
   <button className="primary-button" disabled={busy}>Créer la publicité</button>
  </form>
  {campaigns.map(c=><article className="admin-request-row" key={c.id}><div><strong>{c.title}</strong><p>{c.description}</p><small>{c.is_active?"Active":"En pause"} · Début : {c.starts_at?new Date(c.starts_at).toLocaleString("fr-FR"):"immédiat"} · Fin : {c.ends_at?new Date(c.ends_at).toLocaleString("fr-FR"):"non définie"}</small></div><div className="admin-actions"><button disabled={busy} onClick={()=>void action(`/api/admin/campaigns/${c.id}`,"PATCH",{is_active:!c.is_active})}>{c.is_active?"Suspendre":"Activer"}</button><button disabled={busy} onClick={()=>void action(`/api/admin/campaigns/${c.id}`,"DELETE")}>Supprimer</button></div></article>)}</div>
  <div className="account-card"><h3>Google AdSense</h3><p>Ajoute ton identifiant éditeur après l'acceptation du site par Google. Les annonces ne s'afficheront qu'après validation AdSense.</p><input value={adsense} onChange={e=>setAdsense(e.target.value)} placeholder="ca-pub-0000000000000000"/><button className="primary-button" disabled={busy} onClick={()=>void saveAdsense()}>Enregistrer l'identifiant</button><small>Fichier ads.txt : /ads.txt</small></div>
 </section>;
}
