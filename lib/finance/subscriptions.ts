import {dateOnly} from './ledger';
import type {Subscription} from './ledger';
import {currency, minor, type Currency} from './money';

export function subscriptionValues(field: (key: string) => string) {
  const name = field('name');
  const provider = field('provider');
  const notes = field('notes');
  const billing_cycle = field('cycle');
  const category = field('category');
  if (!name || name.length > 120 || provider.length > 120 || notes.length > 2000 ||
    !['monthly', 'yearly'].includes(billing_cycle) || !['entertainment', 'productivity', 'cloud', 'other'].includes(category) ||
    !['true', 'false'].includes(field('active'))) throw new RangeError('subscription');
  return {name, provider: provider || null, notes: notes || null, amount: minor(field('amount')).toString(),
    currency: currency(field('currency')), billing_cycle: billing_cycle as Subscription['billing_cycle'],
    category: category as Subscription['category'], next_billing_date: dateOnly(field('nextDate')),
    is_active: field('active') === 'true', credit_card_id: field('card') || null};
}

// Sum annual obligations first, then round the displayed monthly equivalent once.
// These are normalized costs, not a forecast of actual charges in a given month.
export function subscriptionLoad(rows: Subscription[], unit: Currency) {
  const active = rows.filter(row => row.is_active && row.currency === unit);
  const yearly = active.reduce((sum, row) => sum + BigInt(row.amount) * (row.billing_cycle === 'monthly' ? 12n : 1n), 0n);
  return {yearly, monthly: (yearly + 6n) / 12n, count: active.length};
}
