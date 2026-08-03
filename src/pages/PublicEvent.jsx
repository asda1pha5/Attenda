import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function PublicEvent() {
  const { slug } = useParams();
  const [event, setEvent] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState('');
  const [numberAttending, setNumberAttending] = useState(1);
  const [attending, setAttending] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [errorMsg, setErrorMsg] = useState('');

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
      number_attending: numberAttending,
      attending,
    });

    if (error) {
      setStatus('error');
      setErrorMsg('Something went wrong — please try again.');
    } else {
      setStatus('done');
    }
  }

  if (notFound) {
    return <div className="page-loading">This invitation could not be found.</div>;
  }
  if (!event) {
    return <div className="page-loading">Loading…</div>;
  }

  return (
    <div className="public-card-wrap">
      <div className="public-card">
        {event.image_url && <img src={event.image_url} alt={event.title} />}

        <div
          className="rsvp-box"
          style={{
            top: `${event.box_top}%`,
            left: `${event.box_left}%`,
            width: `${event.box_width}%`,
            height: `${event.box_height}%`,
          }}
        >
          <h2>Please RSVP</h2>

          {status === 'done' ? (
            <div className="thank-you">
              Thank you — your RSVP has been received!
              <span>We can't wait to celebrate with you.</span>
            </div>
          ) : (
            <form className="rsvp-form" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Family / Guest Name(s)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
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
                  <label>
                    <input
                      type="radio"
                      name="attending"
                      value="Yes"
                      checked={attending === 'Yes'}
                      onChange={(e) => setAttending(e.target.value)}
                      required
                    /> Yes
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="attending"
                      value="No"
                      checked={attending === 'No'}
                      onChange={(e) => setAttending(e.target.value)}
                      required
                    /> No
                  </label>
                </div>
              </div>
              <button type="submit" className="submit-btn" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send RSVP'}
              </button>
              {status === 'error' && <div className="status-msg">{errorMsg}</div>}
            </form>
          )}

          {event.registry_link && (
            <a className="registry-link" href={event.registry_link} target="_blank" rel="noopener noreferrer">
              🎁 View Our Registry
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
