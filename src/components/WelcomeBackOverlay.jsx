import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjectName } from '../lib/model';
import { getProjectMeaningfulActivityAt } from '../lib/projectMomentum';

export default function WelcomeBackOverlay({ api, project, onClose }) {
  const navigate = useNavigate();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!project) return undefined;
    const app = document.querySelector('.app-shell');
    const wasInert = app?.inert;
    if (app) app.inert = true;
    dialogRef.current?.focus();
    const handler = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (app) app.inert = wasInert;
    };
  }, [onClose, project]);

  if (!project) return null;

  const projectName = getProjectName(project);
  const lastActivityAt = getProjectMeaningfulActivityAt(api.data, project.id);
  const lastActivity = lastActivityAt ? new Date(lastActivityAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  }) : null;
  const goTo = (path) => {
    onClose?.();
    navigate(path);
  };

  return (
    <div className="task-sheet-backdrop welcome-back-backdrop" role="presentation">
      <section ref={dialogRef} tabIndex={-1} className="task-sheet welcome-back-sheet" role="dialog" aria-modal="true" aria-labelledby="welcome-back-title">
        <small>WELCOME BACK</small>
        <h3 id="welcome-back-title">Ready to continue working on {projectName}?</h3>
        {lastActivity && <p className="helper-text">Last activity {lastActivity}</p>}
        <div className="welcome-back-actions">
          <button type="button" onClick={() => goTo(`/projects/${project.id}`)}>Continue {projectName}</button>
          <button type="button" className="secondary-button" onClick={() => goTo('/ta-da')}>Choose another project</button>
          <button type="button" className="text-button" onClick={onClose}>Not now</button>
        </div>
      </section>
    </div>
  );
}
