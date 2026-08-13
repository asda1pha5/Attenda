import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/useAuth';
import { usePageTitle } from '../lib/usePageTitle';
import floralTable from '../assets/signup-floral-table.png';
import friendsFerrisWheel from '../assets/signup-friends-ferris-wheel.png';
import { trackFunnelEvent } from '../lib/funnelAnalytics';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState(() => new URLSearchParams(location.search).get('mode') === 'signin' ? 'signin' : 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  usePageTitle(mode === 'signin' ? 'Sign In' : 'Create Account');

  // If a session already exists (e.g. we just signed in, or the page
  // was reloaded while logged in), leave the login page automatically.
  useEffect(() => {
    if (!loading && user) navigate('/hub', { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    setMode(new URLSearchParams(location.search).get('mode') === 'signin' ? 'signin' : 'signup');
  }, [location.search]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);

    if (mode === 'signup') await trackFunnelEvent('signup_started');

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else navigate('/hub', { replace: true });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) setError(error.message);
      else {
        await trackFunnelEvent('signup_completed');
        setInfo('Account created. Check your email to confirm, then sign in.');
      }
    }
    setBusy(false);
  }

  return (
    <div className={`auth-page ${mode === 'signup' ? 'signup-page' : ''}`}>
      {mode === 'signup' && (
        <section className="signup-showcase" aria-label="What you can do with Attendaa">
          <div className="signup-photo-wrap">
            <img
              className="signup-main-photo"
              src={floralTable}
              alt="Floral table setting ready for a celebration"
            />
            <div className="signup-photo-note">Made for the moments people remember.</div>
            <img
              className="signup-small-photo"
              src={friendsFerrisWheel}
              alt="Friends enjoying a sunset outing together"
            />
          </div>

          <p className="signup-kicker">More than an RSVP link</p>
          <h1>Bring your next gathering to life.</h1>
          <p className="signup-lede">
            Attendaa turns your event details into a polished, shareable invitation that makes it easy for guests to say yes.
          </p>
          <p className="signup-examples">Perfect for birthdays, baby showers, graduations, dinners, reunions, and every reason to gather.</p>

          <div className="signup-benefits">
            <div><span>✦</span><strong>Make it yours</strong><p>Add your flyer, colors, event details, music, and RSVP layout.</p></div>
            <div><span>↗</span><strong>Share one beautiful link</strong><p>Give guests everything they need in one simple invitation.</p></div>
            <div><span>✓</span><strong>Know who is coming</strong><p>Collect RSVPs and keep your guest list organized from your hub.</p></div>
          </div>
        </section>
      )}
      <div className={`auth-card ${mode === 'signup' ? 'auth-card-signup' : ''}`}>
        {mode === 'signup' && <p className="auth-brand">Plan · Invite · RSVP · Celebrate</p>}
        <h1>{mode === 'signin' ? 'Attendaa' : 'Create your account'}</h1>
        <p className="auth-sub">{mode === 'signin' ? 'Sign in to your hub' : 'Start making invitations your guests will want to open.'}</p>

        {mode === 'signin' && (
          <div className="signin-flourish">
            <span className="signin-spark" aria-hidden="true">✦</span>
            <p>Every memorable gathering starts with one thoughtful invitation.</p>
            <div><span>Create</span><span>Share</span><span>Celebrate</span></div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-info">{info}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <button
          className="link-btn"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError('');
            setInfo('');
          }}
        >
          {mode === 'signin' ? "Need an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
