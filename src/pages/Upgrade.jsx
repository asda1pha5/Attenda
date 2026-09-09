import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { usePageTitle } from '../lib/usePageTitle';
import { supabase } from '../lib/supabaseClient';
import { getCheckoutAttribution, trackFunnelEvent } from '../lib/funnelAnalytics';
import signatureMark from '../assets/attendaa-signature-mark.png';
import InvitationDemo from '../components/InvitationDemo';

export default function Upgrade() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkoutError, setCheckoutError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [activation, setActivation] = useState('idle');
  const [refresh, setRefresh] = useState(0);
  const checkoutLock = useRef(false);
  const requestedId = searchParams.get('event') || '';
  const returnedFromCheckout = searchParams.get('checkout') === 'success';
  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const signatureOutcomes = [
    ['MAKE IT FEEL CUSTOM', 'More than a link in the group chat.', 'Choose an elevated invitation look and add audio that sets the mood from the first open.'],
    ['KEEP IT FOR YOUR PEOPLE', 'Personal details stay personal.', 'Add an access code and remove Attendaa branding when you want the invitation to feel entirely yours.'],
    ['KEEP THE DAY CLOSE', 'The invitation can live on after “yes.”', 'Bring guests back with a reminder, collect their photos, and keep a guest book of the little moments.'],
  ];
  usePageTitle('Attendaa Signature');
  useEffect(() => {
    if (returnedFromCheckout && activation === 'active' && selectedEvent?.signature_pass_active === true) {
      navigate(`/hub/edit/${selectedEvent.id}?signature=active`, { replace: true });
    }
  }, [returnedFromCheckout, activation, selectedEvent?.id, selectedEvent?.signature_pass_active, navigate]);

  useEffect(() => {
    void trackFunnelEvent('pricing_view', {}, user?.id);
  }, [user?.id]);

  useEffect(() => {
    let disposed = false;
    let timer;
    let attempts = 0;
    setEvents([]);
    setSelectedEventId('');
    setCheckoutError('');
    setLoadingEvents(Boolean(user));
    setActivation(returnedFromCheckout ? 'checking' : 'idle');
    if (!user) return;
    async function load() {
      try {
        const { data, error } = await supabase.from('events').select('id,title,event_date,signature_pass_active').eq('customer_id', user.id).order('created_at', { ascending: false });
        if (disposed) return;
        if (error) throw error;
        const owned = data || [];
        const target = owned.find((event) => event.id === requestedId);
        setEvents(owned);
        // Never silently charge for a different event when a requested event is unavailable.
        setSelectedEventId(requestedId ? target?.id || '' : owned.find((event) => !event.signature_pass_active)?.id || owned[0]?.id || '');
        setLoadingEvents(false);
        if (requestedId && !target) {
          setCheckoutError('This event is unavailable for this account. Sign in as its owner or choose another event.');
          setActivation('unavailable');
          return;
        }
        if (!returnedFromCheckout) return;
        if (!target) {
          setActivation('unavailable');
          setCheckoutError('The checkout return is missing an event. Open your event from the hub to check its Signature access.');
        } else if (target.signature_pass_active === true) {
          setActivation('active');
        } else if (++attempts < 10) {
          setActivation('checking');
          timer = setTimeout(load, 3000);
        } else setActivation('pending');
      } catch {
        if (disposed) return;
        setLoadingEvents(false);
        setActivation('error');
        setCheckoutError('We could not check your event right now. Please retry.');
      }
    }
    void load();
    return () => { disposed = true; clearTimeout(timer); };
  }, [user?.id, requestedId, returnedFromCheckout, refresh]);

  async function startCheckout() {
    setCheckoutError('');
    if (!user || checkoutLock.current || returnedFromCheckout) return;
    checkoutLock.current = true;
    setCheckingOut(true);
    if (!selectedEvent || selectedEvent.signature_pass_active) {
      setCheckoutError('Create a free event first, then choose it for Attendaa Signature.');
      setCheckingOut(false);
      checkoutLock.current = false;
      return;
    }
    void trackFunnelEvent('checkout_started', {}, user.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', { body: { eventId: selectedEventId, ...getCheckoutAttribution() } });
      if (error || !data?.url) throw new Error(data?.error || 'Checkout is not available yet. Please try again.');
      window.location.assign(data.url);
    } catch (error) {
      setCheckoutError(error.message || 'Checkout is not available yet. Please try again.');
      setCheckingOut(false);
      checkoutLock.current = false;
    }
  }

  return (
    <main className="upgrade-page">
      <section className="upgrade-card">
        <div className="signature-brand-lockup">
          <img src={signatureMark} alt="Attendaa Signature" />
          <div><p className="signature-kicker">Attendaa Signature</p><p className="signature-brand-note">For invitations worth keeping</p></div>
        </div>
        <h1>Make the invitation feel as special as the day.</h1>
        <p className="upgrade-lede">Attendaa Signature turns your RSVP link into a more personal place to gather—before, during, and after the celebration.</p>
        <div className="upgrade-promise"><strong>$19 one time, for one event.</strong><span>No subscription. No automatic renewal. Edit your event whenever plans change.</span></div>
        {returnedFromCheckout && <div className="checkout-message" role="status" aria-live="polite">
          {activation === 'active' ? <p>Signature is confirmed active for this event.</p> : <p>{activation === 'checking' ? 'Checking this event’s Signature access…' : 'Signature activation has not been confirmed. Payment processing may take a little longer. If you paid, do not purchase again.'}</p>}
          {['pending', 'error', 'unavailable'].includes(activation) && <button type="button" className="secondary-btn" onClick={() => setRefresh((value) => value + 1)}>Check activation again</button>}
          {selectedEvent && <Link className="secondary-btn" to={`/hub/edit/${selectedEvent.id}`}>{activation === 'active' ? 'Return to your Signature invitation' : 'Return to your invitation'}</Link>}
          <Link to="/help">Need help?</Link>
        </div>}
        <div className="upgrade-outcome-list">
          {signatureOutcomes.map(([eyebrow, title, description]) => <article key={eyebrow}><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></article>)}
        </div>
        <div className="upgrade-comparison" aria-label="Free and Signature feature comparison"><div><strong>Free</strong><span>One beautiful RSVP link, event details, guest list, guest book, flyer upload, registry link, and a downloadable QR code.</span></div><div><strong>Signature</strong><span>Everything in Free, plus elevated invitation looks, audio, private access, reminders, photo album, and branding removal.</span></div></div>
        <InvitationDemo />
        {searchParams.get('checkout') === 'cancelled' && <p className="upgrade-note">Checkout was cancelled. Your free account is unchanged.</p>}
        {user ? (
          <>
            {!returnedFromCheckout && (selectedEvent?.signature_pass_active ? <Link className="primary-btn" to={`/hub/edit/${selectedEvent.id}`}>Signature is active — open this invitation</Link> : <button className="primary-btn" type="button" disabled={checkingOut || loadingEvents || !selectedEvent} onClick={startCheckout}>{checkingOut ? 'Opening secure checkout…' : 'Continue to secure checkout — $19'}</button>)}
            {loadingEvents ? <p role="status">Loading your events…</p> : events.length > 0 ? <label className="upgrade-event-picker">{returnedFromCheckout ? 'Your checkout event' : 'Choose the event for Attendaa Signature'}<select disabled={checkingOut || returnedFromCheckout} value={selectedEventId} onChange={(event) => { setSearchParams({ event: event.target.value }); }}>{!selectedEventId && <option value="">Choose your event</option>}{events.map((event) => <option key={event.id} value={event.id}>{event.title}{event.signature_pass_active ? ' — Signature active' : ''}{event.event_date ? ` — ${new Date(`${event.event_date}T12:00:00`).toLocaleDateString()}` : ''}</option>)}</select></label> : !checkoutError && <p className="upgrade-note"><Link to="/hub/new">Create your free event first.</Link> Then return here to add Signature to that invitation.</p>}
            {checkoutError && <p className="auth-error">{checkoutError}</p>}
            {activation === 'error' && !returnedFromCheckout && <button type="button" className="secondary-btn" onClick={() => setRefresh((value) => value + 1)}>Retry loading events</button>}
            <p className="upgrade-note">One payment, one event, no recurring subscription. Your published event stays live for 90 days after its date, and you can edit it whenever plans change. Secure payment is handled by Stripe.</p>
          </>
        ) : <Link className="primary-btn" to={`/login?mode=${returnedFromCheckout ? 'signin' : 'signup'}&next=${encodeURIComponent(`/upgrade?${searchParams.toString()}`)}`}>{returnedFromCheckout ? 'Sign in to check your event' : 'Create a free account to upgrade'}</Link>}
      </section>
    </main>
  );
}
