import { useEffect, useRef, useState } from 'react';
import { normalizeProject } from '../lib/model';

function maybeGenerateQuestion(capture) {
  const text = capture.text.toLowerCase();
  const triggers = ['not sure', 'unclear', 'blocked', 'stuck', 'maybe', 'decide', 'need to learn', 'assume'];
  if (!triggers.some((t) => text.includes(t))) return null;
  return { id: `q-${crypto.randomUUID()}`, sourceNoteId: null, sourceCaptureId: capture.id, projectId: capture.projectId || null, question: 'What is the most important missing detail that would unblock this capture?', reason: 'This capture looks like it may contain uncertainty, a blocker, or an unclear assumption.', questionType: 'clarify-blocker', state: 'open', createdAt: Date.now(), answeredAt: null, answerNoteId: null, feedback: null };
}

export default function CapturePage({ api }) {
  const initialProjectId = api.data.settings.lastSelectedProjectId && api.data.projects.some((p) => p.id === api.data.settings.lastSelectedProjectId && p.status !== 'archived' && p.status !== 'hidden') ? api.data.settings.lastSelectedProjectId : '';
  const [text, setText] = useState(''); const [projectId, setProjectId] = useState(initialProjectId);
  const [createProject, setCreateProject] = useState(false); const [newProjectTitle, setNewProjectTitle] = useState(''); const [newProjectDescription, setNewProjectDescription] = useState('');
  const [savedMessageVisible, setSavedMessageVisible] = useState(false);
  const savedMessageTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(savedMessageTimerRef.current), []);

  const submit = (e) => {
    e.preventDefault(); if (!text.trim()) return;
    const now = Date.now();
    const createdProject = createProject && newProjectTitle.trim() ? normalizeProject({ id: crypto.randomUUID(), title: newProjectTitle.trim(), description: newProjectDescription.trim(), status: 'active', createdAt: now, updatedAt: now, lastInteractedAt: now, interactionCount: 1, notes: [], gallery: [] }) : null;
    const selectedProjectId = createdProject?.id || (createProject ? null : projectId || null);
    const isNewIdea = !selectedProjectId;
    const capture = { id: crypto.randomUUID(), text, projectId: selectedProjectId, isNewIdea, rawState: 'unprocessed', analysisState: 'not-analyzed', processedAt: null, archivedRawAt: null, needsReanalysis: false, needsProjectAssignment: isNewIdea, candidateProjectIds: [], createdAt: now, createdWithPromptProfileId: api.data.settings.activePromptProfileId };
    const question = maybeGenerateQuestion(capture);
    api.setData((prev) => ({ ...prev, captures: [capture, ...prev.captures], projects: createdProject ? [createdProject, ...prev.projects] : prev.projects.map((p) => p.id === capture.projectId ? { ...p, lastInteractedAt: now, interactionCount: (p.interactionCount || 0) + 1 } : p), questions: question ? [question, ...prev.questions] : prev.questions, settings: { ...prev.settings, lastSelectedProjectId: selectedProjectId } }));
    setText(''); setProjectId(selectedProjectId || ''); setCreateProject(false); setNewProjectTitle(''); setNewProjectDescription('');
    setSavedMessageVisible(true);
    window.clearTimeout(savedMessageTimerRef.current);
    savedMessageTimerRef.current = window.setTimeout(() => setSavedMessageVisible(false), 1000);
  };

  return <form className="stack" onSubmit={submit}><h2>Fast Capture</h2>
    <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Capture idea quickly..." rows={5} />
    <select value={createProject ? '__new__' : projectId} onChange={(e) => { const value = e.target.value; setCreateProject(value === '__new__'); setProjectId(value === '__new__' ? '' : value); }}>
      <option value="">No project</option>{api.data.projects.filter((p) => p.status !== 'archived' && p.status !== 'hidden').map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      <option value="__new__">+ Create new project</option>
    </select>
    {createProject && <div className="stack card"><input value={newProjectTitle} onChange={(e) => setNewProjectTitle(e.target.value)} placeholder="Project title" /><input value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} placeholder="Description (optional)" /></div>}
    <button type="submit">Save Capture</button>
    {savedMessageVisible && <p className="success-message" role="status" aria-live="polite">Note saved</p>}
  </form>;
}
