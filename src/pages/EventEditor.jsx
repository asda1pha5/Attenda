import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/useAuth';
import { usePageTitle } from '../lib/usePageTitle';
import { flyerBackgrounds } from '../lib/flyerBackgrounds';
import { signatureTemplates } from '../lib/signatureTemplates';
import { optimizeImageUpload, validateAudioUpload } from '../lib/mediaUpload';
import { trackFunnelEvent } from '../lib/funnelAnalytics';

const emptyEvent = {
  title: '',
  subtitle: '',
  slug: '',
  event_date: '',
  event_time: '',
  event_end_time: '',
  address: '',
  registry_link: '',
  registry_position: 'bottom',
  image_url: '',
  audio_url: '',
  show_image: true,
  box_mode: 'below',
  box_top: 72,
  box_left: 4,
  box_width: 92,
  box_height: 25,
  overlay_enabled: false,
  flyer_background: 'ivory',
  template_id: 'classic',
  password_protected: false,
  event_password: '',
  photo_album_enabled: false,
  reminder_enabled: false,
  reminder_days_before: 1,
  remove_branding: false,
  rsvp_title: 'Please RSVP',
  rsvp_subtitle: '',
  show_event_details: true,
  is_published: true,
};

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeFileName(name) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function normalizeTime(value) {
  if (!value?.trim()) return '';
  const match = value.trim().match(/^(\d{1,2})(?::(\d{1,2}))?\s*([ap])\.?m\.?$/i);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours < 1 || hours > 12 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${match[3].toUpperCase()}M`;
}

export default function EventEditor() {
  const { user, isAdmin, isPremium } = useAuth();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyEvent);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hadExistingPassword, setHadExistingPassword] = useState(false);
  const [customers, setCustomers] = useState([]);
  const previewRef = useRef(null);
  const dragState = useRef(null);

  usePageTitle(isEditing ? 'Edit Event' : 'New Event');

  useEffect(() => {
    if (isEditing) loadEvent();
  }, [id]);

  useEffect(() => {
    if (isAdmin) loadCustomers();
  }, [isAdmin]);

  async function loadCustomers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, plan')
      .order('full_name', { ascending: true });
    setCustomers(data || []);
  }

  async function loadEvent() {
    const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
    if (!error && data) {
      const savedEvent = { ...emptyEvent, ...data };
      // Older invitations used the experimental overlay by default. Keep those
      // invitations in the dependable below-flyer layout until a Signature
      // host deliberately enables the advanced layout again.
      if (savedEvent.box_mode === 'overlay' && !savedEvent.overlay_enabled) {
        savedEvent.box_mode = 'below';
      }
      setForm(savedEvent);
      setHadExistingPassword(Boolean(data.password_protected));
    }
  }

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const hasSignatureFeatures = Boolean(
    form.template_id !== 'classic'
    || form.password_protected
    || form.photo_album_enabled
    || form.reminder_enabled
    || form.remove_branding
    || form.overlay_enabled
    || form.box_mode === 'overlay'
  );
  const isRestrictedPrebuiltEvent = isEditing && !isPremium && hasSignatureFeatures;

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const optimizedFile = await optimizeImageUpload(file, { maxOutputMB: 2, maxDimension: 2200 });
      const path = `${user.id}/${Date.now()}-${safeFileName(optimizedFile.name) || 'event-image.webp'}`;
      const { error: uploadError } = await supabase.storage.from('event-images').upload(path, optimizedFile, { contentType: optimizedFile.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('event-images').getPublicUrl(path);
      updateField('image_url', data.publicUrl);
      updateField('show_image', true);
    } catch (uploadError) {
      setError(uploadError.message || 'The flyer image could not be uploaded.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleAudioUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      validateAudioUpload(file);
      const path = `${user.id}/audio/${Date.now()}-${safeFileName(file.name) || 'event-audio'}`;
      const { error: uploadError } = await supabase.storage.from('event-images').upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('event-images').getPublicUrl(path);
      updateField('audio_url', data.publicUrl);
    } catch (uploadError) {
      setError(uploadError.message || 'The audio file could not be uploaded.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function handleRemoveAudio() {
    updateField('audio_url', '');
  }

  function handleRemoveImage() {
    updateField('image_url', '');
    updateField('show_image', false);
  }

  function handleLayoutChange(mode) {
    if (mode === 'overlay') {
      setForm((current) => ({
        ...current,
        box_mode: mode,
        box_top: 25,
        box_left: 11,
        box_width: 78,
        box_height: 50,
      }));
    } else {
      updateField('box_mode', mode);
    }
  }

  function startOverlayDrag(e) {
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    dragState.current = {
      startX: point.clientX,
      startY: point.clientY,
      startTop: form.box_top,
      startLeft: form.box_left,
    };
    window.addEventListener('mousemove', moveOverlay);
    window.addEventListener('mouseup', endOverlayDrag);
    window.addEventListener('touchmove', moveOverlay, { passive: false });
    window.addEventListener('touchend', endOverlayDrag);
  }

  function moveOverlay(e) {
    if (!dragState.current || !previewRef.current) return;
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    const rect = previewRef.current.getBoundingClientRect();
    const dx = ((point.clientX - dragState.current.startX) / rect.width) * 100;
    const dy = ((point.clientY - dragState.current.startY) / rect.height) * 100;
    setForm((current) => ({
      ...current,
      box_left: Math.round(clamp(dragState.current.startLeft + dx, 0, 100 - current.box_width) * 10) / 10,
      box_top: Math.round(clamp(dragState.current.startTop + dy, 0, 100 - current.box_height) * 10) / 10,
    }));
  }

  function endOverlayDrag() {
    dragState.current = null;
    window.removeEventListener('mousemove', moveOverlay);
    window.removeEventListener('mouseup', endOverlayDrag);
    window.removeEventListener('touchmove', moveOverlay);
    window.removeEventListener('touchend', endOverlayDrag);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');

    if (!form.event_date) {
      setError('Please choose a date.');
      return;
    }

    const startTime = normalizeTime(form.event_time);
    const endTime = normalizeTime(form.event_end_time);
    if (form.event_time && !startTime) {
      setError('Start time must include AM or PM, for example 5:00 PM.');
      return;
    }
    if (form.event_end_time && !endTime) {
      setError('End time must include AM or PM, for example 8:00 PM.');
      return;
    }

    const slug = form.slug || slugify(form.title);
    if (form.password_protected && !form.event_password.trim() && (!isEditing || !hadExistingPassword)) {
      setError('Set an access code for this password-protected invitation.');
      return;
    }

    setSaving(true);

    const payload = {
      ...form,
      slug,
      customer_id: form.customer_id || user.id,
      // Postgres rejects an empty string for a date column — send null instead
      event_date: form.event_date || null,
      event_time: startTime,
      event_end_time: endTime,
      // A Free owner can update normal invitation details without stripping
      // Signature settings that an admin prebuilt for them.
      template_id: isPremium ? form.template_id : (isEditing ? form.template_id : 'classic'),
      password_protected: isPremium ? form.password_protected : (isEditing ? form.password_protected : false),
      photo_album_enabled: isPremium ? form.photo_album_enabled : (isEditing ? form.photo_album_enabled : false),
      reminder_enabled: isPremium ? form.reminder_enabled : (isEditing ? form.reminder_enabled : false),
      reminder_days_before: isPremium ? Number(form.reminder_days_before) || 1 : (isEditing ? Number(form.reminder_days_before) || 1 : 1),
      remove_branding: isPremium ? form.remove_branding : (isEditing ? form.remove_branding : false),
      box_mode: isPremium
        ? (form.box_mode === 'overlay' ? 'overlay' : form.box_mode)
        : (isEditing ? form.box_mode : (form.box_mode === 'overlay' ? 'below' : form.box_mode)),
      overlay_enabled: isPremium ? form.box_mode === 'overlay' : (isEditing ? form.overlay_enabled : false),
    };
    delete payload.id;
    delete payload.created_at;
    delete payload.event_password;

    let result;
    if (isEditing) {
      result = await supabase.from('events').update(payload).eq('id', id).select('id').single();
    } else {
      result = await supabase.from('events').insert(payload).select('id').single();
    }

    if (result.error) {
      setSaving(false);
      if (result.error.message.toLowerCase().includes('date')) {
        setError('Please choose a valid date.');
      } else {
        setError(result.error.message);
      }
      return;
    }

    const eventId = result.data.id;
    if (!isEditing) void trackFunnelEvent('event_created', {}, user.id);
    if (isPremium && (form.event_password.trim() || !form.password_protected)) {
      const { error: passwordError } = await supabase.rpc('set_event_password', {
        target_event_id: eventId,
        new_password: form.password_protected ? form.event_password.trim() : null,
      });
      if (passwordError) {
        setSaving(false);
        setError(`Your event was saved, but the access code could not be updated: ${passwordError.message}`);
        return;
      }
    }

    setSaving(false);
    navigate(isAdmin ? '/admin' : '/hub');
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-title-group">
          <h1>{isEditing ? 'Edit Event' : 'New Event'}</h1>
          <p className="muted">Create a polished invitation your guests can open with confidence.</p>
        </div>
        <Link to={isAdmin ? '/admin' : '/hub'} className="secondary-btn">Back</Link>
      </header>

      <form className="event-form" onSubmit={handleSave}>
        <div className="form-grid">
          <label>
            Event Title
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              required
            />
          </label>
          <label>
            URL Slug
            <input
              type="text"
              value={form.slug}
              placeholder={slugify(form.title) || 'auto-generated'}
              onChange={(e) => updateField('slug', slugify(e.target.value))}
            />
          </label>
          <label>
            Subtitle / Honoree
            <input
              type="text"
              value={form.subtitle || ''}
              onChange={(e) => updateField('subtitle', e.target.value)}
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={form.event_date || ''}
              onChange={(e) => updateField('event_date', e.target.value)}
              required
            />
          </label>
          <label>
            Start Time
            <input
              type="text"
              placeholder="5:00 PM"
              value={form.event_time || ''}
              onChange={(e) => updateField('event_time', e.target.value)}
              onBlur={(e) => {
                const value = normalizeTime(e.target.value);
                if (value) updateField('event_time', value);
              }}
            />
          </label>
          <label>
            End Time
            <input
              type="text"
              placeholder="8:00 PM"
              value={form.event_end_time || ''}
              onChange={(e) => updateField('event_end_time', e.target.value)}
              onBlur={(e) => {
                const value = normalizeTime(e.target.value);
                if (value) updateField('event_end_time', value);
              }}
            />
          </label>
          <label>
            Address
            <input
              type="text"
              value={form.address || ''}
              onChange={(e) => updateField('address', e.target.value)}
            />
          </label>
          <label>
            Registry Link
            <input
              type="url"
              placeholder="https://..."
              value={form.registry_link || ''}
              onChange={(e) => updateField('registry_link', e.target.value)}
            />
          </label>
          {isAdmin && (
            <label className="event-owner-field">
              Event owner
              <select
                value={form.customer_id || user?.id || ''}
                onChange={(e) => updateField('customer_id', e.target.value)}
                required
              >
                <option value="">Choose a user</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.full_name || customer.email} {customer.plan && customer.plan !== 'free' ? `(${customer.plan})` : ''}
                  </option>
                ))}
              </select>
              <span>They will see this event in their hub and manage it with their own plan permissions.</span>
            </label>
          )}
        </div>

        <section className="form-section background-section">
          <div className="section-heading-row">
            <div>
              <h3 className="form-section-title">Invitation background</h3>
              <p className="section-label">Choose one of Attendaa's curated backgrounds.</p>
            </div>
            <span className="background-count">12 styles</span>
          </div>
          <div className="background-choice-grid" role="radiogroup" aria-label="Invitation background">
            {flyerBackgrounds.map((background) => (
              <button
                type="button"
                key={background.id}
                role="radio"
                aria-checked={form.flyer_background === background.id}
                className={`background-choice ${form.flyer_background === background.id ? 'is-selected' : ''}`}
                style={{ '--swatch': background.color, '--swatch-ink': background.ink }}
                onClick={() => updateField('flyer_background', background.id)}
              >
                <span aria-hidden="true" />{background.label}
              </button>
            ))}
          </div>
        </section>

        <section className="form-section signature-section">
          <div className="section-heading-row">
            <div>
              <p className="signature-kicker">Attendaa Signature</p>
              <h3 className="form-section-title">Make this invitation feel unforgettable</h3>
              <p className="section-label">Premium tools for the moments that deserve more.</p>
            </div>
            {!isPremium && <Link className="signature-upgrade-link" to="/upgrade">View Signature</Link>}
          </div>

          {!isPremium && (
            <p className="signature-locked-message">
              {isRestrictedPrebuiltEvent
                ? 'This event was prebuilt with paid Attendaa Signature features. Your Free account can edit the standard invitation details, but cannot change its Signature settings.'
                : 'These tools are included with the paid Attendaa Signature plan. Your account is currently on the Free plan.'}
              <Link to="/upgrade"> View upgrade options</Link>
            </p>
          )}

          <div className="template-choice-grid">
            {signatureTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`template-choice template-${template.id} ${form.template_id === template.id ? 'is-selected' : ''} ${template.premium && !isPremium ? 'is-locked' : ''}`}
                onClick={() => (template.premium && !isPremium ? null : updateField('template_id', template.id))}
              >
                <span className="template-preview" aria-hidden="true" />
                <strong>{template.label}</strong>
                <small>{template.premium && !isPremium ? 'Paid Signature feature' : template.description}</small>
              </button>
            ))}
          </div>

          <div className={`signature-options ${isPremium ? '' : 'is-locked'}`}>
            <div className="signature-option signature-password-option">
              <label className="checkbox-label">
                <input type="checkbox" checked={form.password_protected} disabled={!isPremium} onChange={(e) => updateField('password_protected', e.target.checked)} />
                Protect this invitation with an access code
              </label>
              {form.password_protected && isPremium && (
                <label className="signature-password-field">
                  Access code
                  <input type="password" placeholder={isEditing ? 'Leave blank to keep the current code' : 'Choose an access code'} value={form.event_password} onChange={(e) => updateField('event_password', e.target.value)} />
                </label>
              )}
            </div>
            <div className="signature-option"><label className="checkbox-label"><input type="checkbox" checked={form.photo_album_enabled} disabled={!isPremium} onChange={(e) => updateField('photo_album_enabled', e.target.checked)} />Enable the event photo album</label></div>
            <div className="signature-option signature-reminder-option">
              <label className="checkbox-label"><input type="checkbox" checked={form.reminder_enabled} disabled={!isPremium} onChange={(e) => updateField('reminder_enabled', e.target.checked)} />Send guests an event reminder</label>
              {form.reminder_enabled && isPremium && (
                <label className="reminder-timing-field">Send <select value={form.reminder_days_before || 1} onChange={(e) => updateField('reminder_days_before', Number(e.target.value))}><option value={1}>1 day before</option><option value={3}>3 days before</option><option value={7}>1 week before</option></select></label>
              )}
            </div>
            <div className="signature-option"><label className="checkbox-label"><input type="checkbox" checked={form.remove_branding} disabled={!isPremium} onChange={(e) => updateField('remove_branding', e.target.checked)} />Remove Attendaa branding from this invitation</label></div>
          </div>

          <details className={`signature-overlay-layout ${isPremium ? '' : 'is-locked'}`}>
            <summary>Advanced layout: place RSVP over the flyer <span>{isPremium ? 'Signature' : 'Paid plan required'}</span></summary>
            <p>For designs with generous open space. The RSVP form stays within the flyer and scrolls when needed.</p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.box_mode === 'overlay'}
                disabled={!isPremium || !form.image_url || !form.show_image}
                onChange={(e) => handleLayoutChange(e.target.checked ? 'overlay' : 'below')}
              />
              Use the advanced flyer overlay
            </label>
            {!form.image_url && <small>Add a flyer image first to unlock this layout.</small>}
          </details>
        </section>

        <label className="upload-label">
          Flyer Image
          <input type="file" accept="image/*" onChange={handleImageUpload} />
        </label>
        <p className="section-label">JPG, PNG, WebP, or GIF. Images are optimized automatically; animated GIFs must be 2 MB or smaller.</p>
        {uploading && <div className="muted">Uploading…</div>}

        {form.image_url && (
          <>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.show_image}
                onChange={(e) => updateField('show_image', e.target.checked)}
              />
              Show this image on the invitation
            </label>
            <button type="button" className="tiny-btn danger" onClick={handleRemoveImage}>Remove image</button>
            <p className="section-label">Flyer preview</p>
            <div className={`flyer-preview ${isPremium && form.box_mode === 'overlay' && form.show_image ? 'overlay-preview' : ''}`} ref={previewRef}>
              <img src={form.image_url} alt="Flyer preview" draggable={false} />
              {isPremium && form.box_mode === 'overlay' && form.show_image && (
                <div
                  className="flyer-preview-box draggable"
                  style={{
                    top: `${form.box_top}%`,
                    left: `${form.box_left}%`,
                    width: `${form.box_width}%`,
                    height: `${form.box_height}%`,
                  }}
                  onMouseDown={startOverlayDrag}
                  onTouchStart={startOverlayDrag}
                >
                  RSVP box
                </div>
              )}
            </div>
          </>
        )}

        <section className="form-section audio-section">
          <h3 className="form-section-title">Invitation Audio</h3>
          <p className="section-label">Add a short audio file to play when guests open the invitation.</p>
          <label className="upload-label">
            Audio file
            <input type="file" accept="audio/*" onChange={handleAudioUpload} />
          </label>
          <p className="section-label">Audio files must be 8 MB or smaller.</p>
          {form.audio_url && (
            <div className="audio-editor-preview">
              <audio controls src={form.audio_url}>Your browser does not support audio playback.</audio>
              <button type="button" className="tiny-btn danger" onClick={handleRemoveAudio}>Remove audio</button>
            </div>
          )}
        </section>

        <label className="rsvp-placement-control">
          RSVP placement
          <select
            value={form.box_mode === 'overlay' ? 'below' : form.box_mode}
            onChange={(e) => handleLayoutChange(e.target.value)}
          >
            <option value="above">Above the flyer</option>
            <option value="below">Below the flyer</option>
            <option value="left">To the left of the flyer</option>
            <option value="right">To the right of the flyer</option>
          </select>
          <span>Choose a clean, readable layout for every guest.</span>
        </label>

        {isPremium && form.box_mode === 'overlay' && form.image_url && form.show_image && (
          <div className="overlay-editor">
            <p className="section-label">Drag the RSVP box on the flyer to position it.</p>
            <label className="overlay-position-control">
              Quick position
              <select
                value={['5-2', '5-11', '5-20', '25-2', '25-11', '25-20', '45-2', '45-11', '45-20'].includes(`${form.box_top}-${form.box_left}`) ? `${form.box_top}-${form.box_left}` : 'custom'}
                onChange={(e) => {
                  const [top, left] = e.target.value.split('-').map(Number);
                  setForm((current) => ({ ...current, box_top: top, box_left: left }));
                }}
              >
                <option value="custom" disabled>Custom (dragged)</option>
                <option value="5-2">Top left</option>
                <option value="5-11">Top center</option>
                <option value="5-20">Top right</option>
                <option value="25-2">Middle left</option>
                <option value="25-11">Middle center</option>
                <option value="25-20">Middle right</option>
                <option value="45-2">Bottom left</option>
                <option value="45-11">Bottom center</option>
                <option value="45-20">Bottom right</option>
              </select>
            </label>
          </div>
        )}

        <section className="form-section event-details-settings">
          <h3 className="form-section-title">Event Details</h3>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.show_event_details}
              onChange={(e) => updateField('show_event_details', e.target.checked)}
            />
            Show date, time, and address on the invitation
          </label>
        </section>

        <section className="form-section rsvp-content-section">
          <h3 className="form-section-title">RSVP Contents</h3>
          <label>
            RSVP heading
            <input
              type="text"
              placeholder="Please RSVP"
              value={form.rsvp_title || ''}
              onChange={(e) => updateField('rsvp_title', e.target.value)}
            />
          </label>
          <label>
            Subtitle / extra text (optional)
            <textarea
              rows="2"
              placeholder="Leave blank to show just the RSVP heading"
              value={form.rsvp_subtitle || ''}
              onChange={(e) => updateField('rsvp_subtitle', e.target.value)}
            />
          </label>
          {form.registry_link && (
            <label>
              Registry button position
              <select
                value={form.registry_position}
                onChange={(e) => updateField('registry_position', e.target.value)}
              >
                <option value="bottom">Below RSVP form</option>
                <option value="top">Above RSVP heading</option>
              </select>
            </label>
          )}
        </section>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={(e) => updateField('is_published', e.target.checked)}
          />
          Published (guests can view and RSVP)
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="primary-btn" disabled={saving}>
          {saving ? 'Saving…' : 'Save Event'}
        </button>
      </form>
    </div>
  );
}
