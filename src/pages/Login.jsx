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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  usePageTitle(mode === 'signin' ? 'Sign In' : mode === 'recovery' ? 'Reset Password' : mode === 'reset' ? 'Choose a New Password' : 'Create Account');

  // If a session already exists (e.g. we just signed in, or the page
  // was reloaded while logged in), leave the login page automatically.
  useEffect(() => {
    if (!loading && user && mode !== 'reset') navigate('/hub', { replace: true });
  }, [user, loading, navigate, mode]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('mode') === 'signin') setMode('signin');
  }, [location.search]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset');
        setError('');
        setInfo('Choose a new password for your Attendaa account.');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);

    if (mode === 'signup') await trackFunnelEvent('signup_started');

    if (mode === 'recovery') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
      if (error) setError(error.message);
      else setInfo('Check your email for a secure link to choose a new password.');
    } else if (mode === 'reset') {
      if (password !== confirmPassword) setError('The passwords do not match.');
      else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) setError(error.message);
        else navigate('/hub', { replace: true });
      }
    } else if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else navigate('/hub', { replace: true });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/hub`,
        },
      });
      if (error) setError(error.message);
      else {
        await trackFunnelEvent('signup_completed');
        setInfo('Your account is ready. Confirm your email, and we’ll bring you straight to your hub.');
      }
    }
    setBusy(false);
  }

  async function resendConfirmation() {
    if (!email) return;
    setError('');
    setResendingConfirmation(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/hub` },
    });
    if (error) setError(error.message);
    else setInfo('A fresh confirmation email is on its way.');
    setResendingConfirmation(false);
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
        <h1>{mode === 'signin' ? 'Attendaa' : mode === 'recovery' ? 'Reset your password' : mode === 'reset' ? 'Choose a new password' : 'Create your account'}</h1>
        <p className="auth-sub">{mode === 'signin' ? 'Sign in to your hub' : mode === 'recovery' ? 'We’ll email you a secure reset link.' : mode === 'reset' ? 'Keep your Attendaa account secure.' : 'Start making invitations your guests will want to open.'}</p>

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
          {mode !== 'reset' && <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />}
          {mode !== 'recovery' && <input
            type="password"
            placeholder={mode === 'reset' ? 'New password' : 'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />}
          {mode === 'reset' && <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />}
          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-info">{info}</div>}
          {mode === 'signup' && info && (
            <button className="auth-inline-action" type="button" onClick={resendConfirmation} disabled={resendingConfirmation}>
              {resendingConfirmation ? 'Sending…' : 'Resend confirmation email'}
            </button>
          )}
          {mode === 'recovery' ? <button type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Email me a reset link'}</button> : mode === 'reset' ? <button type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Save new password'}</button> : <button type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>}
        </form>

        <button
          className="link-btn"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError('');
            setInfo('');
          }}
        >
          {mode === 'signin' ? "Need an account? Sign up" : mode === 'recovery' || mode === 'reset' ? 'Back to sign in' : 'Already have an account? Sign in'}
        </button>
        {mode !== 'reset' && <button className="link-btn auth-recovery-link" type="button" onClick={() => { setMode('recovery'); setError(''); setInfo(''); }}>Forgot your password?</button>}
      </div>
    </div>
  );
}
