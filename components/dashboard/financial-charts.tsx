'use client';

import {useTranslations} from 'next-intl';
import {Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {formatMoney, type Currency} from '@/lib/finance/money';

type Trend = {month: string; debt: string; collected: string};
type Spend = {name: string; amount: string};
type Props = {unit: Currency; locale: string} & ({kind: 'trend'; rows: Trend[]} | {kind: 'spending'; rows: Spend[]});
// Only chart geometry uses Number. Labels and tooltips always use original minor units.
function normalize(value: string, max: bigint) {
  return max === 0n ? 0 : Number(BigInt(value) * 10000n / max) / 100;
}

export default function FinancialCharts(props: Props) {
  const t = useTranslations('Dashboard');
  const {unit, locale} = props;
  const money = (value: string) => formatMoney(value, unit, locale);
  const month = (value: string) => new Intl.DateTimeFormat(locale, {month: 'short', year: '2-digit', timeZone: 'UTC'}).format(new Date(value + '-01T00:00:00Z'));
  const values = props.kind === 'trend' ? props.rows.flatMap(row => [row.debt, row.collected]) : props.rows.map(row => row.amount);
  const max = values.reduce((max, value) => {const n = BigInt(value); return (n < 0n ? -n : n) > max ? (n < 0n ? -n : n) : max;}, 0n);
  if (max === 0n) return <div className="chart-empty"><div className="empty-chart-lines" aria-hidden="true"><span/><span/><span/></div><h3>{t(props.kind === 'trend' ? 'noTrend' : 'noSpending')}</h3><p>{t(props.kind === 'trend' ? 'noTrendNote' : 'noSpendingNote')}</p></div>;
  if (props.kind === 'trend') {
    const rows = props.rows.map(row => ({...row, label: month(row.month), debtPlot: normalize(row.debt, max), collectionPlot: normalize(row.collected, max)}));
    return <><div className="chart-legend"><span><i className="legend-debt"/>{t('receivable')}</span><span><i className="legend-collection"/>{t('collection')}</span></div>
      <div className="chart-canvas" aria-hidden="true"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={rows} margin={{top: 12, right: 32, bottom: 8, left: 32}} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 5"/>
          <XAxis dataKey="label" tick={{fill: 'var(--color-secondary)', fontSize: 11}} axisLine={false} tickLine={false} dy={8} minTickGap={12}/><YAxis hide domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}/>
          <Tooltip content={({active, payload}) => {const row = payload?.[0]?.payload as typeof rows[number] | undefined; return active && row ? <div className="chart-tooltip"><b>{row.label}</b><p>{t('receivable')} <span className="money">{money(row.debt)}</span></p><p>{t('collection')} <span className="money">{money(row.collected)}</span></p></div> : null;}}/>
          <Line dataKey="debtPlot" stroke="var(--chart-debt)" strokeWidth={2} dot={{r: 3, fill: 'var(--color-surface)', strokeWidth: 2}} activeDot={{r: 4}} isAnimationActive={false}/>
          <Line dataKey="collectionPlot" stroke="var(--chart-collection)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false}/>
        </LineChart>
      </ResponsiveContainer></div>
      <details className="chart-data"><summary>{t('viewData')}</summary><div className="table-scroll"><table><caption>{t('trend')} ({unit})</caption><thead><tr><th scope="col">{t('month')}</th><th scope="col">{t('receivable')}</th><th scope="col">{t('collection')}</th></tr></thead><tbody>{rows.map(row => <tr key={row.month}><th scope="row">{row.label}</th><td className="money">{money(row.debt)}</td><td className="money">{money(row.collected)}</td></tr>)}</tbody></table></div></details>
    </>;
  }
  const rows = props.rows.map(row => ({...row, value: normalize(row.amount, max)}));
  return <><div className="chart-canvas spending-canvas" style={{height: Math.max(140, rows.length * 44)}} aria-hidden="true"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
    <BarChart data={rows} layout="vertical" margin={{top: 8, bottom: 8, left: 16, right: 24}} accessibilityLayer={false}>
      <XAxis type="number" hide domain={[Math.min(0, ...rows.map(row => row.value)), 100]}/><YAxis type="category" dataKey="name" width={72} tick={{fill: 'var(--color-secondary)', fontSize: 11}} tickFormatter={value => String(value).length > 11 ? String(value).slice(0, 10) + '…' : String(value)} axisLine={false} tickLine={false}/>
      <Tooltip cursor={{fill: 'var(--color-surface-hover)'}} content={({active, payload}) => {const row = payload?.[0]?.payload as typeof rows[number] | undefined; return active && row ? <div className="chart-tooltip"><b>{row.name}</b><p className="money">{money(row.amount)}</p></div> : null;}}/>
      <Bar dataKey="value" fill="var(--chart-debt)" barSize={12} radius={[0, 3, 3, 0]} isAnimationActive={false}/>
    </BarChart>
  </ResponsiveContainer></div><ul className="spending-values">{rows.map((row, index) => <li key={index}><span>{row.name}</span><strong className="money">{money(row.amount)}</strong></li>)}</ul></>;
}
