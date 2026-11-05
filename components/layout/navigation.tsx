'use client';

import {ArrowLeftRight, ChartNoAxesCombined, CreditCard, LayoutDashboard, Repeat2, Settings2, UsersRound, type LucideIcon} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Link, usePathname} from '@/i18n/navigation';
import {cn} from '@/lib/utils';

export const navigationItems = [
  {key: 'home', href: '/', icon: LayoutDashboard},
  {key: 'clients', href: '/clients', icon: UsersRound},
  {key: 'cards', href: '/cards', icon: CreditCard},
  {key: 'transactions', href: '/transactions', icon: ArrowLeftRight},
  {key: 'subscriptions', href: '/subscriptions', icon: Repeat2}
] as const satisfies ReadonlyArray<{key: string; href: string; icon: LucideIcon}>;

export function Navigation({mobile = false}: {mobile?: boolean}) {
  const t = useTranslations('Common');
  const pathname = usePathname();
  const items = mobile ? navigationItems : [...navigationItems, {key: 'reports' as const, href: '/reports', icon: ChartNoAxesCombined}];

  return <nav aria-label={t(mobile ? 'mobileNavigation' : 'primaryNavigation')} className={mobile ? 'mobile-nav' : 'desktop-nav'}>
    {items.map(({key, href, icon: Icon}) => {
      const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
      const label = mobile && key === 'transactions' ? t('mobileTransactions') : mobile && key === 'subscriptions' ? t('mobileSubscriptions') : t(key);
      return <Link key={key} href={href} aria-current={active ? 'page' : undefined} className={cn('nav-link', active && 'is-active')}>
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
        <span>{label}</span>
      </Link>;
    })}
  </nav>;
}

export function SettingsLink() {
  const t = useTranslations('Common');
  const pathname = usePathname();
  return <Link href="/settings" aria-current={pathname === '/settings' ? 'page' : undefined} className={cn('nav-link', pathname === '/settings' && 'is-active')}>
    <Settings2 size={20} strokeWidth={1.75} aria-hidden="true" /><span>{t('settings')}</span>
  </Link>;
}
