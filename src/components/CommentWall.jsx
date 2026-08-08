import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { notifyHost } from '../lib/notifyHost';

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY;

function safeFileName(name) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export default function CommentWall({ eventId, canComment, guestName, guestEmail }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [gifUrl, setGifUrl] = useState('');
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadComments() {
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      setComments(data || []);
    }
    loadComments();
  }, [eventId]);

  async function uploadImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage('Uploading image...');
    const path = `${eventId}/${Date.now()}-${safeFileName(file.name) || 'guest-photo'}`;
    const { error } = await supabase.storage.from('comment-images').upload(path, file);
    if (error) {
      setMessage(error.message);
    } else {
      const { data } = supabase.storage.from('comment-images').getPublicUrl(path);
      setImageUrl(data.publicUrl);
      setMessage('Image attached.');
    }
    setBusy(false);
  }

  async function searchGifs(e) {
    e.preventDefault();
    if (!GIPHY_API_KEY || !gifQuery.trim()) return;
    setBusy(true);
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(gifQuery)}&limit=8&rating=g`);
    const data = await response.json();
    setGifResults(data.data || []);
    setBusy(false);
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!canComment) return;
    if (!body.trim() && !imageUrl && !gifUrl) {
      setMessage('Write a comment or attach an image/GIF.');
      return;
    }
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase
      .from('comments')
      .insert({
        event_id: eventId,
        guest_name: guestName,
        guest_email: guestEmail,
        body: body.trim() || null,
        image_url: imageUrl || null,
        gif_url: gifUrl || null,
      })
      .select()
      .single();
    if (error) {
      setMessage(error.message);
    } else {
      setComments((current) => [data, ...current]);
      setBody('');
      setImageUrl('');
      setGifUrl('');
      setGifResults([]);
      setMessage('Your comment has been posted.');
      void notifyHost({
        eventId,
        recordId: data.id,
        notificationType: 'comment',
      });
    }
    setBusy(false);
  }

  return (
    <section className="comment-wall">
      <div className="comment-wall-heading">
        <div>
          <p className="event-details-label">Guest book</p>
          <h2>Leave a little love</h2>
        </div>
        <span>{comments.length} {comments.length === 1 ? 'message' : 'messages'}</span>
      </div>

      <form className="comment-form" onSubmit={submitComment}>
        <textarea
          rows="3"
          maxLength="500"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share a memory, a wish, or some excitement..."
          disabled={!canComment || busy}
        />
        {!canComment && <p className="comment-rsvp-note">RSVP to comment.</p>}
        {canComment && (
          <>
            <div className="comment-actions">
              <label className="comment-upload">
                Add image
                <input type="file" accept="image/*" onChange={uploadImage} disabled={busy} />
              </label>
              {imageUrl && <span className="attachment-chip">Image attached</span>}
              <label className="gif-url-field">
                GIF URL
                <input type="url" placeholder="Paste a GIF link" value={gifUrl} onChange={(e) => setGifUrl(e.target.value)} />
              </label>
            </div>
            {GIPHY_API_KEY ? (
              <>
                <div className="giphy-search">
                  <input value={gifQuery} onChange={(e) => setGifQuery(e.target.value)} placeholder="Search Giphy" />
                  <button type="button" onClick={searchGifs} disabled={busy}>Search GIFs</button>
                </div>
                {gifResults.length > 0 && (
                  <div className="gif-results">
                    {gifResults.map((gif) => (
                      <button type="button" key={gif.id} onClick={() => setGifUrl(gif.images.original.url)}>
                        <img src={gif.images.fixed_width_small.url} alt={gif.title || 'GIF option'} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="giphy-note">Paste a GIF URL now. Add a Giphy API key later to enable GIF search here.</p>
            )}
          </>
        )}
        {message && <p className="comment-status">{message}</p>}
        <button className="submit-btn" type="submit" disabled={!canComment || busy}>
          {busy ? 'Posting...' : 'Post comment'}
        </button>
      </form>

      <div className="comment-list">
        {comments.length === 0 ? (
          <p className="comment-empty">Be the first to leave a message.</p>
        ) : comments.map((comment) => (
          <article className="comment-card" key={comment.id}>
            <div className="comment-meta"><strong>{comment.guest_name}</strong><span>{new Date(comment.created_at).toLocaleDateString()}</span></div>
            {comment.body && <p>{comment.body}</p>}
            {comment.image_url && <img src={comment.image_url} alt={`Shared by ${comment.guest_name}`} />}
            {comment.gif_url && <img src={comment.gif_url} alt={`GIF shared by ${comment.guest_name}`} />}
          </article>
        ))}
      </div>
    </section>
  );
}
