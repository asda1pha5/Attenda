import { Link } from 'react-router-dom';
import mark from '../assets/attendaa-mark.png';

export default function AppBrand({ to = '/login?mode=signup', subtle = false }) {
  return (
    <Link className={`app-brand${subtle ? ' app-brand-subtle' : ''}`} to={to} aria-label="Attendaa home">
      <img src={mark} alt="" />
      <span>Attendaa</span>
    </Link>
  );
}
