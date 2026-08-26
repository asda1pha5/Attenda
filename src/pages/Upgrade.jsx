import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { usePageTitle } from '../lib/usePageTitle';
import { supabase } from '../lib/supabaseClient';
import { trackFunnelEvent } from '../lib/funnelAnalytics';
import signatureMark from '../assets/attendaa-signature-mark.png';

export default function Upgrade() {
  const { user, isPremium } = useAuth();
  const [searchParams] = useSearchParams();
  const [checkoutError, setCheckoutError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const signatureOutcomes = [
    ['MAKE IT FEEL CUSTOM', 'More than a link in the group chat.', 'Choose an elevated invitation look and add audio that sets the mood from the first open.'],
    ['KEEP IT FOR YOUR PEOPLE', 'Personal details stay personal.', 'Add an access code and remove Attendaa branding when you want the invitation to feel entirely yours.'],
    ['KEEP THE DAY CLOSE', 'The invitation can live on after “yes.”', 'Bring guests back with a reminder, collect their photos, and keep a guest book of the little moments.'],
  ];
  usePageTitle('Attendaa Signature');

  useEffect(() => {
    void trackFunnelEvent('pricing_view', {}, user?.id);
    if (!user) return;
    supabase.from('events').select('id,title,event_date,signature_pass_active').eq('customer_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => {
        const available = (data || []).filter((event) => !event.signature_pass_active);
        setEvents(available);
        const requestedId = searchParams.get('event');
        setSelectedEventId(available.some((event) => event.id === requestedId) ? requestedId : available[0]?.id || '');
      });
  }, [user?.id, searchParams]);

  async function startCheckout() {
    setCheckoutError('');
    if (!user) return;
    setCheckingOut(true);
    if (!selectedEventId) {
      setCheckoutError('Create a free event first, then choose it for Attendaa Signature.');
      setCheckingOut(false);
      return;
    }
    await trackFunnelEvent('checkout_started', {}, user.id);
    const { data, error } = await supabase.functions.invoke('create-checkout-session', { body: { eventId: selectedEventId } });
    if (error || !data?.url) {
      setCheckoutError(data?.error || error?.message || 'Checkout is not available yet. Please try again.');
      setCheckingOut(false);
      return;
    }
    window.location.assign(data.url);
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
        <div className="upgrade-outcome-list">
          {signatureOutcomes.map(([eyebrow, title, description]) => <article key={eyebrow}><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></article>)}
        </div>
        <div className="upgrade-comparison" aria-label="Free and Signature feature comparison"><div><strong>Free</strong><span>One beautiful RSVP link, event details, guest list, flyer upload, registry link, and a downloadable QR code.</span></div><div><strong>Signature</strong><span>Everything in Free, plus elevated invitation looks, audio, privacy, reminders, photo album, guest book, and branding removal.</span></div></div>
        {searchParams.get('checkout') === 'success' && <p className="checkout-message">Thanks—your payment was received. Your Signature access will be active in a moment.</p>}
        {searchParams.get('checkout') === 'cancelled' && <p className="upgrade-note">Checkout was cancelled. Your free account is unchanged.</p>}
        {isPremium ? <Link className="primary-btn" to="/hub">Signature is active — go to my hub</Link> : user ? (
          <>
            <button className="primary-btn" type="button" disabled={checkingOut} onClick={startCheckout}>{checkingOut ? 'Opening secure checkout…' : 'Continue to secure checkout'}</button>
            {events.length > 0 ? <label className="upgrade-event-picker">Choose the event for Attendaa Signature<select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>{events.map((event) => <option key={event.id} value={event.id}>{event.title}{event.event_date ? ` — ${new Date(event.event_date).toLocaleDateString()}` : ''}</option>)}</select></label> : <p className="upgrade-note">Create your free event first. Then return here to add Signature to that invitation.</p>}
            {checkoutError && <p className="auth-error">{checkoutError}</p>}
            <p className="upgrade-note">One payment, one event, no recurring subscription. Your published event stays live for 90 days after its date, and you can edit it whenever plans change. Secure payment is handled by Stripe.</p>
          </>
        ) : <Link className="primary-btn" to="/login?mode=signup">Create a free account to upgrade</Link>}
      </section>
    </main>
  );
}
