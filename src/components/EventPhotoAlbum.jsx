import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { optimizeImageUpload } from '../lib/mediaUpload';

function safeFileName(name) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

export default function EventPhotoAlbum({ eventId, canUpload, guestName, guestEmail }) {
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadPhotos() {
      const { data } = await supabase.from('event_photos').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
      setPhotos(data || []);
    }
    loadPhotos();
  }, [eventId]);

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    if (!file || !canUpload) return;
    setBusy(true);
    setMessage('Uploading photo...');
    try {
      const optimizedFile = await optimizeImageUpload(file, { maxOutputMB: 1.2, maxDimension: 1600 });
      const path = `${eventId}/${Date.now()}-${safeFileName(optimizedFile.name) || 'event-photo.webp'}`;
      const { error: uploadError } = await supabase.storage.from('event-photos').upload(path, optimizedFile, { contentType: optimizedFile.type });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from('event-photos').getPublicUrl(path);
      const { data, error } = await supabase.from('event_photos').insert({
        event_id: eventId,
        guest_name: guestName,
        guest_email: guestEmail,
        image_url: publicUrl.publicUrl,
      }).select().single();
      if (error) throw error;
      setPhotos((current) => [data, ...current]);
      setMessage('Photo added to the album.');
    } catch (uploadError) {
      setMessage(uploadError.message || 'The photo could not be uploaded.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <section className="event-photo-album">
      <div className="photo-album-heading">
        <div><p className="event-details-label">Signature photo album</p><h2>Memories from the day</h2></div>
        <span>{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</span>
      </div>
      {canUpload ? (
        <label className="photo-upload-button">{busy ? 'Uploading...' : 'Add a photo'}<input type="file" accept="image/*" disabled={busy} onChange={uploadPhoto} /></label>
      ) : <p className="comment-rsvp-note">RSVP to add a photo to the album.</p>}
      {canUpload && <p className="upload-guidance">Photos are optimized automatically (1.2 MB max).</p>}
      {message && <p className="comment-status">{message}</p>}
      {photos.length > 0 ? <div className="event-photo-grid">{photos.map((photo) => <figure key={photo.id}><img src={photo.image_url} alt={`Shared by ${photo.guest_name}`} /><figcaption>{photo.guest_name}</figcaption></figure>)}</div> : <p className="comment-empty">Photos shared by guests will appear here.</p>}
    </section>
  );
}
