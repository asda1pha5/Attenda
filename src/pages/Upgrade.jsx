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
  const signatureFeatures = [
    ['Invitation audio', 'Set the mood the second guests open your link.'],
    ['Private access codes', 'Keep personal events for the people on your list.'],
    ['Signature invitation looks', 'Choose elevated templates that feel made for the moment.'],
    ['Guest photo album', 'Let your people add the memories that happen on the day.'],
    ['Automatic reminders', 'Bring guests back at the right time without chasing replies.'],
    ['A cleaner final touch', 'Remove Attendaa branding from your published invitation.'],
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
        <h1>Make the first yes feel like part of the celebration.</h1>
        <p className="upgrade-lede">Signature turns an RSVP link into a more personal invitation—from the music guests hear when it opens to the details that make it unmistakably yours.</p>
        <div className="upgrade-promise"><strong>For showers, birthdays, reunions, graduations, and the people you cannot wait to gather.</strong><span>Start free. Upgrade only when the moment calls for more.</span></div>
        <div className="upgrade-feature-list">
          {signatureFeatures.map(([title, description]) => <article key={title}><span aria-hidden="true">✦</span><h2>{title}</h2><p>{description}</p></article>)}
        </div>
        {searchParams.get('checkout') === 'success' && <p className="checkout-message">Thanks—your payment was received. Your Signature access will be active in a moment.</p>}
        {searchParams.get('checkout') === 'cancelled' && <p className="upgrade-note">Checkout was cancelled. Your free account is unchanged.</p>}
        {isPremium ? <Link className="primary-btn" to="/hub">Signature is active — go to my hub</Link> : user ? (
          <>
            <button className="primary-btn" type="button" disabled={checkingOut} onClick={startCheckout}>{checkingOut ? 'Opening secure checkout…' : 'Continue to secure checkout'}</button>
            {events.length > 0 ? <label className="upgrade-event-picker">Choose the event for Attendaa Signature<select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>{events.map((event) => <option key={event.id} value={event.id}>{event.title}{event.event_date ? ` — ${new Date(event.event_date).toLocaleDateString()}` : ''}</option>)}</select></label> : <p className="upgrade-note">Create your free event first. Then return here to add Signature to that invitation.</p>}
            {checkoutError && <p className="auth-error">{checkoutError}</p>}
            <p className="upgrade-note">Attendaa Signature is a one-time payment for one event—no recurring subscription. Secure payment is handled by Stripe.</p>
          </>
        ) : <Link className="primary-btn" to="/login?mode=signup">Create a free account to upgrade</Link>}
      </section>
    </main>
  );
}
