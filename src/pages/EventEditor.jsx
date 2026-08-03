import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/useAuth';

const emptyEvent = {
  title: '',
  subtitle: '',
  slug: '',
  event_date: '',
  event_time: '',
  address: '',
  registry_link: '',
  image_url: '',
  box_top: 72,
  box_left: 4,
  box_width: 92,
  box_height: 25,
  theme_color: '#6d7f6a',
  is_published: true,
};

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
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

  useEffect(() => {
    if (isEditing) loadEvent();
  }, [id]);

  async function loadEvent() {
    const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
    if (!error && data) setForm(data);
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
    setUploading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const slug = form.slug || slugify(form.title);
    const payload = { ...form, slug, customer_id: form.customer_id || user.id };
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
      setError(result.error.message);
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
        </div>

        <label className="upload-label">
          Flyer Image
          <input type="file" accept="image/*" onChange={handleImageUpload} />
        </label>
        {uploading && <div className="muted">Uploading…</div>}
        {form.image_url && (
          <div className="flyer-preview">
            <img src={form.image_url} alt="Flyer preview" />
            <div
              className="flyer-preview-box"
              style={{
                top: `${form.box_top}%`,
                left: `${form.box_left}%`,
                width: `${form.box_width}%`,
                height: `${form.box_height}%`,
              }}
            >
              RSVP box
            </div>
          </div>
        )}

        <p className="section-label">Position the RSVP box over the flyer's blank space (%)</p>
        <div className="form-grid four-col">
          <label>
            Top
            <input type="number" value={form.box_top} onChange={(e) => updateField('box_top', Number(e.target.value))} />
          </label>
          <label>
            Left
            <input type="number" value={form.box_left} onChange={(e) => updateField('box_left', Number(e.target.value))} />
          </label>
          <label>
            Width
            <input type="number" value={form.box_width} onChange={(e) => updateField('box_width', Number(e.target.value))} />
          </label>
          <label>
            Height
            <input type="number" value={form.box_height} onChange={(e) => updateField('box_height', Number(e.target.value))} />
          </label>
        </div>

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
