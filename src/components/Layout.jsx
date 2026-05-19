import { NavLink, useLocation } from 'react-router-dom';

const links = [
  ['/aha', 'Aha'],
  ['/hmm', 'Hmm'],
  ['/ta-da', 'Ta-da'],
  ['/settings', 'Settings']
];

export default function Layout({ children }) {
  const location = useLocation();
  const sectionClass = location.pathname.startsWith('/hmm')
    ? 'section-hmm'
    : location.pathname.startsWith('/ta-da') || location.pathname.startsWith('/projects/')
      ? 'section-tada'
      : location.pathname.startsWith('/aha')
        ? 'section-aha'
        : 'section-neutral';
  return (
    <div className={`app-shell ${sectionClass}`}>
      <header className="top-header">
        <h1>Aha Hmm Ta-Da</h1>
        <NavLink to="/settings" className="header-settings-link" aria-label="Settings">Settings</NavLink>
      </header>
      <main>{children}</main>
      <nav className="bottom-nav">
        {links.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => {
              const active = isActive || (to === '/ta-da' && location.pathname.startsWith('/projects/'));
              if (!active) return undefined;
              if (to === '/aha') return 'active active-aha';
              if (to === '/hmm') return 'active active-hmm';
              if (to === '/ta-da') return 'active active-tada';
              return 'active active-settings';
            }}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
