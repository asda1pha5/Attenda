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

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [eventsRes, profilesRes] = await Promise.all([
      supabase.from('events').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    ]);
    setEvents(eventsRes.data || []);
    setCustomers(profilesRes.data || []);
    setLoading(false);
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
