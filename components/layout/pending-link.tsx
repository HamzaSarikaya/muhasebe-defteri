'use client';

import type {ComponentProps} from 'react';
import {createPortal} from 'react-dom';
import {useLinkStatus} from 'next/link';
import {Link as LocalizedLink} from '@/i18n/navigation';
import {PageLoading} from './page-loading';

type LinkProps = ComponentProps<typeof LocalizedLink>;

function PendingSurface({href}: Pick<LinkProps, 'href'>) {
  const {pending} = useLinkStatus();
  if (!pending || typeof document === 'undefined') return null;
  const target = document.getElementById('page-content');
  if (!target) return null;
  const pathname = typeof href === 'string' ? href : href.pathname;
  const segment = pathname?.split('/')[1];
  const view = segment === 'cards' || segment === 'clients' || segment === 'transactions' || segment === 'subscriptions' || segment === 'reports' || segment === 'settings' ? segment : 'overview';
  return createPortal(<div className="navigation-skeleton"><PageLoading view={view} heading/></div>, target);
}

export function Link({children, href, ...props}: LinkProps) {
  return <LocalizedLink href={href} {...props}>{children}<PendingSurface href={href}/></LocalizedLink>;
}
