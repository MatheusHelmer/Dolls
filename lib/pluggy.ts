import {isSupabase,sbStore} from './storage';
const env=process.env;
import {normalizeAccount,normalizeTransaction,nextPage} from './pluggy-data';
export class BankError extends Error{constructor(message:string,public status=400){super(message)}}
export function checkOrigin(request:Request){const origin=request.headers.get('origin');if(origin!==new URL(request.url).origin)throw new BankError('Reabra o Livre para continuar.',403)}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validId(id:unknown):id is string{return typeof id==='string'&&uuid.test(id)}
async function key(){if(!env.PLUGGY_VAULT_KEY)throw new BankError('A configuração segura está indisponível.',503);return crypto.subtle.importKey('raw',Uint8Array.from(atob(env.PLUGGY_VAULT_KEY),x=>x.charCodeAt(0)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
const encode=(a:Uint8Array)=>btoa(Array.from(a,x=>String.fromCharCode(x)).join(''));
export async function encryptCredentials(credentials:{clientId:string,clientSecret:string}){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),new TextEncoder().encode(JSON.stringify(credentials)));return JSON.stringify({iv:encode(iv),data:encode(new Uint8Array(bytes))})}
export async function getCredentials(){const row:any=await sbStore('credentials_read');if(!row)throw new BankError('Configure o Client ID e o Client Secret primeiro.',409);const encrypted=JSON.parse(row.encrypted);const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(encrypted.iv),x=>x.charCodeAt(0))},await key(),Uint8Array.from(atob(encrypted.data),x=>x.charCodeAt(0)));return JSON.parse(new TextDecoder().decode(bytes))}
export async function remote(path:string,apiKey?:string,body?:unknown){
 const res=await fetch('https://api.pluggy.ai'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(apiKey?{'X-API-KEY':apiKey}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(!res.ok){if(res.status===401||res.status===403)throw new BankError('A Pluggy recusou o acesso. Confira as credenciais da aplicação demo e a autorização do Meu Pluggy.',401);if(res.status===404)throw new BankError('Item não encontrado. Use o ID da conexão MeuPluggy na aplicação demo.',404);if(res.status===429)throw new BankError('Limite de consultas atingido. Aguarde antes de tentar novamente.',429);throw new BankError('A Pluggy está indisponível. Tente novamente mais tarde.',502)}
 return await res.json() as any;
}
export async function authenticate(credentials?:{clientId:string,clientSecret:string}){const data=await remote('/auth',undefined,credentials||await getCredentials());if(!data.apiKey)throw new BankError('Não foi possível autenticar na Pluggy.',502);return data.apiKey as string}
export async function verifyItem(id:string,apiKey:string){if(!validId(id))throw new BankError('Informe um Item ID válido.');const item=await remote('/items/'+id,apiKey);if(item.connector?.id!==200)throw new BankError('Use somente a conexão MeuPluggy (conector 200). Outros conectores podem exigir um plano pago.');return item}
export async function syncConnection(id:string){
 const snapshot=isSupabase()?await sbStore('read'):null;const link:any=snapshot?snapshot.connections.find((r:any)=>r.id===id):null;if(!link)throw new BankError('Conexão não cadastrada.',404);
 const apiKey=await authenticate(),item=await verifyItem(id,apiKey);
 if(!['UPDATED','PARTIAL_SUCCESS'].includes(item.status))throw new BankError('A conexão ainda não está pronta. Verifique o Meu Pluggy e tente depois.',409);
 const now=new Date().toISOString(),from=new Date(Date.now()-90*86400000).toISOString().slice(0,10);
 const old:any={results:[]};
 const categories=new Map<string,string>(snapshot?snapshot.records.filter((r:any)=>r.kind==='transaction').map((r:any)=>[r.id,r.data.category]):old.results.map((r:any)=>[r.id,JSON.parse(r.data).category]));
 const rows:any[]=[];let page=1,totalPages=1,requests=0,skipped=0;
 do{const d=await remote('/accounts?itemId='+id+'&page='+page+'&pageSize=500',apiKey);totalPages=d.totalPages||1;if(!Array.isArray(d.results))throw new BankError('Resposta de contas inválida.',502);rows.push(...d.results);page++;if(page>20&&page<=totalPages)throw new BankError('Há contas demais para uma única importação.',422)}while(page<=totalPages);
 const imports:any[]=[];let txCount=0;
 for(const a of rows){const account=normalizeAccount(a,id,link.name,now);if(!account){skipped++;continue}imports.push(account);
 let path:string|null='/v2/transactions?accountId='+encodeURIComponent(a.id)+'&dateFrom='+from;
 const visited=new Set<string>();while(path){if(visited.has(path)||++requests>45)throw new BankError('Histórico muito grande para uma importação. Nenhum dado desta tentativa foi alterado.',422);visited.add(path);const d=await remote(path,apiKey);if(!Array.isArray(d.results))throw new BankError('Resposta de lançamentos inválida.',502);for(const t of d.results){const record=normalizeTransaction(t,account,id,categories.get('pluggy:tx:'+t.id));if(record){imports.push(record);txCount++;if(txCount>2500)throw new BankError('Há mais de 2.500 lançamentos nesta conexão. Nenhum dado desta tentativa foi alterado.',422)}}path=nextPage(d.next,a.id)}
 }
 // Replace only this connection's imported snapshot. Keep manual data and other connections intact.
 await sbStore('bank_sync',{id,records:imports,syncedAt:now,status:item.status,accounts:imports.filter(r=>r.kind!=='transaction').length,transactions:txCount});
 return {accounts:imports.filter(r=>r.kind!=='transaction').length,transactions:txCount,skipped,syncedAt:now,partial:item.status==='PARTIAL_SUCCESS'};
}
export function bankError(e:unknown){if(e instanceof BankError)return Response.json({error:e.message},{status:e.status,headers:{'Cache-Control':'no-store'}});console.error('Bank operation failed',e instanceof Error?e.name:'Unknown');return Response.json({error:'Não foi possível concluir. Seus dados anteriores foram preservados.'},{status:503,headers:{'Cache-Control':'no-store'}})}

