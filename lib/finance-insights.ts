import {cashSummary,isCashMovement,type FinanceRecord} from './finance-summary';

const total=(rows:FinanceRecord[])=>rows.reduce((sum,row)=>sum+row.data.amount,0);
export function spendingForCategory(records:FinanceRecord[],month:string,category:string) {
  // Card purchases belong to consumption budgets; bill payments belong to cash flow.
  return records.filter(r=>r.kind==='transaction'&&r.data.date?.startsWith(month)&&r.data.category===category&&!r.data.internalTransfer&&!r.data.cardSettlement)
    .reduce((sum,r)=>sum+(r.data.type==='expense'?r.data.amount:r.data.card?-r.data.amount:0),0);
}
export function financialInsights(records:FinanceRecord[],month:string,today:string) {
  const summary=cashSummary(records,month,today);
  const settled=summary.cash.filter(r=>r.data.paid&&r.data.date<=today);
  const pending=summary.cash.filter(r=>!r.data.paid).sort((a,b)=>a.data.date.localeCompare(b.data.date));
  const payable=pending.filter(r=>r.data.type==='expense');
  const receivable=pending.filter(r=>r.data.type==='income');
  const futurePending=records.filter(r=>isCashMovement(r)&&!r.data.paid&&r.data.date>=today&&r.data.date<=month+'-31');
  const realizedIncome=total(settled.filter(r=>r.data.type==='income'));
  const realizedExpense=total(settled.filter(r=>r.data.type==='expense'));
  const history=Array.from({length:6},(_,i)=>{
    const date=new Date(month+'-15T12:00:00');date.setMonth(date.getMonth()-5+i);
    const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
    const values=cashSummary(records,key,today);
    return {month:key,income:values.income,expense:values.expense,net:values.income-values.expense,count:values.cash.length};
  });
  const budgets=records.filter(r=>r.kind==='budget').map(r=>{
    const used=spendingForCategory(records,month,r.data.category);
    return {...r,used,remaining:r.data.amount-used,percent:Math.round(used/r.data.amount*100)};
  });
  return {...summary,pending,payable:total(payable),receivable:total(receivable),overdue:pending.filter(r=>r.data.date<today),realizedIncome,realizedExpense,
    projected:month>=today.slice(0,7)?summary.balance+futurePending.reduce((sum,r)=>sum+(r.data.type==='income'?1:-1)*r.data.amount,0):null,
    history,budgets};
}
