import {notFound} from 'next/navigation';
import {getLocale, getTranslations} from 'next-intl/server';
import {ChevronLeft, Mail, Phone} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {LedgerAccess} from '@/components/finance/access';
import {PageHeading} from '@/components/shared/page-heading';
import {readLedger} from '@/lib/finance/read';
import {accountProgress} from '@/lib/finance/analytics';
import {balances} from '@/lib/finance/ledger';
import {currencies, formatMoney} from '@/lib/finance/money';

export default async function ClientPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const t = await getTranslations('Dashboard');
  const locale = await getLocale();
  const result = await readLedger();
  if (result.state !== 'ready') return <><PageHeading title={t('profile')} description={t('profileDescription')}/><LedgerAccess state={result.state}/></>;
  const {data} = result;
  const client = data.clients.find(client => client.id === id);
  if (!client) notFound();
  const totals = balances(data);
  const transactions = data.transactions.filter(row => row.client_id === id);
  const payments = data.payments.filter(row => row.client_id === id);
  const accounts: {id: string | null; name: string; is_active: boolean}[] = data.accounts.filter(row => row.client_id === id);
  if (transactions.some(row => !row.client_account_id) || payments.some(row => !row.client_account_id)) accounts.push({id: null, name: t('unassigned'), is_active: true});
  const units = currencies.filter(unit => totals.clients.has(id + '/' + unit));
  const history = [
    ...transactions.map(row => ({...row, kind: row.type, date: row.transaction_date})),
    ...payments.map(row => ({...row, kind: 'receipt' as const, date: row.payment_date, title: transactions.find(entry => entry.id === row.transaction_id)?.title ?? t('receipt'), status: '', installment_count: 1, installment_current: 1}))
  ].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const date = (value: string) => new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(new Date(value + 'T00:00:00Z'));
  return <>
    <Link href="/clients" className="back-link"><ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true"/>{t('backClients')}</Link>
    <div className="heading-row"><PageHeading title={client.name} description={t('profileDescription')}/><Link href="/transactions" className="action-primary">{t('newEntry')}</Link></div>
    <div className="client-overview panel"><div className="client-contact">{client.email && <span><Mail size={16} strokeWidth={1.75} aria-hidden="true"/>{client.email}</span>}{client.phone && <span><Phone size={16} strokeWidth={1.75} aria-hidden="true"/>{client.phone}</span>}{!client.email && !client.phone && <span>{t('noContact')}</span>}{!client.is_active && <span>{t('inactive')}</span>}</div>
      <div className="client-total"><span>{t('remaining')}</span>{(units.length ? units : [data.base]).map(unit => <strong className="money" key={unit}>{formatMoney(totals.clients.get(id + '/' + unit) ?? 0n, unit, locale)}</strong>)}</div></div>
    <section className="client-accounts"><header className="section-heading"><div><h2>{t('accountActivity')}</h2><p>{t('accountNote')}</p></div><Link href="/clients" className="section-link">{t('allClients')}</Link></header>
      {accounts.length ? <div className="account-grid">{accounts.map(account => {
        const accountUnits = currencies.filter(unit => transactions.some(row => row.client_account_id === account.id && row.currency === unit) || payments.some(row => row.client_account_id === account.id && row.currency === unit));
        return <article className="panel account-card" key={account.id ?? 'unassigned'}><h3>{account.name}{!account.is_active && <small> · {t('inactive')}</small>}</h3>{(accountUnits.length ? accountUnits : [data.base]).map(unit => {
          const amounts = accountProgress(data, id, account.id, unit);
          return <div className="account-currency" key={unit}><dl><div><dt>{t('charged')}</dt><dd className="money">{formatMoney(amounts.charged, unit, locale)}</dd></div><div><dt>{t('credited')}</dt><dd className="money">{formatMoney(amounts.credited, unit, locale)}</dd></div><div className="account-remaining"><dt>{t('remaining')}</dt><dd className="money">{formatMoney(amounts.remaining, unit, locale)}</dd></div></dl>
            <div className="usage-track settlement-track" role="meter" aria-label={t('progress', {name: account.name})} aria-valuemin={0} aria-valuemax={100} aria-valuenow={amounts.progress ?? 0}><span style={{width: (amounts.progress ?? 0) + '%'}}/></div></div>;
        })}</article>;
      })}</div> : <div className="section-empty"><div><h3>{t('noAccounts')}</h3><p>{t('noAccountsNote')}</p></div></div>}
    </section>
    <section className="panel client-history"><header className="section-heading"><h2>{t('history')}</h2></header>{history.length ? <ul className="activity-list">{history.map(row => <li key={row.kind + row.id}><div className="activity-date">{date(row.date)}</div><div className="activity-title"><h3>{row.title}</h3><p>{t(row.kind)} · {accounts.find(account => account.id === row.client_account_id)?.name ?? t('unassigned')}{row.installment_count > 1 && ' · ' + t('installmentValue', {current: row.installment_current, count: row.installment_count})}{row.status === 'cancelled' && ' · ' + t('cancelled')}</p></div><strong className={'money' + (row.kind === 'receipt' || row.kind === 'refund' || row.kind === 'payment' ? ' positive-amount' : '')}>{formatMoney(row.amount, row.currency, locale)}</strong></li>)}</ul> : <div className="quiet-empty"><p>{t('noHistory')}</p></div>}</section>
  </>;
}
