import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { usePageTitle } from '../lib/usePageTitle';
import { useAuth } from '../lib/useAuth';

const initialForm = { name: '', email: '', subject: '', message: '', company: '' };

export default function Support() {
  const { user, profile } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  usePageTitle('Help & support');

  const signedIn = Boolean(user?.email);
  const accountName = profile?.full_name || user?.user_metadata?.full_name || 'Attendaa member';
  const accountEmail = user?.email || '';

  useEffect(() => {
    if (!signedIn) return;
    setForm((current) => ({ ...current, name: accountName, email: accountEmail }));
  }, [signedIn, accountName, accountEmail]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setStatus('');
    const { error } = await supabase.functions.invoke('contact-support', { body: form });
    if (error) {
      setStatus('We could not send your note just now. Please try again in a moment.');
    } else {
      setForm(signedIn ? { ...initialForm, name: accountName, email: accountEmail } : initialForm);
      setStatus('Your note is on its way. We’ll reply to the email you shared.');
    }
    setSending(false);
  };

  return (
    <main className="support-page">
      <section className="support-hero">
        <p className="support-kicker">ATTENDAA SUPPORT</p>
        <h1>We’re here to help you gather.</h1>
        <p>Whether you are setting up your first invitation or need a hand with an RSVP, send us a note. We’ll reply by email.</p>
        <div className="support-quick-links">
          <Link to="/baby-shower-rsvp">Make a baby shower RSVP</Link>
          <Link to="/upgrade">Explore Attendaa Signature</Link>
        </div>
      </section>

      <section className="support-form-card" aria-labelledby="support-form-title">
        <div>
          <p className="support-kicker">SEND A NOTE</p>
          <h2 id="support-form-title">How can we help?</h2>
          <p>Tell us what is happening and include a link to your event if it is relevant.</p>
        </div>
        <form onSubmit={submit}>
          {signedIn ? (
            <p className="support-signed-in-note">Signed in as <strong>{accountName}</strong>. We’ll reply to <strong>{accountEmail}</strong>.</p>
          ) : (
            <div className="support-form-grid">
              <label>
                Your name
                <input name="name" value={form.name} onChange={updateField} autoComplete="name" maxLength="100" required />
              </label>
              <label>
                Email address
                <input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" maxLength="254" required />
              </label>
            </div>
          )}
          <label>
            What can we help with?
            <input name="subject" value={form.subject} onChange={updateField} placeholder="For example: I need help sharing my invitation" maxLength="160" required />
          </label>
          <label>
            Your message
            <textarea name="message" value={form.message} onChange={updateField} rows="7" placeholder="Share as much detail as you can so we can point you in the right direction." maxLength="5000" required />
          </label>
          <label className="support-honeypot" aria-hidden="true">
            Company
            <input name="company" value={form.company} onChange={updateField} tabIndex="-1" autoComplete="off" />
          </label>
          <button className="primary-btn support-submit" type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send message'}</button>
          {status && <p className="support-status" role="status">{status}</p>}
        </form>
      </section>
    </main>
  );
}
