'use client';

import {useState} from 'react';
import {CalendarDays, ChevronRight, Plus, Repeat2} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {Ledger, Subscription} from '@/lib/finance/ledger';
import {currencies, decimalAmount, formatMoney, type Currency} from '@/lib/finance/money';
import {subscriptionLoad} from '@/lib/finance/subscriptions';
import {Field, RecordForm, Remove} from './forms';
import {LazyDetails, PageControls, usePageWindow} from './page-window';

type SubscriptionData = Pick<Ledger, 'base' | 'cards' | 'subscriptions'>;

function SubscriptionFields({data, today, row}: {data: SubscriptionData; today: string; row?: Subscription}) {
  const t = useTranslations('Subscriptions');
  const f = useTranslations('Finance');
  return <>
    <Field name="name" label={f('name')} value={row?.name} required maxLength={120}/>
    <Field name="provider" label={t('provider')} value={row?.provider ?? ''} maxLength={120}/>
    <Field name="amount" label={t('charge')} value={row ? decimalAmount(BigInt(row.amount)) : ''} decimal required/>
    <label>{f('currency')}<select name="currency" defaultValue={row?.currency ?? data.base}>{currencies.map(unit => <option key={unit}>{unit}</option>)}</select></label>
    <label>{t('cycle')}<select name="cycle" defaultValue={row?.billing_cycle ?? 'monthly'}>{['monthly', 'yearly'].map(cycle => <option value={cycle} key={cycle}>{t(cycle)}</option>)}</select></label>
    <Field name="nextDate" label={t('nextDate')} type="date" value={row?.next_billing_date ?? today} required/>
    <label>{f('card')}<select name="card" defaultValue={row?.credit_card_id ?? ''}><option value="">{f('noCard')}</option>{data.cards.filter(card => card.is_active || card.id === row?.credit_card_id).map(card => <option value={card.id} key={card.id}>{card.name} · {card.currency}</option>)}</select></label>
    <label>{f('category')}<select name="category" defaultValue={row?.category ?? 'productivity'}>{['entertainment', 'productivity', 'cloud', 'other'].map(category => <option value={category} key={category}>{t(category)}</option>)}</select></label>
    <label>{t('status')}<select name="active" defaultValue={String(row?.is_active ?? true)}><option value="true">{t('active')}</option><option value="false">{t('paused')}</option></select></label>
    <Field name="notes" label={t('notes')} value={row?.notes ?? ''} maxLength={2000}/>
  </>;
}

export function SubscriptionsView({data, owner, locale, today}: {data: SubscriptionData; owner: string; locale: string; today: string}) {
  const t = useTranslations('Subscriptions');
  const f = useTranslations('Finance');
  const [unit, setUnit] = useState<Currency>(data.base);
  const [showPaused, setShowPaused] = useState(false);
  const load = subscriptionLoad(data.subscriptions, unit);
  const active = data.subscriptions.filter(row => row.currency === unit && row.is_active).sort((a, b) => a.next_billing_date.localeCompare(b.next_billing_date) || a.name.localeCompare(b.name));
  const paused = data.subscriptions.filter(row => row.currency === unit && !row.is_active);
  const rows = [...active, ...(showPaused ? paused : [])];
  const page = usePageWindow(rows, unit + '/' + showPaused);
  const money = (value: bigint | string) => formatMoney(value, unit, locale);
  const date = (value: string) => new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(value + 'T00:00:00Z'));
  return <div className="phase-four" key={owner}>
    <div className="dashboard-toolbar"><span className="as-of"><Repeat2 size={17} strokeWidth={1.75} aria-hidden="true"/>{t('activeCount', {count: load.count})}</span><div className="currency-switch" role="group" aria-label={f('currency')}>{currencies.map(value => <button type="button" key={value} aria-pressed={value === unit} onClick={() => setUnit(value)}>{value}</button>)}</div></div>
    <dl className="summary-grid subscription-summary">
      <div className="summary-item"><dt>{t('monthlyLoad')}</dt><dd className="money">{money(load.monthly)}</dd><dd className="summary-note">{t('monthlyNote')}</dd></div>
      <div className="summary-item"><dt>{t('yearlyLoad')}</dt><dd className="money">{money(load.yearly)}</dd><dd className="summary-note">{t('yearlyNote')}</dd></div>
      <div className="summary-item"><dt>{t('nextRenewal')}</dt><dd className="next-renewal">{active[0] ? date(active[0].next_billing_date) : '—'}</dd><dd className="summary-note">{active[0]?.name ?? t('noRenewal')}</dd></div>
    </dl>
    <LazyDetails className="panel composer" summary={<><Plus size={18} strokeWidth={1.75} aria-hidden="true"/>{t('add')}</>}><div className="composer-body"><RecordForm action="subscription" owner={owner} label={f('save')}><SubscriptionFields data={data} today={today}/></RecordForm></div></LazyDetails>
    <section className="panel subscription-list"><header className="section-heading"><div><h2>{t('list')}</h2><p>{t('listNote')}</p></div><label className="check-control"><input type="checkbox" checked={showPaused} onChange={e => setShowPaused(e.target.checked)}/>{t('showPaused', {count: paused.length})}</label></header>
      {rows.length ? <ul>{page.rows.map(row => {
        const overdue = row.is_active && row.next_billing_date < today;
        const due = row.is_active && row.next_billing_date <= today;
        return <li className={'subscription-row' + (!row.is_active ? ' subscription-paused' : '')} key={row.id}>
          <div className="subscription-main"><div className="subscription-name"><h3>{row.name}</h3><p>{[row.provider, t(row.category), data.cards.find(card => card.id === row.credit_card_id)?.name].filter(Boolean).join(' · ')}</p></div>
            <div className="subscription-date"><span><CalendarDays size={15} strokeWidth={1.75} aria-hidden="true"/>{date(row.next_billing_date)}</span><small className={due ? 'data-warning' : ''}>{t(!row.is_active ? 'paused' : overdue ? 'overdue' : due ? 'dueToday' : 'nextDate')}</small></div>
            <div className="subscription-price"><strong className="money">{money(row.amount)}</strong><small>{t(row.billing_cycle)}</small></div></div>
          <LazyDetails className="ledger-editor" summary={<>{f('edit')} · {row.name}</>}><RecordForm key={JSON.stringify(row)} owner={owner} action="subscription" label={f('save')}><input type="hidden" name="id" value={row.id}/><SubscriptionFields row={row} data={data} today={today}/></RecordForm>
            {due && <RecordForm owner={owner} action="subscriptionRenew" label={t('advance')}><input type="hidden" name="id" value={row.id}/><input type="hidden" name="expectedDate" value={row.next_billing_date}/></RecordForm>}
            <Remove owner={owner} kind="subscription" id={row.id}/></LazyDetails>
        </li>;
      })}</ul> : <div className="phase-empty"><Repeat2 size={24} strokeWidth={1.75} aria-hidden="true"/><h3>{t('empty')}</h3><p>{t('emptyNote')}</p></div>}
      <PageControls {...page} label={t('list')}/>
    </section>
    <div className="phase-footer"><p>{t('trackingNote')}</p><Link href="/reports" className="section-link">{t('reports')}<ChevronRight size={16} strokeWidth={1.75} aria-hidden="true"/></Link></div>
  </div>;
}
