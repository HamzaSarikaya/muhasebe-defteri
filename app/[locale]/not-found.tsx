import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {Button} from '@/components/ui/button';

export default async function NotFoundPage() {
  const t = await getTranslations('Errors');
  const common = await getTranslations('Common');
  return <main className="error-page"><span className="error-code font-money">404</span><h1>{t('notFound')}</h1><p>{t('notFoundDescription')}</p><Button asChild variant="outline"><Link href="/">{common('backHome')}</Link></Button></main>;
}
