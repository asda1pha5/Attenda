import { Link } from 'react-router-dom';
import wordmark from '../assets/attendaa-wordmark.png';

export default function AppBrand({ to = '/login?mode=signup', subtle = false }) {
  return (
    <Link className={`app-brand${subtle ? ' app-brand-subtle' : ''}`} to={to} aria-label="Attendaa home">
      <img src={wordmark} alt="" />
    </Link>
  );
}
