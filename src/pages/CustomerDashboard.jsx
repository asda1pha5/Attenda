import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/useAuth';
import SubmissionsTable from '../components/SubmissionsTable';
import { usePageTitle } from '../lib/usePageTitle';
import ThemeToggle from '../components/ThemeToggle';

export default function CustomerDashboard() {
  usePageTitle('My Events');
  const { user, profile, isAdmin } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openEventId, setOpenEventId] = useState(null);

  useEffect(() => {
    if (!user) return;
    loadEvents();
  }, [user]);

  async function loadEvents() {
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });
    setEvents(data || []);
    setLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>My Events</h1>
          <p className="muted">Your invitations, guest list, and responses in one place.</p>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          {isAdmin && <Link to="/admin" className="secondary-btn">Admin View</Link>}
          <Link to="/hub/new" className="primary-btn">+ New Event</Link>
          <button className="secondary-btn" onClick={handleSignOut}>Sign Out</button>
        </div>
      </header>

      {loading ? (
        <div className="muted">Loading…</div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <p>You haven't created an event yet.</p>
          <Link to="/hub/new" className="primary-btn">Create your first event</Link>
        </div>
      ) : (
        <div className="event-list">
          {events.map((ev) => (
            <div className="event-card" key={ev.id}>
              <div className="event-card-main">
                <h3>{ev.title}</h3>
                <p className="muted">
                  {ev.event_date ? new Date(ev.event_date).toLocaleDateString() : 'No date set'}
                  {ev.event_time ? ` · ${ev.event_time}` : ''}
                  {ev.event_end_time ? ` – ${ev.event_end_time}` : ''}
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
