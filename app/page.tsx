import Finance from './finance';
import {owner,authClient} from '../lib/auth';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Home(){try{await owner()}catch{redirect('/login')}return <><Finance/><form action={async()=>{'use server';await (await authClient()).auth.signOut();redirect('/login')}} className="logout-form"><button className="secondary" type="submit">Sair da conta</button></form></>}
