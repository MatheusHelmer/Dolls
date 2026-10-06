const fs=require('node:fs');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const http=require('node:http');
fs.mkdirSync('.layout-preview',{recursive:true});
fs.writeFileSync('.layout-preview/package.json','{"type":"commonjs"}');
const month=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}).slice(0,7);
const records=[{id:'account',kind:'account',data:{name:'Conta principal',amount:4250,source:'pluggy'}},...[
 ['Salário','income',6500,'Salário','05'],['Supermercado','expense',385.9,'Alimentação','06'],['Aluguel','expense',1800,'Moradia','02'],['Transporte','expense',145,'Transporte','04'],['Internet','expense',99.9,'Moradia','03']
].map(([name,type,amount,category,day],i)=>({id:'tx'+i,kind:'transaction',data:{name,type,amount,category,date:month+'-'+day,paid:true,account:'account',source:'pluggy'}}))];
fs.writeFileSync('.layout-preview/finance-summary.js',ts.transpileModule(fs.readFileSync('lib/finance-summary.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
for(const name of ['finance','banks','theme-toggle','card-bills']){
 let source=fs.readFileSync('app/'+name+'.tsx','utf8').replace('../lib/finance-summary','./finance-summary');
 if(name==='finance')source=source.replace('useState<RecordItem[]>([])','useState<RecordItem[]>('+JSON.stringify(records)+')').replace('[loading,setLoading]=useState(true)','[loading,setLoading]=useState(false)');
 if(name==='banks')source=source.replace('useState<Connection[]>([])',`useState<Connection[]>([{id:'demo',name:'Nubank',status:'UPDATED',syncedAt:'2026-10-06T12:00:00Z'}])`).replace('[configured,setConfigured]=useState(false)','[configured,setConfigured]=useState(true)').replace('[loading,setLoading]=useState(true)','[loading,setLoading]=useState(false)');
 fs.writeFileSync('.layout-preview/'+name+'.js',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText);
}
const Finance=require(require('node:path').resolve('.layout-preview/finance.js')).default;
const Banks=require(require('node:path').resolve('.layout-preview/banks.js')).default;
const css=['globals','design','refined','mobile','bills'].map(n=>fs.readFileSync('app/'+n+'.css','utf8')).join('\n').replace("@import 'tailwindcss';",'');
const shell=(body,dark=false)=>`<!doctype html><html lang="pt-BR" ${dark?'data-theme="dark"':''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Livre · Prévia do layout</title><style>${css}</style></head><body><div style="position:fixed;bottom:88px;right:12px;z-index:100;background:var(--surface-soft);color:var(--muted);border:1px solid var(--line);padding:6px 10px;border-radius:8px;font-size:11px">Prévia visual · dados de exemplo</div>${body}</body></html>`;
const overview=renderToStaticMarkup(React.createElement(Finance));
fs.writeFileSync('.layout-preview/overview.html',shell(overview));
fs.writeFileSync('.layout-preview/dark.html',shell(overview,true));
fs.writeFileSync('.layout-preview/banks.html',shell('<main style="max-width:1100px"><div class="page-top"><div><h1>Open Finance</h1><p class="subtitle">Conecte seus bancos e importe suas movimentações.</p></div></div>'+renderToStaticMarkup(React.createElement(Banks,{onChange:async()=>{}}))+'</main>'));
const CardBills=require(require('node:path').resolve('.layout-preview/card-bills.js')).default;
const card={id:'card',kind:'card',data:{name:'Nubank',source:'pluggy',billsStatus:'available',billsUpdatedAt:month+'-06T12:00:00Z',bills:[{id:'bill',dueDate:month+'-15',closingDate:month+'-08',total:1285.9,minimum:128.59,paymentsInCycle:0}]}};
const installments=[{id:'purchase',kind:'transaction',data:{card:'card',name:'Compra parcelada',type:'expense',amount:250,date:month+'-04',installment:{number:2,total:6}}}];
fs.writeFileSync('.layout-preview/cards.html',shell('<main><h1>Cartões</h1>'+renderToStaticMarkup(React.createElement(CardBills,{cards:[card],transactions:installments,month,shown:n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}))+'</main>'));
http.createServer((req,res)=>{const page=req.url==='/cards'?'cards':req.url==='/banks'?'banks':req.url==='/dark'?'dark':'overview';res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync('.layout-preview/'+page+'.html'));}).listen(3100,'127.0.0.1',()=>console.log('Layout preview: http://127.0.0.1:3100 (sample data only)'));
