type Env = { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY?: string; SUPABASE_SECRET_KEY?: string };
type AuthUser = { id: string };
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const headers=(env:Env)=>({apikey:env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY||"",Authorization:"Bearer "+(env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY||""),"Content-Type":"application/json",Prefer:"return=representation"});
async function isAdmin(env:Env,userId:string):Promise<boolean>{
 const r=await fetch(`${env.SUPABASE_URL}/rest/v1/hub_admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`,{headers:headers(env)});
 if(!r.ok)throw new Error("Admin authorization lookup failed");
 return ((await r.json()) as Array<{user_id:string}>).length===1;
}
export async function handleAdmin(request:Request,env:Env,user:AuthUser):Promise<Response>{
 if(!env.SUPABASE_URL||!(env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY))return json({error:"Backend non configuré."},503);
 try{
  if(!await isAdmin(env,user.id))return json({error:"Accès administrateur refusé."},403);
  const url=new URL(request.url);
  if(request.method==="GET"&&url.pathname==="/api/admin/me")return json({isAdmin:true});
  if(request.method==="GET"&&url.pathname==="/api/admin/requests"){
   const paths=["hub_ad_requests?select=id,user_id,company_name,contact_name,email,phone,website,budget,message,status,created_at&order=created_at.desc&limit=200","hub_partner_applications?select=id,user_id,organization,contact_name,email,phone,website,proposal,status,created_at&order=created_at.desc&limit=200","hub_follow_verifications?select=*&order=created_at.desc&limit=200","hub_social_audits?select=id,user_id,platform,account_name,social_url,followers,average_views,average_likes,average_comments,posts_per_week,goal,created_at&order=created_at.desc&limit=200"];
   const rs=await Promise.all(paths.map(p=>fetch(`${env.SUPABASE_URL}/rest/v1/${p}`,{headers:headers(env)})));
   if(!rs.every(r=>r.ok))return json({error:"Impossible de charger les demandes."},502);
   const [ads,partners,follows,audits]=await Promise.all(rs.map(r=>r.json()));
   return json({ads,partners,follows,audits});
  }
  if(request.method==="GET"&&url.pathname==="/api/admin/campaigns"){
   const r=await fetch(`${env.SUPABASE_URL}/rest/v1/hub_campaigns?select=*&order=created_at.desc&limit=200`,{headers:headers(env)});
   return r.ok?json({campaigns:await r.json()}):json({error:"Lecture des campagnes impossible."},502);
  }
  if(request.method==="POST"&&url.pathname==="/api/admin/campaigns"){
   const b=await request.json() as any;const title=String(b.title||"").trim(),description=String(b.description||"").trim();
   if(title.length<4||description.length<4)return json({error:"Titre et description obligatoires."},400);
   for(const value of [b.destination_url,b.image_url])if(value){try{if(new URL(value).protocol!=="https:")throw 0;}catch{return json({error:"Les liens doivent être des URL HTTPS valides."},400);}}
   const r=await fetch(`${env.SUPABASE_URL}/rest/v1/hub_campaigns`,{method:"POST",headers:headers(env),body:JSON.stringify({title,description,destination_url:b.destination_url||null,image_url:b.image_url||null,starts_at:b.starts_at||null,ends_at:b.ends_at||null,is_active:!!b.is_active})});
   if(!r.ok)return json({error:"Création de la campagne impossible."},502);
   return json({campaign:(await r.json() as unknown[])[0]},201);
  }
  const campaign=url.pathname.match(/^\/api\/admin\/campaigns\/([0-9a-f-]{36})$/i);
  if(campaign&&request.method==="PATCH"){
   const b=await request.json() as Record<string,unknown>,patch:Record<string,unknown>={};
   for(const k of ["title","description","destination_url","image_url","starts_at","ends_at","is_active"])if(k in b)patch[k]=b[k];
   if(!Object.keys(patch).length)return json({error:"Aucune modification fournie."},400);
   const r=await fetch(`${env.SUPABASE_URL}/rest/v1/hub_campaigns?id=eq.${encodeURIComponent(campaign[1])}`,{method:"PATCH",headers:headers(env),body:JSON.stringify(patch)});
   if(!r.ok)return json({error:"Mise à jour impossible."},502);
   return json({campaign:(await r.json() as unknown[])[0]});
  }
  if(campaign&&request.method==="DELETE"){
   const r=await fetch(`${env.SUPABASE_URL}/rest/v1/hub_campaigns?id=eq.${encodeURIComponent(campaign[1])}`,{method:"DELETE",headers:headers(env)});
   return r.ok?json({ok:true}):json({error:"Suppression impossible."},502);
  }
  if(request.method==="GET"&&url.pathname==="/api/admin/settings"){
   const r=await fetch(`${env.SUPABASE_URL}/rest/v1/hub_site_settings?select=setting_key,setting_value`,{headers:headers(env)});
   if(!r.ok)return json({error:"Lecture des paramètres impossible."},502);
   const rows=await r.json() as Array<{setting_key:string;setting_value:string}>;
   return json({adsense_client:rows.find(x=>x.setting_key==="adsense_client")?.setting_value||""});
  }
  if(request.method==="PATCH"&&url.pathname==="/api/admin/settings"){
   const b=await request.json() as {adsense_client?:string};const client=(b.adsense_client||"").trim();
   if(client&&!/^ca-pub-[0-9]{16}$/.test(client))return json({error:"Identifiant AdSense invalide (ca-pub- suivi de 16 chiffres)."},400);
   const r=await fetch(`${env.SUPABASE_URL}/rest/v1/hub_site_settings?on_conflict=setting_key`,{method:"POST",headers:{...headers(env),Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({setting_key:"adsense_client",setting_value:client,updated_at:new Date().toISOString()})});
   return r.ok?json({ok:true,adsense_client:client}):json({error:"Enregistrement AdSense impossible."},502);
  }
  const follow=url.pathname.match(/^\/api\/admin\/follows\/([0-9a-f-]{36})$/i);
  if(follow&&request.method==="PATCH"){
   const b=await request.json() as {status?:string;admin_note?:string};
   if(!["approved","rejected"].includes(b.status||""))return json({error:"Statut invalide."},400);
   const r=await fetch(`${env.SUPABASE_URL}/rest/v1/hub_follow_verifications?id=eq.${encodeURIComponent(follow[1])}`,{method:"PATCH",headers:headers(env),body:JSON.stringify({status:b.status,admin_note:(b.admin_note||"").slice(0,500),reviewed_at:new Date().toISOString()})});
   if(!r.ok)return json({error:"Validation impossible."},502);
   return (await r.json() as unknown[]).length?json({ok:true}):json({error:"Demande introuvable."},404);
  }
  const match=url.pathname.match(/^\/api\/admin\/requests\/(ads|partners)\/([0-9a-f-]{36})$/i);
  if(request.method==="PATCH"&&match){
   const b=await request.json() as {status?:string};
   if(!["received","reviewing","accepted","declined"].includes(b.status||""))return json({error:"Statut invalide."},400);
   const table=match[1].toLowerCase()==="ads"?"hub_ad_requests":"hub_partner_applications";
   const r=await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(match[2])}`,{method:"PATCH",headers:headers(env),body:JSON.stringify({status:b.status})});
   if(!r.ok)return json({error:"Mise à jour impossible."},502);
   return (await r.json() as unknown[]).length?json({ok:true}):json({error:"Demande introuvable."},404);
  }
  return json({error:"Route administrateur introuvable."},404);
 }catch{return json({error:"Erreur de contrôle administrateur."},500);}
}
