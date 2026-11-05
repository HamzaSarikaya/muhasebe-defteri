import {getTranslations} from 'next-intl/server';
import {ArrowLeftRight, ChartNoAxesCombined, CreditCard, Repeat2, UsersRound} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {PageHeading} from './page-heading';
import {Button} from '@/components/ui/button';

const icons = {clients: UsersRound, cards: CreditCard, transactions: ArrowLeftRight, subscriptions: Repeat2, reports: ChartNoAxesCombined};
export type ModuleName = keyof typeof icons;

export async function ModulePage({module}: {module: ModuleName}) {
  const t = await getTranslations(`Modules.${module}`);
  const common = await getTranslations('Common');
  const Icon = icons[module];
  return <>
    <PageHeading title={t('title')} description={t('description')} />
    <section className="panel module-empty" aria-label={t('title')}>
      <span className="empty-icon"><Icon size={28} strokeWidth={1.75} aria-hidden="true" /></span>
      <h2>{t('emptyTitle')}</h2><p>{t('emptyDescription')}</p>
      <span className="availability-label">{common('notAvailable')}</span>
      <Button asChild variant="outline"><Link href="/">{common('backHome')}</Link></Button>
    </section>
  </>;
}
