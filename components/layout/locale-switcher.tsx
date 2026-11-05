'use client';

import {Languages} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {useSearchParams} from 'next/navigation';
import {Link, usePathname, useRouter} from '@/i18n/navigation';

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('Common');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  return <Link
    href={query ? `${pathname}?${query}` : pathname}
    locale={locale === 'tr' ? 'en' : 'tr'}
    aria-label={t('changeLanguage')}
    className="locale-switcher"
    onClick={(event) => {
      // Hashes are client-only and must survive changing language, too.
      if (window.location.hash && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        router.replace(`${pathname}${query ? `?${query}` : ''}${window.location.hash}`, {locale: locale === 'tr' ? 'en' : 'tr'});
      }
    }}
  >
    <Languages size={18} strokeWidth={1.75} aria-hidden="true" />
    <span>{locale === 'tr' ? 'EN' : 'TR'}</span>
  </Link>;
}
