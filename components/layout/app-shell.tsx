import {BookOpen, ChartNoAxesCombined, Settings2} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Suspense, type ReactNode} from 'react';
import {Link} from './pending-link';
import {Navigation, SettingsLink} from './navigation';
import {LocaleSwitcher} from './locale-switcher';
import {ConnectionNotice} from './connection-notice';

export function AppShell({children}: {children: ReactNode}) {
  const t = useTranslations('Common');
  return <div className="app-shell">
    <a href="#main-content" className="skip-link">{t('skipToContent')}</a>
    <aside className="sidebar">
      <Navigation rail />
      <div className="sidebar-footer"><SettingsLink compact /></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <Link href="/" className="brand" aria-label={t('appName')}>
          <span className="brand-symbol"><BookOpen size={20} strokeWidth={1.75} aria-hidden="true" /></span>
          <span>{t('appName')}</span>
        </Link>
        <Navigation />
        <div className="topbar-actions">
          <Link href="/reports" className="reports-shortcut settings-shortcut" aria-label={t('reports')}><ChartNoAxesCombined size={20} strokeWidth={1.75} aria-hidden="true"/></Link>
          <Suspense fallback={<span className="locale-placeholder" />}><LocaleSwitcher /></Suspense>
          <Link href="/settings" className="settings-shortcut" aria-label={t('settings')}><Settings2 size={20} strokeWidth={1.75} aria-hidden="true" /></Link>
        </div>
      </header>
      <main id="main-content" className="main-content" tabIndex={-1}><ConnectionNotice /><div id="page-content" className="page-content"><div className="page-records">{children}</div></div></main>
    </div>
    <Navigation mobile />
  </div>;
}
