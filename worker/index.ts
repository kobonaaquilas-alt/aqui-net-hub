import { CinetPayClient, parseNotification, verifyNotification } from "cinetpay-js";
interface Env { ASSETS:{fetch(request:Request):Promise<Response>}; SUPABASE_URL:string; SUPABASE_ANON_KEY:string; SUPABASE_SERVICE_ROLE_KEY:string; CINETPAY_API_KEY:string; CINETPAY_API_PASSWORD:string; APP_BASE_URL?:string; }
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const headers=(env:Env)=>({apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,"Content-Type":"application/json",Prefer:"return=representation"});
async function authUser(request:Request,env:Env){const token=request.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");if(!token)return null;const r=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`}});return r.ok?await r.json() as {id:string;email?:string}:null;}
async function createPayment(request:Request,env:Env){
 if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.SUPABASE_SERVICE_ROLE_KEY)return json({error:"Backend Supabase non configuré."},503);
 if(!env.CINETPAY_API_KEY||!env.CINETPAY_API_PASSWORD)return json({error:"Paiement non configuré : identifiants marchands absents."},503);
 const user=await authUser(request,env);if(!user)return json({error:"Connexion requise."},401);
 const body=await request.json() as {plan_id?:string;first_name?:string;last_name?:string;phone?:string};
 if(!body.plan_id||!body.first_name||!body.last_name||!user.email)return json({error:"Informations de paiement incomplètes."},400);
 const pr=await fetch(`${env.SUPABASE_URL}/rest/v1/hub_plans?id=eq.${encodeURIComponent(body.plan_id)}&is_active=eq.true&select=id,name,amount_xof`,{headers:headers(env)});
 const plans=await pr.json() as Array<{id:string;name:string;amount_xof:number}>;const plan=plans[0];if(!pr.ok||!plan)return json({error:"Formule indisponible."},404);
 const merchantId=`ANH-${crypto.randomUUID().replace(/-/g,"").slice(0,20)}`;
 const order=await fetch(`${env.SUPABASE_URL}/rest/v1/hub_payment_orders`,{method:"POST",headers:headers(env),body:JSON.stringify({user_id:user.id,plan_id:plan.id,amount_xof:plan.amount_xof,merchant_transaction_id:merchantId})});
 if(!order.ok)return json({error:"Création de commande impossible."},500);
 try{
  const client=new CinetPayClient({credentials:{TG:{apiKey:env.CINETPAY_API_KEY,apiPassword:env.CINETPAY_API_PASSWORD}}});
  const base=env.APP_BASE_URL||new URL(request.url).origin;
  const payment=await client.payment.initialize({currency:"XOF",merchantTransactionId:merchantId,amount:plan.amount_xof,lang:"fr",designation:`AQUI NET HUB - ${plan.name}`,clientEmail:user.email,clientFirstName:body.first_name,clientLastName:body.last_name,...(body.phone?{clientPhoneNumber:body.phone}:{}),successUrl:`${base}/?payment=return`,failedUrl:`${base}/?payment=failed`,notifyUrl:`${base}/api/payments/webhook`,channel:"PUSH"},"TG");
  await fetch(`${env.SUPABASE_URL}/rest/v1/hub_payment_orders?merchant_transaction_id=eq.${encodeURIComponent(merchantId)}`,{method:"PATCH",headers:headers(env),body:JSON.stringify({payment_url:payment.paymentUrl,notify_token:payment.notifyToken,cinetpay_transaction_id:payment.transactionId})});
  return json({payment_url:payment.paymentUrl});
 }catch{await fetch(`${env.SUPABASE_URL}/rest/v1/hub_payment_orders?merchant_transaction_id=eq.${encodeURIComponent(merchantId)}`,{method:"PATCH",headers:headers(env),body:JSON.stringify({status:"failed"})});return json({error:"CinetPay n'a pas pu initialiser le paiement."},502);}
}
async function webhook(request:Request,env:Env){
 const ct=request.headers.get("Content-Type")||"";const raw=await request.text();const payload=ct.includes("application/json")?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw));
 const n=parseNotification(payload);const r=await fetch(`${env.SUPABASE_URL}/rest/v1/hub_payment_orders?merchant_transaction_id=eq.${encodeURIComponent(n.merchantTransactionId)}&select=id,amount_xof,notify_token,cinetpay_transaction_id,status`,{headers:headers(env)});
 const rows=await r.json() as Array<{id:string;amount_xof:number;notify_token:string|null;cinetpay_transaction_id:string|null;status:string}>;const order=rows[0];
 if(!order||!order.notify_token||!verifyNotification(order.notify_token,n.notifyToken))return json({error:"Notification invalide."},401);
 if(order.status==="paid")return json({received:true});
 const client=new CinetPayClient({credentials:{TG:{apiKey:env.CINETPAY_API_KEY,apiPassword:env.CINETPAY_API_PASSWORD}}});
 const verified=await client.payment.getStatus(n.transactionId,"TG");
 if(verified.status==="SUCCESS"&&verified.merchantTransactionId===n.merchantTransactionId&&verified.transactionId===n.transactionId&&order.cinetpay_transaction_id===n.transactionId){
  const confirmed=await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/confirm_hub_payment`,{method:"POST",headers:headers(env),body:JSON.stringify({p_order_id:order.id,p_transaction_id:n.transactionId})});
  if(!confirmed.ok)return json({error:"Confirmation interne impossible."},500);
 }else if(verified.status==="FAILED"){
  await fetch(`${env.SUPABASE_URL}/rest/v1/hub_payment_orders?id=eq.${order.id}`,{method:"PATCH",headers:headers(env),body:JSON.stringify({status:"failed"})});
 }
 return json({received:true});
}
export default {async fetch(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url);
 if(request.method==="GET"&&url.pathname==="/api/health")return json({ok:true,supabase:!!env.SUPABASE_URL&&!!env.SUPABASE_SERVICE_ROLE_KEY,cinetpay:!!env.CINETPAY_API_KEY&&!!env.CINETPAY_API_PASSWORD});
 if(request.method==="POST"&&url.pathname==="/api/payments/create")return createPayment(request,env);
 if(request.method==="POST"&&url.pathname==="/api/payments/webhook")return webhook(request,env);
 if(url.pathname.startsWith("/api/"))return json({error:"Route introuvable."},404);
 return env.ASSETS.fetch(request);
}};
