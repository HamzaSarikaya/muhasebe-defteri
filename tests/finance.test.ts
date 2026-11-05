import assert from 'node:assert/strict';
import {test} from 'node:test';
import {convert, decimalAmount, formatMoney, installments, minor, rate} from '../lib/finance/money';
import {balances, dateOnly, dueMonth, schedule, statementCycle, type Entry, type Ledger, type Payment} from '../lib/finance/ledger';

test('minor units and formatting preserve the last cent through the BIGINT boundary', () => {
  const max = 9223372036854775807n;
  assert.equal(minor('92233720368547758,07'),max);
  assert.equal(decimalAmount(-max),'-92233720368547758.07');
  assert.equal(formatMoney(max,'USD','en-US'),'$92,233,720,368,547,758.07');
  assert.equal(formatMoney(-1n,'USD','en-US'),'-$0.01');
  for (const bad of ['92233720368547758.08','0.0001','NaN','Infinity','1e2','-1','1.000,00','0','']) assert.throws(() => minor(bad));
  for (const bad of ['0','0.0000001','1000000000000','-1','1e3']) assert.throws(() => rate(bad));
  assert.equal(convert(max,'999999999999.999999'),(max*999999999999999999n+500000n)/1000000n);
});

test('first installment absorbs the remainder and FX rows add up to the converted purchase', () => {
  const parts = installments(minor('22000'),12);
  assert.deepEqual(parts,[183337n,...Array(11).fill(183333n)]);
  for (let count=1;count<=120;count++) {
    const total=12503n;
    const rows=schedule(total,count,'1.275','2028-01-31');
    assert.equal(rows.reduce((n,row) => n+BigInt(row.amount),0n),total);
    assert.equal(rows.reduce((n,row) => n+BigInt(row.amount_base),0n),convert(total,'1.275'));
  }
  for (const count of [0,121,2.5,NaN]) assert.throws(() => installments(500n,count));
  assert.throws(() => installments(1n,2));
  assert.throws(() => schedule(2n,2,'0.1','2028-01-01'));
});

test('schedules clamp month ends independently and use the statement cutoff', () => {
  assert.deepEqual([0,1,2].map(i => dueMonth('2028-01-31',i)),['2028-01-31','2028-02-29','2028-03-31']);
  assert.deepEqual(statementCycle('2026-12-20',20,5),{closing:'2026-12-20',due:'2027-01-05'});
  assert.deepEqual(statementCycle('2026-12-21',20,5),{closing:'2027-01-20',due:'2027-02-05'});
  assert.deepEqual(statementCycle('2027-02-05',5,31),{closing:'2027-02-05',due:'2027-02-28'});
  assert.equal(schedule(100n,2,'1','2027-02-28',31)[1].due_date,'2027-03-31');
  assert.throws(() => dateOnly('2027-02-29'));
});

test('partial and full payments, advances and refunds conserve account and card balances', () => {
  const entry: Entry={id:'t',title:'Debt',type:'debt',status:'pending',amount:'3',currency:'USD',client_id:'c',client_account_id:'a',
    credit_card_id:'k',card_rate:'1.5',fx_offset:'0',transaction_date:'2026-11-05',due_date:null,installment_count:1,installment_current:1,installment_group_id:null};
  const payment: Payment={id:'p',client_id:'c',client_account_id:'a',transaction_id:'t',amount:'1',currency:'USD',payment_date:'2026-11-05',payment_method:'cash'};
  const data: Ledger={base:'TRY',defaults:false,cards:[],accounts:[],clients:[],transactions:[entry],payments:[payment]};
  assert.equal(balances(data).cards.get('k'),3n);
  assert.equal(balances(data).accounts.get('a/USD'),2n);
  data.payments.push({...payment,id:'p2',amount:'2'},{...payment,id:'p3',amount:'8',transaction_id:null});
  data.transactions.push({...entry,id:'refund',type:'refund',currency:'EUR',amount:'10',card_rate:'2'}, {...entry,id:'void',status:'cancelled'});
  const totals=balances(data);
  assert.equal(totals.cards.get('k'),-20n);
  assert.equal(totals.clients.get('c/USD'),-8n);
  assert.equal(totals.accounts.get('a/EUR'),-10n);
  data.transactions.push({...entry,id:'legacy',card_rate:null});
  assert.ok(balances(data).unknownCards.has('k'));
});

