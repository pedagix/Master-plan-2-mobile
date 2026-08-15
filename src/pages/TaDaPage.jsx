import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { compareProjectsByLastOpened, getProjectName } from '../lib/model';
import {
  buildDailyProgress,
  getProjectMeaningfulActivityAt,
  isDormantProject,
} from '../lib/projectMomentum';
import ProjectMomentumIndicator from '../components/ProjectMomentumIndicator';

function relativeAge(timestamp) {
  const age = Math.max(0, Date.now() - Number(timestamp || 0));
  const days = Math.floor(age / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export default function TaDaPage({ api }) {
  const navigate = useNavigate();
  const activeProjects = useMemo(() => (api.data.projects || [])
    .filter((project) => project.status === 'active' && !project.archived && !project.hidden && !project.finishedAt)
    .sort(compareProjectsByLastOpened), [api.data.projects]);
  const pausedProjects = useMemo(() => (api.data.projects || [])
    .filter((project) => project.status === 'paused' && !project.archived && !project.hidden && !project.finishedAt)
    .sort(compareProjectsByLastOpened), [api.data.projects]);
  const finishedProjects = useMemo(() => (api.data.projects || [])
    .filter((project) => project.status === 'finished' || Boolean(project.finishedAt))
    .sort((a, b) => Number(b.finishedAt || b.updatedAt || 0) - Number(a.finishedAt || a.updatedAt || 0)), [api.data.projects]);
  const daily = useMemo(() => buildDailyProgress(api.data), [api.data]);
  const dormantProject = useMemo(() => activeProjects
    .filter((project) => isDormantProject(api.data, project))
    .sort((a, b) => getProjectMeaningfulActivityAt(api.data, a.id) - getProjectMeaningfulActivityAt(api.data, b.id))[0] || null, [activeProjects, api.data]);

  const patchProject = (projectId, patch) => {
    const now = Date.now();
    api.setData((prev) => ({
      ...prev,
      projects: prev.projects.map((project) => project.id === projectId ? { ...project, ...patch, updatedAt: now } : project),
    }));
  };

  const pauseDormant = () => {
    if (!dormantProject) return;
    patchProject(dormantProject.id, { status: 'paused' });
  };

  const archiveDormant = () => {
    if (!dormantProject || !window.confirm(`Archive “${getProjectName(dormantProject)}”?`)) return;
    patchProject(dormantProject.id, { status: 'archived', archived: true });
  };

  return (
    <div className="stack page-screen">
      <section className="daily-progress-card" aria-label="Today's progress">
        <div><small>TODAY</small><strong>{daily.focusedLabel}</strong><span>focused</span></div>
        <div><small>STEPS</small><strong>{daily.completedCount}</strong><span>completed</span></div>
        <div><small>PROJECTS</small><strong>{daily.projectsAdvanced}</strong><span>advanced</span></div>
      </section>

      {dormantProject && (
        <section className="dormant-rescue-card">
          <div className="dormant-rescue-heading">
            <div><small>PROJECT RESCUE</small><strong>{getProjectName(dormantProject)}</strong></div>
            <span>quiet since {relativeAge(getProjectMeaningfulActivityAt(api.data, dormantProject.id))}</span>
          </div>
          <p>It has stopped moving. Decide what it is now instead of letting it become background clutter.</p>
          <div className="dormant-rescue-actions">
            <button type="button" onClick={() => navigate(`/projects/${dormantProject.id}`)}>Continue</button>
            <button type="button" className="secondary-button" onClick={() => navigate(`/projects/${dormantProject.id}?edit=1`)}>Redefine</button>
            <button type="button" className="secondary-button" onClick={pauseDormant}>Pause</button>
            <button type="button" className="text-button" onClick={archiveDormant}>Archive</button>
          </div>
        </section>
      )}

      <div className="section-title-row reports-entry-row">
        <div><strong>{activeProjects.length} ACTIVE</strong><p className="helper-text">Momentum shows whether meaningful work has been moving recently.</p></div>
        <Link className="secondary-button button-link" to="/reports">Reports</Link>
      </div>

      <section className="stack">
        {!activeProjects.length && <p className="empty-state">No active projects.</p>}
        <div className="project-grid">
          {activeProjects.map((project) => (
            <Link key={project.id} className="project-tile card momentum-project-tile" to={`/projects/${project.id}`}>
              <strong>{getProjectName(project)}</strong>
              <ProjectMomentumIndicator data={api.data} projectId={project.id} compact />
            </Link>
          ))}
        </div>
      </section>

      {!!pausedProjects.length && (
        <details className="project-archive-group">
          <summary>Paused projects <span>{pausedProjects.length}</span></summary>
          <div className="project-grid project-grid-secondary">
            {pausedProjects.map((project) => (
              <div className="project-tile card paused-project-tile" key={project.id}>
                <Link to={`/projects/${project.id}`}><strong>{getProjectName(project)}</strong></Link>
                <div className="paused-project-actions">
                  <ProjectMomentumIndicator data={api.data} projectId={project.id} compact />
                  <button type="button" className="text-button" onClick={() => patchProject(project.id, { status: 'active', lastInteractedAt: Date.now() })}>Resume</button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {!!finishedProjects.length && (
        <details className="project-archive-group finished-project-group">
          <summary>Finished projects <span>{finishedProjects.length}</span></summary>
          <div className="project-grid project-grid-secondary">
            {finishedProjects.map((project) => (
              <Link key={project.id} className="project-tile card finished-project-tile" to={`/projects/${project.id}`}>
                <small>FINISHED {project.finishedAt ? new Date(project.finishedAt).toLocaleDateString() : ''}</small>
                <strong>{getProjectName(project)}</strong>
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
