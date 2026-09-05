import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/useAuth';
import { usePageTitle } from '../lib/usePageTitle';

export default function ManageRsvp() {
  const { slug } = useParams();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const next = encodeURIComponent(`/rsvp/${slug}/manage`);
  const eventLink = `/e/${slug}`;

  usePageTitle('Manage RSVP');

  async function cancelRsvp() {
    setStatus('saving');
    setMessage('');
    const { data, error } = await supabase.rpc('cancel_own_rsvp', { target_event_slug: slug });
    if (error) {
      setStatus('error');
      setMessage('We could not cancel your RSVP. Please make sure you are signed in with the email address used to RSVP, then try again.');
      return;
    }
    setStatus('done');
    setMessage(data
      ? 'Your RSVP has been cancelled. The host’s guest count has been updated.'
      : 'We could not find an active RSVP for this event under this account email.');
  }

  if (loading) return <div className="page-loading">Loading...</div>;

  if (!user) {
    return (
      <main className="rsvp-manager-page">
        <section className="rsvp-manager-card">
          <p className="signature-kicker">MANAGE YOUR RSVP</p>
          <h1>Need to change plans?</h1>
          <p>Create an Attendaa account—or sign in to one you already have—using the same email address you used to RSVP. That keeps cancellation private and secure.</p>
          <div className="rsvp-manager-actions">
            <Link className="primary-btn" to={`/login?mode=signup&next=${next}`}>Create an account</Link>
            <Link className="secondary-btn" to={`/login?mode=signin&next=${next}`}>Sign in</Link>
          </div>
          <Link className="rsvp-manager-back" to={eventLink}>Back to invitation</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="rsvp-manager-page">
      <section className="rsvp-manager-card">
        <p className="signature-kicker">MANAGE YOUR RSVP</p>
        <h1>Cancel your RSVP</h1>
        <p>We’ll only cancel an RSVP for this invitation if it uses <strong>{user.email}</strong>, the email on your signed-in Attendaa account.</p>
        {status === 'done' ? <p className="auth-info rsvp-manager-message">{message}</p> : <>
          <button className="rsvp-cancel-button" type="button" onClick={cancelRsvp} disabled={status === 'saving'}>
            {status === 'saving' ? 'Cancelling…' : 'Cancel my RSVP'}
          </button>
          <p className="rsvp-manager-note">This removes your response from the host’s active guest count and stops any future event reminders.</p>
          {status === 'error' && <p className="auth-error rsvp-manager-message">{message}</p>}
        </>}
        <Link className="rsvp-manager-back" to={eventLink}>Back to invitation</Link>
      </section>
    </main>
  );
}
