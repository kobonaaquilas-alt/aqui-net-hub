type Env = { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY?: string; SUPABASE_SECRET_KEY?: string };
type User = { id: string };
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const headers=(env:Env)=>({apikey:env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY||"","Content-Type":"application/json",Prefer:"return=representation"});
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
 const [follow,sub]=await Promise.all([
  fetch(`${env.SUPABASE_URL}/rest/v1/hub_follow_verifications?user_id=eq.${encodeURIComponent(userId)}&select=status&limit=1`,{headers:headers(env)}),
  fetch(`${env.SUPABASE_URL}/rest/v1/hub_subscriptions?user_id=eq.${encodeURIComponent(userId)}&status=eq.active&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=1`,{headers:headers(env)})
 ]);
 if(!follow.ok||!sub.ok)throw new Error("entitlement");
 const f=await follow.json() as Array<{status:string}>; const s=await sub.json() as unknown[];
 return {followStatus:f[0]?.status||"none",subscribed:s.length>0};
}
function analyze(body:any){
 const followers=Number(body.followers),views=Number(body.average_views),likes=Number(body.average_likes),comments=Number(body.average_comments),frequency=Number(body.posts_per_week);
 const engagement=followers>0?(likes+comments)/followers*100:0;
 const viewRatio=followers>0?views/followers*100:0;
 const strengths:string[]=[]; const issues:string[]=[]; const actions:string[]=[];
 if(followers>0&&views>followers)strengths.push("La moyenne de vues dépasse le nombre d'abonnés : certains contenus touchent déjà au-delà de l'audience existante.");
 if(engagement>=3)strengths.push("Le taux d'interactions déclaré est encourageant.");
 if(frequency>=3)strengths.push("La fréquence de publication déclarée crée une bonne régularité.");
 if(views===0)issues.push("La moyenne de vues n'est pas renseignée : impossible d'évaluer la portée.");
 else if(viewRatio<20)issues.push("Les vues moyennes restent faibles par rapport à la taille de l'audience déclarée.");
 if(followers>0&&engagement<1)issues.push("Le taux d'interactions déclaré est faible : les contenus doivent mieux susciter commentaires et partages.");
 if(frequency<2)issues.push("La cadence déclarée est irrégulière.");
 actions.push("Renforcer les 2 premières secondes avec une promesse, une question ou une scène surprenante.");
 actions.push("Construire 3 à 4 séries récurrentes pour donner une raison de revenir.");
 actions.push("Ajouter un appel à l'action simple et naturel, puis répondre rapidement aux commentaires.");
 actions.push("Comparer les performances de 5 publications et reproduire les formats qui retiennent le mieux l'audience.");
 if(frequency<3)actions.push("Tester au moins 3 publications par semaine pendant 3 semaines, sans sacrifier la qualité.");
 return {engagement_rate:Number(engagement.toFixed(2)),views_to_followers_percent:Number(viewRatio.toFixed(1)),strengths,issues,actions,disclaimer:"Analyse indicative calculée à partir des chiffres déclarés par l'utilisateur. Les statistiques n'ont pas été vérifiées auprès du réseau social."};
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
  if(request.method==="POST"&&url.pathname==="/api/social/follow-verification"){
   const b=await request.json() as {account_name?:string;tiktok_proof_url?:string;facebook_proof_url?:string};
   const account=b.account_name?.trim()||"";
   const valid=(s:string|undefined)=>{try{const u=new URL(s||"");return u.protocol==="https:";}catch{return false;}};
   if(account.length<2||!valid(b.tiktok_proof_url)||!valid(b.facebook_proof_url))return json({error:"Indique le nom du compte et deux liens HTTPS vers les preuves d'abonnement."},400);
   const r=await fetch(`${env.SUPABASE_URL}/rest/v1/hub_follow_verifications?on_conflict=user_id`,{method:"POST",headers:{...headers(env),Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({user_id:user.id,account_name:account,tiktok_proof_url:b.tiktok_proof_url,facebook_proof_url:b.facebook_proof_url,status:"pending",admin_note:null,reviewed_at:null})});
   if(!r.ok)return json({error:"Impossible d'enregistrer la demande de vérification."},502);
   return json({ok:true,status:"pending"});
  }
  if(request.method==="POST"&&url.pathname==="/api/social/audits"){
   const b=await request.json() as any;
   const platform=String(b.platform||"").slice(0,40),account=String(b.account_name||"").trim();
   let profile:URL;try{profile=new URL(String(b.social_url||""));}catch{return json({error:"Lien de profil invalide."},400);}
   if(profile.protocol!=="https:"||account.length<2)return json({error:"Renseigne un profil HTTPS et le nom du compte."},400);
   const fields=["followers","average_views","average_likes","average_comments","posts_per_week"];
   for(const k of fields){const n=Number(b[k]);if(!Number.isFinite(n)||n<0||n>100000000000)return json({error:`Valeur invalide : ${k}`},400);}
   const report=analyze(b);
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
     FOLLOW_REQUIRED:"Les 3 analyses gratuites sont utilisées. Abonne-toi aux comptes TikTok et Facebook puis envoie les preuves pour validation.",
     FOLLOW_PENDING:"Ta preuve d'abonnement est en cours de vérification.",
     SUBSCRIPTION_REQUIRED:"Abonnement AQUI NET HUB requis après validation des abonnements TikTok et Facebook."
    };
    return json({error:messages[result.code||""]||"Accès refusé.",code:result.code,count:result.count},result.code==="SUBSCRIPTION_REQUIRED"?402:403);
   }
   return json({ok:true,count:result.count,free_remaining:Math.max(0,3-result.count),report});
  }
  return json({error:"Route sociale introuvable."},404);
 }catch{return json({error:"Erreur pendant le traitement social."},500);}
}
