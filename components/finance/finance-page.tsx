import {getLocale, getTranslations} from 'next-intl/server';
import {ChevronRight} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {isSupabaseConfigured} from '@/lib/supabase/config';
import {createClient} from '@/lib/supabase/server';
import {balances, statementCycle, type Ledger} from '@/lib/finance/ledger';
import {currencies, formatMoney} from '@/lib/finance/money';
import {PageHeading} from '@/components/shared/page-heading';
import {CardFields, ClientFields, Editor, Field, RecordForm} from './forms';
import {Entries} from './entries';

type Module = 'cards' | 'clients' | 'transactions';

async function Records({module}: {module: Module}) {
  const t = await getTranslations('Finance');
  const d = await getTranslations('Dashboard');
  if (!isSupabaseConfigured()) return <section className="panel ledger-block"><p>{t('setup')}</p><Link href="/settings" className="ledger-link">{t('settings')}</Link></section>;
  const db = await createClient();
  const {data: {user}, error: authError} = await db.auth.getUser();
  if (!user) {
    if (authError && authError.name !== 'AuthSessionMissingError' && authError.status !== 401 && authError.status !== 403 && authError.status !== 400) throw authError;
    return <section className="panel ledger-block"><h2>{t('login')}</h2><RecordForm action="login" label={t('signIn')}>
      <Field name="email" type="email" label={t('email')} autoComplete="username" required/><Field name="password" type="password" label={t('password')} autoComplete="current-password" required/>
    </RecordForm></section>;
  }
  const {data: snapshot,error} = await db.rpc('ledger_snapshot');
  if (error || !snapshot) throw new Error('Ledger unavailable');
  const data = snapshot as Ledger;
  const owner = user.id;
  const locale = await getLocale();
  const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date());
  const totals = balances(data);
  function accountBalance(id: string, amounts: Map<string,bigint>) {
    const units = currencies.filter(unit => amounts.has(id+'/'+unit));
    return <div className="ledger-amount">{(units.length ? units : [data.base]).map(unit => <div className="money" key={unit}>{formatMoney(amounts.get(id+'/'+unit) ?? 0n,unit,locale)}</div>)}</div>;
  }
  return <div className="ledger" key={owner}>
    {!data.defaults && <section className="panel ledger-block"><p>{t('starter')}</p><RecordForm owner={owner} action="defaults" label={t('defaults')}/></section>}
    {module === 'cards' && <>
      <details className="panel ledger-block"><summary>{t('newCard')}</summary><RecordForm owner={owner} action="card" label={t('save')}><CardFields/></RecordForm></details>
      {!data.cards.length && <p>{t('emptyCards')}</p>}
      {data.cards.map(card => {
        const balance = totals.cards.get(card.id) ?? 0n;
        const cycle = card.statement_day && card.due_day ? statementCycle(today,card.statement_day,card.due_day) : null;
        return <section className="panel ledger-block" key={card.id}><h2>{card.name}</h2><p>{card.primary_user}{!card.is_active && ' · '+t('inactive')}</p>
          <dl className="ledger-metrics">
            {[[t('balance'),formatMoney(balance,card.currency,locale)],[t('limit'),formatMoney(card.credit_limit,card.currency,locale)],
              [t('available'),formatMoney(BigInt(card.credit_limit)-balance,card.currency,locale)]].map(([label,value],index) => <div key={label}><dt>{label}</dt><dd className="money">{index !== 1 && totals.unknownCards.has(card.id) ? t('unknown') : value}</dd></div>)}
            <div><dt>{t(cycle ? 'nextStatement' : 'statement')}</dt><dd>{cycle?.closing ?? card.statement_day ?? '—'}</dd></div>
            <div><dt>{t(cycle ? 'statementDue' : 'dueDay')}</dt><dd>{cycle?.due ?? card.due_day ?? '—'}</dd></div>
          </dl><Editor owner={owner} kind="card" row={card}><CardFields card={card}/></Editor></section>;
      })}
    </>}
    {module === 'clients' && <>
      <details className="panel ledger-block"><summary>{t('newClient')}</summary><RecordForm owner={owner} action="client" label={t('save')}><ClientFields/></RecordForm></details>
      {!data.clients.length && <p>{t('emptyClients')}</p>}
      {data.clients.map(client => <section className="panel ledger-block" key={client.id}><header className="ledger-line"><div><h2><Link href={'/clients/'+client.id} className="client-profile-link">{client.name}<ChevronRight size={16} strokeWidth={1.75} aria-hidden="true"/></Link></h2><small>{[client.email,client.phone].filter(Boolean).join(' · ')}</small><Link href={'/clients/'+client.id} className="section-link">{d('profile')}</Link></div>
        <div className="ledger-amount"><small>{t('balance')}</small>{accountBalance(client.id,totals.clients)}</div></header>
        <Editor owner={owner} kind="client" row={client}><ClientFields client={client}/></Editor>
        <h3 className="ledger-subtitle">{t('accounts')}</h3>
        {data.accounts.filter(a => a.client_id === client.id).map(a => <div className="ledger-line" key={a.id}><div><h3>{a.name}</h3>
          <Editor owner={owner} kind="account" row={a}><Field name="name" label={t('name')} value={a.name} required maxLength={120}/></Editor></div>{accountBalance(a.id,totals.accounts)}</div>)}
        <details className="ledger-editor"><summary>{t('newAccount')}</summary><RecordForm owner={owner} action="account" label={t('save')}>
          <input type="hidden" name="client" value={client.id}/><Field name="name" label={t('name')} required maxLength={120}/></RecordForm></details>
      </section>)}
    </>}
    {module === 'transactions' && <Entries data={data} owner={owner} locale={locale} today={today}/>}
    <RecordForm owner={owner} action="logout" label={t('signOut')}/>
  </div>;
}
export async function FinancePage({module}: {module: Module}) {
  const t = await getTranslations('Modules.'+module);
  return <><PageHeading title={t('title')} description={t('description')}/><Records module={module}/></>;
}

