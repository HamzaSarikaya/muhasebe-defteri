import {getLocale, getTranslations} from 'next-intl/server';
import {Plus} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/shared/page-heading';
import {DashboardView} from '@/components/dashboard/dashboard-view';
import {LedgerAccess} from '@/components/finance/access';
import {dashboard, istanbulToday} from '@/lib/finance/analytics';
import {readLedger} from '@/lib/finance/read';

export default async function OverviewPage() {
  const t = await getTranslations('Dashboard');
  const overview = await getTranslations('Overview');
  const locale = await getLocale();
  const result = await readLedger();
  const today = istanbulToday();
  return <>
    <div className="heading-row"><PageHeading title={overview('title')} description={t('description')}/>
      <Link href="/transactions" className="action-primary"><Plus size={16} strokeWidth={1.75} aria-hidden="true"/>{t('newEntry')}</Link></div>
    {result.state !== 'ready' && <LedgerAccess state={result.state}/>}
    <DashboardView model={result.state === 'ready' ? dashboard(result.data, today) : null} clients={result.state === 'ready' ? result.data.clients.map(({id, name}) => ({id, name})) : []} locale={locale} today={today}/>
  </>;
}
