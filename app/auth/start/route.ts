import {authClient} from '../../../lib/auth';
import {NextResponse} from 'next/server';
export async function GET(request:Request){
 const url=new URL(request.url),provider=url.searchParams.get('provider');
 if(provider!=='google')return NextResponse.redirect(new URL('/login?error=provider',url));
 try{const client=await authClient();const {data,error}=await client.auth.signInWithOAuth({provider,options:{redirectTo:url.origin+'/auth/callback',skipBrowserRedirect:true,...(provider==='google'?{queryParams:{prompt:'select_account'}}:{})}});
 if(error||!data.url)return NextResponse.redirect(new URL('/login?error=oauth',url));
 return NextResponse.redirect(data.url);
 }catch{return NextResponse.redirect(new URL('/login?error=config',url))}
}

