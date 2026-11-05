'use client';

import {useState} from 'react';
import {Download, Search, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import type {Ledger} from '@/lib/finance/ledger';
import {currencies, type Currency} from '@/lib/finance/money';
import {activityCsv, backupJson, emptyFilters, validRange, type Filters} from '@/lib/finance/reports';

export function ActivityFilters({value, onChange, allCurrencies = true}: {value: Filters; onChange: (value: Filters) => void; allCurrencies?: boolean}) {
  const t = useTranslations('Activity');
  const set = (key: keyof Filters, text: string) => onChange({...value, [key]: text});
  return <div className="activity-filters">
    <label className="search-field">{t('search')}<span><Search size={17} strokeWidth={1.75} aria-hidden="true"/><input type="search" value={value.query} maxLength={200} onChange={e => set('query', e.target.value)} placeholder={t('searchHint')}/></span></label>
    <label>{t('from')}<input type="date" value={value.from} onChange={e => set('from', e.target.value)} aria-invalid={!validRange(value)} aria-describedby={!validRange(value) ? 'range-error' : undefined}/></label>
    <label>{t('to')}<input type="date" value={value.to} onChange={e => set('to', e.target.value)} aria-invalid={!validRange(value)} aria-describedby={!validRange(value) ? 'range-error' : undefined}/></label>
    {allCurrencies && <label>{t('currency')}<select value={value.unit} onChange={e => set('unit', e.target.value as Currency | '')}><option value="">{t('allCurrencies')}</option>{currencies.map(unit => <option key={unit}>{unit}</option>)}</select></label>}
    <button type="button" className="filter-reset" onClick={() => onChange({...emptyFilters, unit: allCurrencies ? '' : value.unit})} disabled={!value.query && !value.from && !value.to && (!allCurrencies || !value.unit)}><X size={16} strokeWidth={1.75} aria-hidden="true"/>{t('clear')}</button>
    {!validRange(value) && <p id="range-error" className="form-error" role="alert">{t('invalidRange')}</p>}
  </div>;
}

export function ExportTools({data, filters, today}: {data: Ledger; filters: Filters; today: string}) {
  const t = useTranslations('Activity');
  const [message, setMessage] = useState('');
  function download(kind: 'csv' | 'json') {
    try {
      const content = kind === 'csv' ? activityCsv(data, filters) : backupJson(data, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([content], {type: kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8'}));
      const link = document.createElement('a');
      link.href = url; link.download = `muhasebe-${kind === 'json' ? 'backup' : 'activity'}-${today}.${kind}`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(t('downloaded'));
    } catch {setMessage(t('downloadError'));}
  }
  return <div className="export-tools"><div className="export-actions"><button type="button" className="action-secondary" disabled={!validRange(filters)} onClick={() => download('csv')}><Download size={16} strokeWidth={1.75} aria-hidden="true"/>{t('csv')}</button><button type="button" className="action-secondary" onClick={() => download('json')}>{t('json')}</button></div><p>{t('exportNote')}</p>{message && <p role="status">{message}</p>}</div>;
}
