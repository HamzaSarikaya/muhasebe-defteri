'use client';

import {useState, type ReactNode} from 'react';
import {useTranslations} from 'next-intl';

export function usePageWindow<T>(rows: T[], scope: string, size = 50) {
  const [position, setPosition] = useState({scope, page: 1});
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = position.scope === scope ? Math.min(position.page, pages) : 1;
  if (position.scope !== scope || position.page !== page) setPosition({scope, page});
  return {rows: rows.slice((page - 1) * size, page * size), page, pages,
    go: (next: number) => setPosition({scope, page: Math.max(1, Math.min(next, pages))})};
}

export function PageControls({page, pages, go, label}: {page: number; pages: number; go: (page: number) => void; label: string}) {
  const t = useTranslations('Activity');
  if (pages <= 1) return null;
  return <nav className="page-controls" aria-label={label}>
    <button className="action-secondary" type="button" disabled={page === 1} onClick={event => {go(page - 1); event.currentTarget.closest('section')?.scrollIntoView({block: 'start', behavior: 'instant'});}}>{t('previous')}</button>
    <span role="status">{t('page', {page, pages})}</span>
    <button className="action-secondary" type="button" disabled={page === pages} onClick={event => {go(page + 1); event.currentTarget.closest('section')?.scrollIntoView({block: 'start', behavior: 'instant'});}}>{t('next')}</button>
  </nav>;
}

// Mount heavy form options on first use and preserve edits when collapsed.
export function LazyDetails({summary, children, className}: {summary: ReactNode; children: ReactNode | (() => ReactNode); className?: string}) {
  const [mounted, setMounted] = useState(false);
  return <details className={className} onToggle={event => {if (event.currentTarget.open) setMounted(true);}}>
    <summary>{summary}</summary>{mounted && (typeof children === 'function' ? children() : children)}
  </details>;
}
