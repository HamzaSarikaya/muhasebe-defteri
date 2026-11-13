import assert from 'node:assert/strict';
import {test} from 'node:test';
import Decimal from 'decimal.js';
import {convert, decimalAmount, minor, rate} from '../lib/finance/money';
import {dashboard} from '../lib/finance/analytics';
import {balances} from '../lib/finance/ledger';
import {activityCsv, emptyFilters, filterActivity} from '../lib/finance/reports';
import {largeLedger} from './fixtures/large-ledger';

test('fixed-point conversion matches independent decimal arithmetic including negative half ties', () => {
  const Exact = Decimal.clone({precision: 60, rounding: Decimal.ROUND_HALF_UP});
  const amounts = [0n, 1n, -1n, 9223372036854775807n, -9223372036854775807n];
  let seed = 42;
  for (let i = 0; i < 300; i++) {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; amounts.push(BigInt(seed) * BigInt(i - 150));}
  for (const amount of amounts) {
    assert.equal(decimalAmount(amount), new Exact(amount.toString()).div(100).toFixed(2));
    for (const value of ['1', '0.5', '1.234567', '00035,120000', '0.000001', '999999999999.999999'])
      assert.equal(convert(amount, value), BigInt(new Exact(amount.toString()).times(value.replace(',', '.')).toFixed(0)));
  }
  assert.equal(rate('00035,120000'), '35.12');
  assert.equal(minor('00012,3'), 1230n);
  assert.equal(minor('0', true), 0n);
});

test('six monthly snapshots reconcile all currencies with independent ledger balances', () => {
  const data = largeLedger(2000);
  data.payments.push({...data.payments[0], id: 'advance', amount: '999999999999999999', transaction_id: null});
  const today = '2026-11-13';
  for (const trend of dashboard(data, today).trends) for (const row of trend.rows) {
    const cutoff = row.month === today.slice(0, 7) ? today : row.month + '-31';
    const clients = balances({...data, transactions: data.transactions.filter(e => e.transaction_date <= cutoff), payments: data.payments.filter(p => p.payment_date <= cutoff)}).clients;
    let expected = 0n;
    for (const [key, amount] of clients) if (key.endsWith('/' + trend.unit) && amount > 0n) expected += amount;
    assert.equal(row.debt, expected.toString());
  }
});

test('large activity searches linked payments and exports every matching row', () => {
  const data = largeLedger(1200);
  assert.equal(filterActivity(data, emptyFilters).transactions.length, 1200);
  const selected = filterActivity(data, {...emptyFilters, query: 'ALT HESAP 55'});
  assert.ok(selected.transactions.length > 0);
  assert.ok(selected.transactions.every(row => row.client_account_id === data.accounts[54].id));
  const query = {...emptyFilters, query: 'İŞLEM 00004'};
  assert.equal(filterActivity(data, query).payments.length, 1);
  const csv = activityCsv(data, emptyFilters);
  assert.equal(csv.split('\r\n').length, 1200 + data.payments.length + 1);
  assert.ok(csv.includes('İşlem 01200'));
});
