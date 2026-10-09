const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),ts=require('typescript'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'livre-insights-'));
for(const name of ['finance-summary','finance-insights'])fs.writeFileSync(path.join(dir,name+'.js'),ts.transpileModule(fs.readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
const {financialInsights,spendingForCategory}=require(path.join(dir,'finance-insights.js'));
const tx=(id,type,amount,extra={})=>({id,kind:'transaction',data:{name:id,type,amount,category:'Compras',date:'2026-10-09',paid:true,...extra}});
const records=[{id:'bank',kind:'account',data:{source:'pluggy',amount:1000}},tx('received','income',500),tx('paid','expense',100),tx('late','expense',50,{paid:false,date:'2026-10-01'}),tx('upcoming','expense',200,{paid:false,date:'2026-10-15'}),tx('futureIncome','income',300,{paid:false,date:'2026-10-20'}),tx('nextMonth','expense',900,{paid:false,date:'2026-11-01'}),tx('futurePaid','income',700,{date:'2026-10-25'}),tx('purchase','expense',150,{card:'card'}),tx('refund','income',20,{card:'card'}),tx('settlement','expense',130,{card:'card',cardSettlement:true}),tx('transfer','expense',80,{internalTransfer:true}),{id:'budget',kind:'budget',data:{category:'Compras',amount:300}}];
const info=financialInsights(records,'2026-10','2026-10-09');
assert.equal(info.realizedIncome,500);assert.equal(info.realizedExpense,100);
assert.equal(info.payable,250);assert.equal(info.receivable,300);assert.equal(info.overdue.length,1);
assert.equal(info.balance,1320);assert.equal(info.projected,1420); // Future pending only; late entries need review.
assert.equal(info.cardSpending,130);assert.equal(spendingForCategory(records,'2026-10','Compras'),480);
assert.equal(info.budgets[0].percent,160);assert.equal(info.budgets[0].remaining,-180);
assert.equal(info.history.length,6);assert.equal(info.history[0].month,'2026-05');
assert.equal(financialInsights(records,'2026-09','2026-10-09').projected,null);
assert.equal(financialInsights([],'2027-01','2027-01-01').history[0].month,'2026-08');
console.log('Passed: realized totals, late and upcoming entries, projection boundaries, card refunds, consumption budgets, six-month history and year boundary.');
