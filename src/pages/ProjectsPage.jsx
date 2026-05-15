import { Link } from 'react-router-dom';

export default function ProjectsPage({ api }) {
  const visible = api.data.projects.filter((p) => p.status !== 'hidden');
  const hidden = api.data.projects.filter((p) => p.status === 'hidden');
  return <div className="stack"><h2>Projects</h2>
    {visible.map((p) => <Link key={p.id} className="card" to={`/projects/${p.id}`}>{p.title} · {p.status}</Link>)}
    <h3>Hidden Projects</h3>
    {hidden.map((p) => <Link key={p.id} className="card" to={`/projects/${p.id}`}>{p.title}</Link>)}
  </div>;
}
