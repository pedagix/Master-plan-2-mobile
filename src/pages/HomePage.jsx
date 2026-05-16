import { Link } from 'react-router-dom';

export default function HomePage({ api }) {
  const active = api.data.projects.filter((p) => p.status === 'active');
  const important = api.data.suggestions.filter((s) => s.state === 'marked-important' && s.inboxStatus === 'approved');
  const next = (api.data.tasks || []).filter((t) => t.state === 'open');

  return (
    <div className="stack">
      <Link to="/capture" className="capture-btn">+ Fast Capture</Link>
      <section><h2>Active Projects</h2>{active.map((p) => <Link key={p.id} className="card" to={`/projects/${p.id}`}>{p.title}</Link>)}</section>
      <section><h2>Important Suggestions</h2>{important.map((s) => <div key={s.id} className="card">{s.text}</div>)}</section>
      <section><h2>Next Actions</h2>{next.map((t) => <div key={t.id} className="card">{t.title}</div>)}</section>
    </div>
  );
}
