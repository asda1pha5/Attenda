import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { supabase } from '../lib/supabaseClient';
import AppBrand from './AppBrand';

export default function TopNav() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const closeMenu = () => setOpen(false);

  async function handleSignOut() {
    closeMenu();
    await supabase.auth.signOut();
  }

  return (
    <header className="top-nav">
      <AppBrand to={user ? '/hub' : '/'} />
      <button className="nav-menu-button" type="button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span /><span /><span />
      </button>
      <nav className={`top-nav-links ${open ? 'is-open' : ''}`} aria-label="Primary navigation">
        {!loading && user ? (
          <>
            <Link to="/hub" onClick={closeMenu}>My hub</Link>
            <Link to="/help" onClick={closeMenu}>Help</Link>
            <button className="top-nav-sign-out" type="button" onClick={handleSignOut}>Sign out</button>
            <Link className="top-nav-cta" to="/hub/new" onClick={closeMenu}>Create event</Link>
          </>
        ) : !loading && (
          <>
            <a href="/#how-it-works" onClick={closeMenu}>How it works</a>
            <Link to="/upgrade" onClick={closeMenu}>Signature</Link>
            <Link to="/help" onClick={closeMenu}>Help</Link>
            <Link to="/login?mode=signin" onClick={closeMenu}>Sign in</Link>
            <Link className="top-nav-cta" to="/create" onClick={closeMenu}>Preview an invitation</Link>
          </>
        )}
      </nav>
    </header>
  );
}
