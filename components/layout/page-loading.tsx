import {useTranslations} from 'next-intl';

export function PageLoading() {
  const t = useTranslations('Common');
  return <section className="route-loading" aria-busy="true" aria-label={t('loading')}>
    <p role="status">{t('loading')}</p>
    <div aria-hidden="true"><div className="loading-lines"><span/><span/><span/></div>
      <div className="loading-panels"><span/><span/><span/></div></div>
  </section>;
}
