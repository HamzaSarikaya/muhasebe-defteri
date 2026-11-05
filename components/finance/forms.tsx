'use client';

import {useRef, useState, type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {authenticate, saveRecord, type Result} from '@/lib/finance/actions';
import {currencies, decimalAmount} from '@/lib/finance/money';
import type {Account, Card, Client} from '@/lib/finance/ledger';

export function RecordForm({owner = '', action, label, children, confirm = false}: {
  owner?: string; action: string; label: string; children?: ReactNode; confirm?: boolean;
}) {
  const t = useTranslations('Finance');
  const router = useRouter();
  const request = useRef('');
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | 'offline'>();
  const [generation, setGeneration] = useState(0);
  return <form className="finance-form" aria-busy={pending} onSubmit={async event => {
    event.preventDefault();
    if (locked.current) return;
    if (!navigator.onLine) { setResult('offline'); return; }
    if (confirm && !window.confirm(t('confirm'))) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    locked.current = true;
    setPending(true);
    setResult(undefined);
    try {
      request.current ||= crypto.randomUUID();
      const status = action === 'login' || action === 'logout'
        ? await authenticate(action === 'logout', values)
        : await saveRecord(owner, action, request.current, values);
      setResult(status);
      if (status === 'saved') {
        request.current = '';
        setGeneration(n => n + 1);
        router.refresh();
      } else if (status === 'conflict') router.refresh();
    } catch { setResult('unavailable'); }
    finally { locked.current = false; setPending(false); }
  }}>
    <fieldset key={generation} disabled={pending} className="finance-fields">{children}</fieldset>
    <button type="submit" disabled={pending} className={confirm || action === 'logout' ? 'ledger-quiet' : 'ledger-submit'}>{pending ? t('pending') : label}</button>
    {result && <span role="status" className={result === 'saved' ? 'form-success' : 'form-error'}>{t(result)}</span>}
  </form>;
}

export function Field({label, name, type = 'text', value, required, min, max, maxLength, decimal, autoComplete}: {
  label: string; name: string; type?: string; value?: string | number; required?: boolean;
  min?: string | number; max?: string | number; maxLength?: number; decimal?: boolean; autoComplete?: string;
}) {
  return <label>{label}<input name={name} type={type} defaultValue={value} required={required} min={min} max={max}
    maxLength={maxLength} inputMode={decimal ? 'decimal' : undefined} autoComplete={autoComplete}
    pattern={decimal ? '[0-9]+([.,][0-9]{1,2})?' : undefined}/></label>;
}
export function CardFields({card}: {card?: Card}) {
  const t = useTranslations('Finance');
  return <>
    <Field label={t('name')} name="name" required maxLength={120} value={card?.name}/>
    <Field label={t('holder')} name="holder" maxLength={120} value={card?.primary_user ?? ''}/>
    <Field label={t('limit')} name="limit" decimal required value={decimalAmount(BigInt(card?.credit_limit ?? '0'))}/>
    <label>{t('currency')}<select name="currency" defaultValue={card?.currency ?? 'TRY'} disabled={!!card}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label>
    <Field label={t('statement')} name="statement" type="number" min={1} max={31} value={card?.statement_day ?? ''}/>
    <Field label={t('dueDay')} name="due" type="number" min={1} max={31} value={card?.due_day ?? ''}/>
  </>;
}
export function ClientFields({client}: {client?: Client}) {
  const t = useTranslations('Finance');
  return <><Field label={t('name')} name="name" required maxLength={120} value={client?.name}/>
    <Field label={t('email')} name="email" type="email" value={client?.email ?? ''}/>
    <Field label={t('phone')} name="phone" type="tel" value={client?.phone ?? ''}/></>;
}
export function Editor({owner, kind, row, children}: {owner: string; kind: 'card' | 'client' | 'account'; row: Card | Client | Account; children: ReactNode}) {
  const t = useTranslations('Finance');
  return <details className="ledger-editor"><summary>{t('edit')} · {row.name}</summary>
    <RecordForm owner={owner} action={kind} label={t('save')}><input type="hidden" name="id" value={row.id}/>{children}</RecordForm>
    <Remove owner={owner} kind={kind} id={row.id}/>
  </details>;
}
export function Remove({owner, kind, id}: {owner: string; kind: string; id: string}) {
  const t = useTranslations('Finance');
  return <RecordForm owner={owner} action="remove" label={t('remove')} confirm>
    <input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={id}/>
  </RecordForm>;
}

