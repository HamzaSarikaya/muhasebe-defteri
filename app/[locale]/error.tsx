'use client';

import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';

export default function ErrorPage({reset}: {error: Error & {digest?: string}; reset: () => void}) {
  const t = useTranslations('Errors');
  return <main className="error-page"><h1>{t('title')}</h1><p>{t('description')}</p><Button onClick={reset}>{t('retry')}</Button></main>;
}
