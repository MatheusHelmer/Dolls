import 'server-only';
import {owner} from './auth';
export const isSupabase=()=>true;
export async function sbStore(action:string,payload:unknown={}){
 const user=await owner();
 const {SUPABASE_URL:url,SUPABASE_BACKEND_TOKEN:token,SUPABASE_SITE_USER_ID:siteUserId}=process.env;
 if(!url||!token||!siteUserId)throw Error('A conexão segura não está configurada.');
 const r=await fetch(url+'/functions/v1/livre-backend',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({siteUserId,email:user.email,action,payload}),cache:'no-store',signal:AbortSignal.timeout(60000)});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível acessar o Supabase.');return data;
}
