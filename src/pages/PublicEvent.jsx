import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { usePageTitle } from '../lib/usePageTitle';

export default function PublicEvent() {
  const { slug } = useParams();
  const [event, setEvent] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [numberAttending, setNumberAttending] = useState(1);
  const [attending, setAttending] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  usePageTitle(event ? `RSVP for ${event.title}` : 'Invitation');

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();
      if (error || !data) setNotFound(true);
      else setEvent(data);
    }
    load();
  }, [slug]);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');

    const { error } = await supabase.from('rsvps').insert({
      event_id: event.id,
      guest_name: name,
      guest_email: email,
      guest_phone: phone || null,
      number_attending: numberAttending,
      attending,
    });

    if (error) {
      setStatus('error');
      setErrorMsg('Something went wrong - please try again.');
    } else {
      setStatus('done');
    }
  }

  if (notFound) return <div className="page-loading">This invitation could not be found.</div>;
  if (!event) return <div className="page-loading">Loading...</div>;

  const theme = event.theme_color || '#6d7f6a';
  const accent = event.accent_color || '#d8b98c';
  const hasImage = Boolean(event.image_url) && event.show_image !== false;
  const legacySide = event.box_left >= 50 ? 'right' : 'left';
  const layout = hasImage ? (event.box_mode || legacySide) : 'standalone';
  const cssVars = { '--theme': theme, '--accent': accent };

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
          <div className="field-row">
            <input
              type="number"
              min="1"
              max="20"
              placeholder="# Attending"
              value={numberAttending}
              onChange={(e) => setNumberAttending(Number(e.target.value))}
              style={{ width: '45%' }}
            />
            <div className="attending-row" style={{ width: '55%' }}>
              <label><input type="radio" name="attending" value="Yes" checked={attending === 'Yes'} onChange={(e) => setAttending(e.target.value)} required /> Yes</label>
              <label><input type="radio" name="attending" value="No" checked={attending === 'No'} onChange={(e) => setAttending(e.target.value)} required /> No</label>
            </div>
          </div>
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
  const isSplitLayout = layout === 'left' || layout === 'right';
  const formattedDate = event.event_date
    ? new Date(`${event.event_date}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
    : '';
  const eventDetails = (formattedDate || event.event_time || event.address) && (
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
        <div className={`public-card is-loaded layout-${layout} ${eventDetails ? 'has-event-details' : ''}`}>
          {layout === 'overlay' ? (
            <>
              {image}
              {rsvpBox('overlay', overlayStyle)}
            </>
          ) : layout === 'left' ? (
            <>
              {rsvpBox()}
              {image}
              {eventDetails}
            </>
          ) : layout === 'right' ? (
            <>
              {eventDetails}
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
        {!isSplitLayout && eventDetails}
        {event.audio_url && (
          <audio className="event-audio" src={event.audio_url} autoPlay controls preload="auto">
            Your browser does not support audio playback.
          </audio>
        )}
      </div>
      <Link to="/login?mode=signup" className="create-invite-cta">
        Want to make your own invite? <span>Click here</span>
      </Link>
    </div>
  );
}
