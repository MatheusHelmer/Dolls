const url=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function api(path:string,method='GET',body?:unknown,schema=true){
 const r=await fetch(url+path,{method,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',...(schema?{'Accept-Profile':'livre','Content-Profile':'livre'}:{}),Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const text=await r.text();const data=text?JSON.parse(text):null;if(!r.ok)throw new Error(data?.code||'remote_error');return data;
}
Deno.serve(async(req:Request)=>{
 const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
 const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token||token.length!==64)return json({error:'Unauthorized'},401);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 const keys=await api('/rest/v1/backend_auth?key_hash=eq.'+hash+'&select=allowed_email');if(!keys?.length)return json({error:'Unauthorized'},401);
 const b=await req.json();if(typeof b.siteUserId!=='string'||!b.siteUserId||b.siteUserId.length>150||typeof b.email!=='string'||b.email.toLowerCase()!==keys[0].allowed_email.toLowerCase())return json({error:'Forbidden'},403);
 if(!['read','migrate','save','delete','bank_add','bank_delete','bank_sync','credentials_read','credentials_save'].includes(b.action))return json({error:'Invalid action'},400);
 let mappings=await api('/rest/v1/site_users?site_user_id=eq.'+encodeURIComponent(b.siteUserId)+'&select=user_id,migrated');
 if(!mappings.length){
 let userId:string|undefined;
 for(let page=1;page<=20&&!userId;page++){const users=await api('/auth/v1/admin/users?page='+page+'&per_page=100',undefined,undefined,false);userId=users.users?.find((u:any)=>u.email?.toLowerCase()===b.email.toLowerCase())?.id;if((users.users?.length||0)<100)break;}
 if(!userId){const user=await api('/auth/v1/admin/users','POST',{email:b.email,email_confirm:true},false);userId=user.id;}
 await api('/rest/v1/site_users?on_conflict=site_user_id','POST',{site_user_id:b.siteUserId,user_id:userId});mappings=[{user_id:userId,migrated:false}];
 }
 if(!mappings[0].migrated&&b.action!=='migrate')return json({error:'A migração inicial ainda não foi concluída.'},409);
 if(b.action==='credentials_read'){const rows=await api('/rest/v1/server_credentials?user_id=eq.'+mappings[0].user_id+'&select=encrypted');return json({encrypted:rows[0]?.encrypted||null});}
 if(b.action==='credentials_save'){if(typeof b.payload?.encrypted!=='string'||b.payload.encrypted.length>5000)return json({error:'Invalid credentials'},400);const uid=mappings[0].user_id;const existing=await api('/rest/v1/server_credentials?user_id=eq.'+uid+'&select=user_id');if(existing.length)await api('/rest/v1/server_credentials?user_id=eq.'+uid,'PATCH',{encrypted:b.payload.encrypted});else await api('/rest/v1/server_credentials','POST',{user_id:uid,encrypted:b.payload.encrypted});return json({ok:true});}
 const result=await api('/rest/v1/rpc/app_api','POST',{u:mappings[0].user_id,action:b.action,payload:b.payload||{}});
 return json({...result,migrated:true});
 }catch(e){const code=e instanceof Error?e.message:'error';console.error('Livre backend operation failed',code);return json({error:'Não foi possível concluir a operação no Supabase. Os dados anteriores foram preservados.'},503)}
});

