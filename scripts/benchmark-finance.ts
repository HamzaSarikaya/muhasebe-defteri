import {performance} from 'node:perf_hooks';
import {largeLedger} from '../tests/fixtures/large-ledger';
import {dashboard} from '../lib/finance/analytics';
import {activityCsv, emptyFilters, filterActivity, report} from '../lib/finance/reports';
import {formatMoney} from '../lib/finance/money';

const data = largeLedger(Number(process.argv[2] ?? 10000));
const operations = {
  dashboard: () => dashboard(data, '2026-11-13'),
  filterEmpty: () => filterActivity(data, emptyFilters),
  filterSearch: () => filterActivity(data, {...emptyFilters, query: 'müşteri 55'}),
  report: () => report(data, emptyFilters, '2026-11-13', 'TRY'),
  csv: () => activityCsv(data, emptyFilters),
  format: () => data.transactions.map(row => formatMoney(row.amount, row.currency, 'tr'))
};
const results: Record<string, number> = {};
for (const [name, run] of Object.entries(operations)) {
  run();
  const times = Array.from({length: 5}, () => {const start = performance.now(); run(); return performance.now() - start;}).sort((a, b) => a - b);
  results[name] = Number(times[2].toFixed(2));
}
console.log(JSON.stringify({transactions: data.transactions.length, payments: data.payments.length, medianMilliseconds: results}, null, 2));
