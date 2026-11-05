import {istanbulToday} from '../../lib/finance/analytics';
import type {Entry, Ledger} from '../../lib/finance/ledger';

export const owner = '10000000-0000-0000-0000-000000000001';
export const client01 = '20000000-0000-0000-0000-000000000001';
export const client02 = '20000000-0000-0000-0000-000000000002';
const account = '30000000-0000-0000-0000-000000000001';
const otherAccount = '30000000-0000-0000-0000-000000000002';
const card01 = '40000000-0000-0000-0000-000000000001';
const card02 = '40000000-0000-0000-0000-000000000002';
const today = istanbulToday();
const prior = new Date(today + 'T00:00:00Z');
prior.setUTCDate(1); prior.setUTCMonth(prior.getUTCMonth() - 1);
function day(offset: number) {const date = new Date(today + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10);}
const debt: Entry = {id: '50000000-0000-0000-0000-000000000001', title: 'İşlem 01', type: 'debt', status: 'pending', amount: '1200000', currency: 'TRY', client_id: client01, client_account_id: account, credit_card_id: card01, card_rate: '1', fx_offset: '0', installment_count: 3, installment_current: 1, installment_group_id: '60000000-0000-0000-0000-000000000001', transaction_date: prior.toISOString().slice(0, 10), due_date: day(-1)};

export const sampleLedger: Ledger = {
  base: 'TRY', defaults: true,
  subscriptions: [
    {id: '80000000-0000-0000-0000-000000000001', name: 'Abonelik 01', provider: 'Abonelik 01', amount: '9999', currency: 'TRY', billing_cycle: 'monthly', next_billing_date: day(-1), billing_anchor_day: Number(day(-1).slice(8)), billing_anchor_month: Number(day(-1).slice(5, 7)), credit_card_id: card01, is_active: true, category: 'entertainment', notes: null},
    {id: '80000000-0000-0000-0000-000000000002', name: 'Abonelik 02', provider: 'Sağlayıcı 02', amount: '10001', currency: 'TRY', billing_cycle: 'yearly', next_billing_date: day(10), billing_anchor_day: Number(day(10).slice(8)), billing_anchor_month: Number(day(10).slice(5, 7)), credit_card_id: null, is_active: true, category: 'entertainment', notes: null},
    {id: '80000000-0000-0000-0000-000000000003', name: 'Abonelik 03', provider: null, amount: '90000', currency: 'TRY', billing_cycle: 'monthly', next_billing_date: day(-10), billing_anchor_day: 1, billing_anchor_month: 1, credit_card_id: null, is_active: false, category: 'other', notes: null},
    {id: '80000000-0000-0000-0000-000000000004', name: 'Abonelik 04', provider: 'Sağlayıcı 04', amount: '1200', currency: 'USD', billing_cycle: 'monthly', next_billing_date: day(3), billing_anchor_day: Number(day(3).slice(8)), billing_anchor_month: Number(day(3).slice(5, 7)), credit_card_id: card02, is_active: true, category: 'productivity', notes: null}
  ],
  clients: [{id: client01, name: 'Müşteri 01', email: null, phone: null, is_active: true}, {id: client02, name: 'Müşteri 02', email: null, phone: null, is_active: true}],
  accounts: [{id: account, client_id: client01, name: 'Alt hesap 01', is_active: true}, {id: otherAccount, client_id: client02, name: 'Alt hesap 02', is_active: true}],
  cards: [
    {id: card01, name: 'Kart 01', currency: 'TRY', credit_limit: '5000000', primary_user: 'Kullanıcı 01 ve müşteriler', is_active: true, statement_day: 20, due_day: 5},
    {id: card02, name: 'Kart 02', currency: 'TRY', credit_limit: '3000000', primary_user: 'Kullanıcı 01 ve müşteriler', is_active: true, statement_day: 10, due_day: 20},
    {id: '40000000-0000-0000-0000-000000000003', name: 'Kart 03', currency: 'TRY', credit_limit: '0', primary_user: 'Kullanıcı 02', is_active: true, statement_day: null, due_day: null}
  ],
  transactions: [debt,
    {...debt, id: '50000000-0000-0000-0000-000000000002', title: 'İşlem 02', amount: '600000', client_id: client02, client_account_id: otherAccount, transaction_date: today, due_date: day(5)},
    {...debt, id: '50000000-0000-0000-0000-000000000003', title: 'İşlem 03', type: 'expense', amount: '125000', client_id: null, client_account_id: null, transaction_date: today, due_date: day(10), installment_count: 1, installment_group_id: null},
    {...debt, id: '50000000-0000-0000-0000-000000000004', title: 'İşlem 04', amount: '10000', currency: 'USD', credit_card_id: null, transaction_date: today, installment_count: 1, installment_group_id: null},
    {...debt, id: '50000000-0000-0000-0000-000000000005', title: 'İşlem 05', type: 'expense', client_id: null, client_account_id: null, amount: '500', currency: 'USD', credit_card_id: card02, card_rate: null, installment_count: 1, installment_group_id: null}
  ],
  payments: [{id: '70000000-0000-0000-0000-000000000001', amount: '300000', currency: 'TRY', client_id: client01, client_account_id: account, transaction_id: debt.id, payment_date: today, payment_method: 'bank_transfer'}]
};
