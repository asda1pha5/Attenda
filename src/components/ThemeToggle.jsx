import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem('attenda-dashboard-theme') === 'dark');

  useEffect(() => {
    document.body.classList.toggle('dashboard-dark-mode', dark);
    localStorage.setItem('attenda-dashboard-theme', dark ? 'dark' : 'light');
    return () => document.body.classList.remove('dashboard-dark-mode');
  }, [dark]);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setDark((current) => !current)}
      aria-label={dark ? 'Use light theme' : 'Use dark theme'}
      title={dark ? 'Use light theme' : 'Use dark theme'}
    >
      <span aria-hidden="true">☀</span>
      <span aria-hidden="true">☾</span>
      <span className={`theme-toggle-thumb ${dark ? 'is-dark' : ''}`} />
    </button>
  );
}
