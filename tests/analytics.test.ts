import assert from 'node:assert/strict';
import {test} from 'node:test';
import {accountProgress, dashboard, istanbulToday, percentage} from '../lib/finance/analytics';
import {balances, type Entry, type Ledger, type Payment} from '../lib/finance/ledger';

const entry: Entry = {id: 't', title: 'Hosting', amount: '10001', currency: 'TRY', type: 'debt', status: 'pending', client_id: 'c', client_account_id: 'a', credit_card_id: 'k', card_rate: '1', fx_offset: '0', installment_count: 3, installment_current: 1, installment_group_id: 'g', transaction_date: '2026-10-01', due_date: '2026-11-01'};
const payment: Payment = {id: 'p', amount: '3001', currency: 'TRY', client_id: 'c', client_account_id: 'a', transaction_id: 't', payment_date: '2026-11-03', payment_method: 'cash'};
function ledger(): Ledger {
  return {base: 'TRY', defaults: true, clients: [{id: 'c', name: 'Müşteri 01', is_active: true, email: null, phone: null}], accounts: [{id: 'a', client_id: 'c', name: 'Site', is_active: true}], cards: [{id: 'k', name: 'Kart 01', primary_user: null, currency: 'TRY', is_active: true, credit_limit: '20000', statement_day: null, due_day: null}], transactions: [{...entry}], payments: [{...payment}]};
}

test('dashboard reconciles partial collections, remaining installments and card shares', () => {
  const data = ledger();
  const result = dashboard(data, '2026-11-05');
  assert.deepEqual(result.metrics, [{unit: 'TRY', receivable: '7000', collection: '3001', pending: '7000', count: 1}]);
  assert.equal(result.cards[0].balance, String(balances(data).cards.get('k')));
  assert.equal(result.cards[0].usage, 35);
  assert.equal(result.cards[0].available, '13000');
  assert.deepEqual(result.cards[0].shares, [{client: 'c', amount: '7000'}]);
  assert.equal(result.upcoming[0].overdue, true);
  assert.equal(result.upcoming[0].remaining, '7000');
});

test('six-month trend applies payments on their own month and spans year boundaries', () => {
  const result = dashboard(ledger(), '2026-11-05');
  assert.deepEqual(result.trends[0].rows.slice(-2), [{month: '2026-10', debt: '10001', collected: '0'}, {month: '2026-11', debt: '7000', collected: '3001'}]);
  assert.deepEqual(dashboard(ledger(), '2027-02-01').trends[0].rows.map(row => row.month), ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
});

test('currencies stay separate, client advances do not erase other clients’ receivables', () => {
  const data = ledger();
  data.transactions.push({...entry, id: 'usd', currency: 'USD', amount: '20', credit_card_id: null});
  data.payments.push({...payment, id: 'advance', amount: '999999', transaction_id: null, client_id: 'other'});
  const result = dashboard(data, '2026-11-05');
  assert.equal(result.metrics[0].receivable, '7000');
  assert.equal(result.metrics[1].receivable, '20');
  assert.equal(result.metrics[1].collection, '0');
});

test('cancelled and future records are excluded; paid installments leave the due list', () => {
  const data = ledger();
  data.transactions.push({...entry, id: 'void', status: 'cancelled'}, {...entry, id: 'future', transaction_date: '2026-11-06'});
  data.payments.push({...payment, id: 'futurePayment', amount: '7000', payment_date: '2026-11-06'});
  assert.equal(dashboard(data, '2026-11-05').metrics[0].pending, '7000');
  const next = dashboard(data, '2026-11-06');
  assert.equal(next.upcoming.some(row => row.id === 't'), false);
  assert.equal(next.metrics[0].pending, '10001');
});

test('FX card shares conserve prefix rounding, absent rates remain unknown', () => {
  const data = ledger();
  data.transactions = [{...entry, amount: '1', card_rate: '1.5', fx_offset: '2', installment_current: 3}, {...entry, id: 'personal', client_id: null, amount: '7', type: 'expense', card_rate: '2'}];
  data.payments = [];
  let result = dashboard(data, '2026-11-05');
  assert.equal(result.cards[0].balance, '16');
  assert.equal(result.cards[0].shares.reduce((sum, row) => sum + BigInt(row.amount), 0n), 16n);
  data.transactions.push({...entry, id: 'missing', card_rate: null});
  result = dashboard(data, '2026-11-05');
  assert.equal(result.cards[0].unknown, true);
});

test('refunds and account credits reconcile without losing large minor amounts', () => {
  const data = ledger();
  data.transactions[0].amount = '9223372036854775807';
  data.transactions.push({...entry, id: 'refund', type: 'refund', amount: '7'});
  const result = accountProgress(data, 'c', 'a', 'TRY');
  assert.equal(result.remaining, 9223372036854772799n);
  assert.equal(result.credited, 3008n);
  assert.equal(dashboard(data, '2026-11-05').metrics[0].receivable, result.remaining.toString());
  assert.equal(percentage(120n, 100n), 100);
  assert.equal(percentage(-10n, 100n), 0);
  assert.equal(percentage(0n, 0n), null);
});

test('Istanbul date switches at UTC 21:00, and invalid cutoff dates are rejected', () => {
  assert.equal(istanbulToday(new Date('2026-11-04T20:59:59Z')), '2026-11-04');
  assert.equal(istanbulToday(new Date('2026-11-04T21:00:00Z')), '2026-11-05');
  assert.throws(() => dashboard(ledger(), '2026-02-30'));
});
