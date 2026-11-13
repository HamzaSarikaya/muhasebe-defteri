import {balances, dateOnly, type Entry, type Ledger} from './ledger';
import {convert, currencies, type Currency} from './money';

export function istanbulToday(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Istanbul'}).format(now);
}

export function percentage(amount: bigint, total: bigint): number | null {
  if (total <= 0n) return null;
  return Number((amount < 0n ? 0n : amount > total ? total : amount) * 10000n / total) / 100;
}

export function cardRemainder(row: Entry, paid: bigint) {
  if (!row.card_rate) return null;
  const offset = BigInt(row.fx_offset);
  const sign = row.type === 'refund' || row.type === 'payment' ? -1n : 1n;
  return sign * (convert(offset + BigInt(row.amount), row.card_rate) - convert(offset + paid, row.card_rate));
}

export function dashboard(data: Ledger, today: string) {
  dateOnly(today);
  const current = {...data, transactions: data.transactions.filter(row => row.transaction_date <= today),
    payments: data.payments.filter(row => row.payment_date <= today)};
  const totals = balances(current);
  const active = current.transactions.filter(row => row.status !== 'cancelled');
  const cardEntries = new Map<string, Entry[]>();
  for (const row of active) if (row.credit_card_id) {
    const rows = cardEntries.get(row.credit_card_id) ?? [];
    rows.push(row); cardEntries.set(row.credit_card_id, rows);
  }
  const collections = new Map<string, bigint>();
  for (const row of current.payments) {
    const key = row.payment_date.slice(0, 7) + '/' + row.currency;
    collections.set(key, (collections.get(key) ?? 0n) + BigInt(row.amount));
  }
  const month = today.slice(0, 7);
  const units = [data.base, ...currencies.filter(unit => unit !== data.base && (active.some(row => row.currency === unit) || current.payments.some(row => row.currency === unit)))];
  const open = active.filter(row => (row.type === 'debt' || row.type === 'expense') && BigInt(row.amount) > (totals.allocated.get(row.id) ?? 0n));
  const metrics = units.map(unit => {
    let receivable = 0n;
    for (const [key, amount] of totals.clients) if (key.endsWith('/' + unit) && amount > 0n) receivable += amount;
    const collection = collections.get(month + '/' + unit) ?? 0n;
    const installments = open.filter(row => row.currency === unit && row.installment_count > 1);
    const pending = installments.reduce((sum, row) => sum + BigInt(row.amount) - (totals.allocated.get(row.id) ?? 0n), 0n);
    return {unit, receivable: receivable.toString(), collection: collection.toString(), pending: pending.toString(), count: installments.length};
  });
  const cards = data.cards.map(card => {
    const shares = new Map<string, bigint>();
    for (const row of cardEntries.get(card.id) ?? []) {
      const amount = cardRemainder(row, totals.allocated.get(row.id) ?? 0n);
      if (amount !== null) shares.set(row.client_id ?? '', (shares.get(row.client_id ?? '') ?? 0n) + amount);
    }
    const balance = totals.cards.get(card.id) ?? 0n;
    return {...card, balance: balance.toString(), available: (BigInt(card.credit_limit) - balance).toString(),
      unknown: totals.unknownCards.has(card.id), usage: percentage(balance, BigInt(card.credit_limit)),
      overLimit: balance > BigInt(card.credit_limit), shares: [...shares].map(([client, amount]) => ({client, amount: amount.toString()}))};
  });
  const months = Array.from({length: 6}, (_, index) => {
    const date = new Date(month + '-01T00:00:00Z');
    date.setUTCMonth(date.getUTCMonth() - 5 + index);
    return date.toISOString().slice(0, 7);
  });
  // Trends need client receivables only. Build each monthly snapshot once for
  // all currencies, without recalculating card FX and account balances.
  const history = months.map(month => {
    const cutoff = month === today.slice(0, 7) ? today : month + '-31';
    const clients = new Map<string, bigint>();
    for (const row of active) if (row.client_id && row.transaction_date <= cutoff) {
      const key = row.client_id + '/' + row.currency;
      const sign = row.type === 'refund' || row.type === 'payment' ? -1n : 1n;
      clients.set(key, (clients.get(key) ?? 0n) + sign * BigInt(row.amount));
    }
    for (const row of current.payments) if (row.payment_date <= cutoff) {
      const key = row.client_id + '/' + row.currency;
      clients.set(key, (clients.get(key) ?? 0n) - BigInt(row.amount));
    }
    const debts = new Map<string, bigint>();
    for (const [key, amount] of clients) if (amount > 0n) {
      const unit = key.slice(key.lastIndexOf('/') + 1);
      debts.set(unit, (debts.get(unit) ?? 0n) + amount);
    }
    return {month, debts};
  });
  const trends = units.map(unit => ({unit, rows: history.map(({month, debts}) => ({month,
    debt: (debts.get(unit) ?? 0n).toString(), collected: (collections.get(month + '/' + unit) ?? 0n).toString()}))}));
  // Original purchase values, grouped by person, stay in their own currency.
  const spending = units.map(unit => {
    const groups = new Map<string, bigint>();
    for (const row of active.filter(row => row.currency === unit && row.transaction_date.startsWith(month) && row.type !== 'payment')) {
      const key = row.client_id ?? '';
      groups.set(key, (groups.get(key) ?? 0n) + (row.type === 'refund' ? -1n : 1n) * BigInt(row.amount));
    }
    return {unit, rows: [...groups].map(([client, amount]) => ({client, amount: amount.toString()}))};
  });
  const upcoming = open.filter(row => row.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!) || a.id.localeCompare(b.id)).slice(0, 5)
    .map(row => ({...row, remaining: (BigInt(row.amount) - (totals.allocated.get(row.id) ?? 0n)).toString(), overdue: row.due_date! < today}));
  return {units, metrics, cards, trends, spending, upcoming};
}

export function accountProgress(data: Ledger, client: string, account: string | null, unit: Currency) {
  const rows = data.transactions.filter(row => row.client_id === client && row.client_account_id === account && row.currency === unit && row.status !== 'cancelled');
  const charged = rows.filter(row => row.type === 'debt' || row.type === 'expense').reduce((sum, row) => sum + BigInt(row.amount), 0n);
  const credited = rows.filter(row => row.type === 'payment' || row.type === 'refund').reduce((sum, row) => sum + BigInt(row.amount), 0n)
    + data.payments.filter(row => row.client_id === client && row.client_account_id === account && row.currency === unit).reduce((sum, row) => sum + BigInt(row.amount), 0n);
  return {charged, credited, remaining: charged - credited, progress: percentage(credited, charged)};
}
