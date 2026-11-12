type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  FACEBOOK_APP_ID?: string;
  FACEBOOK_APP_SECRET?: string;
  FACEBOOK_GRAPH_VERSION?: string;
  APP_BASE_URL?: string;
};
type AuthUser = { id: string };
type PageRow = { id: string; name: string; access_token: string; tasks?: string[] };
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const serviceKey=(env:Env)=>env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY||"";
const dbHeaders=(env:Env)=>({apikey:serviceKey(env),Authorization:"Bearer "+serviceKey(env),"Content-Type":"application/json",Prefer:"return=representation"});
const graph=(env:Env)=>env.FACEBOOK_GRAPH_VERSION||"v26.0";
const baseUrl=(request:Request,env:Env)=> (env.APP_BASE_URL||new URL(request.url).origin).replace(/\/$/,"");
const callbackUrl=(request:Request,env:Env)=>baseUrl(request,env)+"/api/facebook/callback";
async function currentUser(request:Request,env:Env):Promise<AuthUser|null>{
 const token=request.headers.get("Authorization")?.replace(/^Bearer\s+/i,"").trim();
 if(!token||!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY)return null;
 const r=await fetch(env.SUPABASE_URL+"/auth/v1/user",{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:"Bearer "+token}});
 if(!r.ok)return null;const u=await r.json() as {id?:string};return u.id?{id:u.id}:null;
}
function redirect(request:Request,env:Env,status:string,native=false){
 if(native){const u=new URL("aquinet://oauth");u.searchParams.set("facebook",status);return Response.redirect(u.toString(),302);}
 const u=new URL(baseUrl(request,env)+"/");u.searchParams.set("facebook",status);
 return Response.redirect(u.toString(),302);
}
async function graphGet(env:Env,path:string,params:Record<string,string>={}){
 const u=new URL("https://graph.facebook.com/"+graph(env)+"/"+path.replace(/^\//,""));
 for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
 const r=await fetch(u);const data=await r.json() as any;
 if(!r.ok||data.error)throw new Error(data.error?.message||"Erreur Meta Graph API.");
 return data;
}
export async function handleFacebook(request:Request,env:Env){
 const url=new URL(request.url);
 if(!env.SUPABASE_URL||!serviceKey(env))return json({error:"Backend Supabase non configuré."},503);
 try{
  if(request.method==="POST"&&url.pathname==="/api/facebook/connect"){
   if(!env.FACEBOOK_APP_ID||!env.FACEBOOK_APP_SECRET)return json({error:"Connexion Facebook en attente : les identifiants de l'application Meta doivent être configurés dans Cloudflare."},503);
   const user=await currentUser(request,env);if(!user)return json({error:"Connexion AQUI NET HUB requise."},401);
   let body:{native?:boolean}={};try{body=await request.json() as typeof body;}catch{/* Optional for older web clients. */}
   const native=body.native===true;
   const state=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("")+(native?".native":"");
   const saved=await fetch(env.SUPABASE_URL+"/rest/v1/hub_facebook_oauth_states",{method:"POST",headers:dbHeaders(env),body:JSON.stringify({state,user_id:user.id,expires_at:new Date(Date.now()+10*60*1000).toISOString()})});
   if(!saved.ok)return json({error:"Impossible de préparer la connexion sécurisée."},502);
   const auth=new URL("https://www.facebook.com/"+graph(env)+"/dialog/oauth");
   auth.searchParams.set("client_id",env.FACEBOOK_APP_ID);auth.searchParams.set("redirect_uri",callbackUrl(request,env));
   auth.searchParams.set("state",state);auth.searchParams.set("response_type","code");
   auth.searchParams.set("scope","pages_show_list,pages_read_engagement,read_insights");
   auth.searchParams.set("auth_type","rerequest");
   return json({authorization_url:auth.toString()});
  }
  if(request.method==="GET"&&url.pathname==="/api/facebook/callback"){
   const state=url.searchParams.get("state")||"",native=state.endsWith(".native");
   if(url.searchParams.has("error"))return redirect(request,env,"denied",native);
   const code=url.searchParams.get("code")||"";
   if(!code||!state||!env.FACEBOOK_APP_ID||!env.FACEBOOK_APP_SECRET)return redirect(request,env,"invalid",native);
   const q=encodeURIComponent;
   const stateResponse=await fetch(env.SUPABASE_URL+"/rest/v1/hub_facebook_oauth_states?state=eq."+q(state)+"&expires_at=gt."+q(new Date().toISOString())+"&select=user_id,state",{headers:dbHeaders(env)});
   const states=stateResponse.ok?await stateResponse.json() as Array<{user_id:string;state:string}>:[];
   if(!states.length)return redirect(request,env,"expired",native);
   await fetch(env.SUPABASE_URL+"/rest/v1/hub_facebook_oauth_states?state=eq."+q(state),{method:"DELETE",headers:dbHeaders(env)});
   const userId=states[0].user_id;
   const tokenData=await graphGet(env,"oauth/access_token",{client_id:env.FACEBOOK_APP_ID,client_secret:env.FACEBOOK_APP_SECRET,redirect_uri:callbackUrl(request,env),code});
   const longData=await graphGet(env,"oauth/access_token",{grant_type:"fb_exchange_token",client_id:env.FACEBOOK_APP_ID,client_secret:env.FACEBOOK_APP_SECRET,fb_exchange_token:String(tokenData.access_token)});
   const userToken=String(longData.access_token||tokenData.access_token||"");
   if(!userToken)return redirect(request,env,"token_error",native);
   const pagesData=await graphGet(env,"me/accounts",{fields:"id,name,access_token,tasks",limit:"100",access_token:userToken});
   const pages=(pagesData.data||[]) as PageRow[];
   if(!pages.length)return redirect(request,env,"no_pages",native);
   const expires=Number(longData.expires_in||0);
   const rows=pages.filter(p=>p.id&&p.access_token).map(p=>({
    user_id:userId,page_id:p.id,page_name:p.name||"Facebook Page",page_access_token:p.access_token,
    user_access_token:userToken,token_expires_at:expires?new Date(Date.now()+expires*1000).toISOString():null,
    granted_scopes:["pages_show_list","pages_read_engagement","read_insights"],updated_at:new Date().toISOString()
   }));
   const saved=await fetch(env.SUPABASE_URL+"/rest/v1/hub_facebook_connections?on_conflict=user_id,page_id",{method:"POST",headers:{...dbHeaders(env),Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(rows)});
   if(!saved.ok)return redirect(request,env,"save_error",native);
   return redirect(request,env,"connected",native);
  }
  const user=await currentUser(request,env);if(!user)return json({error:"Connexion AQUI NET HUB requise."},401);
  if(request.method==="GET"&&url.pathname==="/api/facebook/pages"){
   const r=await fetch(env.SUPABASE_URL+"/rest/v1/hub_facebook_connections?user_id=eq."+encodeURIComponent(user.id)+"&select=page_id,page_name,updated_at&order=page_name.asc",{headers:dbHeaders(env)});
   if(!r.ok)return json({error:"Impossible de lire les Pages Facebook connectées."},502);
   const pages=await r.json() as Array<{page_id:string;page_name:string;updated_at:string}>;
   return json({connected:pages.length>0,pages});
  }
  if(request.method==="POST"&&url.pathname==="/api/facebook/audit"){
   const body=await request.json() as {page_id?:string};
   const pageId=String(body.page_id||"");
   if(!/^\d{5,30}$/.test(pageId))return json({error:"Sélectionne une Page Facebook valide."},400);
   const r=await fetch(env.SUPABASE_URL+"/rest/v1/hub_facebook_connections?user_id=eq."+encodeURIComponent(user.id)+"&page_id=eq."+encodeURIComponent(pageId)+"&select=page_id,page_name,page_access_token&limit=1",{headers:dbHeaders(env)});
   if(!r.ok)return json({error:"Lecture de la connexion Facebook impossible."},502);
   const rows=await r.json() as Array<{page_id:string;page_name:string;page_access_token:string}>;
   const page=rows[0];if(!page)return json({error:"Cette Page n'est pas connectée à ton compte. Reconnecte Facebook."},404);
   const [details,posts]=await Promise.all([
    graphGet(env,page.page_id,{fields:"id,name,followers_count,fan_count",access_token:page.page_access_token}),
    graphGet(env,page.page_id+"/posts",{fields:"id,message,created_time,permalink_url,shares,likes.summary(true),comments.summary(true)",limit:"20",access_token:page.page_access_token})
   ]);
   const items=(posts.data||[]) as Array<{id?:string;message?:string;permalink_url?:string;likes?:{summary?:{total_count?:number}};comments?:{summary?:{total_count?:number}};created_time?:string;shares?:{count?:number}}>;
   const average=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
   const likes=items.map(p=>Number(p.likes?.summary?.total_count||0));
   const comments=items.map(p=>Number(p.comments?.summary?.total_count||0));
   const shares=items.map(p=>Number(p.shares?.count||0));
   let insights:any=null;
   try{
    const until=Math.floor(Date.now()/1000),since=until-28*86400;
    insights=await graphGet(env,page.page_id+"/insights",{metric:"page_impressions,page_post_engagements,page_follows",period:"day",since:String(since),until:String(until),access_token:page.page_access_token});
   }catch{/* Some Page types or API versions may not expose every metric. */}
   const insightMap:Record<string,number>={};
   for(const metric of insights?.data||[]){const vals=(metric.values||[]).map((v:any)=>Number(v.value||0));insightMap[metric.name]=vals.reduce((a:number,b:number)=>a+b,0);}
   const followers=Number(details.followers_count||details.fan_count||0);
   const report={
    platform:"Facebook",page_id:page.page_id,page_name:details.name||page.page_name,followers,
    posts_analyzed:items.length,average_likes:Number(average(likes).toFixed(1)),
    average_comments:Number(average(comments).toFixed(1)),average_shares:Number(average(shares).toFixed(1)),
    impressions_28d:insightMap.page_impressions??null,engagements_28d:insightMap.page_post_engagements??null,
    follows_28d:insightMap.page_follows??null,
    recent_posts:items.slice(0,5).map(p=>({created_at:p.created_time||null,permalink:p.permalink_url||null,likes:Number(p.likes?.summary?.total_count||0),comments:Number(p.comments?.summary?.total_count||0)})),
    disclaimer:"Données récupérées directement via l'API officielle Meta pour la Page autorisée. Certaines statistiques peuvent être indisponibles selon les autorisations, le type de Page et les règles Meta."
   };
   return json({ok:true,report});
  }
  return json({error:"Route Facebook introuvable."},404);
 }catch(e){return json({error:e instanceof Error?e.message:"Erreur de connexion Facebook."},502);}
}
