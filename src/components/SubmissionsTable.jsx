import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SubmissionsTable({ eventId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('rsvps')
        .select('*')
        .eq('event_id', eventId)
        .is('cancelled_at', null)
        .order('created_at', { ascending: false });
      if (mounted) {
        if (!error) setRows(data);
        setLoading(false);
      }
    }
    load();

    // Live updates keep the guest count correct when a guest responds or
    // securely cancels their RSVP from an Attendaa account.
    const channel = supabase
      .channel(`rsvps-${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rsvps', filter: `event_id=eq.${eventId}` },
        (payload) => setRows((prev) => [payload.new, ...prev])
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rsvps', filter: `event_id=eq.${eventId}` },
        (payload) => {
          if (payload.new.cancelled_at) setRows((prev) => prev.filter((row) => row.id !== payload.new.id));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) =>
    !normalizedSearch || [row.guest_name, row.guest_email, row.guest_phone]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSearch))
  );

  function exportCsv() {
    const header = 'Name,Email,Phone,Attending,Number,Private Message,Submitted At\n';
    const body = filteredRows
      .map((r) => `"${r.guest_name}","${r.guest_email || ''}","${r.guest_phone || ''}","${r.attending}",${r.number_attending},"${(r.private_message || '').replace(/"/g, '""')}","${new Date(r.created_at).toLocaleString()}"`)
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rsvps-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="muted">Loading submissions…</div>;
  if (rows.length === 0) return <div className="muted">No RSVPs yet.</div>;

  const attendingCount = filteredRows.filter((r) => r.attending === 'Yes').reduce((s, r) => s + (r.number_attending || 1), 0);

  return (
    <div>
      <div className="submissions-toolbar">
        <span>{rows.length} responses · {attendingCount} attending</span>
        <input
          className="guest-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, or phone"
          aria-label="Search guests by name, email, or phone"
        />
        <button onClick={exportCsv}>Export CSV</button>
      </div>
      <table className="submissions-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Attending</th>
            <th># Guests</th>
            <th>Private message</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((r) => (
            <tr key={r.id}>
              <td>{r.guest_name}</td>
              <td>{r.guest_email || '—'}</td>
              <td>{r.guest_phone || '—'}</td>
              <td>{r.attending}</td>
              <td>{r.number_attending}</td>
              <td>{r.private_message || '—'}</td>
              <td>{new Date(r.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
