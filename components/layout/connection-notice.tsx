'use client';

import {WifiOff} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useOnline} from '@/lib/use-online';

export function ConnectionNotice() {
  const t = useTranslations('Common');
  const online = useOnline();
  if (online) return null;
  return <div className="connection-notice" role="status">
    <WifiOff size={18} strokeWidth={1.75} aria-hidden="true"/>
    <p>{t('offline')}</p>
  </div>;
}
