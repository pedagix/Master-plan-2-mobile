import { useState } from 'react';
import ContentSection from '../components/ContentSection';
import { normalizeProject } from '../lib/model';

function projectLabel(projects, id) {
  if (!id) return 'No project';
  return projects.find((p) => p.id === id)?.title || 'Missing project';
}

export default function RawNotesPage({ api }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ text: '', projectId: '', isNewIdea: false, createProject: false, newProjectTitle: '', newProjectDescription: '' });

  const openEdit = (capture) => {
    setEditingId(capture.id);
    setDraft({ text: capture.text || '', projectId: capture.projectId || '', isNewIdea: !!capture.isNewIdea, createProject: false, newProjectTitle: '', newProjectDescription: '' });
  };

  const saveEdit = () => {
    if (!editingId) return;
    const now = Date.now();
    api.setData((prev) => {
      const newProject = draft.createProject && draft.newProjectTitle.trim() ? normalizeProject({ id: crypto.randomUUID(), title: draft.newProjectTitle.trim(), description: draft.newProjectDescription.trim(), status: 'active', createdAt: now, updatedAt: now, lastInteractedAt: now, interactionCount: 1, notes: [], gallery: [] }) : null;
      const projectId = newProject?.id || draft.projectId || null;
      return { ...prev, projects: newProject ? [newProject, ...prev.projects] : prev.projects, captures: prev.captures.map((c) => c.id === editingId ? { ...c, text: draft.text, projectId, isNewIdea: draft.isNewIdea, needsProjectAssignment: draft.isNewIdea && !projectId, needsReanalysis: c.rawState === 'archived' ? true : c.needsReanalysis } : c), settings: { ...prev.settings, lastSelectedProjectId: projectId || prev.settings.lastSelectedProjectId } };
    });
    setEditingId(null);
  };

  const sendBack = (id) => api.setData((prev) => ({ ...prev, captures: prev.captures.map((c) => c.id === id ? { ...c, rawState: 'unprocessed', analysisState: 'not-analyzed', processedAt: null, archivedRawAt: null, needsReanalysis: false } : c) }));

  const unprocessed = api.data.captures.filter((c) => c.rawState !== 'archived');
  const archived = api.data.captures.filter((c) => c.rawState === 'archived');

  const renderCard = (capture, isArchived) => <div key={capture.id} className="card stack">
    <strong>{capture.text?.slice(0, 140) || '(empty note)'}</strong>
    <small>Project: {projectLabel(api.data.projects, capture.projectId)}</small>
    <small>Created: {new Date(capture.createdAt || Date.now()).toLocaleString()}</small>
    <small>Analysis: {capture.analysisState || 'not-analyzed'} {capture.isNewIdea ? '• New idea' : ''}</small>
    <div className="actions">
      <button onClick={() => openEdit(capture)}>Edit</button>
      {isArchived && <button onClick={() => sendBack(capture.id)}>Send note back for processing</button>}
    </div>
    {editingId === capture.id && <div className="card stack"><h3>Edit note</h3>
      <textarea rows={6} value={draft.text} onChange={(e) => setDraft((prev) => ({ ...prev, text: e.target.value }))} />
      <select value={draft.createProject ? '__new__' : draft.projectId} onChange={(e) => { const value = e.target.value; setDraft((prev) => ({ ...prev, createProject: value === '__new__', projectId: value === '__new__' ? prev.projectId : value })); }}>
        <option value="">No project</option>{api.data.projects.filter((p) => p.status !== 'archived' && p.status !== 'hidden').map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        <option value="__new__">+ Create new project</option>
      </select>
      {draft.createProject && <><input value={draft.newProjectTitle} onChange={(e) => setDraft((prev) => ({ ...prev, newProjectTitle: e.target.value }))} placeholder="Project title" /><input value={draft.newProjectDescription} onChange={(e) => setDraft((prev) => ({ ...prev, newProjectDescription: e.target.value }))} placeholder="Description (optional)" /></>}
      <label className="checkbox-row"><input type="checkbox" checked={draft.isNewIdea} onChange={(e) => setDraft((prev) => ({ ...prev, isNewIdea: e.target.checked }))} /><span>New project / new idea</span></label>
      <div className="actions"><button onClick={saveEdit}>Save changes</button><button onClick={() => setEditingId(null)}>Cancel</button></div>
    </div>}
  </div>;

  return <div className="stack"><h2>Ideas</h2>
    <ContentSection title="Unprocessed notes" items={unprocessed} headingLevel={3}>{unprocessed.map((c) => renderCard(c, false))}</ContentSection>
    <ContentSection title="Archived notes" items={archived} headingLevel={3}>{archived.map((c) => renderCard(c, true))}</ContentSection>
  </div>;
}
