import { Link } from 'react-router-dom';
import logo from '@/assets/logo.png';

export default function ApplyTopNav() {
  return (
    <nav className="pa-topnav">
      <Link to="/dashboard" className="pa-nav-logo">
        <img src={logo} alt="" />
        <span className="logo-wordmark">
          <span className="logo-light">Clinical</span>
          <span className="logo-bold">Hours</span>
        </span>
      </Link>
      <div className="pa-nav-links">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/opportunities">Opportunities</Link>
        <Link to="/map">Map</Link>
        <Link to="/settings">Settings</Link>
      </div>
    </nav>
  );
}
