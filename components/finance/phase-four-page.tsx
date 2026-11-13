import {Suspense} from 'react';
import {PageLoading} from '@/components/layout/page-loading';
import {getLocale, getTranslations} from 'next-intl/server';
import {PageHeading} from '@/components/shared/page-heading';
import {readLedger} from '@/lib/finance/read';
import {istanbulToday} from '@/lib/finance/analytics';
import {LedgerAccess} from './access';
import {ReportsView} from './reports-view';
import {SubscriptionsView} from './subscriptions-view';

async function Records({module}: {module: 'subscriptions' | 'reports'}) {
  const locale = await getLocale();
  const result = await readLedger();
  return <>{result.state !== 'ready' ? <LedgerAccess state={result.state}/> : module === 'subscriptions' ?
    <SubscriptionsView data={{base: result.data.base, cards: result.data.cards, subscriptions: result.data.subscriptions}} owner={result.owner} locale={locale} today={istanbulToday()}/> : <ReportsView data={result.data} locale={locale} today={istanbulToday()}/>}</>;
}

export async function PhaseFourPage({module}: {module: 'subscriptions' | 'reports'}) {
  const t = await getTranslations('Modules.' + module);
  return <><PageHeading title={t('title')} description={t('description')}/><Suspense fallback={<PageLoading view={module}/>}><Records module={module}/></Suspense></>;
}
