import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { usePageTitle } from '../lib/usePageTitle';
import { notifyHost } from '../lib/notifyHost';
import CommentWall from '../components/CommentWall';
import EventPhotoAlbum from '../components/EventPhotoAlbum';
import { getFlyerBackground } from '../lib/flyerBackgrounds';

export default function PublicEvent() {
  const { slug } = useParams();
  const [event, setEvent] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [expired, setExpired] = useState(false);
  const [locked, setLocked] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [accessError, setAccessError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [numberAttending, setNumberAttending] = useState(1);
  const [attending, setAttending] = useState('');
  const [privateMessage, setPrivateMessage] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  usePageTitle(event ? `RSVP for ${event.title}` : 'Invitation');

  useEffect(() => {
    loadEvent(sessionStorage.getItem(`attenda-access-${slug}`));
  }, [slug]);

  async function loadEvent(password) {
    const { data, error } = await supabase.rpc('get_public_event', {
      target_slug: slug,
      provided_password: password || null,
    });
    if (error || !data) {
      setNotFound(true);
      return;
    }
    if (data.locked) {
      setEvent(data);
      setLocked(true);
      return;
    }
    if (data.expired) {
      setEvent(data);
      setExpired(true);
      return;
    }
    setEvent(data);
    setLocked(false);
  }

  async function unlockEvent(e) {
    e.preventDefault();
    setAccessError('');
    const { data, error } = await supabase.rpc('get_public_event', {
      target_slug: slug,
      provided_password: accessCode,
    });
    if (error || !data || data.locked) {
      setAccessError('That access code did not match. Please try again.');
      return;
    }
    sessionStorage.setItem(`attenda-access-${slug}`, accessCode);
    setEvent(data);
    setLocked(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');

    const { data: rsvp, error } = await supabase.rpc('submit_public_rsvp', {
      target_event_id: event.id,
      target_guest_name: name,
      target_guest_email: email,
      target_guest_phone: phone || null,
      target_number_attending: numberAttending,
      target_attending: attending,
      target_private_message: privateMessage.trim() || null,
    });

    if (error) {
      setStatus('error');
      setErrorMsg('Something went wrong - please try again.');
    } else {
      setStatus('done');
      if (rsvp?.notification_token) {
        void notifyHost({
          eventId: event.id,
          recordId: rsvp.rsvp_id,
          notificationType: 'private_message',
          notificationToken: rsvp.notification_token,
        });
      }
    }
  }

  if (notFound) return <div className="page-loading">This invitation could not be found.</div>;
  if (!event) return <div className="page-loading">Loading...</div>;
  if (expired) return <main className="invitation-lock-page"><section className="invitation-lock-card"><p className="signature-kicker">EVENT ARCHIVE</p><h1>This invitation has closed.</h1><p>{event.title ? `${event.title} is no longer accepting RSVPs.` : 'This event is no longer accepting RSVPs.'}</p></section></main>;
  if (locked) return (
    <main className="invitation-lock-page">
      <section className="invitation-lock-card">
        <p className="event-details-label">Private invitation</p>
        <h1>{event.title || 'This event'}</h1>
        <p>Enter the access code from your host to view the invitation and RSVP.</p>
        <form onSubmit={unlockEvent}>
          <input type="password" autoFocus value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Access code" required />
          {accessError && <p className="auth-error">{accessError}</p>}
          <button className="primary-btn" type="submit">Open invitation</button>
        </form>
      </section>
    </main>
  );

  const background = getFlyerBackground(event.flyer_background);
  const theme = '#63765f';
  const accent = '#a87a45';
  const hasImage = Boolean(event.image_url) && event.show_image !== false;
  const legacySide = event.box_left >= 50 ? 'right' : 'left';
  const requestedLayout = event.box_mode || legacySide;
  // Overlay used to be a standard setting. Existing invitations fall back to
  // the reliable below-flyer layout unless a Signature host enabled it.
  const layout = hasImage
    ? (requestedLayout === 'overlay' && !event.overlay_enabled ? 'below' : requestedLayout)
    : 'standalone';
  const cssVars = { '--theme': theme, '--accent': accent, '--flyer-bg': background.color, '--flyer-ink': background.ink };

  const registryButton = event.registry_link && (
    <a className="registry-link" href={event.registry_link} target="_blank" rel="noopener noreferrer">
      View Our Registry
    </a>
  );

  const rsvpBox = (extraClass = '', extraStyle = {}) => (
    <div className={`rsvp-box ${extraClass}`} style={{ ...cssVars, ...extraStyle }}>
      {event.registry_position === 'top' && registryButton}
      <h2>{event.rsvp_title || 'Please RSVP'}</h2>
      {event.rsvp_subtitle && <p className="rsvp-subtitle">{event.rsvp_subtitle}</p>}

      {status === 'done' ? (
        <div className="thank-you">
          Thank you - your RSVP has been received!
          <span>We can't wait to celebrate with you.</span>
        </div>
      ) : (
        <form className="rsvp-form" onSubmit={handleSubmit}>
          <input type="text" placeholder="Family / Guest Name(s)" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="guest-count-control">
            <span>Total Guests <small>(Including you)</small></span>
            <div>
              <button type="button" onClick={() => setNumberAttending((current) => Math.max(1, current - 1))} aria-label="Remove one guest">−</button>
              <strong>{numberAttending}</strong>
              <button type="button" onClick={() => setNumberAttending((current) => Math.min(20, current + 1))} aria-label="Add one guest">+</button>
            </div>
          </div>
          <div className="attending-row attending-options">
            <label><input type="radio" name="attending" value="Yes" checked={attending === 'Yes'} onChange={(e) => setAttending(e.target.value)} required /> Yes</label>
            <label><input type="radio" name="attending" value="Maybe" checked={attending === 'Maybe'} onChange={(e) => setAttending(e.target.value)} required /> Maybe</label>
            <label><input type="radio" name="attending" value="No" checked={attending === 'No'} onChange={(e) => setAttending(e.target.value)} required /> No</label>
          </div>
          <label className="private-message-field">
            Private message for the host <span>(optional, 250 characters)</span>
            <textarea
              rows="3"
              maxLength="250"
              value={privateMessage}
              onChange={(e) => setPrivateMessage(e.target.value)}
              placeholder="Share something just with the host..."
            />
            <small>{privateMessage.length}/250</small>
          </label>
          <button type="submit" className="submit-btn" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending...' : 'Send RSVP'}
          </button>
          {status === 'error' && <div className="status-msg">{errorMsg}</div>}
        </form>
      )}

      {event.registry_position !== 'top' && registryButton}
    </div>
  );

  const image = hasImage && <img className="event-flyer" src={event.image_url} alt={event.title} />;
  const rsvpFirst = layout === 'above' || layout === 'left' || layout === 'standalone';
  const formattedDate = event.event_date
    ? new Date(`${event.event_date}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
    : '';
  const eventDetails = event.show_event_details !== false && (formattedDate || event.event_time || event.address) && (
    <aside className="event-details-panel">
      <p className="event-details-label">Event details</p>
      {event.title && <h1>{event.title}</h1>}
      {formattedDate && <p>{formattedDate}</p>}
      {event.event_time && (
        <p className="event-details-time">
          {event.event_time}{event.event_end_time ? ` – ${event.event_end_time}` : ''}
        </p>
      )}
      {event.address && <p>{event.address}</p>}
    </aside>
  );
  const overlayStyle = {
    top: `${event.box_top ?? 25}%`,
    left: `${event.box_left ?? 11}%`,
    width: `${event.box_width ?? 78}%`,
  };

  return (
    <div className="public-page" style={cssVars}>
      <div className="public-card-wrap">
        {eventDetails}
        <div className="invitation-frame">
          <div className={`public-card is-loaded layout-${layout} template-${event.template_id || 'classic'}`}>
            {layout === 'overlay' ? (
              <>
                {image}
                {rsvpBox('overlay', overlayStyle)}
              </>
            ) : layout === 'left' ? (
              <>
                {rsvpBox()}
                {image}
              </>
            ) : layout === 'right' ? (
              <>
                {image}
                {rsvpBox()}
              </>
            ) : (
              <>
                {rsvpFirst && rsvpBox()}
                {image}
                {!rsvpFirst && rsvpBox()}
              </>
            )}
          </div>
        </div>
        {event.audio_url && (
          <audio className="event-audio" src={event.audio_url} autoPlay controls preload="auto">
            Your browser does not support audio playback.
          </audio>
        )}
        <CommentWall
          eventId={event.id}
          canComment={status === 'done'}
          guestName={name}
          guestEmail={email}
        />
        {event.photo_album_enabled && (
          <EventPhotoAlbum eventId={event.id} canUpload={status === 'done'} guestName={name} guestEmail={email} />
        )}
      </div>
      {!event.remove_branding && (
        <Link to="/login?mode=signup" className="create-invite-cta">
          Want to make your own invite? <span>Click here</span>
        </Link>
      )}
    </div>
  );
}
