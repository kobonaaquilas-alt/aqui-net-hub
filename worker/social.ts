type Env = { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY?: string; SUPABASE_SECRET_KEY?: string };
type User = { id: string };
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const headers=(env:Env)=>({apikey:env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY||"",Authorization:"Bearer "+(env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY||""),"Content-Type":"application/json",Prefer:"return=representation"});
async function userFrom(request:Request,env:Env):Promise<User|null>{
 const token=request.headers.get("Authorization")?.replace(/^Bearer\s+/i,"").trim();
 if(!token)return null;
 const r=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`}});
 if(!r.ok)return null; const u=await r.json() as {id?:string}; return u.id?{id:u.id}:null;
}
async function countAudits(env:Env,userId:string){
 const r=await fetch(`${env.SUPABASE_URL}/rest/v1/hub_social_audits?user_id=eq.${encodeURIComponent(userId)}&select=id`,{headers:{...headers(env),Prefer:"count=exact"}});
 if(!r.ok)throw new Error("quota"); const range=r.headers.get("content-range")||"*/0"; return Number(range.split("/")[1]||0);
}
async function entitlement(env:Env,userId:string){
 const response=await fetch(
  `${env.SUPABASE_URL}/rest/v1/hub_subscriptions?user_id=eq.${encodeURIComponent(userId)}&status=eq.active&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=1`,
  {headers:headers(env)}
 );
 if(!response.ok)throw new Error("subscription");
 const rows=await response.json() as unknown[];
 return {followStatus:"not_required",subscribed:rows.length>0};
}

function analyze(body:any, platform:string){
  const followers=Number(body.followers),views=Number(body.average_views),likes=Number(body.average_likes),comments=Number(body.average_comments),frequency=Number(body.posts_per_week);
  const interactions=likes+comments;
  const engagementFollowers=followers>0?interactions/followers*100:0;
  const engagementViews=views>0?interactions/views*100:0;
  const viewRatio=followers>0?views/followers*100:0;
  const commentShare=interactions>0?comments/interactions*100:0;
  const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
  const reachScore=followers>0?clamp(viewRatio/150*30):0;
  const engagementScore=views>0?clamp(engagementViews/8*30):0;
  const consistencyScore=clamp(frequency/5*25);
  const conversationScore=interactions>0?clamp(commentShare/25*15):0;
  const healthScore=Math.round(reachScore+engagementScore+consistencyScore+conversationScore);
  const strengths:string[]=[]; const issues:string[]=[]; const actions:string[]=[];
  if(followers>0&&viewRatio>=100)strengths.push("La portée moyenne atteint ou dépasse la taille de l'audience.");
  if(views>0&&engagementViews>=4)strengths.push("Les interactions rapportées représentent une part encourageante des vues.");
  if(frequency>=4)strengths.push("La cadence de publication est régulière.");
  if(commentShare>=20)strengths.push("Les commentaires occupent une bonne part des interactions.");
  if(views===0)issues.push("Les vues moyennes manquent : la portée ne peut pas être évaluée.");
  else if(viewRatio<25)issues.push("La portée moyenne est faible par rapport au nombre d'abonnés.");
  if(views>0&&engagementViews<2)issues.push("Les interactions rapportées sont faibles par rapport aux vues.");
  if(frequency<3)issues.push("La fréquence de publication est basse pour construire une habitude d'audience.");
  if(interactions>0&&commentShare<8)issues.push("Les contenus déclenchent peu de commentaires par rapport aux mentions J'aime.");
  actions.push("Teste trois accroches différentes sur les prochaines publications et compare la rétention dès les premières secondes.");
  actions.push("Transforme les sujets qui fonctionnent en séries récurrentes avec un rendez-vous identifiable.");
  actions.push("Termine chaque contenu par une question précise qui donne une vraie raison de commenter.");
  if(frequency<3)actions.push("Teste trois publications par semaine pendant trois semaines, puis ajuste selon les résultats.");
  if(/vente|business|client|revenu|monet/i.test(String(body.goal||""))) actions.push("Ajoute un appel à l'action commercial clair dans la bio et les contenus, sans surcharger chaque publication.");
  return {
    platform,
    health_score:healthScore,
    engagement_rate:Number(engagementFollowers.toFixed(2)),
    engagement_rate_by_views:Number(engagementViews.toFixed(2)),
    views_to_followers_percent:Number(viewRatio.toFixed(1)),
    comment_share_percent:Number(commentShare.toFixed(1)),
    strengths,issues,actions,
    disclaimer:"Indice indicatif fondé sur les chiffres fournis ou importés. Les statistiques saisies manuellement ne sont pas vérifiées par le réseau social. Les résultats dépendent aussi du format, de la rétention, de la période et de l'audience."
  };
}
export async function handleSocial(request:Request,env:Env){
 if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!(env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY))return json({error:"Service social non configuré."},503);
 const user=await userFrom(request,env); if(!user)return json({error:"Connexion requise."},401);
 const url=new URL(request.url);
 try{
  if(request.method==="GET"&&url.pathname==="/api/social/status"){
   const [count,access]=await Promise.all([countAudits(env,user.id),entitlement(env,user.id)]);
   return json({count,free_remaining:Math.max(0,3-count),...access});
  }
  if(request.method==="POST"&&url.pathname==="/api/social/audits"){
   const b=await request.json() as any;
   const platform=String(b.platform||"").slice(0,40),account=String(b.account_name||"").trim();
    if(!["TikTok","Facebook","Instagram","YouTube"].includes(platform))return json({error:"Seuls TikTok, Facebook, Instagram et YouTube sont pris en charge."},400);
   let profile:URL;try{profile=new URL(String(b.social_url||""));}catch{return json({error:"Lien de profil invalide."},400);}
   const allowedHosts:Record<string,string[]>={
    TikTok:["tiktok.com"],Facebook:["facebook.com","fb.com"],Instagram:["instagram.com"],YouTube:["youtube.com","youtu.be"]
   };
   const host=profile.hostname.toLowerCase();
   const hostAllowed=(allowedHosts[platform]||[]).some(domain=>host===domain||host.endsWith("."+domain));
   if(profile.protocol!=="https:"||profile.username||profile.password||!hostAllowed||account.length<2||account.length>120)
    return json({error:"Renseigne un lien HTTPS valide du réseau sélectionné et un nom de compte (2 à 120 caractères)."},400);
   const fields=["followers","average_views","average_likes","average_comments","posts_per_week"];
   for(const k of fields){const n=Number(b[k]);if(!Number.isFinite(n)||n<0||n>100000000000)return json({error:`Valeur invalide : ${k}`},400);}
   const report=analyze(b,platform);
   const saved=await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/create_hub_social_audit`,{
    method:"POST",headers:headers(env),
    body:JSON.stringify({
     p_user_id:user.id,p_social_url:profile.toString(),p_platform:platform,p_account_name:account,
     p_followers:Number(b.followers),p_average_views:Number(b.average_views),
     p_average_likes:Number(b.average_likes),p_average_comments:Number(b.average_comments),
     p_posts_per_week:Number(b.posts_per_week),p_goal:String(b.goal||"").slice(0,500),p_report:report
    })
   });
   if(!saved.ok)return json({error:"Impossible d'enregistrer l'analyse."},502);
   const result=await saved.json() as {ok:boolean;code?:string;count:number};
   if(!result.ok){
    const messages:Record<string,string>={
     SUBSCRIPTION_REQUIRED:"Les trois analyses gratuites sont utilisées. Un abonnement AQUI NET HUB est nécessaire pour continuer."
    };
    return json({error:messages[result.code||""]||"Accès refusé.",code:result.code,count:result.count},result.code==="SUBSCRIPTION_REQUIRED"?402:403);
   }
   return json({ok:true,count:result.count,free_remaining:Math.max(0,3-result.count),report});
  }
  return json({error:"Route sociale introuvable."},404);
 }catch{return json({error:"Erreur pendant le traitement social."},500);}
}
