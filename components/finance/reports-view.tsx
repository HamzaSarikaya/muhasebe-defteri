'use client';

import {useDeferredValue, useMemo, useState} from 'react';
import {CalendarDays, ChartNoAxesCombined} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {Ledger} from '@/lib/finance/ledger';
import {currencies, formatMoney, type Currency} from '@/lib/finance/money';
import {percentage} from '@/lib/finance/analytics';
import {activityIndex, emptyFilters, report, type Filters} from '@/lib/finance/reports';
import {ActivityFilters, ExportTools} from './activity-tools';
import {PageControls, usePageWindow} from './page-window';

export function ReportsView({data, locale, today}: {data: Ledger; locale: string; today: string}) {
  const t = useTranslations('Reports');
  const f = useTranslations('Finance');
  const a = useTranslations('Activity');
  const [unit, setUnit] = useState<Currency>(data.base);
  const [filters, setFilters] = useState<Filters>({...emptyFilters, from: today.slice(0, 7) + '-01', to: today});
  const deferred = useDeferredValue(filters);
  const index = useMemo(() => activityIndex(data), [data]);
  const model = useMemo(() => report(data, deferred, today, unit, index), [data, deferred, today, unit, index]);
  const calendar = usePageWindow(model.calendar, JSON.stringify(deferred) + unit);
  const money = (value: bigint) => formatMoney(value, unit, locale);
  const category = (value: string) => ['personal', 'hosting', 'domain', 'installment', 'market', 'productivity', 'entertainment', 'cloud', 'other'].includes(value) ? t('categories.' + value) : value;
  const max = model.categories.reduce((max, row) => row.net > max ? row.net : max, 0n);
  const months = new Map<string, typeof model.calendar>();
  for (const row of calendar.rows) {
    const key = row.due_date!.slice(0, 7);
    const rows = months.get(key) ?? []; rows.push(row); months.set(key, rows);
  }
  const month = (value: string) => new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric', timeZone: 'UTC'}).format(new Date(value + '-01T00:00:00Z'));
  const day = (value: string) => new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', timeZone: 'UTC'}).format(new Date(value + 'T00:00:00Z'));
  return <div className="phase-four">
    <div className="dashboard-toolbar"><Link href="/transactions" className="section-link">{t('transactions')}</Link><div className="currency-switch" role="group" aria-label={f('currency')}>{currencies.map(value => <button type="button" key={value} aria-pressed={unit === value} onClick={() => setUnit(value)}>{value}</button>)}</div></div>
    <section className="report-filter-section" aria-label={a('filters')}><ActivityFilters value={filters} onChange={setFilters} allCurrencies={false}/><p className="filter-note">{t('rangeNote')}</p></section>
    <dl className="summary-grid report-summary" aria-live="polite" aria-busy={filters !== deferred}>
      {[['charged', model.charged], ['refunded', model.refunded], ['collected', model.collected]].map(([label, amount]) => <div className="summary-item" key={String(label)}><dt>{t(String(label))}</dt><dd className="money">{money(amount as bigint)}</dd><dd className="summary-note">{t(String(label) + 'Note')}</dd></div>)}
    </dl>
    <section className="panel category-panel"><header className="section-heading"><div><h2>{t('categoryTitle')}</h2><p>{t('categoryNote')}</p></div><span className="unit-label">{unit}</span></header>
      {model.categories.length ? <div className="category-content"><div className="category-bars" aria-hidden="true">{model.categories.map(row => <div className="category-bar-row" key={row.category}><span>{category(row.category)}</span><div className="category-track"><span style={{width: (percentage(row.net, max) ?? 0) + '%'}}/></div><strong className="money">{money(row.net)}</strong></div>)}</div>
        <div className="table-scroll" role="region" aria-label={t('categoryTitle')} tabIndex={0}><table className="report-table"><caption className="sr-only">{t('categoryTitle')}</caption><thead><tr><th scope="col">{f('category')}</th><th scope="col">{t('charged')}</th><th scope="col">{t('refunded')}</th><th scope="col">{t('net')}</th></tr></thead><tbody>{model.categories.map(row => <tr key={row.category}><th scope="row">{category(row.category)}</th><td className="money">{money(row.charged)}</td><td className="money">{money(row.refunded)}</td><td className="money">{money(row.net)}</td></tr>)}</tbody></table></div></div> : <div className="phase-empty"><ChartNoAxesCombined size={24} strokeWidth={1.75} aria-hidden="true"/><h3>{t('noCategory')}</h3><p>{t('noCategoryNote')}</p></div>}
    </section>
    <section className="panel installment-calendar"><header className="section-heading"><div><h2>{t('calendar')}</h2><p>{t('calendarNote', {date: day(today)})}</p></div></header>
      {months.size ? [...months].map(([value, rows]) => <div className="calendar-month" key={value}><header><h3>{month(value)}</h3><strong className="money">{money(rows.reduce((sum, row) => sum + row.remaining, 0n))}</strong></header><ul>{rows.map(row => <li key={row.id}><span className="calendar-day">{day(row.due_date!)}</span><div className="calendar-title"><h4>{row.title}</h4><p>{index.clients.get(row.client_id ?? '')?.name ?? t('personal')} · {t('installment', {current: row.installment_current, count: row.installment_count})}</p></div><div className="calendar-amount"><strong className="money">{money(row.remaining)}</strong><small className={row.due_date! < today ? 'data-warning' : ''}>{t(row.due_date! < today ? 'overdue' : 'pending')}</small></div></li>)}</ul></div>) : <div className="phase-empty"><CalendarDays size={24} strokeWidth={1.75} aria-hidden="true"/><h3>{t('noInstallments')}</h3><p>{t('noInstallmentsNote')}</p></div>}
      <PageControls {...calendar} label={t('calendar')}/>
    </section>
    <ExportTools data={data} filters={{...filters, unit}} today={today}/>
  </div>;
}
