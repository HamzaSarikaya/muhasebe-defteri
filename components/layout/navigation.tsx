'use client';

import {ArrowLeftRight, ChartNoAxesCombined, CreditCard, LayoutDashboard, Repeat2, Settings2, UsersRound, type LucideIcon} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useLinkStatus} from 'next/link';
import {createPortal} from 'react-dom';
import {Link, usePathname} from '@/i18n/navigation';
import {cn} from '@/lib/utils';

function NavigationPending() {
  const {pending} = useLinkStatus();
  const t = useTranslations('Common');
  if (!pending || typeof document === 'undefined') return null;
  return createPortal(<div className="navigation-pending" role="status">{t('loading')}</div>, document.body);
}

export const navigationItems = [
  {key: 'home', href: '/', icon: LayoutDashboard},
  {key: 'clients', href: '/clients', icon: UsersRound},
  {key: 'cards', href: '/cards', icon: CreditCard},
  {key: 'transactions', href: '/transactions', icon: ArrowLeftRight},
  {key: 'subscriptions', href: '/subscriptions', icon: Repeat2}
] as const satisfies ReadonlyArray<{key: string; href: string; icon: LucideIcon}>;

export function Navigation({mobile = false, rail = false}: {mobile?: boolean; rail?: boolean}) {
  const t = useTranslations('Common');
  const pathname = usePathname();
  const items = mobile ? navigationItems : [...navigationItems, {key: 'reports' as const, href: '/reports', icon: ChartNoAxesCombined}];

  return <nav aria-label={t(mobile ? 'mobileNavigation' : rail ? 'quickNavigation' : 'primaryNavigation')} className={mobile ? 'mobile-nav' : rail ? 'rail-nav' : 'desktop-nav'}>
    {items.map(({key, href, icon: Icon}) => {
      const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
      const label = mobile && key === 'transactions' ? t('mobileTransactions') : mobile && key === 'subscriptions' ? t('mobileSubscriptions') : t(key);
      return <Link key={key} href={href} aria-label={rail ? t(key) : undefined} title={rail ? t(key) : undefined} aria-current={active ? 'page' : undefined} className={cn('nav-link', active && 'is-active')}>
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
        <span className={rail ? 'sr-only' : undefined}>{label}</span><NavigationPending/>
      </Link>;
    })}
  </nav>;
}

export function SettingsLink({compact = false}: {compact?: boolean}) {
  const t = useTranslations('Common');
  const pathname = usePathname();
  return <Link href="/settings" aria-label={compact ? t('settings') : undefined} title={compact ? t('settings') : undefined} aria-current={pathname === '/settings' ? 'page' : undefined} className={cn('nav-link', pathname === '/settings' && 'is-active')}>
    <Settings2 size={20} strokeWidth={1.75} aria-hidden="true" /><span className={compact ? 'sr-only' : undefined}>{t('settings')}</span><NavigationPending/>
  </Link>;
}
