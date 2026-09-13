import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { compareProjectsByLastOpened, getProjectName } from '../lib/model';
import { buildDailyProgress } from '../lib/projectMomentum';
import ProjectMomentumIndicator from '../components/ProjectMomentumIndicator';

export default function TaDaPage({ api }) {
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

  const patchProject = (projectId, patch) => {
    const now = Date.now();
    api.setData((prev) => ({
      ...prev,
      projects: prev.projects.map((project) => project.id === projectId ? { ...project, ...patch, updatedAt: now } : project),
    }));
  };

  return (
    <div className="stack page-screen">
      <section className="daily-progress-card" aria-label="Today's progress">
        <div><small>TODAY</small><strong>{daily.focusedLabel}</strong><span>focused</span></div>
        <div><small>STEPS</small><strong>{daily.completedCount}</strong><span>completed</span></div>
        <div><small>PROJECTS</small><strong>{daily.projectsAdvanced}</strong><span>advanced</span></div>
      </section>

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
