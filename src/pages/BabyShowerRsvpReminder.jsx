import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { babyShowerRsvpReminders } from '../lib/babyShowerRsvpReminders';
import { trackFunnelEvent } from '../lib/funnelAnalytics';
import { useSeoMetadata } from '../lib/useSeoMetadata';
import './BabyShowerRsvpReminder.css';

export default function BabyShowerRsvpReminder() {
  const [copyStatus, setCopyStatus] = useState({ id: '', text: '' });
  useSeoMetadata({
    title: 'Baby Shower RSVP Reminder Wording | Attendaa',
    description: 'Copy kind baby shower RSVP reminder messages for before, on, or after the reply date, plus maybe guests and final headcounts.',
    path: '/baby-shower-rsvp-reminder',
    image: '/baby-shower-social-preview.png',
  });

  useEffect(() => {
    void trackFunnelEvent('landing_view', { entry: 'baby-shower-rsvp-reminder' });
  }, []);

  async function copyMessage(reminder) {
    try {
      await navigator.clipboard.writeText(reminder.message);
      setCopyStatus({ id: reminder.id, text: `${reminder.label} message copied. Replace every bracketed detail before sending.` });
    } catch {
      setCopyStatus({ id: reminder.id, text: `Couldn’t copy automatically. Select the ${reminder.label.toLowerCase()} message and copy it with your browser.` });
    }
  }

  return (
    <main className="reminder-page">
      <section className="reminder-hero" aria-labelledby="reminder-title">
        <div className="reminder-hero-copy">
          <p className="reminder-eyebrow">BABY SHOWER PLANNING WORDS</p>
          <h1 id="reminder-title">Kind baby shower RSVP reminder wording</h1>
          <p className="reminder-lede">Waiting on a reply can feel awkward. These ready-to-edit messages help you ask clearly while leaving room for real life.</p>
          <a className="reminder-jump" href="#messages">Choose a message <span aria-hidden="true">↓</span></a>
        </div>
        <aside className="reminder-hero-note" aria-label="Planning note">
          <span aria-hidden="true">✦</span>
          <p><strong>Let your plans set the date.</strong> Check when your venue, caterer, or other plans require a final number, then leave yourself time to follow up. There is no single RSVP date that fits every shower.</p>
        </aside>
      </section>

      <section className="reminder-intro" id="messages" aria-labelledby="message-heading">
        <p className="reminder-eyebrow">COPY, THEN MAKE IT YOURS</p>
        <h2 id="message-heading">Five common RSVP moments</h2>
        <p>Replace the bracketed details and read the message once in your own voice. A short personal opening can make even a practical deadline feel warm.</p>
      </section>

      <div className="reminder-grid">
        {babyShowerRsvpReminders.map((reminder, index) => (
          <article className="reminder-card" key={reminder.id}>
            <div className="reminder-card-heading">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <p>{reminder.label}</p>
                <h3>{reminder.title}</h3>
              </div>
            </div>
            <p className="reminder-note">{reminder.note}</p>
            <blockquote>{reminder.message}</blockquote>
            <button type="button" onClick={() => copyMessage(reminder)} aria-describedby={`${reminder.id}-tip`}>
              Copy this message
            </button>
            <p className="reminder-copy-status" role="status" aria-live="polite">{copyStatus.id === reminder.id ? copyStatus.text : ''}</p>
            <p className="reminder-edit-tip" id={`${reminder.id}-tip`}>Edit every detail in [brackets] before sending.</p>
          </article>
        ))}
      </div>

      <section className="reminder-kindness" aria-labelledby="kindness-heading">
        <div>
          <p className="reminder-eyebrow">A GENTLER FOLLOW-UP</p>
          <h2 id="kindness-heading">Clear can still feel considerate.</h2>
        </div>
        <ul>
          <li>Start from the possibility that the invitation was missed or the guest simply forgot.</li>
          <li>Ask for one action by one date, using the reply method you actually track.</li>
          <li>Name a firm final cutoff only when your venue, caterer, or plans truly require it.</li>
          <li>Avoid guilt, public callouts, or a long explanation. A private, direct note is enough.</li>
        </ul>
      </section>

      <section className="reminder-next" aria-labelledby="next-heading">
        <p className="reminder-eyebrow">KEEP THE DETAILS TOGETHER</p>
        <h2 id="next-heading">Give guests one place to reply.</h2>
        <p>Create a baby-shower invitation with the date, place, registry, and RSVP in one link. Guests can view it and reply without an Attendaa account.</p>
        <div className="reminder-actions">
          <Link className="reminder-primary" to="/create" onClick={() => void trackFunnelEvent('landing_cta_clicked', { placement: 'rsvp-reminder-resource' })}>Create your free invitation</Link>
          <Link className="reminder-secondary" to="/baby-shower-wording">Write the invitation wording</Link>
        </div>
      </section>
    </main>
  );
}
