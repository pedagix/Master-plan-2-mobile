import { Link } from 'react-router-dom';
import ContentSection from '../components/ContentSection';

export default function HomePage({ api }) {
  const active = api.data.projects.filter((p) => p.status === 'active');
  const important = api.data.suggestions.filter((s) => s.state === 'marked-important' && s.inboxStatus === 'approved');
  const next = (api.data.tasks || []).filter((t) => t.state === 'open');

  return (
    <div className="stack">
      <Link to="/capture" className="capture-btn">+ Fast Capture</Link>
      <ContentSection title="Active Projects" items={active}>{active.map((p) => <Link key={p.id} className="card" to={`/projects/${p.id}`}>{p.title}</Link>)}</ContentSection>
      <ContentSection title="Important Suggestions" items={important}>{important.map((s) => <div key={s.id} className="card">{s.text}</div>)}</ContentSection>
      <ContentSection title="Next steps" items={next}>{next.map((t) => <div key={t.id} className="card">{t.title}</div>)}</ContentSection>
    </div>
  );
}
