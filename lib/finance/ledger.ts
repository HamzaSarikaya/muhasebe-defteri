import {convert, installments, type Currency} from './money';

type Named = {id: string; name: string; is_active: boolean};
export type Card = Named & {currency: Currency; primary_user: string | null; credit_limit: string; statement_day: number | null; due_day: number | null};
export type Client = Named & {email: string | null; phone: string | null};
export type Account = Named & {client_id: string};
export type Entry = {
  id: string; title: string; type: 'debt' | 'expense' | 'payment' | 'refund'; status: string;
  category?: string;
  amount: string; currency: Currency; credit_card_id: string | null; client_id: string | null;
  client_account_id: string | null; card_rate: string | null; fx_offset: string;
  installment_count: number; installment_current: number; installment_group_id: string | null;
  transaction_date: string; due_date: string | null;
};
export type Payment = {id: string; amount: string; currency: Currency; client_id: string;
  client_account_id: string | null; transaction_id: string | null; payment_date: string; payment_method: string};
export type Subscription = {
  id: string; name: string; provider: string | null; amount: string; currency: Currency;
  credit_card_id: string | null; billing_cycle: 'monthly' | 'yearly'; next_billing_date: string;
  billing_anchor_day: number; billing_anchor_month: number; is_active: boolean;
  category: 'entertainment' | 'productivity' | 'cloud' | 'other'; notes: string | null;
};
export type Ledger = {base: Currency; defaults: boolean; cards: Card[]; clients: Client[]; accounts: Account[]; transactions: Entry[]; payments: Payment[]; subscriptions: Subscription[]};

export function balances(data: Ledger) {
  const cards = new Map<string, bigint>();
  const unknownCards = new Set<string>();
  const allocated = new Map<string, bigint>();
  const accounts = new Map<string, bigint>();
  const clients = new Map<string, bigint>();
  function book(client: string | null, account: string | null, unit: Currency, amount: bigint) {
    if (client) {
      const key = client + '/' + unit;
      clients.set(key, (clients.get(key) ?? 0n) + amount);
    }
    if (account) {
      const key = account + '/' + unit;
      accounts.set(key, (accounts.get(key) ?? 0n) + amount);
    }
  }
  for (const p of data.payments) {
    const amount = BigInt(p.amount);
    book(p.client_id, p.client_account_id, p.currency, -amount);
    if (p.transaction_id) allocated.set(p.transaction_id, (allocated.get(p.transaction_id) ?? 0n) + amount);
  }
  for (const row of data.transactions) {
    if (row.status === 'cancelled') continue;
    const sign = row.type === 'refund' || row.type === 'payment' ? -1n : 1n;
    const amount = BigInt(row.amount);
    book(row.client_id, row.client_account_id, row.currency, sign * amount);
    if (!row.credit_card_id) continue;
    if (!row.card_rate) { unknownCards.add(row.credit_card_id); continue; }
    const start = BigInt(row.fx_offset);
    const paid = allocated.get(row.id) ?? 0n;
    const balance = convert(start + amount, row.card_rate) - convert(start + paid, row.card_rate);
    cards.set(row.credit_card_id, (cards.get(row.credit_card_id) ?? 0n) + sign * balance);
  }
  return {cards, clients, accounts, allocated, unknownCards};
}

export function dateOnly(value: string) {
  if (!/^[1-9]\d{3}-\d\d-\d\d$/.test(value)) throw new RangeError('date');
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) throw new RangeError('date');
  return value;
}

export function dueMonth(first: string, months: number, anchorDay?: number) {
  const date = new Date(dateOnly(first) + 'T00:00:00Z');
  const day = anchorDay ?? date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months + 1, 0);
  date.setUTCDate(Math.min(day, date.getUTCDate()));
  return dateOnly(date.toISOString().slice(0,10));
}

export function schedule(total: bigint, count: number, exchangeRate: string, firstDue: string, anchorDay?: number) {
  let offset = 0n;
  return installments(total, count).map((amount, i) => {
    const base = convert(offset + amount, exchangeRate) - convert(offset, exchangeRate);
    if (base <= 0n || base > 9223372036854775807n) throw new RangeError('conversion');
    const row = {amount: amount.toString(), amount_base: base.toString(), fx_offset: offset.toString(),
      installment_current: i + 1, installment_count: count, due_date: dueMonth(firstDue, i, anchorDay)};
    offset += amount;
    return row;
  });
}

// Purchases on the closing day belong to that statement. Clamp short months.
export function statementCycle(date: string, closingDay: number, paymentDay: number) {
  const month = dateOnly(date).slice(0, 7) + '-01';
  function cycleDay(offset: number, day: number) {
    const first = new Date(dueMonth(month, offset) + 'T00:00:00Z');
    first.setUTCMonth(first.getUTCMonth() + 1, 0);
    first.setUTCDate(Math.min(day, first.getUTCDate()));
    return first.toISOString().slice(0,10);
  }
  const monthOffset = date > cycleDay(0, closingDay) ? 1 : 0;
  const closing = cycleDay(monthOffset, closingDay);
  const due = cycleDay(monthOffset + (paymentDay <= closingDay ? 1 : 0), paymentDay);
  return {closing, due};
}

