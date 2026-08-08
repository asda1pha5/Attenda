import { Link } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { usePageTitle } from '../lib/usePageTitle';

export default function Upgrade() {
  const { isPremium } = useAuth();
  usePageTitle('Attenda Signature');

  return (
    <main className="upgrade-page">
      <section className="upgrade-card">
        <p className="signature-kicker">Attenda Signature</p>
        <h1>Make the invitation part of the celebration.</h1>
        <p className="upgrade-lede">For the events people will remember, Signature adds privacy, richer design, guest photos, reminders, and a clean unbranded experience.</p>
        <div className="upgrade-feature-list">
          <span>Premium invitation looks</span><span>Private access codes</span><span>Guest photo album</span><span>Day-before reminders</span><span>Remove Attenda branding</span>
        </div>
        {isPremium ? <Link className="primary-btn" to="/hub">Signature is active — go to my hub</Link> : <p className="upgrade-note">Signature checkout is the next launch connection. Until Stripe is connected, plans can be activated manually from Supabase for private testing.</p>}
      </section>
    </main>
  );
}
