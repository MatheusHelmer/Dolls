const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const ts=require('typescript');
const assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'livre-finance-'));
for(const name of ['finance-summary','pluggy-data'])fs.writeFileSync(path.join(dir,name+'.js'),ts.transpileModule(fs.readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
const {cashSummary,accountBalance,isInternalTransfer,normalizeBill}=require(path.join(dir,'finance-summary.js'));
const {normalizeTransaction}=require(path.join(dir,'pluggy-data.js'));
const account={id:'bank',kind:'account',data:{source:'pluggy',amount:1000,providerAccount:'bank-provider'}};
const card={id:'card',kind:'card',data:{source:'pluggy',providerAccount:'card-provider'}};
const tx=(id,type,amount,extra={})=>({id,kind:'transaction',data:{type,amount,paid:true,date:'2026-10-06',account:'bank',...extra}});
const entries=[account,card,tx('salary','income',2000),tx('bill-payment','expense',400),tx('purchase','expense',400,{account:'',card:'card'}),tx('card-refund','income',50,{account:'',card:'card'}),tx('self-out','expense',100,{internalTransfer:true}),tx('self-in','income',100,{internalTransfer:true}),tx('manual-snapshot','expense',60)];
const result=cashSummary(entries,'2026-10','2026-10-06');
assert.equal(result.income,2000);
assert.equal(result.expense,460);
assert.equal(result.cardSpending,350);
assert.equal(result.balance,1000); // Manual entries cannot modify a bank snapshot.
assert.equal(result.internalTransfers,2);
const manual={id:'manual',kind:'account',data:{amount:500}};
assert.equal(accountBalance(manual,[tx('x','expense',100,{account:'manual'}),tx('future','expense',70,{account:'manual',date:'2026-11-01'})],'2026-10-06'),400);
const participant=value=>({documentNumber:{type:'CPF',value}});
assert.equal(isInternalTransfer({paymentMethod:'PIX',payer:participant('123.456.789-01'),receiver:participant('12345678901')}),true);
assert.equal(isInternalTransfer({paymentMethod:'PIX',payer:participant('***.456.789-**'),receiver:participant('***.456.789-**')}),false);
assert.equal(isInternalTransfer({paymentMethod:'PIX',payer:participant('12345678901'),receiver:participant('12345678902')}),false);
assert.equal(isInternalTransfer({paymentMethod:'BOLETO',payer:participant('12345678901'),receiver:participant('12345678901')}),false);
const base={id:'provider-tx',currencyCode:'BRL',amount:80,date:'2026-10-06T00:00:00Z',type:'DEBIT',status:'POSTED'};
const payment=normalizeTransaction({...base,type:'CREDIT',amount:-80,operationType:'PAGAMENTO_FATURA'},card,'item');
assert.equal(payment.data.cardSettlement,true);
assert.equal(cashSummary([account,card,payment],'2026-10','2026-10-06').cardSpending,0);
const purchase=normalizeTransaction({...base,creditCardMetadata:{installmentNumber:2,totalInstallments:6,billId:'bill'}},card,'item');
assert.deepEqual(purchase.data.installment,{number:2,total:6});
assert.equal(purchase.data.billId,'bill');
assert.equal(normalizeTransaction({...base,currencyCode:'USD'},card,'item'),null);
assert.equal(normalizeTransaction({...base,creditCardMetadata:{installmentNumber:8,totalInstallments:6}},card,'item').data.installment,null);
const bill=normalizeBill({id:'bill',dueDate:'2026-10-15',totalAmount:500,totalAmountCurrencyCode:'BRL',payments:[{amount:80,currencyCode:'BRL'},{amount:20,currencyCode:'USD'}]});
assert.equal(bill.total,500);assert.equal(bill.paymentsInCycle,80);assert.equal(bill.minimum,null);
assert.equal(normalizeBill({id:'bill',dueDate:'2026-10-15',totalAmount:NaN,totalAmountCurrencyCode:'BRL'}),null);
assert.equal(normalizeBill({id:'bill',dueDate:'2026-10-15',totalAmount:10,totalAmountCurrencyCode:'USD'}),null);
console.log('Passed: cash flow, bank snapshots, internal transfers, card settlements, refunds, installments and bills.');
async function testSync(){
 fs.writeFileSync(path.join(dir,'pluggy.js'),ts.transpileModule(fs.readFileSync('lib/pluggy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
 fs.writeFileSync(path.join(dir,'storage.js'),'exports.isSupabase=()=>true;exports.sbStore=(action,payload)=>global.__livreTestStore(action,payload);');
 const oldFetch=global.fetch,oldKey=process.env.PLUGGY_VAULT_KEY;
 const id='00000000-0000-4000-8000-000000000001';let stored=null,mode='ok',encrypted;
 process.env.PLUGGY_VAULT_KEY=Buffer.alloc(32,1).toString('base64');
 const snapshot={connections:[{id,name:'Test bank'}],records:[{id:'pluggy:account:card-api',kind:'card',data:{bills:[{id:'previous-bill',dueDate:'2026-10-15',total:500}],billsUpdatedAt:'2026-10-01T00:00:00Z'}}]};
 global.__livreTestStore=async(action,payload)=>{if(action==='read')return snapshot;if(action==='credentials_read')return {encrypted};if(action==='bank_sync'){stored=payload;return {}};throw Error('Unexpected storage call')};
 global.fetch=async url=>{
  const request=new URL(url);let body;
  if(request.pathname==='/auth')body={apiKey:'test-key'};
  else if(request.pathname==='/items/'+id)body={status:'UPDATED',connector:{id:200}};
  else if(request.pathname==='/accounts')body={totalPages:1,results:[{id:'card-api',type:'CREDIT',currencyCode:'BRL',balance:500,creditData:{creditLimit:2000}}]};
  else if(request.pathname==='/v2/transactions'){if(mode==='transactions-failed')return Response.json({}, {status:502});body={results:[{...base,id:'test-purchase'}],next:null};}
  else if(request.pathname==='/bills'){if(mode==='bills-failed')return Response.json({}, {status:503});const page=request.searchParams.get('page');body={totalPages:2,results:[{id:'bill-'+page,dueDate:'2026-10-15',totalAmount:500,totalAmountCurrencyCode:'BRL'}]};}
  else throw Error('Unexpected URL');
  return Response.json(body);
 };
 try{
  const provider=require(path.join(dir,'pluggy.js'));encrypted=await provider.encryptCredentials({clientId:'test',clientSecret:'test'});
  let response=await provider.syncConnection(id);
  assert.equal(response.billsUnavailable,0);assert.equal(stored.records.find(r=>r.kind==='card').data.bills.length,2);
  assert.equal(response.transactions,1);
  mode='bills-failed';stored=null;response=await provider.syncConnection(id);
  const savedCard=stored.records.find(r=>r.kind==='card');assert.equal(response.billsUnavailable,1);assert.equal(savedCard.data.billsStatus,'unavailable');assert.equal(savedCard.data.bills[0].id,'previous-bill');assert.equal(savedCard.data.billsUpdatedAt,'2026-10-01T00:00:00Z');
  mode='transactions-failed';stored=null;await assert.rejects(()=>provider.syncConnection(id));assert.equal(stored,null);
  console.log('Passed: bill pagination, retained bills on outage, successful transaction import without bills, and no writes after transaction failure.');
 }finally{global.fetch=oldFetch;delete global.__livreTestStore;if(oldKey===undefined)delete process.env.PLUGGY_VAULT_KEY;else process.env.PLUGGY_VAULT_KEY=oldKey;}
}
testSync().catch(error=>{console.error(error);process.exitCode=1});
