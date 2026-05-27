import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getProjectName, getRealProjects } from '../lib/model';

export default function TaDaPage({ api }) {
  const projects = useMemo(() => getRealProjects(api.data.projects)
    .sort((a, b) => (b.lastInteractedAt || b.updatedAt || b.createdAt || 0) - (a.lastInteractedAt || a.updatedAt || a.createdAt || 0)), [api.data.projects]);

  const projectTodoCount = (projectId) => (api.data.notes || []).filter((note) => !note.deleted && !note.legacyShape && note.projectId === projectId && note.isTodo).length;

  return (
    <div className="stack page-screen">
      <section className="stack">
        {!projects.length && <p className="empty-state">No projects yet.</p>}
        <div className="project-grid">
          {projects.map((project) => (
            <Link key={project.id} className="project-tile card" to={`/projects/${project.id}`}>
              <strong>{getProjectName(project)}</strong>
              <span>{projectTodoCount(project.id)} to-do</span>
              <span>{project.tasksDone || 0} done</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
