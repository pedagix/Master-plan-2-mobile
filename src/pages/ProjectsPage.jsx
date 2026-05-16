import { Link } from 'react-router-dom';

const byInteraction = (a, b) => (b.lastInteractedAt || b.createdAt || 0) - (a.lastInteractedAt || a.createdAt || 0);

export default function ProjectsPage({ api }) {
  const active = api.data.projects.filter((p) => p.status === 'active' || p.status === 'paused').sort(byInteraction);
  const hidden = api.data.projects.filter((p) => p.status === 'hidden');
  const archived = api.data.projects.filter((p) => p.status === 'archived');

  return <div className="stack"><h2>Projects</h2>
    <h3>Active</h3>
    {active.map((p) => <Link key={p.id} className="card" to={`/projects/${p.id}`}>{p.title}</Link>)}
    {!!hidden.length && <><h3>Hidden</h3>{hidden.map((p) => <Link key={p.id} className="card" to={`/projects/${p.id}`}>{p.title}</Link>)}</>}
    {!!archived.length && <><h3>Archived</h3>{archived.map((p) => <Link key={p.id} className="card" to={`/projects/${p.id}`}>{p.title}</Link>)}</>}
  </div>;
}
