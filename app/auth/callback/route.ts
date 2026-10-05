import {authClient} from '../../../lib/auth';
import {NextResponse} from 'next/server';
import {isOwnerEmail} from '../../../lib/access';
export async function GET(request:Request){
 const url=new URL(request.url),code=url.searchParams.get('code');
 if(code&&!url.searchParams.has('error')){
  try{const client=await authClient();const {error}=await client.auth.exchangeCodeForSession(code);
   if(!error){const {data:{user},error:validation}=await client.auth.getUser();
    if(!validation&&isOwnerEmail(user?.email))return NextResponse.redirect(new URL('/',url));
    await client.auth.signOut();return NextResponse.redirect(new URL('/login?error=owner',url));
   }
  }catch{/* Show a fixed message without leaking provider error details. */}
 }
 return NextResponse.redirect(new URL('/login?error=oauth',url));
}
