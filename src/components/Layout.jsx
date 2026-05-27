import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const links = [
  ['/aha', 'Notes'],
  ['/hmm', 'Plans'],
  ['/ta-da', 'Projects']
];

export default function Layout({ children }) {
  const location = useLocation();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const rootStyle = document.documentElement.style;
    const keyboardThreshold = 80;

    const isKeyboardFocusable = (element) => {
      if (!element || !(element instanceof HTMLElement)) return false;
      if (element.tagName === 'TEXTAREA') return true;
      if (element.tagName !== 'INPUT') return element.isContentEditable;

      const input = element;
      const ignoredTypes = ['button', 'submit', 'checkbox', 'radio', 'range', 'file', 'color', 'image', 'reset'];
      return !ignoredTypes.includes(input.type);
    };

    const updateKeyboardOffset = () => {
      const viewport = window.visualViewport;
      const fullHeight = window.innerHeight || 0;
      const viewportHeight = viewport?.height ?? fullHeight;
      const viewportOffsetTop = viewport?.offsetTop ?? 0;
      const keyboardHeight = Math.max(0, fullHeight - viewportHeight - viewportOffsetTop);
      const activeElement = document.activeElement;
      const shouldLiftNav = keyboardHeight > keyboardThreshold && isKeyboardFocusable(activeElement);

      rootStyle.setProperty('--keyboard-offset', shouldLiftNav ? `${keyboardHeight}px` : '0px');
      setKeyboardOpen(shouldLiftNav);
    };

    updateKeyboardOffset();

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', updateKeyboardOffset);
    viewport?.addEventListener('scroll', updateKeyboardOffset);
    window.addEventListener('resize', updateKeyboardOffset);
    window.addEventListener('orientationchange', updateKeyboardOffset);
    window.addEventListener('focusin', updateKeyboardOffset);
    window.addEventListener('focusout', updateKeyboardOffset);

    return () => {
      viewport?.removeEventListener('resize', updateKeyboardOffset);
      viewport?.removeEventListener('scroll', updateKeyboardOffset);
      window.removeEventListener('resize', updateKeyboardOffset);
      window.removeEventListener('orientationchange', updateKeyboardOffset);
      window.removeEventListener('focusin', updateKeyboardOffset);
      window.removeEventListener('focusout', updateKeyboardOffset);
      rootStyle.setProperty('--keyboard-offset', '0px');
    };
  }, []);

  const sectionClass = location.pathname.startsWith('/hmm')
    ? 'section-hmm'
    : location.pathname.startsWith('/ta-da') || location.pathname.startsWith('/projects/')
      ? 'section-tada'
      : location.pathname.startsWith('/aha')
        ? 'section-aha'
        : 'section-neutral';
  return (
    <div className={`app-shell ${sectionClass} ${keyboardOpen ? 'keyboard-open' : ''}`}>
      <header className="top-header">
        <h1>Notes Plans Projects</h1>
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
              return 'active';
            }}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
