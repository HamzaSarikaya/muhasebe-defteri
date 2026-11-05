'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {currencies, formatMoney, installments, minor, type Currency} from '@/lib/finance/money';
import {balances, type Ledger} from '@/lib/finance/ledger';
import {Field, RecordForm, Remove} from './forms';

function EntryFields({data, today, locale}: {data: Ledger; today: string; locale: string}) {
  const t = useTranslations('Finance');
  const [type, setType] = useState('debt');
  const [unit, setUnit] = useState<Currency>(data.base);
  const [card, setCard] = useState('');
  const [amount, setAmount] = useState('');
  const [count, setCount] = useState('1');
  const cardUnit = data.cards.find(c => c.id === card)?.currency;
  const activeClients = new Map(data.clients.filter(c => c.is_active).map(c => [c.id,c.name]));
  let preview: bigint[] = [];
  try { preview = installments(minor(amount),Number(count)); } catch { /* Incomplete input. */ }
  return <>
    <label>{t('type')}<select name="type" value={type} onChange={e => setType(e.target.value)}>
      <option value="debt">{t('debt')}</option><option value="expense">{t('expense')}</option></select></label>
    {type === 'debt' && <label>{t('account')}<select name="account" required defaultValue=""><option value="">{t('select')}</option>
      {data.accounts.filter(a => a.is_active && activeClients.has(a.client_id)).map(a => <option value={a.id} key={a.id}>{activeClients.get(a.client_id)} / {a.name}</option>)}</select></label>}
    <label>{t('card')}<select name="card" value={card} required={type === 'expense'} onChange={e => setCard(e.target.value)}><option value="">{t(type === 'debt' ? 'noCard' : 'select')}</option>
      {data.cards.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name} · {c.currency}</option>)}</select></label>
    <Field label={t('title')} name="title" required maxLength={200}/>
    <Field label={t('category')} name="category" maxLength={80}/>
    <label>{t('amount')}<input name="amount" required inputMode="decimal" maxLength={20} value={amount} onChange={e => setAmount(e.target.value)}/></label>
    <label>{t('currency')}<select name="currency" value={unit} onChange={e => setUnit(e.target.value as Currency)}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label>
    {unit !== data.base && <Field key={unit+data.base} label={t('rate',{from:unit,to:data.base})} name="rate" required maxLength={19}/>}
    {cardUnit && cardUnit !== unit && cardUnit !== data.base && <Field key={unit+cardUnit} label={t('rate',{from:unit,to:cardUnit})} name="cardRate" required maxLength={19}/>}
    <Field label={t('date')} name="date" type="date" required value={today}/>
    <Field label={t('due')} name="due" type="date"/>
    <label>{t('count')}<input name="count" type="number" required min={1} max={120} value={count} onChange={e => setCount(e.target.value)}/></label>
    {preview.length > 1 && <output className="installment-preview">{t('first')} <b className="money">{formatMoney(preview[0],unit,locale)}</b> · {t('next')} <b className="money">{formatMoney(preview[1],unit,locale)}</b> × {preview.length-1}</output>}
  </>;
}

export function Entries({owner,data,today,locale}: {owner: string; data: Ledger; today: string; locale: string}) {
  const t = useTranslations('Finance');
  const {allocated} = balances(data);
  const accounts = new Map(data.accounts.map(a => [a.id,a.name]));
  const clients = new Map(data.clients.map(c => [c.id,c.name]));
  const entries = new Map(data.transactions.map(e => [e.id,e]));
  const open = data.transactions.filter(e => e.client_id && ['debt','expense'].includes(e.type) && e.status !== 'cancelled' && BigInt(e.amount) > (allocated.get(e.id) ?? 0n));
  return <>
    <details className="panel ledger-block"><summary>{t('newEntry')}</summary>
      <RecordForm owner={owner} action="entry" label={t('save')}><EntryFields data={data} today={today} locale={locale}/></RecordForm>
    </details>
    <details className="panel ledger-block"><summary>{t('collect')}</summary>
      {open.length ? <RecordForm owner={owner} action="collect" label={t('collect')}>
        <label>{t('target')}<select name="target" required defaultValue=""><option value="">{t('select')}</option>{open.map(e => <option key={e.id} value={e.id}>
          {clients.get(e.client_id!)} / {accounts.get(e.client_account_id ?? '')} · {e.title} ({e.installment_current}/{e.installment_count}) · {e.due_date ?? e.transaction_date} · {formatMoney(BigInt(e.amount)-(allocated.get(e.id) ?? 0n),e.currency,locale)}
        </option>)}</select></label>
        <Field label={t('amount')} name="amount" decimal required/><Field label={t('payDate')} name="date" type="date" value={today} required/>
        <label>{t('method')}<select name="method">{['bank_transfer','cash','card'].map(k => <option key={k} value={k}>{t(k)}</option>)}</select></label>
      </RecordForm> : <p>{t('noDebt')}</p>}
    </details>
    <section className="panel ledger-block"><h2>{t('history')}</h2>{!data.transactions.length && <p>{t('empty')}</p>}
      {data.transactions.map(e => <article key={e.id} className="ledger-line"><div><h3>{e.title}</h3>
        <small>{t(e.type)} · {clients.get(e.client_id ?? '')} {accounts.get(e.client_account_id ?? '')} {data.cards.find(c => c.id === e.credit_card_id)?.name}</small>
        <small>{e.transaction_date} {e.due_date && ' · '+t('dueLabel')+' '+e.due_date} {e.installment_count > 1 && ' · '+t('installment')+' '+e.installment_current+'/'+e.installment_count}</small></div>
        <div className="ledger-amount"><strong className="money">{formatMoney(e.amount,e.currency,locale)}</strong>
          <small>{e.status === 'cancelled' ? t('cancelled') : e.client_id && ['debt','expense'].includes(e.type) ? t('remaining')+' '+formatMoney(BigInt(e.amount)-(allocated.get(e.id) ?? 0n),e.currency,locale) : ''}</small>
          {e.status !== 'cancelled' && e.installment_current === 1 && <RecordForm owner={owner} action="cancel" confirm label={t(e.installment_count > 1 ? 'cancelGroup' : 'cancel')}><input type="hidden" name="id" value={e.id}/></RecordForm>}
        </div></article>)}
    </section>
    <section className="panel ledger-block"><h2>{t('receipts')}</h2>{!data.payments.length && <p>{t('empty')}</p>}
      {data.payments.map(p => <article key={p.id} className="ledger-line"><div><h3>{clients.get(p.client_id)} · {entries.get(p.transaction_id ?? '')?.title ?? t('advance')}</h3><small>{p.payment_date} · {t(p.payment_method)}</small></div>
        <div className="ledger-amount"><strong className="money">{formatMoney(p.amount,p.currency,locale)}</strong><Remove owner={owner} kind="payment" id={p.id}/></div></article>)}
    </section>
  </>;
}

