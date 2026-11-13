import {dateOnly, type Entry, type Ledger, type Payment} from './ledger';
import {decimalAmount, type Currency} from './money';

export type Filters = {query: string; from: string; to: string; unit: Currency | ''};
export const emptyFilters: Filters = {query: '', from: '', to: '', unit: ''};
export function validRange(filters: Filters) {
  try {
    if (filters.from) dateOnly(filters.from);
    if (filters.to) dateOnly(filters.to);
    return !filters.from || !filters.to || filters.from <= filters.to;
  } catch {return false;}
}
function inRange(date: string, filters: Filters) {
  return (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);
}
const fold = (value: string) => value.normalize('NFKC').toLocaleLowerCase('tr');
export function activityIndex(data: Ledger) {
  return {clients: new Map(data.clients.map(row => [row.id, row])), accounts: new Map(data.accounts.map(row => [row.id, row])),
    cards: new Map(data.cards.map(row => [row.id, row])), entries: new Map(data.transactions.map(row => [row.id, row]))};
}
type ActivityIndex = ReturnType<typeof activityIndex>;
export function searchText(data: Ledger, row: Entry | Payment, index = activityIndex(data)) {
  const entry = 'title' in row ? row : index.entries.get(row.transaction_id ?? '');
  return [entry?.title, entry?.category, entry?.type, 'payment_method' in row ? row.payment_method : '',
    index.clients.get(row.client_id ?? '')?.name,
    index.accounts.get(row.client_account_id ?? '')?.name,
    index.cards.get(entry?.credit_card_id ?? '')?.name].filter(Boolean).join(' ');
}
export function filterActivity(data: Ledger, filters: Filters, index?: ActivityIndex) {
  if (!validRange(filters)) return {transactions: [], payments: []};
  const query = fold(filters.query.trim());
  const lookups = query ? index ?? activityIndex(data) : undefined;
  function match(row: Entry | Payment, date: string) {
    return (!filters.unit || row.currency === filters.unit) && inRange(date, filters) && (!query || fold(searchText(data, row, lookups)).includes(query));
  }
  return {transactions: data.transactions.filter(e => match(e, e.transaction_date)), payments: data.payments.filter(p => match(p, p.payment_date))};
}

export function report(data: Ledger, filters: Filters, today: string, unit: Currency, index = activityIndex(data)) {
  dateOnly(today);
  const filtered = filterActivity(data, {...filters, unit}, index);
  const query = fold(filters.query.trim());
  const categories = new Map<string, {charged: bigint; refunded: bigint; count: number}>();
  for (const row of filtered.transactions) {
    if (row.status === 'cancelled' || row.type === 'payment') continue;
    const key = row.category || 'personal';
    const value = categories.get(key) ?? {charged: 0n, refunded: 0n, count: 0};
    if (row.type === 'refund') value.refunded += BigInt(row.amount);
    else value.charged += BigInt(row.amount);
    value.count++;
    categories.set(key, value);
  }
  const rows = [...categories].map(([category, values]) => ({category, ...values, net: values.charged - values.refunded}))
    .sort((a, b) => a.net === b.net ? a.category.localeCompare(b.category) : a.net > b.net ? -1 : 1);
  const allocated = new Map<string, bigint>();
  for (const payment of data.payments) if (payment.transaction_id && payment.payment_date <= today)
    allocated.set(payment.transaction_id, (allocated.get(payment.transaction_id) ?? 0n) + BigInt(payment.amount));
  const calendar = validRange(filters) ? data.transactions.filter(row => row.currency === unit && row.status !== 'cancelled' &&
    (row.type === 'debt' || row.type === 'expense') && row.installment_count > 1 && row.transaction_date <= today && row.due_date &&
    inRange(row.due_date, filters) && (!query || fold(searchText(data, row, index)).includes(query)))
    .map(row => ({...row, remaining: BigInt(row.amount) - (allocated.get(row.id) ?? 0n)}))
    .filter(row => row.remaining > 0n).sort((a, b) => a.due_date!.localeCompare(b.due_date!) || a.id.localeCompare(b.id)) : [];
  return {categories: rows, calendar, charged: rows.reduce((sum, row) => sum + row.charged, 0n),
    refunded: rows.reduce((sum, row) => sum + row.refunded, 0n),
    collected: filtered.payments.reduce((sum, row) => sum + BigInt(row.amount), 0n)};
}

// Quote every field and neutralize spreadsheet formulas, including prefixed whitespace.
export function csvCell(value: string) {
  const safe = /^[\s\uFEFF]*[=+@-]/u.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function activityCsv(data: Ledger, filters: Filters) {
  if (!validRange(filters)) throw new RangeError('range');
  const index = activityIndex(data);
  const selected = filterActivity(data, filters, index);
  const rows = [
    ...selected.transactions.map(e => [e.id, e.transaction_date, e.type, e.title, e.category ?? 'personal', decimalAmount(BigInt(e.amount)), e.currency, e.status,
      index.clients.get(e.client_id ?? '')?.name ?? '', index.accounts.get(e.client_account_id ?? '')?.name ?? '',
      index.cards.get(e.credit_card_id ?? '')?.name ?? '', e.due_date ?? '', e.installment_current + '/' + e.installment_count, e.installment_group_id ?? '', e.card_rate ?? '', e.fx_offset, '']),
    ...selected.payments.map(p => [p.id, p.payment_date, 'collection', index.entries.get(p.transaction_id ?? '')?.title ?? '', '', decimalAmount(BigInt(p.amount)), p.currency, '',
      index.clients.get(p.client_id)?.name ?? '', index.accounts.get(p.client_account_id ?? '')?.name ?? '', '', '', '', '', '', '', p.transaction_id ?? ''])
  ].sort((a, b) => b[1].localeCompare(a[1]) || a[0].localeCompare(b[0]));
  return '\uFEFF' + [['id', 'date', 'type', 'title', 'category', 'amount', 'currency', 'status', 'client', 'account', 'card', 'due_date', 'installment', 'installment_group_id', 'card_rate', 'fx_offset_minor', 'transaction_id'], ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function backupJson(data: Ledger, exportedAt: string) {
  return JSON.stringify({format: 'muhasebe-ledger', version: 1, exportedAt, ledger: data}, null, 2);
}
