import {authClient} from '../../../lib/auth';
export async function POST(){return Response.json({error:'Use Continuar com Google para entrar.'},{status:405})}
export async function DELETE(r:Request){if(r.headers.get('origin')!==new URL(r.url).origin)return Response.json({error:'Origem inválida.'},{status:403});await (await authClient()).auth.signOut();return Response.json({ok:true})}
