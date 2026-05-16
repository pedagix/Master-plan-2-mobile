import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fileToDataUrl } from '../lib/storage';

export default function ProjectDetailPage({ api }) {
  const { projectId } = useParams();
  const project = useMemo(() => api.data.projects.find((p) => p.id === projectId), [api.data.projects, projectId]);
  const [note, setNote] = useState('');
  if (!project) return <p>Project not found</p>;

  const patchProject = (fn) => api.setData((prev) => ({ ...prev, projects: prev.projects.map((p) => p.id === projectId ? fn(p) : p) }));

  const addNote = () => { if (!note.trim()) return; patchProject((p) => ({ ...p, notes: [...p.notes, { id: crypto.randomUUID(), text: note, createdAt: Date.now() }] })); setNote(''); };

  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = await fileToDataUrl(file);
    patchProject((p) => ({ ...p, gallery: [...p.gallery, { id: crypto.randomUUID(), name: file.name, createdAt: Date.now(), previewUrl: url, noteId: null }] }));
  };

  const addImageNote = (imgId) => {
    const text = prompt('Add image note');
    if (!text) return;
    const id = crypto.randomUUID();
    patchProject((p) => ({
      ...p,
      notes: [...p.notes, { id, text: `[Image] ${text}`, imageId: imgId, createdAt: Date.now() }],
      gallery: p.gallery.map((g) => g.id === imgId ? { ...g, noteId: id } : g)
    }));
  };

  return <div className="stack"><h2>{project.title}</h2><p>{project.description}</p>
    <label>Status <select value={project.status} onChange={(e) => patchProject((p) => ({ ...p, status: e.target.value }))}><option>active</option><option>paused</option><option>hidden</option><option>archived</option></select></label>
    <h3>Notes</h3><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} /><button onClick={addNote}>Add Note</button>
    {project.notes.map((n) => <div className="card" key={n.id}>{n.text}</div>)}
    <h3>Gallery</h3><input type="file" accept="image/*" onChange={upload} />
    <div className="gallery">{[...project.gallery].sort((a,b)=>a.createdAt-b.createdAt).map((img) => <button className="img-card" key={img.id} onClick={() => addImageNote(img.id)}><img src={img.previewUrl} alt={img.name} /><small>{img.name}</small></button>)}</div>
  </div>;
}
