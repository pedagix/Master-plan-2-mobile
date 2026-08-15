import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import CurrentTaskBar from './CurrentTaskBar';
import FocusModePanel from './FocusModePanel';

const links = [
  ['/aha', 'Notes'],
  ['/hmm', 'Plans'],
  ['/ta-da', 'Projects'],
];

export default function Layout({ children, api, noteSaveConfirmation = { visible: false, id: 0 } }) {
  const location = useLocation();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [focusDismissedTaskId, setFocusDismissedTaskId] = useState(null);
  const activeTask = api?.data?.activeTask;
  const focusModeActive = Boolean(
    api
    && api.data.settings?.focusModeEnabled !== false
    && activeTask
    && ['running', 'break'].includes(activeTask.status)
    && focusDismissedTaskId !== activeTask.id
  );
  const activeHeaderTitle = focusModeActive ? 'Focus' : location.pathname.startsWith('/reports')
    ? 'Reports'
    : location.pathname.startsWith('/settings')
      ? 'System'
      : location.pathname.startsWith('/hmm')
        ? 'Plans'
        : location.pathname.startsWith('/ta-da') || location.pathname.startsWith('/projects/')
          ? 'Projects'
          : location.pathname.startsWith('/aha')
            ? 'Notes'
            : 'Master Plan';

  useEffect(() => {
    if (!activeTask?.id) setFocusDismissedTaskId(null);
  }, [activeTask?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const rootStyle = document.documentElement.style;
    const keyboardThreshold = 80;

    const isKeyboardFocusable = (element) => {
      if (!element || !(element instanceof HTMLElement)) return false;
      if (element.tagName === 'TEXTAREA') return true;
      if (element.tagName !== 'INPUT') return element.isContentEditable;
      const ignoredTypes = ['button', 'submit', 'checkbox', 'radio', 'range', 'file', 'color', 'image', 'reset'];
      return !ignoredTypes.includes(element.type);
    };

    const updateKeyboardOffset = () => {
      const viewport = window.visualViewport;
      const fullHeight = window.innerHeight || 0;
      const viewportHeight = viewport?.height ?? fullHeight;
      const viewportOffsetTop = viewport?.offsetTop ?? 0;
      const keyboardHeight = Math.max(0, fullHeight - viewportHeight - viewportOffsetTop);
      const shouldLiftNav = keyboardHeight > keyboardThreshold && isKeyboardFocusable(document.activeElement);

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
    ? 'section-plans'
    : location.pathname.startsWith('/ta-da') || location.pathname.startsWith('/projects/')
      ? 'section-projects'
      : location.pathname.startsWith('/aha')
        ? 'section-notes'
        : 'section-neutral';

  return (
    <div className={`app-shell ${sectionClass} ${keyboardOpen ? 'keyboard-open' : ''} ${api?.data?.activeTask ? 'has-now-bar' : ''} ${focusModeActive ? 'focus-mode-active' : ''} ${noteSaveConfirmation.visible ? 'save-signal-active' : ''}`}>
      <header className="top-header">
        <div className="header-identity">
          <span className="header-status-dot" aria-hidden="true" />
          <h1>{activeHeaderTitle}</h1>
        </div>

        {noteSaveConfirmation.visible && (
          <div key={noteSaveConfirmation.id} className="header-save-confirmation" role="status" aria-live="polite">
            <span className="save-confirmation-scan" aria-hidden="true" />
            <span className="save-confirmation-dot" aria-hidden="true" />
            <span>NOTE SAVED</span>
          </div>
        )}

        {api && <NavLink to="/settings" className="header-settings-link" aria-label="Open system settings" onClick={() => { if (focusModeActive) setFocusDismissedTaskId(activeTask.id); }}>SYS</NavLink>}
      </header>

      <main className="app-main">{focusModeActive ? <FocusModePanel api={api} onShowApp={() => setFocusDismissedTaskId(activeTask.id)} /> : children}</main>

      {api && <CurrentTaskBar api={api} keyboardOpen={keyboardOpen} />}

      {api && !focusModeActive && (
        <nav className="bottom-nav" aria-label="Main navigation">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => {
                const active = isActive || (to === '/ta-da' && location.pathname.startsWith('/projects/'));
                return active ? 'active' : undefined;
              }}
            >
              <span className="nav-active-dot" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
