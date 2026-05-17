import { NavLink, useLocation } from 'react-router-dom';

const links = [
  ['/aha', 'Aha'],
  ['/hmm', 'Hmm'],
  ['/ta-da', 'Ta-da'],
  ['/settings', 'Settings']
];

export default function Layout({ children }) {
  const location = useLocation();
  return (
    <div className="app-shell">
      <header><h1>Master Plan</h1></header>
      <main>{children}</main>
      <nav className="bottom-nav">
        {links.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => isActive || (to === '/ta-da' && location.pathname.startsWith('/projects/')) ? 'active' : undefined}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
