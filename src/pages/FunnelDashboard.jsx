import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { usePageTitle } from '../lib/usePageTitle';

const stages = [
  ['landing_view', 'Landing views'],
  ['landing_cta_clicked', 'Free-start clicks'],
  ['signup_started', 'Signups started'],
  ['signup_completed', 'Accounts created'],
  ['event_created', 'Events created'],
  ['checkout_started', 'Checkout started'],
  ['checkout_completed', 'Signature activated'],
];

export default function FunnelDashboard() {
  usePageTitle('Funnel');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void loadFunnel(); }, []);

  async function loadFunnel() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('funnel_events')
      .select('event_name, visitor_id, created_at, source, medium, campaign')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    setEvents(data || []);
    setLoading(false);
  }

  const metrics = useMemo(() => stages.map(([name, label]) => {
    const matching = events.filter((event) => event.event_name === name);
    return { name, label, events: matching.length, visitors: new Set(matching.map((event) => event.visitor_id)).size };
  }), [events]);
  const landingVisitors = metrics[0]?.visitors || 0;
  const sources = useMemo(() => {
    const grouped = new Map();
    events.filter((event) => event.event_name === 'landing_view').forEach((event) => {
      const label = event.source || event.referrer_host || 'Direct';
      grouped.set(label, (grouped.get(label) || 0) + 1);
    });
    return [...grouped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [events]);

  return (
    <div className="dashboard funnel-dashboard">
      <header className="dashboard-header">
        <div><h1>Growth funnel</h1><p className="muted">Last 30 days · anonymous behavior and conversion signals.</p></div>
        <Link to="/admin" className="secondary-btn">Back to admin</Link>
      </header>
      {loading ? <p className="muted">Loading funnel data…</p> : (
        <>
          <section className="funnel-stage-list" aria-label="Funnel stages">
            {metrics.map((metric, index) => (
              <article key={metric.name} className="funnel-stage">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div><h2>{metric.label}</h2><strong>{metric.visitors}</strong><p>{metric.events} recorded actions{index ? ` · ${landingVisitors ? Math.round((metric.visitors / landingVisitors) * 100) : 0}% of landing visitors` : ''}</p></div>
              </article>
            ))}
          </section>
          <section className="funnel-sources">
            <h2>Top traffic sources</h2>
            {sources.length ? <ul>{sources.map(([source, count]) => <li key={source}><span>{source}</span><strong>{count} visits</strong></li>)}</ul> : <p className="muted">Traffic sources will appear after visitors reach the new landing page.</p>}
          </section>
        </>
      )}
    </div>
  );
}
