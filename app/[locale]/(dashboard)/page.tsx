import {ArrowRight, BookOpen, CreditCard, Repeat2, UsersRound} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/shared/page-heading';
import {Button} from '@/components/ui/button';

export default async function OverviewPage() {
  const t = await getTranslations('Overview');
  const common = await getTranslations('Common');
  const sections = [
    {key: 'clients' as const, icon: UsersRound, href: '/clients'},
    {key: 'cards' as const, icon: CreditCard, href: '/cards'},
    {key: 'subscriptions' as const, icon: Repeat2, href: '/subscriptions'}
  ];
  return <>
    <PageHeading title={t('title')} description={t('description')} />
    <div className="overview-grid">
      <section className="panel ledger-panel" aria-labelledby="ledger-title">
        <div className="panel-heading"><h2 id="ledger-title">{t('ledgerTitle')}</h2><p>{t('ledgerDescription')}</p></div>
        <div className="ledger-empty">
          <span className="empty-icon"><BookOpen size={28} strokeWidth={1.75} aria-hidden="true" /></span>
          <h3>{t('emptyTitle')}</h3><p>{t('emptyDescription')}</p>
          <div className="empty-actions"><Button asChild variant="outline"><Link href="/transactions">{common('transactions')}</Link></Button><Button asChild variant="ghost"><Link href="/clients">{t('clientsAction')}</Link></Button></div>
        </div>
      </section>
      <aside className="workspace-guide" aria-labelledby="workspace-title">
        <h2 id="workspace-title">{t('workspaceTitle')}</h2>
        <div className="workspace-links">{sections.map(({key, icon: Icon, href}) => <Link href={href} className="workspace-link" key={key}>
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" /><span><strong>{common(key)}</strong><small>{t(`${key}Description`)}</small></span><ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </Link>)}</div>
        <div className="workspace-note"><span className="note-line" /><h3>{t('noteTitle')}</h3><p>{t('noteDescription')}</p></div>
      </aside>
    </div>
  </>;
}
