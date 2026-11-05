import {Suspense} from 'react';
import {getTranslations} from 'next-intl/server';
import {LocaleSwitcher} from '@/components/layout/locale-switcher';
import {PageHeading} from '@/components/shared/page-heading';
import {isSupabaseConfigured} from '@/lib/supabase/config';

export default async function SettingsPage() {
  const t = await getTranslations('Settings');
  const common = await getTranslations('Common');
  return <>
    <PageHeading title={t('title')} description={t('description')} />
    <div className="panel settings-panel">
      <section className="setting-row"><div><h2>{common('language')}</h2><p>{t('languageDescription')}</p></div><Suspense><LocaleSwitcher /></Suspense></section>
      <section className="setting-row"><div><h2>{t('appearance')}</h2><p>{t('appearanceDescription')}</p></div><span className="setting-value">{t('dark')}</span></section>
      <section className="setting-row"><div><h2>{t('currency')}</h2><p>{t('currencyDescription')}</p></div><span className="setting-value font-money">TRY</span></section>
      <section className="setting-row connection-row"><div><h2>{t('connection')}</h2><p>{t('connectionDescription')}</p></div><span className="connection-status">{t(isSupabaseConfigured() ? 'configured' : 'notConfigured')}</span></section>
    </div>
  </>;
}
