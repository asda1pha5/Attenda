import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import AppBrand from './AppBrand';

export default function TopNav() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const closeMenu = () => setOpen(false);

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
            <Link className="top-nav-cta" to="/hub/new" onClick={closeMenu}>Create event</Link>
          </>
        ) : !loading && (
          <>
            <a href="/#how-it-works" onClick={closeMenu}>How it works</a>
            <Link to="/upgrade" onClick={closeMenu}>Signature</Link>
            <Link to="/login?mode=signin" onClick={closeMenu}>Sign in</Link>
            <Link className="top-nav-cta" to="/login?mode=signup" onClick={closeMenu}>Create a free account</Link>
          </>
        )}
      </nav>
    </header>
  );
}
