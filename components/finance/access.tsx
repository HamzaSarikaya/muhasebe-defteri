import {Database, LockKeyhole} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/components/layout/pending-link';
import {Field, RecordForm} from './forms';

export async function LedgerAccess({state}: {state: 'setup' | 'login'}) {
  const t = await getTranslations('Finance');
  const d = await getTranslations('Dashboard');
  const Icon = state === 'setup' ? Database : LockKeyhole;
  return <section className="panel access-panel">
    <div className="access-message"><Icon size={24} strokeWidth={1.75} aria-hidden="true"/><div>
      <h2>{d(state === 'setup' ? 'connectTitle' : 'loginTitle')}</h2><p>{d(state === 'setup' ? 'connectDescription' : 'loginDescription')}</p>
    </div></div>
    {state === 'setup' ? <Link href="/settings" className="action-secondary">{t('settings')}</Link> :
      <RecordForm action="login" label={t('signIn')}><Field name="email" type="email" label={t('email')} autoComplete="username" required/><Field name="password" type="password" label={t('password')} autoComplete="current-password" required/></RecordForm>}
  </section>;
}
