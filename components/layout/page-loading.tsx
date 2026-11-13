import {useTranslations} from 'next-intl';

type LoadingView = 'overview' | 'cards' | 'clients' | 'transactions' | 'subscriptions' | 'reports' | 'settings';

function Placeholder({shape = 'line'}: {shape?: 'line' | 'short' | 'amount' | 'plot'}) {
  return <span className={'skeleton skeleton-' + shape}/>;
}

function SummaryPanels() {
  return <div className="summary-grid">{[0, 1, 2].map(index => <div className="panel skeleton-summary" key={index}>
    <Placeholder shape="short"/><Placeholder shape="amount"/><Placeholder/>
  </div>)}</div>;
}

function ListPanel() {
  return <div className="panel skeleton-list"><Placeholder shape="short"/>{[0, 1, 2, 3, 4].map(index =>
    <div className="skeleton-row" key={index}><div><Placeholder/><Placeholder shape="short"/></div><Placeholder shape="amount"/></div>
  )}</div>;
}

export function ChartLoading() {
  const t = useTranslations('Common');
  return <div className="chart-loading skeleton-chart-body" role="status" aria-label={t('loading')} aria-busy="true"><span className="sr-only">{t('loading')}</span><span aria-hidden="true" className="skeleton skeleton-plot"/></div>;
}

export function PageLoading({view = 'overview', heading = false}: {view?: LoadingView; heading?: boolean}) {
  const t = useTranslations('Common');
  const overview = view === 'overview';
  const summary = overview || view === 'reports' || view === 'subscriptions';
  return <section className={'route-loading skeleton-view-' + view} role="status" aria-label={t('loading')} aria-busy="true">
    <span className="sr-only">{t('loading')}</span>
    <div className="skeleton-layout" aria-hidden="true">
      {heading && <div className="skeleton-heading"><Placeholder shape="amount"/><Placeholder/></div>}
      {view === 'settings' ? <ListPanel/> : <>
        <div className="skeleton-toolbar"><Placeholder shape="short"/><Placeholder shape="short"/></div>
        {summary && <SummaryPanels/>}
        {(overview || view === 'reports') && <div className="analytics-grid">{[0, 1].map(index =>
          <div className="panel skeleton-chart" key={index}><Placeholder shape="short"/><Placeholder/><Placeholder shape="plot"/></div>
        )}</div>}
        {view === 'cards' || view === 'clients' ? <div className="ledger">{[0, 1, 2].map(index => <div className="panel skeleton-record" key={index}>
          <Placeholder shape="short"/><div className="skeleton-record-metrics">{[0, 1, 2].map(metric => <div key={metric}><Placeholder/><Placeholder shape="amount"/></div>)}</div>
          <Placeholder shape="short"/>
        </div>)}</div> : <ListPanel/>}
      </>}
    </div>
  </section>;
}
