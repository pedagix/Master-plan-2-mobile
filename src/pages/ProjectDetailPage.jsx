import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fileToDataUrl } from '../lib/storage';

export default function ProjectDetailPage({ api }) {
  const { projectId } = useParams();
  const project = useMemo(() => api.data.projects.find((p) => p.id === projectId), [api.data.projects, projectId]);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!projectId) return;
    api.setData((prev) => ({ ...prev, projects: prev.projects.map((p) => p.id === projectId ? { ...p, lastInteractedAt: Date.now(), interactionCount: (p.interactionCount || 0) + 1 } : p) }));
  }, [projectId]);
  if (!project) return <p>Project not found</p>;

  const patchProject = (fn) => api.setData((prev) => ({ ...prev, projects: prev.projects.map((p) => p.id === projectId ? fn(p) : p) }));
  const addNote = () => { if (!note.trim()) return; patchProject((p) => ({ ...p, notes: [...p.notes, { id: crypto.randomUUID(), text: note, createdAt: Date.now() }], lastInteractedAt: Date.now(), interactionCount: (p.interactionCount || 0) + 1 })); setNote(''); };
  const upload = async (e) => { const file = e.target.files?.[0]; if (!file) return; const url = await fileToDataUrl(file); patchProject((p) => ({ ...p, gallery: [...p.gallery, { id: crypto.randomUUID(), name: file.name, createdAt: Date.now(), previewUrl: url, noteId: null }], lastInteractedAt: Date.now(), interactionCount: (p.interactionCount || 0) + 1 })); };

  const captures = api.data.captures.filter((c) => c.projectId === projectId);
  const approvedSuggestions = api.data.suggestions.filter((s) => s.projectId === projectId && s.state !== 'pending' && s.state !== 'hidden-until-next-analysis');
  const approvedTasks = (api.data.tasks || []).filter((t) => t.projectId === projectId);
  const approvedChecklists = (api.data.checklists || []).filter((c) => c.projectId === projectId);
  const approvedQuestions = (api.data.questions || []).filter((q) => q.projectId === projectId && q.state !== 'pending');

  return <div className="stack"><h2>{project.title}</h2><p>{project.description}</p>
    <div className="card"><h3>Project actions</h3><button onClick={() => patchProject((p) => ({ ...p, status: 'archived' }))}>Archive project</button></div>
    <h3>Notes</h3><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} /><button onClick={addNote}>Add Note</button>
    {project.notes.map((n) => <div className="card" key={n.id}>{n.text}</div>)}
    <h3>Captures</h3>{captures.map((n) => <div className="card" key={n.id}>{n.text}</div>)}
    <h3>Approved Suggestions</h3>{approvedSuggestions.map((s) => <div className="card" key={s.id}>{s.text}</div>)}
    <h3>Approved Tasks / Next Steps</h3>{approvedTasks.map((t) => <div className="card" key={t.id}>{t.title}</div>)}
    <h3>Approved Checklists</h3>{approvedChecklists.map((c) => <div className="card" key={c.id}>{c.title}</div>)}
    <h3>Approved Follow-up Questions</h3>{approvedQuestions.map((q) => <div className="card" key={q.id}>{q.question}</div>)}
    <h3>Gallery</h3><input type="file" accept="image/*" onChange={upload} />
    <div className="gallery">{[...project.gallery].sort((a,b)=>a.createdAt-b.createdAt).map((img) => <div className="img-card" key={img.id}><img src={img.previewUrl} alt={img.name} /><small>{img.name}</small></div>)}</div>
  </div>;
}
