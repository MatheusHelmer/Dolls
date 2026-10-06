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
for(const name of ['finance','banks','theme-toggle']){
 let source=fs.readFileSync('app/'+name+'.tsx','utf8');
 if(name==='finance')source=source.replace('useState<RecordItem[]>([])','useState<RecordItem[]>('+JSON.stringify(records)+')').replace('[loading,setLoading]=useState(true)','[loading,setLoading]=useState(false)');
 if(name==='banks')source=source.replace('useState<Connection[]>([])',`useState<Connection[]>([{id:'demo',name:'Nubank',status:'UPDATED',syncedAt:'2026-10-06T12:00:00Z'}])`).replace('[configured,setConfigured]=useState(false)','[configured,setConfigured]=useState(true)').replace('[loading,setLoading]=useState(true)','[loading,setLoading]=useState(false)');
 fs.writeFileSync('.layout-preview/'+name+'.js',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText);
}
const Finance=require(require('node:path').resolve('.layout-preview/finance.js')).default;
const Banks=require(require('node:path').resolve('.layout-preview/banks.js')).default;
const css=['globals','design','refined','mobile'].map(n=>fs.readFileSync('app/'+n+'.css','utf8')).join('\n').replace("@import 'tailwindcss';",'');
const shell=(body,dark=false)=>`<!doctype html><html lang="pt-BR" ${dark?'data-theme="dark"':''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Livre · Prévia do layout</title><style>${css}</style></head><body><div style="position:fixed;bottom:88px;right:12px;z-index:100;background:var(--surface-soft);color:var(--muted);border:1px solid var(--line);padding:6px 10px;border-radius:8px;font-size:11px">Prévia visual · dados de exemplo</div>${body}</body></html>`;
const overview=renderToStaticMarkup(React.createElement(Finance));
fs.writeFileSync('.layout-preview/overview.html',shell(overview));
fs.writeFileSync('.layout-preview/dark.html',shell(overview,true));
fs.writeFileSync('.layout-preview/banks.html',shell('<main style="max-width:1100px"><div class="page-top"><div><h1>Open Finance</h1><p class="subtitle">Conecte seus bancos e importe suas movimentações.</p></div></div>'+renderToStaticMarkup(React.createElement(Banks,{onChange:async()=>{}}))+'</main>'));
http.createServer((req,res)=>{const page=req.url==='/banks'?'banks':req.url==='/dark'?'dark':'overview';res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync('.layout-preview/'+page+'.html'));}).listen(3099,'127.0.0.1',()=>console.log('Layout preview: http://127.0.0.1:3099 (sample data only)'));
