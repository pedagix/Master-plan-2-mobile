const actions = ['important', 'do_next', 'saved', 'connect_project', 'checklist', 'note', 'dismissed', 'wrong', 'archived'];

export default function InboxPage({ api }) {
  const setState = (id, state) => api.setData((prev) => ({ ...prev, suggestions: prev.suggestions.map((s) => s.id === id ? { ...s, state } : s) }));
  return <div className="stack"><h2>Suggestion Inbox</h2>{api.data.suggestions.map((s) => <div key={s.id} className="card"><p>{s.text}</p><div className="actions">{actions.map((a) => <button key={a} onClick={() => setState(s.id, a)}>{a}</button>)}</div></div>)}</div>;
}
