import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sampleLedger} from './fixtures/dashboard-data';
import {activityCsv, backupJson, csvCell, emptyFilters, filterActivity, report, validRange} from '../lib/finance/reports';
import {subscriptionLoad, subscriptionValues} from '../lib/finance/subscriptions';
import {istanbulToday} from '../lib/finance/analytics';

test('subscription equivalents round once per currency and exclude paused subscriptions', () => {
  assert.deepEqual(subscriptionLoad(sampleLedger.subscriptions, 'TRY'), {monthly: 10832n, yearly: 129989n, count: 2});
  assert.deepEqual(subscriptionLoad(sampleLedger.subscriptions, 'USD'), {monthly: 1200n, yearly: 14400n, count: 1});
  assert.equal(subscriptionLoad(sampleLedger.subscriptions.map(row => ({...row, amount: '9223372036854775807'})), 'TRY').yearly, 119903836479112085491n);
  assert.deepEqual(subscriptionLoad([], 'EUR'), {monthly: 0n, yearly: 0n, count: 0});
});

test('subscription input rejects malformed amounts, dates, cycles, status and oversized fields', () => {
  const valid = {name: 'Abonelik 01', provider: '', notes: '', amount: '12,01', currency: 'USD', cycle: 'monthly', category: 'cloud', nextDate: '2028-02-29', active: 'true', card: ''};
  const parse = (changes = {}) => subscriptionValues(key => ({...valid, ...changes})[key as keyof typeof valid] ?? '');
  assert.equal(parse().amount, '1201');
  for (const changes of [{name: ''}, {provider: 'x'.repeat(121)}, {amount: '0'}, {amount: '1.000,00'}, {nextDate: '2027-02-29'}, {cycle: 'weekly'}, {currency: 'GBP'}, {active: 'yes'}, {category: 'invalid'}]) assert.throws(() => parse(changes), RangeError);
});

test('search matches Turkish case, account and linked collection descriptions; ranges are inclusive', () => {
  assert.equal(filterActivity(sampleLedger, {...emptyFilters, query: 'işlem 01'}).transactions.length, 1);
  const filters = {...emptyFilters, query: 'ALT HESAP 01'};
  const selected = filterActivity(sampleLedger, filters);
  assert.ok(selected.transactions.length > 0);
  assert.equal(selected.payments.length, 1);
  const date = sampleLedger.payments[0].payment_date;
  assert.equal(filterActivity(sampleLedger, {...emptyFilters, from: date, to: date}).payments.length, 1);
  assert.equal(filterActivity(sampleLedger, {...emptyFilters, unit: 'EUR'}).transactions.length, 0);
  assert.equal(validRange({...emptyFilters, from: '2026-02-30'}), false);
  assert.equal(validRange({...emptyFilters, from: '2026-12-01', to: '2026-01-01'}), false);
  assert.deepEqual(filterActivity(sampleLedger, {...emptyFilters, from: 'invalid'}), {transactions: [], payments: []});
});

test('category analysis excludes cancellations, nets refunds and leaves collections separate', () => {
  const source = structuredClone(sampleLedger);
  source.transactions = [
    {...source.transactions[0], amount: '1001', category: 'hosting'},
    {...source.transactions[0], id: 'refund', type: 'refund', amount: '201', category: 'hosting'},
    {...source.transactions[0], id: 'cancelled', status: 'cancelled', amount: '99999', category: 'hosting'},
    {...source.transactions[0], id: 'payment', type: 'payment', amount: '10', category: 'hosting'}
  ];
  const result = report(source, emptyFilters, istanbulToday(), 'TRY');
  assert.deepEqual(result.categories, [{category: 'hosting', charged: 1001n, refunded: 201n, net: 800n, count: 2}]);
  assert.equal(result.collected, 300000n);
});

test('calendar uses due dates and all payments as of today, independently of activity date filters', () => {
  const source = structuredClone(sampleLedger);
  const row = source.transactions[0];
  row.due_date = '2027-03-31'; row.transaction_date = '2026-01-01'; row.amount = '10000';
  source.transactions = [row];
  source.payments = [{...source.payments[0], amount: '3000', payment_date: '2026-02-01'}, {...source.payments[0], id: 'future', amount: '7000', payment_date: '2027-04-01'}];
  const result = report(source, {...emptyFilters, from: '2027-03-01', to: '2027-03-31'}, '2027-03-01', 'TRY');
  assert.equal(result.charged, 0n);
  assert.equal(result.calendar[0].remaining, 7000n);
  source.transactions[0].status = 'cancelled';
  assert.equal(report(source, emptyFilters, '2027-03-01', 'TRY').calendar.length, 0);
});

test('CSV escapes delimiters, quotes, line breaks and spreadsheet formula prefixes', () => {
  for (const text of ['=1+1', '+CMD', '-1', '@SUM(A1)', '\t=1', '  =1', '\r\n=1']) assert.ok(csvCell(text).startsWith('"\''));
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
  const source = structuredClone(sampleLedger);
  source.transactions[0].amount = '9007199254740993';
  const csv = activityCsv(source, {...emptyFilters, query: 'ALT HESAP 01', unit: 'TRY'});
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('90071992547409.93'));
  assert.ok(csv.includes('"collection"'));
  assert.ok(!csv.includes('"USD"'));
  assert.throws(() => activityCsv(source, {...emptyFilters, from: 'invalid'}), RangeError);
});

test('versioned JSON backup preserves all rows, relationships and exact monetary strings', () => {
  const source = structuredClone(sampleLedger);
  source.subscriptions[0].amount = '9007199254740993';
  const result = JSON.parse(backupJson(source, '2026-11-05T12:00:00Z'));
  assert.equal(result.version, 1);
  assert.equal(result.format, 'muhasebe-ledger');
  assert.deepEqual(result.ledger, source);
  assert.equal(result.ledger.subscriptions[0].amount, '9007199254740993');
});
