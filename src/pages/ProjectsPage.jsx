import { Link } from 'react-router-dom';
import ContentSection from '../components/ContentSection';
import { compareProjectsByLastOpened } from '../lib/model';

export default function ProjectsPage({ api }) {
  const active = api.data.projects.filter((p) => p.status === 'active' || p.status === 'paused').sort(compareProjectsByLastOpened);
  const hidden = api.data.projects.filter((p) => p.status === 'hidden').sort(compareProjectsByLastOpened);
  const archived = api.data.projects.filter((p) => p.status === 'archived').sort(compareProjectsByLastOpened);

  return <div className="stack"><h2>Projects</h2>
    <ContentSection title="Active" items={active} headingLevel={3}>{active.map((p) => <Link key={p.id} className="card" to={`/projects/${p.id}`}>{p.title}</Link>)}</ContentSection>
    <ContentSection title="Hidden" items={hidden} headingLevel={3}>{hidden.map((p) => <Link key={p.id} className="card" to={`/projects/${p.id}`}>{p.title}</Link>)}</ContentSection>
    <ContentSection title="Archived" items={archived} headingLevel={3}>{archived.map((p) => <Link key={p.id} className="card" to={`/projects/${p.id}`}>{p.title}</Link>)}</ContentSection>
  </div>;
}
