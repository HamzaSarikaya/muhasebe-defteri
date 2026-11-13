import type {Ledger} from '../../lib/finance/ledger';
import {currencies} from '../../lib/finance/money';

// Deterministic, fictitious records for performance and regression checks.
export function largeLedger(count = 10000): Ledger {
  const id = (group: number, n: number) => `${group}0000000-0000-0000-0000-${String(n + 1).padStart(12, '0')}`;
  const data: Ledger = {base: 'TRY', defaults: true, subscriptions: [],
    clients: Array.from({length: 100}, (_, i) => ({id: id(2, i), name: `Müşteri ${i + 1}`, email: null, phone: null, is_active: true})),
    accounts: Array.from({length: 200}, (_, i) => ({id: id(3, i), client_id: id(2, i % 100), name: `Alt hesap ${i + 1}`, is_active: true})),
    cards: Array.from({length: 10}, (_, i) => ({id: id(4, i), name: `Kart ${i + 1}`, currency: 'TRY', credit_limit: '50000000', primary_user: null, statement_day: 20, due_day: 5, is_active: true})),
    transactions: [], payments: []};
  for (let i = 0; i < count; i++) {
    const date = new Date('2026-01-01T00:00:00Z'); date.setUTCDate(date.getUTCDate() + i % 340);
    const row: Ledger['transactions'][number] = {id: id(5, i), title: `İşlem ${String(i + 1).padStart(5, '0')}`, category: ['hosting', 'market', 'other'][i % 3],
      type: i % 19 === 0 ? 'refund' : i % 23 === 0 ? 'payment' : 'debt', status: i % 29 === 0 ? 'cancelled' : 'pending', amount: String(10001 + i * 37),
      currency: currencies[i % 3], client_id: id(2, i % 100), client_account_id: id(3, i % 200), credit_card_id: id(4, i % 10),
      card_rate: i % 31 === 0 ? null : ['1', '35.123456', '38.5'][i % 3], fx_offset: String(i % 17),
      installment_count: 3, installment_current: 1, installment_group_id: id(6, i), transaction_date: date.toISOString().slice(0, 10), due_date: '2026-11-20'};
    data.transactions.push(row);
    if (i % 3 === 0 && row.type === 'debt' && row.status !== 'cancelled') data.payments.push({id: id(7, i), amount: String(1000 + i), currency: row.currency,
      client_id: row.client_id!, client_account_id: row.client_account_id, transaction_id: row.id, payment_date: row.transaction_date, payment_method: 'cash'});
  }
  return data;
}
