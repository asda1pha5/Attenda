import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { usePageTitle } from '../lib/usePageTitle';
import { supabase } from '../lib/supabaseClient';
import { trackFunnelEvent } from '../lib/funnelAnalytics';

export default function Upgrade() {
  const { user, isPremium } = useAuth();
  const [searchParams] = useSearchParams();
  const [checkoutError, setCheckoutError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  usePageTitle('Attenda Signature');

  useEffect(() => {
    void trackFunnelEvent('pricing_view', {}, user?.id);
  }, [user?.id]);

  async function startCheckout() {
    setCheckoutError('');
    if (!user) return;
    setCheckingOut(true);
    await trackFunnelEvent('checkout_started', {}, user.id);
    const { data, error } = await supabase.functions.invoke('create-checkout-session', { body: {} });
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
        <p className="signature-kicker">Attenda Signature</p>
        <h1>Make the invitation part of the celebration.</h1>
        <p className="upgrade-lede">For the events people will remember, Signature adds privacy, richer design, guest photos, reminders, and a clean unbranded experience.</p>
        <div className="upgrade-feature-list">
          <span>Premium invitation looks</span><span>Private access codes</span><span>Guest photo album</span><span>Day-before reminders</span><span>Remove Attenda branding</span>
        </div>
        {searchParams.get('checkout') === 'success' && <p className="checkout-message">Thanks—your payment was received. Your Signature access will be active in a moment.</p>}
        {searchParams.get('checkout') === 'cancelled' && <p className="upgrade-note">Checkout was cancelled. Your free account is unchanged.</p>}
        {isPremium ? <Link className="primary-btn" to="/hub">Signature is active — go to my hub</Link> : user ? (
          <>
            <button className="primary-btn" type="button" disabled={checkingOut} onClick={startCheckout}>{checkingOut ? 'Opening secure checkout…' : 'Continue to secure checkout'}</button>
            {checkoutError && <p className="auth-error">{checkoutError}</p>}
            <p className="upgrade-note">Secure payment is handled by Stripe.</p>
          </>
        ) : <Link className="primary-btn" to="/login?mode=signup">Create a free account to upgrade</Link>}
      </section>
    </main>
  );
}
