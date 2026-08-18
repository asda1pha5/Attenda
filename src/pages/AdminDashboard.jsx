import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/useAuth';
import SubmissionsTable from '../components/SubmissionsTable';
import { usePageTitle } from '../lib/usePageTitle';
import ThemeToggle from '../components/ThemeToggle';

export default function AdminDashboard() {
  usePageTitle('Admin Events');
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openEventId, setOpenEventId] = useState(null);
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [retentionDays, setRetentionDays] = useState(90);
  const [savingRetention, setSavingRetention] = useState(false);
  const [retentionError, setRetentionError] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [eventsRes, profilesRes, settingsRes] = await Promise.all([
      supabase.from('events').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('app_settings').select('value').eq('key', 'event_retention_days').maybeSingle(),
    ]);
    setEvents(eventsRes.data || []);
    setCustomers(profilesRes.data || []);
    setRetentionDays(Number(settingsRes.data?.value?.days) || 90);
    setLoading(false);
  }

  async function saveRetentionDays() {
    const days = Number(retentionDays);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setRetentionError('Choose a whole number between 1 and 3,650 days.');
      return;
    }
    setSavingRetention(true);
    setRetentionError('');
    const { error } = await supabase.from('app_settings').upsert({ key: 'event_retention_days', value: { days }, updated_at: new Date().toISOString() });
    if (error) setRetentionError(error.message);
    setSavingRetention(false);
  }

  async function toggleRetentionExempt(event) {
    const { error } = await supabase.from('events').update({ retention_exempt: !event.retention_exempt }).eq('id', event.id);
    if (error) {
      setRetentionError(error.message);
      return;
    }
    setEvents((current) => current.map((item) => item.id === event.id ? { ...item, retention_exempt: !event.retention_exempt } : item));
  }

  function expirationLabel(event) {
    if (!event.event_date) return 'No event date — no automatic expiration';
    if (event.retention_exempt) return 'Kept live indefinitely by admin';
    const expires = new Date(`${event.event_date}T12:00:00`);
    expires.setDate(expires.getDate() + Number(retentionDays || 90));
    return `Closes ${expires.toLocaleDateString()} (${retentionDays} days after event)`;
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const customerName = (customerId) => {
    const c = customers.find((c) => c.id === customerId);
    return c?.full_name || c?.email || 'Unknown';
  };

  const normalizedSearch = customerSearch.trim().toLowerCase();
  const filteredEvents = events.filter((event) => {
    const matchesSelectedCustomer = filterCustomer === 'all' || event.customer_id === filterCustomer;
    const owner = customerName(event.customer_id).toLowerCase();
    return matchesSelectedCustomer && (!normalizedSearch || owner.includes(normalizedSearch));
  });

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Admin — All Events</h1>
          <p className="muted">{customers.length} customers · {events.length} events</p>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <Link to="/admin/new" className="primary-btn">+ Create for a user</Link>
          <Link to="/admin/funnel" className="secondary-btn">Growth funnel</Link>
          <Link to="/hub" className="secondary-btn">My Own Hub</Link>
          <button className="secondary-btn" onClick={handleSignOut}>Sign Out</button>
        </div>
      </header>

      <div className="admin-filter">
        <label className="customer-search">
          Search customers:
          <input
            type="search"
            list="customer-suggestions"
            placeholder="Start typing a name or email"
            value={customerSearch}
            onChange={(e) => {
              const value = e.target.value;
              setCustomerSearch(value);
              const matchedCustomer = customers.find((customer) =>
                [customer.full_name, customer.email].filter(Boolean).some((item) => item.toLowerCase() === value.toLowerCase())
              );
              setFilterCustomer(matchedCustomer?.id || 'all');
            }}
          />
          <datalist id="customer-suggestions">
            {customers.map((customer) => (
              <option key={customer.id} value={customer.full_name || customer.email}>
                {customer.email}
              </option>
            ))}
          </datalist>
        </label>
        <label>
          Filter by customer:
          <select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}>
            <option value="all">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name || c.email}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="admin-retention-controls">
        <div><p className="signature-kicker">EVENT RETENTION</p><h2>Keep published events live for</h2><p>After an event date passes, its public RSVP page closes automatically. Events with no date remain live until you change them.</p></div>
        <label><input type="number" min="1" max="3650" value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} /> days after the event</label>
        <button className="secondary-btn" type="button" onClick={saveRetentionDays} disabled={savingRetention}>{savingRetention ? 'Saving…' : 'Save policy'}</button>
        {retentionError && <p className="auth-error">{retentionError}</p>}
      </section>

      {loading ? (
        <div className="muted">Loading…</div>
      ) : filteredEvents.length === 0 ? (
        <div className="empty-state"><p>No events found.</p></div>
      ) : (
        <div className="event-list">
          {filteredEvents.map((ev) => (
            <div className="event-card" key={ev.id}>
              <div className="event-card-main">
                <h3>{ev.title}</h3>
                <p className="muted">Owner: {customerName(ev.customer_id)}</p>
                <p className="muted">
                  {ev.event_date ? new Date(ev.event_date).toLocaleDateString() : 'No date set'}
                  {ev.event_time ? ` · ${ev.event_time}` : ''}
                  {ev.event_end_time ? ` – ${ev.event_end_time}` : ''} · {ev.is_published ? 'Published' : 'Draft'}
                </p>
                <p className="event-retention-status">{expirationLabel(ev)}</p>
                <p className="event-link">
                  <code>/e/{ev.slug}</code>
                  <button
                    className="tiny-btn"
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/e/${ev.slug}`)}
                  >
                    Copy link
                  </button>
                </p>
              </div>
              <div className="event-card-actions">
                <Link to={`/e/${ev.slug}`} target="_blank" className="secondary-btn">View Page</Link>
                <Link to={`/hub/edit/${ev.id}`} className="secondary-btn">Edit</Link>
                {ev.event_date && <button className="secondary-btn" onClick={() => toggleRetentionExempt(ev)}>{ev.retention_exempt ? 'Use standard expiration' : 'Keep live indefinitely'}</button>}
                <button
                  className="secondary-btn"
                  onClick={() => setOpenEventId(openEventId === ev.id ? null : ev.id)}
                >
                  {openEventId === ev.id ? 'Hide RSVPs' : 'View RSVPs'}
                </button>
              </div>
              {openEventId === ev.id && (
                <div className="event-submissions">
                  <SubmissionsTable eventId={ev.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
