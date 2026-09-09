import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { babyShowerWording } from '../lib/babyShowerWording';
import { trackFunnelEvent } from '../lib/funnelAnalytics';
import { usePageTitle } from '../lib/usePageTitle';

export default function BabyShowerWording() {
  const [tone, setTone] = useState('warm');
  const [wording, setWording] = useState(babyShowerWording());
  const [message, setMessage] = useState('');
  usePageTitle('Free baby shower invitation wording');
  useEffect(() => { void trackFunnelEvent('wording_tool_viewed', { experiment: 'baby-wording-v1' }); }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(wording); setMessage('Copied. Replace the bracketed details before sharing.'); void trackFunnelEvent('wording_copied', { experiment: 'baby-wording-v1', tone }); }
    catch { setMessage('Select the wording below and copy it using your browser.'); }
  }
  return <main className="draft-page wording-page">
    <p className="landing-eyebrow">A LITTLE HELP WITH THE FIRST WORDS</p>
    <h1>Baby shower invitation wording</h1>
    <p>Choose a tone, then replace the bracketed details. Registry wording is optional. Your edits stay on this page and are never sent to analytics.</p>
    <label>Tone<select value={tone} onChange={(e) => { setTone(e.target.value); setWording(babyShowerWording(e.target.value)); setMessage(''); void trackFunnelEvent('wording_generated', { experiment: 'baby-wording-v1', tone: e.target.value }); }}><option value="warm">Warm</option><option value="simple">Simple</option><option value="playful">Playful</option></select></label>
    <label>Your wording<textarea rows={12} value={wording} onChange={(e) => setWording(e.target.value)} /></label>
    <button className="secondary-btn" type="button" onClick={copy}>Copy wording</button>
    <p role="status">{message}</p>
    <h2>Give those words a place to live.</h2>
    <p>Preview your invitation, then add your wording and details in the editor. Free includes your registry link and RSVP.</p>
    <Link className="primary-btn" to="/create?utm_source=attendaa&utm_medium=tool&utm_campaign=baby-shower&utm_content=baby-wording-v1" onClick={() => void trackFunnelEvent('wording_create_clicked', { experiment: 'baby-wording-v1' })}>Create your invitation</Link>
  </main>;
}
