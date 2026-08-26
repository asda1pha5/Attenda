import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { usePageTitle } from '../lib/usePageTitle';
import { trackFunnelEvent } from '../lib/funnelAnalytics';
import { babyShowerStyles } from '../lib/eventStylePresets';

export default function BabyShowerLanding() {
  const { user } = useAuth();
  usePageTitle('Baby Shower RSVP Website');

  useEffect(() => {
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'Create a beautiful baby shower RSVP website. Share every detail, collect responses, add your registry, and keep the celebration together.');
    void trackFunnelEvent('baby_shower_landing_view');
  }, []);

  const startLink = (style) => user ? `/hub/new?style=${style}` : `/login?mode=signup&next=${encodeURIComponent(`/hub/new?style=${style}`)}`;

  return <main className="milestone-page">
    <section className="milestone-hero">
      <div className="milestone-copy">
        <p className="landing-eyebrow">BABY SHOWER RSVP WEBSITE</p>
        <h1>The RSVP page for your baby shower.</h1>
        <p>Create one lovely RSVP link for the shower—easy to text, simple for guests, and warm from the very first open.</p>
        <div className="milestone-actions"><Link className="primary-btn landing-primary" to={startLink('garden-welcome')}>Create your free baby shower RSVP</Link><a className="landing-text-link" href="#styles">See invitation styles</a></div>
        <span>Free to start. No card required.</span>
      </div>
      <div className="baby-hero-invite" aria-label="Sample baby shower invitation">
        <div className="baby-hero-bloom baby-hero-bloom-one" /><div className="baby-hero-bloom baby-hero-bloom-two" />
        <p>CELEBRATING BABY</p><h2>Baby<br />Morgan</h2><i>Join us for a garden shower</i><div className="baby-hero-date">SATURDAY · MAY 18</div><b>Please RSVP</b>
      </div>
    </section>

    <section className="milestone-section" id="styles">
      <p className="landing-eyebrow">START WITH A FEELING</p><h2>Choose an invitation style, then make it yours.</h2>
      <div className="baby-template-grid">
        {babyShowerStyles.map((style) => <article className={`baby-template-card baby-style-${style.id}`} key={style.id}>
          <div className="baby-template-art"><span>{style.detail}</span><strong>{style.name === 'Little Sunshine' ? 'hello, sunshine' : style.name === 'Storybook Baby' ? 'a little story begins' : style.name === 'Modern Nest' ? 'a little love grows' : 'baby in bloom'}</strong><i>baby shower</i></div>
          <div><h3>{style.name}</h3><p>{style.description}</p><Link to={startLink(style.id)} onClick={() => void trackFunnelEvent('baby_template_selected', { style: style.id }, user?.id)}>Use this style <span aria-hidden="true">→</span></Link></div>
        </article>)}
      </div>
    </section>

    <section className="milestone-benefits"><div><span>01</span><h2>One lovely link for every guest.</h2><p>Include the date, place, registry, and RSVP in one easy-to-share invitation.</p></div><div><span>02</span><h2>Know who is coming without chasing texts.</h2><p>Watch your guest list come together in your Attendaa hub.</p></div><div><span>03</span><h2>Keep the celebration close.</h2><p>Signature can bring reminders, private access, music, and photos into the same invitation.</p></div></section>

    <section className="baby-signature"><p className="landing-eyebrow">ATTENDAA SIGNATURE</p><h2>For the shower you want people to remember.</h2><p>Make the invitation feel custom, keep personal details for your people, and collect the little moments afterward—with elevated looks, audio, private access, reminders, and a photo album.</p><div><strong>$19</strong><span>one time for one event · no automatic renewal</span></div><Link className="secondary-btn" to="/upgrade">See what Signature adds</Link></section>

    <section className="baby-faq"><p className="landing-eyebrow">A FEW GOOD QUESTIONS</p><h2>Everything your guests need, in one place.</h2><details><summary>Is Attendaa free to start?</summary><p>Yes. Create, publish, and share a beautiful baby shower RSVP page for free.</p></details><details><summary>Can I text the RSVP link?</summary><p>Absolutely. Your invitation has one link you can text, add to a printed invitation, or share anywhere.</p></details><details><summary>Do guests need an account?</summary><p>No. Guests can open the link and RSVP without creating an Attendaa account.</p></details><details><summary>Can I add a registry?</summary><p>Yes. Add your registry link while creating the event, and guests will see it on the invitation.</p></details><details><summary>Can I edit details after I share the link?</summary><p>Yes. Update the date, place, registry, RSVP details, or invitation look in your hub. Guests keep using the same link and see the updated information.</p></details><details><summary>How long will my event stay live?</summary><p>Your published event stays live for 90 days after its event date. Your RSVP list remains available in the host hub, and the admin can adjust this policy when needed.</p></details></section>
    <section className="milestone-final"><h2>Ready to make the first yes feel special?</h2><Link className="primary-btn landing-primary" to={startLink('garden-welcome')}>Create your free baby shower RSVP</Link></section>
  </main>;
}
