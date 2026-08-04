import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/useAuth';
import { extractPalette } from '../lib/extractPalette';
import { usePageTitle } from '../lib/usePageTitle';

const emptyEvent = {
  title: '',
  subtitle: '',
  slug: '',
  event_date: '',
  event_time: '',
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
  theme_color: '#6d7f6a',
  accent_color: '#d8b98c',
  rsvp_title: 'Please RSVP',
  rsvp_subtitle: '',
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

export default function EventEditor() {
  const { user, isAdmin } = useAuth();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyEvent);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const previewRef = useRef(null);
  const dragState = useRef(null);

  usePageTitle(isEditing ? 'Edit Event' : 'New Event');

  useEffect(() => {
    if (isEditing) loadEvent();
  }, [id]);

  async function loadEvent() {
    const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
    if (!error && data) setForm({ ...emptyEvent, ...data });
  }

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('event-images').upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('event-images').getPublicUrl(path);
    updateField('image_url', data.publicUrl);
    updateField('show_image', true);
    setUploading(false);

    const palette = await extractPalette(data.publicUrl);
    if (palette) {
      updateField('theme_color', palette.theme);
      updateField('accent_color', palette.accent);
    }
  }

  async function handleAudioUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const path = `${user.id}/audio/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('event-images').upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('event-images').getPublicUrl(path);
    updateField('audio_url', data.publicUrl);
    setUploading(false);
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

    setSaving(true);

    const slug = form.slug || slugify(form.title);
    const payload = {
      ...form,
      slug,
      customer_id: form.customer_id || user.id,
      // Postgres rejects an empty string for a date column — send null instead
      event_date: form.event_date || null,
    };
    delete payload.id;
    delete payload.created_at;

    let result;
    if (isEditing) {
      result = await supabase.from('events').update(payload).eq('id', id);
    } else {
      result = await supabase.from('events').insert(payload);
    }

    setSaving(false);
    if (result.error) {
      if (result.error.message.toLowerCase().includes('date')) {
        setError('Please choose a valid date.');
      } else {
        setError(result.error.message);
      }
    } else {
      navigate(isAdmin ? '/admin' : '/hub');
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>{isEditing ? 'Edit Event' : 'New Event'}</h1>
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
            Time
            <input
              type="text"
              placeholder="5:00 PM"
              value={form.event_time || ''}
              onChange={(e) => updateField('event_time', e.target.value)}
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
          <label>
            Theme Color
            <input
              type="color"
              value={form.theme_color || '#6d7f6a'}
              onChange={(e) => updateField('theme_color', e.target.value)}
            />
          </label>
          <label>
            Accent Color
            <input
              type="color"
              value={form.accent_color || '#d8b98c'}
              onChange={(e) => updateField('accent_color', e.target.value)}
            />
          </label>
        </div>

        <label className="upload-label">
          Flyer Image
          <input type="file" accept="image/*" onChange={handleImageUpload} />
        </label>
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
            <div className={`flyer-preview ${form.box_mode === 'overlay' && form.show_image ? 'overlay-preview' : ''}`} ref={previewRef}>
              <img src={form.image_url} alt="Flyer preview" draggable={false} />
              {form.box_mode === 'overlay' && form.show_image && (
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
            value={form.box_mode}
            onChange={(e) => handleLayoutChange(e.target.value)}
          >
            <option value="above">Above the flyer</option>
            <option value="below">Below the flyer</option>
            <option value="left">To the left of the flyer</option>
            <option value="right">To the right of the flyer</option>
            <option value="overlay">Over the flyer (moveable)</option>
          </select>
          <span>The RSVP panel is automatically sized so its contents remain readable.</span>
        </label>

        {form.box_mode === 'overlay' && form.image_url && form.show_image && (
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
