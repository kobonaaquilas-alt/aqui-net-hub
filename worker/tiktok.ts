type Env = {
  SUPABASE_URL: string; SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string; SUPABASE_SECRET_KEY?: string;
  TIKTOK_CLIENT_KEY?: string; TIKTOK_CLIENT_SECRET?: string; APP_BASE_URL?: string;
};
type User = { id: string };
const tiktokKey = (e: Env) => e.TIKTOK_CLIENT_KEY?.trim() || "";
const tiktokSecret = (e: Env) => e.TIKTOK_CLIENT_SECRET?.trim() || "";
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const key=(e:Env)=>e.SUPABASE_SERVICE_ROLE_KEY||e.SUPABASE_SECRET_KEY||"";
const dbh=(e:Env)=>({apikey:key(e),Authorization:"Bearer "+key(e),"Content-Type":"application/json",Prefer:"return=representation"});
const base=(r:Request,e:Env)=>(e.APP_BASE_URL||new URL(r.url).origin).replace(/\/$/,"");
const callback=(r:Request,e:Env)=>base(r,e)+"/api/tiktok/callback";
async function currentUser(r:Request,e:Env):Promise<User|null>{
 const t=r.headers.get("Authorization")?.replace(/^Bearer\s+/i,"").trim();
 if(!t)return null;
 const x=await fetch(e.SUPABASE_URL+"/auth/v1/user",{headers:{apikey:e.SUPABASE_ANON_KEY,Authorization:"Bearer "+t}});
 if(!x.ok)return null;const u=await x.json() as {id?:string};return u.id?{id:u.id}:null;
}
function done(r:Request,e:Env,s:string){const u=new URL(base(r,e)+"/");u.searchParams.set("tiktok",s);return Response.redirect(u.toString(),302);}
async function tokenRequest(e:Env,body:URLSearchParams){
 const r=await fetch("https://open.tiktokapis.com/v2/oauth/token/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
 const d=await r.json() as any;if(!r.ok||d.error||!d.access_token)throw new Error(d.error_description||d.error||"TikTok token exchange failed");return d;
}
async function refresh(e:Env,row:any){
 const p=new URLSearchParams({client_key:tiktokKey(e),client_secret:tiktokSecret(e),grant_type:"refresh_token",refresh_token:row.refresh_token});
 const d=await tokenRequest(e,p);
 const saved=await fetch(e.SUPABASE_URL+"/rest/v1/hub_tiktok_connections?user_id=eq."+encodeURIComponent(row.user_id),{method:"PATCH",headers:dbh(e),body:JSON.stringify({access_token:d.access_token,refresh_token:d.refresh_token||row.refresh_token,expires_at:new Date(Date.now()+Number(d.expires_in||86400)*1000).toISOString(),refresh_expires_at:new Date(Date.now()+Number(d.refresh_expires_in||31536000)*1000).toISOString(),updated_at:new Date().toISOString()})});
 if(!saved.ok)throw new Error("Token refresh storage failed");return {...row,access_token:d.access_token};
}
async function api(e:Env,token:string,path:string,method="GET",body?:unknown){
 const r=await fetch("https://open.tiktokapis.com"+path,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
 const d=await r.json() as any;if(!r.ok||d.error?.code&&d.error.code!=="ok")throw new Error(d.error?.message||"TikTok API request failed");return d.data;
}
export async function handleTikTok(r:Request,e:Env){
 const u=new URL(r.url);
 if(!e.SUPABASE_URL||!e.SUPABASE_ANON_KEY||!key(e))return json({error:"Supabase n'est pas configuré."},503);
 try{
  if(r.method==="POST"&&u.pathname==="/api/tiktok/connect"){
   if(!tiktokKey(e)||!tiktokSecret(e))return json({error:"Identifiants TikTok manquants dans les secrets Cloudflare."},503);
   const user=await currentUser(r,e);if(!user)return json({error:"Connecte-toi à AQUI NET HUB."},401);
   const state=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
   const saved=await fetch(e.SUPABASE_URL+"/rest/v1/hub_tiktok_oauth_states",{method:"POST",headers:dbh(e),body:JSON.stringify({state,user_id:user.id,expires_at:new Date(Date.now()+10*60*1000).toISOString()})});
   if(!saved.ok)return json({error:"Impossible de créer la session sécurisée TikTok."},502);
   const auth=new URL("https://www.tiktok.com/v2/auth/authorize/");
   auth.searchParams.set("client_key",tiktokKey(e));auth.searchParams.set("response_type","code");
   auth.searchParams.set("scope","user.info.basic,user.info.profile,user.info.stats,video.list");
   auth.searchParams.set("redirect_uri",callback(r,e));auth.searchParams.set("state",state);
   return json({authorization_url:auth.toString()});
  }
  if(r.method==="GET"&&u.pathname==="/api/tiktok/callback"){
   if(u.searchParams.has("error"))return done(r,e,"denied");
   const code=u.searchParams.get("code")||"",state=u.searchParams.get("state")||"";
   if(!code||!state||!tiktokKey(e)||!tiktokSecret(e))return done(r,e,"invalid");
   const q=encodeURIComponent;
   const sr=await fetch(e.SUPABASE_URL+"/rest/v1/hub_tiktok_oauth_states?state=eq."+q(state)+"&expires_at=gt."+q(new Date().toISOString())+"&select=user_id,state",{headers:dbh(e)});
   const states=sr.ok?await sr.json() as Array<{user_id:string;state:string}>:[];
   if(!states.length)return done(r,e,"expired");
   await fetch(e.SUPABASE_URL+"/rest/v1/hub_tiktok_oauth_states?state=eq."+q(state),{method:"DELETE",headers:dbh(e)});
   const p=new URLSearchParams({client_key:tiktokKey(e),client_secret:tiktokSecret(e),code,grant_type:"authorization_code",redirect_uri:callback(r,e)});
   const d=await tokenRequest(e,p);const uid=states[0].user_id;
   const saved=await fetch(e.SUPABASE_URL+"/rest/v1/hub_tiktok_connections?on_conflict=user_id",{method:"POST",headers:{...dbh(e),Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({user_id:uid,open_id:d.open_id,display_name:"",access_token:d.access_token,refresh_token:d.refresh_token,expires_at:new Date(Date.now()+Number(d.expires_in||86400)*1000).toISOString(),refresh_expires_at:new Date(Date.now()+Number(d.refresh_expires_in||31536000)*1000).toISOString(),granted_scopes:d.scope||"",updated_at:new Date().toISOString()})});
   if(!saved.ok)return done(r,e,"save_error");
   return done(r,e,"connected");
  }
  const user=await currentUser(r,e);if(!user)return json({error:"Connexion AQUI NET HUB requise."},401);
  if(r.method==="DELETE"&&u.pathname==="/api/tiktok/disconnect"){
   const d=await fetch(e.SUPABASE_URL+"/rest/v1/hub_tiktok_connections?user_id=eq."+encodeURIComponent(user.id),{method:"DELETE",headers:dbh(e)});
   if(!d.ok)return json({error:"Déconnexion impossible."},502);return json({ok:true});
  }
  if(r.method==="GET"&&u.pathname==="/api/tiktok/me"){
   const q=encodeURIComponent(user.id);
   const sr=await fetch(e.SUPABASE_URL+"/rest/v1/hub_tiktok_connections?user_id=eq."+q+"&select=user_id,open_id,display_name,access_token,refresh_token,expires_at,granted_scopes&limit=1",{headers:dbh(e)});
   if(!sr.ok)return json({error:"Lecture de la connexion impossible."},502);
   const rows=await sr.json() as any[];let row=rows[0];if(!row)return json({connected:false});
   if(new Date(row.expires_at).getTime()<Date.now()+60000)row=await refresh(e,row);
   const fields="open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count";
   const data=await api(e,row.access_token,"/v2/user/info/?fields="+fields);
   const profile=data.user||{};
   await fetch(e.SUPABASE_URL+"/rest/v1/hub_tiktok_connections?user_id=eq."+q,{method:"PATCH",headers:dbh(e),body:JSON.stringify({display_name:profile.display_name||"",updated_at:new Date().toISOString()})});
   let videos:any[]=[];
   if(String(row.granted_scopes||"").split(",").includes("video.list")){
    try{const vd=await api(e,row.access_token,"/v2/video/list/?fields=id,title,video_description,duration,cover_image_url,share_url,view_count,like_count,comment_count,share_count","POST",{max_count:20});videos=vd.videos||[];}catch{/* video permission may not be approved */}
   }
   return json({connected:true,profile,videos,source:"TikTok Display API",granted_scopes:row.granted_scopes});
  }
  return json({error:"Route TikTok introuvable."},404);
 }catch(err){return json({error:err instanceof Error?err.message:"Erreur TikTok."},502);}
}
