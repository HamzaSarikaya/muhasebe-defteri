'use client';

import {useState} from 'react';
import dynamic from 'next/dynamic';
import {ArrowDownLeft, CalendarDays, ChevronRight, CreditCard, ReceiptText, Wallet} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {dashboard} from '@/lib/finance/analytics';
import {formatMoney, type Currency} from '@/lib/finance/money';
import {ChartLoading} from '@/components/layout/page-loading';

const Charts = dynamic(() => import('./financial-charts'), {loading: () => <ChartLoading/>});
type Model = ReturnType<typeof dashboard>;

export function DashboardView({model, clients, locale, today}: {model: Model | null; clients: {id: string; name: string}[]; locale: string; today: string}) {
  const t = useTranslations('Dashboard');
  const [selectedUnit, setUnit] = useState<Currency>(model?.units[0] ?? 'TRY');
  const unit = model && !model.units.includes(selectedUnit) ? model.units[0] : selectedUnit;
  const metric = model?.metrics.find(row => row.unit === unit);
  const money = (value: string | bigint, currency = unit) => formatMoney(value, currency, locale);
  const percent = (value: number) => new Intl.NumberFormat(locale, {maximumFractionDigits: 2}).format(value);
  const person = (id: string) => clients.find(client => client.id === id)?.name ?? t(id ? 'otherClient' : 'personal');
  const date = (value: string) => new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', timeZone: 'UTC'}).format(new Date(value + 'T00:00:00Z'));
  return <div className="dashboard">
    <div className="dashboard-toolbar"><span className="as-of"><CalendarDays size={16} strokeWidth={1.75} aria-hidden="true"/>{t('asOf', {date: date(today)})}</span>
      <div className="currency-switch" role="group" aria-label={t('currency')}>{(model?.units ?? ['TRY', 'USD', 'EUR'] as Currency[]).map(value => <button type="button" key={value} aria-pressed={unit === value} onClick={() => setUnit(value)}>{value}</button>)}</div>
    </div>
    <dl className="summary-grid">
      {([{key: 'receivable', icon: Wallet, value: metric?.receivable, note: t('receivableNote')},
        {key: 'collection', icon: ArrowDownLeft, value: metric?.collection, note: t('collectionNote')},
        {key: 'pending', icon: ReceiptText, value: metric?.pending, note: metric ? t('pendingCount', {count: metric.count}) : t('pendingNote')}] as const).map(({key, icon: Icon, value, note}) =>
        <div className={'summary-item summary-' + key} key={key}><dt><span>{t(key)}</span><Icon size={18} strokeWidth={1.75} aria-hidden="true"/></dt>
          <dd className="money">{value === undefined ? '—' : money(value)}</dd><dd className="summary-note">{note}</dd></div>)}
    </dl>
    <div className="analytics-grid">
      <section className="panel chart-panel"><header className="section-heading"><div><h2>{t('trend')}</h2><p>{t('trendNote')}</p></div><span className="unit-label">{unit}</span></header>
        {model ? <Charts kind="trend" unit={unit} locale={locale} rows={model.trends.find(row => row.unit === unit)?.rows ?? []}/> : <ChartEmpty title={t('noChart')} description={t('noChartNote')}/>}
      </section>
      <section className="panel chart-panel"><header className="section-heading"><div><h2>{t('spending')}</h2><p>{t('spendingNote')}</p></div></header>
        {model ? <Charts kind="spending" unit={unit} locale={locale} rows={(model.spending.find(row => row.unit === unit)?.rows ?? []).map(row => ({...row, name: person(row.client)}))}/> : <ChartEmpty title={t('noSpending')} description={t('noSpendingNote')}/>}
      </section>
    </div>
    <section className="cards-section"><header className="section-heading"><div><h2>{t('cards')}</h2><p>{t('cardsNote')}</p></div><Link href="/cards" className="section-link">{t('manageCards')}<ChevronRight size={16} strokeWidth={1.75} aria-hidden="true"/></Link></header>
      {model?.cards.length ? <div className="card-grid">{model.cards.map(card => <article className="panel bank-card" key={card.id}>
        <header className="bank-heading"><div className="bank-mark"><CreditCard size={20} strokeWidth={1.75} aria-hidden="true"/></div><div><h3>{card.name}</h3><p>{card.primary_user || t('card')}{!card.is_active && ' · ' + t('inactive')}</p></div><span className="unit-label">{card.currency}</span></header>
        <div className="bank-balance"><span>{t('cardBalance')}</span><strong className="money">{card.unknown ? '—' : money(card.balance, card.currency)}</strong></div>
        {card.unknown ? <p className="data-warning">{t('missingRate')}</p> : <>
          <div className="usage-track" role="meter" aria-label={t('usageLabel', {name: card.name})} aria-valuemin={0} aria-valuemax={100} aria-valuenow={card.usage ?? 0} aria-valuetext={card.usage === null ? t('noLimit') : t('usageValue', {value: percent(card.usage)})}><span style={{width: (card.usage ?? 0) + '%'}} className={card.overLimit ? 'is-over' : undefined}/></div>
          <div className="limit-line"><span>{card.usage === null ? t('noLimit') : t('usageValue', {value: percent(card.usage)})}</span><span className="money">{money(card.credit_limit, card.currency)}</span></div>
          <dl className="card-shares">{card.shares.map(share => <div key={share.client}><dt>{person(share.client)}</dt><dd className="money">{money(share.amount, card.currency)}</dd></div>)}</dl>
          <div className={'available-line' + (card.overLimit ? ' data-warning' : '')}><span>{t(card.overLimit ? 'overLimit' : 'available')}</span><span className="money">{money(card.overLimit ? -BigInt(card.available) : card.available, card.currency)}</span></div>
        </>}
      </article>)}</div> : <div className="section-empty"><CreditCard size={22} strokeWidth={1.75} aria-hidden="true"/><div><h3>{t('noCards')}</h3><p>{t('noCardsNote')}</p></div><Link href="/cards" className="action-secondary">{t('addCard')}</Link></div>}
    </section>
    <section className="panel upcoming-panel"><header className="section-heading"><div><h2>{t('upcoming')}</h2><p>{t('upcomingNote')}</p></div><Link href="/transactions" className="section-link">{t('allEntries')}<ChevronRight size={16} strokeWidth={1.75} aria-hidden="true"/></Link></header>
      {model?.upcoming.length ? <ul className="upcoming-list">{model.upcoming.map(row => <li key={row.id}><span className={'due-date' + (row.overdue ? ' data-warning' : '')}>{date(row.due_date!)}</span><div className="upcoming-title"><h3>{row.title}</h3><p>{person(row.client_id ?? '')} · {t('installmentValue', {current: row.installment_current, count: row.installment_count})}</p></div><div className="upcoming-amount"><strong className="money">{money(row.remaining, row.currency)}</strong><small className={row.overdue ? 'data-warning' : ''}>{t(row.overdue ? 'overdue' : 'waiting')}</small></div></li>)}</ul> : <div className="quiet-empty"><CalendarDays size={22} strokeWidth={1.75} aria-hidden="true"/><p>{t(model ? 'noUpcoming' : 'unavailableUpcoming')}</p></div>}
    </section>
    <p className="dashboard-footnote">{t('currencyNote')}</p>
  </div>;
}

function ChartEmpty({title, description}: {title: string; description: string}) {
  return <div className="chart-empty"><div className="empty-chart-lines" aria-hidden="true"><span/><span/><span/></div><h3>{title}</h3><p>{description}</p></div>;
}
