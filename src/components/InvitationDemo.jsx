import { useState } from 'react';
import PublicEvent from '../pages/PublicEvent';
import { signatureTemplates } from '../lib/signatureTemplates';

export const fictionalInvitation = {
  title: 'A baby shower for Morgan', event_date: '2026-11-14', event_time: '02:00 PM',
  address: 'The Garden Room · fictional venue', rsvp_title: 'Please RSVP',
  rsvp_subtitle: 'A little one is on the way', flyer_background: 'sage', template_id: 'classic',
  registry_link: '#demo-registry', show_event_details: true, registry_position: 'bottom',
};

export default function InvitationDemo({ draft, template, onTemplateChange }) {
  const [selected, setSelected] = useState('classic');
  const active = template || selected;
  return <section className="invitation-demo" aria-label="Interactive invitation preview">
    <p className="landing-eyebrow">{draft ? 'YOUR PRIVATE PREVIEW' : 'INTERACTIVE FICTIONAL DEMO'}</p>
    <h2>One invitation. Try Free and Signature.</h2>
    <label>Invitation look<select value={active} onChange={(e) => { setSelected(e.target.value); onTemplateChange?.(e.target.value); }}>
      {signatureTemplates.map((style) => <option key={style.id} value={style.id}>{style.label} · {style.premium ? 'Signature preview' : 'Free'}</option>)}
    </select></label>
    <p>Free includes details, registry and RSVP. Signature adds these elevated looks and more for <strong>$19 once per event</strong>. No subscription.</p>
    <p className="demo-notice">Demo mode: RSVP and registry interactions stay on this page. Nothing is sent or published. Previewing Signature does not unlock paid features.</p>
    <PublicEvent demoEvent={{ ...fictionalInvitation, ...draft, template_id: active }} />
  </section>;
}
