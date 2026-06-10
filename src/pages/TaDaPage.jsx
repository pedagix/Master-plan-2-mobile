import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { compareProjectsByLastOpened, getProjectName, getRealProjects } from '../lib/model';

export default function TaDaPage({ api }) {
  const projects = useMemo(() => getRealProjects(api.data.projects)
    .sort(compareProjectsByLastOpened), [api.data.projects]);

  return (
    <div className="stack page-screen">
      <section className="stack">
        {!projects.length && <p className="empty-state">No projects yet.</p>}
        <div className="project-grid">
          {projects.map((project) => (
            <Link key={project.id} className="project-tile card" to={`/projects/${project.id}`}>
              <strong>{getProjectName(project)}</strong>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
