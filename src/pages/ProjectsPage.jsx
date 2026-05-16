import { Link } from 'react-router-dom';
import ContentSection from '../components/ContentSection';

const byInteraction = (a, b) => (b.lastInteractedAt || b.createdAt || 0) - (a.lastInteractedAt || a.createdAt || 0);

export default function ProjectsPage({ api }) {
  const active = api.data.projects.filter((p) => p.status === 'active' || p.status === 'paused').sort(byInteraction);
  const hidden = api.data.projects.filter((p) => p.status === 'hidden');
  const archived = api.data.projects.filter((p) => p.status === 'archived');

  return <div className="stack"><h2>Projects</h2>
    <ContentSection title="Active" items={active} headingLevel={3}>{active.map((p) => <Link key={p.id} className="card" to={`/projects/${p.id}`}>{p.title}</Link>)}</ContentSection>
    <ContentSection title="Hidden" items={hidden} headingLevel={3}>{hidden.map((p) => <Link key={p.id} className="card" to={`/projects/${p.id}`}>{p.title}</Link>)}</ContentSection>
    <ContentSection title="Archived" items={archived} headingLevel={3}>{archived.map((p) => <Link key={p.id} className="card" to={`/projects/${p.id}`}>{p.title}</Link>)}</ContentSection>
  </div>;
}
