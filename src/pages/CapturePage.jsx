import { useState } from 'react';

export default function CapturePage({ api }) {
  const [text, setText] = useState('');
  const [projectId, setProjectId] = useState('');
  const [isNewIdea, setIsNewIdea] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    api.setData((prev) => ({ ...prev, captures: [{ id: crypto.randomUUID(), text, projectId: projectId || null, isNewIdea, createdAt: Date.now() }, ...prev.captures] }));
    setText(''); setProjectId(''); setIsNewIdea(false);
  };

  return <form className="stack" onSubmit={submit}><h2>Fast Capture</h2>
    <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Capture idea quickly..." rows={5} />
    <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
      <option value="">No project</option>
      {api.data.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
    </select>
    <label><input type="checkbox" checked={isNewIdea} onChange={(e) => setIsNewIdea(e.target.checked)} /> New project / new idea</label>
    <button type="submit">Save Capture</button>
  </form>;
}
