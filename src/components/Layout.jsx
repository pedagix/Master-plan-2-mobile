import { NavLink } from 'react-router-dom';

const links = [
  ['/', 'Home'],
  ['/capture', 'Capture'],
  ['/projects', 'Projects'],
  ['/inbox', 'Inbox'],
  ['/raw-notes', 'RAW Notes'],
  ['/review', 'Review'],
  ['/settings', 'Settings']
];

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <header><h1>Master Plan</h1></header>
      <main>{children}</main>
      <nav className="bottom-nav">
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>
        ))}
      </nav>
    </div>
  );
}
