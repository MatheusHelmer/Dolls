import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
export async function proxy(request:NextRequest){
 let response=NextResponse.next({request});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key){if(request.nextUrl.pathname==='/login')return response;return NextResponse.json({error:'Configure o Supabase na hospedagem.'},{status:503})}
 const client=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll(values){for(const {name,value} of values)request.cookies.set(name,value);response=NextResponse.next({request});for(const {name,value,options} of values)response.cookies.set(name,value,{...options,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax'});}}});
 const {data:{user}}=await client.auth.getUser();
 const allowed=user?.email?.toLowerCase()===process.env.SUPABASE_OWNER_EMAIL?.toLowerCase();
 if(!allowed&&request.nextUrl.pathname!=='/login'&&request.nextUrl.pathname!=='/api/auth'){
  if(request.nextUrl.pathname.startsWith('/api/'))return NextResponse.json({error:'Entre na sua conta para continuar.'},{status:401});
  return NextResponse.redirect(new URL('/login',request.url));
 }
 return response;
}
export const config={matcher:['/','/login','/api/:path*']};
