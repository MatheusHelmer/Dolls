import {authClient} from '../../../lib/auth';
function origin(r:Request){return r.headers.get('origin')===new URL(r.url).origin}
export async function POST(r:Request){
 if(!origin(r))return Response.json({error:'Origem inválida.'},{status:403});
 try{const {email,password}=await r.json();if(typeof email!=='string'||typeof password!=='string'||email.toLowerCase()!==process.env.SUPABASE_OWNER_EMAIL?.toLowerCase())return Response.json({error:'E-mail ou senha inválidos.'},{status:401});const client=await authClient();const {error}=await client.auth.signInWithPassword({email,password});return error?Response.json({error:'E-mail ou senha inválidos.'},{status:401}):Response.json({ok:true});}catch{return Response.json({error:'Não foi possível entrar. Tente novamente.'},{status:503})}
}
export async function DELETE(r:Request){if(!origin(r))return Response.json({error:'Origem inválida.'},{status:403});await (await authClient()).auth.signOut();return Response.json({ok:true})}
