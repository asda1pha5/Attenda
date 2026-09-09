import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { supabase } from '../lib/supabaseClient';
import { trackFunnelEvent } from '../lib/funnelAnalytics';
import { newDraft, readDraft, writeDraft, resetDraft, saveDraftEvent } from '../lib/invitationDraft';
import { babyShowerStyles, getBabyShowerStyle } from '../lib/eventStylePresets';
import InvitationDemo from '../components/InvitationDemo';
import { usePageTitle } from '../lib/usePageTitle';

export default function CreateInvitation() {
  usePageTitle('Preview your invitation');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [draft, setDraft] = useState(() => { try { return readDraft(localStorage) || newDraft(params.get('style')); } catch { return newDraft(params.get('style')); } });
  const [storageOK, setStorageOK] = useState(true);
  const [preview, setPreview] = useState(params.get('save') === '1');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const resumed = useRef(false);
  const style = getBabyShowerStyle(draft.style);
  useEffect(() => { void trackFunnelEvent('invitation_started'); }, []);
  useEffect(() => { try { setStorageOK(writeDraft(localStorage, draft)); } catch { setStorageOK(false); } }, [draft]);
  function update(key, value) { setDraft((current) => ({ ...current, [key]: value, updatedAt: Date.now() })); }
  async function save() {
    if (inFlight.current) return;
    setError('');
    if (!draft.title.trim() || !draft.event_date) { setError('Add a title and date before saving.'); return; }
    if (!user) {
      if (!storageOK) { setError('Browser storage is unavailable. Keep this tab open, sign in in another tab, then return to save.'); return; }
      navigate('/login?mode=signup&next=%2Fcreate%3Fsave%3D1'); return;
    }
    inFlight.current = true; setBusy(true);
    try {
      const result = await saveDraftEvent(supabase, draft, user.id, style.flyer_background);
      if (result.created) { void trackFunnelEvent('event_created', { entry: 'preview' }); void trackFunnelEvent('invitation_saved'); }
      try { resetDraft(localStorage); } catch {}
      navigate(`/hub/edit/${result.id}?previewStyle=${draft.template_id}`, { replace: true });
    } catch (err) { setError(err.message); }
    finally { inFlight.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!loading && user && params.get('save') === '1' && !resumed.current) { resumed.current = true; void save(); }
  }, [loading, user?.id]);
  return <main className="draft-page">
    <p className="landing-eyebrow">CHOOSE A STYLE → ADD DETAILS → PREVIEW → SAVE</p>
    <h1>See your invitation before signing up.</h1>
    <p>Your title, date and style stay in this browser for up to 7 days. Add private venue details and registry links after signing in. Please keep sensitive information out of this preview.</p>
    <form className="draft-form" onSubmit={(e) => { e.preventDefault(); setPreview(true); void trackFunnelEvent('invitation_previewed', { style: draft.style, template: draft.template_id }); }}>
      <label>Style<select value={draft.style} onChange={(e) => update('style', e.target.value)}>{babyShowerStyles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Invitation title<input required maxLength={100} value={draft.title} onChange={(e) => update('title', e.target.value)} /></label>
      <label>Date<input type="date" required value={draft.event_date} onChange={(e) => update('event_date', e.target.value)} /></label>
      <label>Time (optional)<input type="time" value={draft.event_time} onChange={(e) => update('event_time', e.target.value)} /></label>
      <button className="primary-btn" type="submit">Preview invitation</button>
      <button type="button" className="secondary-btn" onClick={() => { try { resetDraft(localStorage); } catch {} setDraft(newDraft()); setPreview(false); setError(''); }}>Reset draft</button>
    </form>
    <p role="status">{storageOK ? 'Draft saved in this browser. Nothing is published.' : 'Browser storage unavailable. Your preview works, but will be lost if you close or reload this tab.'}</p>
    {!storageOK && !user && <Link to="/login?mode=signin" target="_blank" rel="noopener noreferrer">Sign in in another tab</Link>}
    {error && <p role="alert" className="auth-error">{error}</p>}
    {preview && <>
      <InvitationDemo draft={{ title: draft.title, event_date: draft.event_date, event_time: draft.event_time ? new Date(`2000-01-01T${draft.event_time}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '', flyer_background: style.flyer_background, address: 'Add your venue after signing in' }} template={draft.template_id} onTemplateChange={(value) => update('template_id', value)} />
      <button className="primary-btn" disabled={busy || loading} onClick={save}>{busy ? 'Saving…' : user ? 'Save draft and continue to sharing' : 'Sign up to save and share'}</button>
      <p>Saved invitations start unpublished. Review details in your editor, then publish when ready. Signature previews save as Free until purchased.</p>
    </>}
  </main>;
}
