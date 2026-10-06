export type FinanceRecord={id:string;kind:string;data:any};

export function isInternalTransfer(payment:any):boolean {
 const payer=payment?.payer?.documentNumber,receiver=payment?.receiver?.documentNumber;
 if(!['PIX','TED','DOC'].includes(payment?.paymentMethod)||payer?.type!==receiver?.type||!['CPF','CNPJ'].includes(payer?.type))return false;
 const digits=(value:unknown)=>typeof value==='string'&&/^[\d.\-/]+$/.test(value)?value.replace(/\D/g,''):'';
 const a=digits(payer.value),b=digits(receiver.value),length=payer.type==='CPF'?11:14;
 return a.length===length&&a===b&&!/^([0-9])\1+$/.test(a);
}

export function isCashMovement(record:FinanceRecord):boolean {
 return record.kind==='transaction'&&!record.data.card&&!record.data.internalTransfer;
}

// Bank balances are snapshots. Manual entries linked to them must not be added again.
export function accountBalance(account:FinanceRecord,transactions:FinanceRecord[],today:string):number {
 if(account.data.source==='pluggy')return account.data.amount;
 return account.data.amount+transactions.filter(t=>t.data.source!=='pluggy'&&t.data.paid&&!t.data.card&&t.data.account===account.id&&t.data.date<=today).reduce((sum,t)=>sum+(t.data.type==='income'?1:-1)*t.data.amount,0);
}

export function cashSummary(records:FinanceRecord[],month:string,today:string){
 const accounts=records.filter(r=>r.kind==='account');
 const transactions=records.filter(r=>r.kind==='transaction');
 const monthly=transactions.filter(t=>t.data.date?.startsWith(month));
 const cash=monthly.filter(isCashMovement);
 const income=cash.filter(t=>t.data.type==='income').reduce((s,t)=>s+t.data.amount,0);
 const expense=cash.filter(t=>t.data.type==='expense').reduce((s,t)=>s+t.data.amount,0);
 const cardSpending=monthly.filter(t=>t.data.card&&!t.data.cardSettlement).reduce((s,t)=>s+(t.data.type==='expense'?1:-1)*t.data.amount,0);
 const unassigned=transactions.filter(t=>t.data.source!=='pluggy'&&t.data.paid&&!t.data.card&&!t.data.account&&t.data.date<=today).reduce((s,t)=>s+(t.data.type==='income'?1:-1)*t.data.amount,0);
 return {monthly,cash,income,expense,cardSpending,balance:accounts.reduce((s,a)=>s+accountBalance(a,transactions,today),0)+unassigned,internalTransfers:monthly.filter(t=>t.data.internalTransfer).length};
}

export type CardBill={id:string;dueDate:string;closingDate:string|null;total:number;minimum:number|null;paymentsInCycle:number};
export function normalizeBill(b:any):CardBill|null {
 if(typeof b.id!=='string'||typeof b.dueDate!=='string'||!/^\d{4}-\d{2}-\d{2}/.test(b.dueDate)||b.totalAmountCurrencyCode!=='BRL'||!Number.isFinite(b.totalAmount)||b.totalAmount<0)return null;
 return {id:b.id,dueDate:b.dueDate.slice(0,10),closingDate:typeof b.billClosingDate==='string'?b.billClosingDate.slice(0,10):null,total:b.totalAmount,minimum:Number.isFinite(b.minimumPaymentAmount)&&b.minimumPaymentAmount>=0?b.minimumPaymentAmount:null,paymentsInCycle:Array.isArray(b.payments)?b.payments.filter((p:any)=>p.currencyCode==='BRL'&&Number.isFinite(p.amount)&&p.amount>=0).reduce((s:number,p:any)=>s+p.amount,0):0};
}
