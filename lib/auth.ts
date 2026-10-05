import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
export async function authClient(){
 const jar=await cookies();
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw Error('Configure o Supabase na hospedagem.');
 return createServerClient(url,key,{cookies:{getAll:()=>jar.getAll(),setAll(values){try{for(const {name,value,options} of values)jar.set(name,value,{...options,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax'});}catch{/* Server components cannot write; route handlers refresh sessions. */}}}});
}
export async function owner(){
 const {data:{user},error}=await (await authClient()).auth.getUser();
 if(error||!user||!user.email||user.email.toLowerCase()!==process.env.SUPABASE_OWNER_EMAIL?.toLowerCase())throw Error('Entre com a conta proprietária do Livre.');
 return user;
}
