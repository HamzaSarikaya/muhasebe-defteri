import {getLocale, getTranslations} from 'next-intl/server';
import {PageHeading} from '@/components/shared/page-heading';
import {readLedger} from '@/lib/finance/read';
import {istanbulToday} from '@/lib/finance/analytics';
import {LedgerAccess} from './access';
import {ReportsView} from './reports-view';
import {SubscriptionsView} from './subscriptions-view';

export async function PhaseFourPage({module}: {module: 'subscriptions' | 'reports'}) {
  const t = await getTranslations('Modules.' + module);
  const locale = await getLocale();
  const result = await readLedger();
  return <><PageHeading title={t('title')} description={t('description')}/>{result.state !== 'ready' ? <LedgerAccess state={result.state}/> : module === 'subscriptions' ?
    <SubscriptionsView data={result.data} owner={result.owner} locale={locale} today={istanbulToday()}/> : <ReportsView data={result.data} locale={locale} today={istanbulToday()}/>}</>;
}
