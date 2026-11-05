'use server';

import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {currency, minor, rate} from './money';
import {dateOnly, schedule, statementCycle} from './ledger';

export type Result = 'saved' | 'invalid' | 'session' | 'conflict' | 'unavailable';
export async function authenticate(signOut: boolean, data: FormData): Promise<Result> {
  const db = await createClient();
  const {error} = signOut ? await db.auth.signOut({scope: 'local'}) :
    await db.auth.signInWithPassword({email: String(data.get('email')).trim(), password: String(data.get('password'))});
  if (error) return 'session';
  revalidatePath('/', 'layout');
  return 'saved';
}

export async function saveRecord(owner: string, action: string, requestId: string, data: FormData): Promise<Result> {
  const db = await createClient();
  const {data: {user}} = await db.auth.getUser();
  if (!user || user.id !== owner) return 'session';
  const field = (name: string) => String(data.get(name) ?? '').trim();
  const id = field('id');
  const namedTables = {card: 'credit_cards', client: 'clients', account: 'client_accounts'} as const;
  const check = (result: {error: {code?: string} | null}) => { if (result.error) throw result.error; };
  try {
    if (action === 'defaults') check(await db.rpc('install_ledger_defaults'));
    else if (action === 'card' || action === 'client' || action === 'account') {
      const name = field('name');
      if (!name || name.length > 120) return 'invalid';
      let values: Record<string, unknown> = {name};
      if (action === 'card') values = {...values, ...(!id && {bank_name: name}), primary_user: field('holder') || null,
        credit_limit: minor(field('limit'), true).toString(), statement_day: field('statement') || null,
        due_day: field('due') || null, ...(!id && {currency: currency(field('currency'))})};
      if (action === 'client') values = {...values, email: field('email') || null, phone: field('phone') || null};
      if (action === 'account' && !id) values.client_id = field('client');
      const table = db.from(namedTables[action]);
      check(id ? await table.update(values).eq('user_id',owner).eq('id',id).select('id').single()
        : await table.insert({...values, user_id: owner, id: requestId}));
    } else if (action === 'remove') {
      const table = {card:'credit_cards', client:'clients', account:'client_accounts', payment:'payments'}[field('kind')];
      if (!table) return 'invalid';
      check(await db.from(table).delete().eq('user_id',owner).eq('id',id).select('id').single());
    } else if (action === 'entry') {
      const unit = currency(field('currency'));
      const accountId = field('account') || null;
      const cardId = field('card') || null;
      const credit = field('type') === 'debt';
      if (!['debt','expense'].includes(field('type'))) return 'invalid';
      if (credit ? !accountId : !cardId) return 'invalid';
      const profile = await db.from('profiles').select('base_currency').eq('id',owner).single();
      check(profile);
      const base = currency(profile.data!.base_currency);
      const fx = unit === base ? '1' : rate(field('rate'));
      let clientId: string | null = null;
      if (credit) {
        const account = await db.from('client_accounts').select('client_id').eq('id',accountId!).eq('is_active',true).single();
        check(account);
        clientId = account.data!.client_id;
      }
      let cardRate: string | null = null;
      const date = dateOnly(field('date'));
      let defaultDue = date;
      let anchorDay: number | undefined;
      if (cardId) {
        const card = await db.from('credit_cards').select('currency,statement_day,due_day').eq('id',cardId).eq('is_active',true).single();
        check(card);
        const cardUnit = card.data!.currency;
        if (card.data!.statement_day && card.data!.due_day) {
          defaultDue = statementCycle(date, card.data!.statement_day, card.data!.due_day).due;
          anchorDay = card.data!.due_day;
        }
        cardRate = cardUnit === unit ? '1' : cardUnit === base ? fx : rate(field('cardRate'));
      }
      const firstDue = dateOnly(field('due') || defaultDue);
      if (firstDue < date) return 'invalid';
      const count = Number(field('count'));
      const rows = schedule(minor(field('amount')), count, fx, firstDue, field('due') ? undefined : anchorDay);
      // A single INSERT commits every installment or none. The first PK also guards retries.
      check(await db.from('transactions').insert(rows.map((row, i) => ({...row, id: i === 0 ? requestId : crypto.randomUUID(),
        user_id: owner, client_id: clientId, client_account_id: credit ? accountId : null, credit_card_id: cardId,
        title: field('title'), category: field('category') || 'personal', type: credit ? 'debt' : 'expense',
        currency: unit, currency_base: base, exchange_rate: fx, card_rate: cardRate,
        transaction_date: date, installment_group_id: count > 1 ? requestId : null}))));
    } else if (action === 'collect') {
      const target = await db.from('transactions').select('id,client_id,client_account_id,currency').eq('id',field('target')).eq('user_id',owner).single();
      check(target);
      const row = target.data!;
      check(await db.from('payments').insert({id: requestId, user_id: owner, client_id: row.client_id,
        client_account_id: row.client_account_id, transaction_id: row.id, currency: row.currency,
        amount: minor(field('amount')).toString(), payment_date: dateOnly(field('date')), payment_method: field('method')}));
    } else if (action === 'cancel') {
      const target = await db.from('transactions').select('installment_group_id').eq('id',id).single();
      check(target);
      const group = target.data!.installment_group_id;
      const result = await db.from('transactions').update({status:'cancelled'}).eq('user_id',owner)
        .eq(group ? 'installment_group_id' : 'id', group || id).select('id');
      check(result);
      if (!result.data?.length) return 'conflict';
    } else return 'invalid';
  } catch (error) {
    if (error instanceof RangeError) return 'invalid';
    const code = (error as {code?: string})?.code ?? '';
    if (['23503','23505','PGRST116'].includes(code) || (code === '23514' && ['cancel','collect'].includes(action))) return 'conflict';
    return /^(22|23)/.test(code) ? 'invalid' : 'unavailable';
  }
  revalidatePath('/', 'layout');
  return 'saved';
}

