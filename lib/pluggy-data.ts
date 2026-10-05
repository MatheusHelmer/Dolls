export type BankRecord={id:string;kind:string;data:any};
export function normalizeAccount(a:any,itemId:string,label:string,now:string):BankRecord|null {
 if(a.currencyCode!=='BRL'||!['BANK','CREDIT'].includes(a.type)||!a.id)return null;
 const card=a.type==='CREDIT';
 return {id:'pluggy:account:'+a.id,kind:card?'card':'account',data:{name:String(a.name||label).slice(0,120),amount:card?(Number.isFinite(a.creditData?.creditLimit)?a.creditData.creditLimit:0):(Number.isFinite(a.balance)?a.balance:0),source:'pluggy',sourceItem:itemId,providerAccount:a.id,updatedAt:now,balance:a.balance??null,availableLimit:a.creditData?.availableCreditLimit??null,due:a.creditData?.balanceDueDate?.slice(8,10)||null,closing:a.creditData?.balanceCloseDate?.slice(8,10)||null}};
}
export function normalizeTransaction(t:any,account:BankRecord,itemId:string,category='Outros'):BankRecord|null {
 if(!t.id||t.currencyCode!=='BRL'||!Number.isFinite(t.amount)||!t.date||!['CREDIT','DEBIT'].includes(t.type))return null;
 // Credit-card bill settlements are already represented by the debit in the bank account.
 if(account.kind==='card'&&['PAGAMENTO','PAGAMENTO_FATURA'].includes(t.operationType))return null;
 const income=t.type==='CREDIT';
 return {id:'pluggy:tx:'+t.id,kind:'transaction',data:{name:String(t.description||'Lançamento bancário').slice(0,120),amount:Math.abs(t.amount),date:t.date.slice(0,10),type:income?'income':'expense',category,paid:t.status==='POSTED',account:account.kind==='account'?account.id:'',card:account.kind==='card'?account.id:'',source:'pluggy',sourceItem:itemId,providerAccount:account.data.providerAccount,providerTransaction:t.id}};
}
export function nextPage(next:unknown,accountId:string):string|null {
 if(next===null||next===undefined)return null;
 if(typeof next!=='string'||!next.startsWith('?')||next.length>5000)throw Error('Resposta de paginação inválida.');
 const p=new URLSearchParams(next);
 if(p.get('accountId')!==accountId||!p.get('after'))throw Error('Resposta de paginação inválida.');
 return '/v2/transactions'+next;
}
