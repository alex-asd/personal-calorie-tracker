import { NavLink } from 'react-router-dom';

export default function Nav() {
  return (
    <nav className="topnav">
      <div className="topnav-inner">
        <NavLink to="/" className="brand">
          Calorie Tracker
        </NavLink>
        <div className="nav-links">
          <NavLink to="/" end>
            Today
          </NavLink>
          <NavLink to="/saved-meals">Saved meals</NavLink>
          <NavLink to="/archive">Archive</NavLink>
        </div>
      </div>
    </nav>
  );
}
