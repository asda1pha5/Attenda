import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { usePageTitle } from '../lib/usePageTitle';
import { trackFunnelEvent } from '../lib/funnelAnalytics';
import celebrationImage from '../assets/signup-celebration-collage.png';
import stationeryImage from '../assets/landing-stationery.png';

export default function Landing() {
  const { user } = useAuth();
  usePageTitle('RSVP pages for family milestones');

  useEffect(() => {
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      'Create a beautiful RSVP page for baby showers, birthdays, graduations, reunions, and the family milestones worth gathering for.'
    );
    void trackFunnelEvent('landing_view');

    const sections = document.querySelectorAll('.landing-reveal');
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible')),
      { threshold: 0.16 }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const startLink = user ? '/hub/new' : '/login?mode=signup';

  return (
    <main className="landing-page">
      <section className="landing-hero landing-reveal is-visible">
        <div className="landing-copy">
          <p className="landing-eyebrow">ATTENDAA · PLAN, INVITE, CELEBRATE</p>
          <h1>The easy yes for family milestones.</h1>
          <p className="landing-lede">Turn the details of your celebration into one beautiful link—easy to share, simple for guests, and organized for you.</p>
          <div className="landing-actions">
            <Link className="primary-btn landing-primary" to={startLink} onClick={() => void trackFunnelEvent('landing_cta_clicked', { placement: 'hero' }, user?.id)}>
              Create a free event
            </Link>
            <a className="landing-text-link" href="#how-it-works">See how it works</a>
          </div>
          <p className="landing-note">Free to start. No card required.</p>
        </div>
        <div className="landing-visual">
          <img src={celebrationImage} alt="A joyful gathering prepared for a celebration" />
          <span className="landing-spark landing-spark-one" aria-hidden="true">✦</span>
          <span className="landing-spark landing-spark-two" aria-hidden="true">✦</span>
          <div className="landing-rsvp-card">
            <span>Saturday · October 18</span>
            <strong>Celebrating together</strong>
            <p>One lovely link for every guest.</p>
            <b>RSVP</b>
          </div>
        </div>
      </section>

      <section className="landing-section landing-reveal" id="how-it-works">
        <p className="landing-eyebrow">BUILT FOR FAMILY MILESTONES</p>
        <h2>From invite to headcount in three simple steps.</h2>
        <div className="landing-walkthroughs">
          <article><img src="/marketing/attendaa-live-invitation-story.svg" alt="Real Attendaa Sunday Brunch invitation page" /><div><span>01 · MAKE IT YOURS</span><h3>Start with the details, then choose the feeling.</h3><p>Add your flyer, date, place, and the invitation look that fits your celebration.</p></div></article>
          <article><img src="/marketing/attendaa-live-rsvp-story.svg" alt="Real Attendaa RSVP page with a Send RSVP callout" /><div><span>02 · SHARE ONE LINK</span><h3>Give guests a page they’ll actually want to open.</h3><p>Text it, add it to an invitation, or share it anywhere your people are gathering.</p></div></article>
          <article><img src="/marketing/attendaa-live-guestbook-story.svg" alt="Real Attendaa guest book and photo album page section" /><div><span>03 · KEEP THE CELEBRATION CLOSE</span><h3>More than a headcount.</h3><p>Signature can turn the invite into a guest book and photo album guests return to.</p></div></article>
        </div>
      </section>

      <section className="landing-signature landing-reveal" id="signature">
        <div>
          <p className="landing-eyebrow">ATTENDAA SIGNATURE</p>
          <h2>For the family moments you want to make unforgettable.</h2>
          <p>Unlock invitation audio, private access codes, elevated looks, guest photo albums, reminders, and an unbranded experience for one special event.</p>
        </div>
        <Link className="secondary-btn" to="/upgrade" onClick={() => void trackFunnelEvent('signature_interest_clicked', { placement: 'landing' }, user?.id)}>Explore Signature</Link>
      </section>

      <section className="landing-stationery landing-reveal" aria-label="Attendaa invitation stationery">
        <img src={stationeryImage} alt="Elegant invitation cards and an RSVP envelope" />
        <div className="landing-stationery-copy">
          <p className="landing-eyebrow">THE DETAILS, BEAUTIFULLY HELD</p>
          <h2>More than a form. A warm welcome to your event.</h2>
          <p>Give guests a thoughtful first impression, then give yourself a simple way to stay organized.</p>
        </div>
      </section>

      <section className="landing-section landing-occasions landing-reveal">
        <p className="landing-eyebrow">ONE LINK, THE PEOPLE WHO MATTER</p>
        <h2>Made for the family milestones worth showing up for.</h2>
        <div><span>Baby showers</span><span>Birthdays</span><span>Graduations</span><span>Family reunions</span><span>Anniversaries</span><span>Welcome-home gatherings</span></div>
      </section>

      <section className="landing-final-cta landing-reveal">
        <h2>Ready to make your next family milestone feel special?</h2>
        <Link className="primary-btn landing-primary" to={startLink} onClick={() => void trackFunnelEvent('landing_cta_clicked', { placement: 'footer' }, user?.id)}>Create your free event</Link>
        <Link className="landing-help-link" to="/help">Need a hand? Contact Attendaa support</Link>
      </section>
    </main>
  );
}
