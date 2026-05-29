import { useMemo, useState } from 'react';
import ContentSection from '../components/ContentSection';
import { normalizeProject } from '../lib/model';

const outputActions = [
  { id: 'important', label: 'Important' },
  { id: 'to-do-list', label: 'To-do list' },
  { id: 'bad-idea', label: 'Bad idea' },
  { id: 'remind-me-later', label: 'Remind me later' }
];

const tagColors = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#4f46e5', '#be123c', '#0f766e', '#ca8a04', '#7c3aed', '#15803d'];
const checklistPattern = /\n|(^|\s)(\-|\*|\d+\.)\s+/m;

function getActivePromptProfile(data) {
  return data.settings.promptProfiles.find((p) => p.id === data.settings.activePromptProfileId) || data.settings.promptProfiles[0];
}

function projectLabel(projects, id) {
  if (!id) return 'No project';
  return projects.find((p) => p.id === id)?.title || 'Missing project';
}

function suggestionProjectLabel(projects, suggestion) {
  if (suggestion.projectId) return projects.find((p) => p.id === suggestion.projectId)?.title || suggestion.projectId;
  if (suggestion.candidateProjectIds?.length) return suggestion.candidateProjectIds.join(', ');
  return 'No project assigned';
}

function isActiveProcessorItem(item) {
  const excludedStates = new Set(['marked-important', 'approved', 'converted-to-task', 'converted-to-checklist', 'converted-to-question', 'bad-idea', 'hidden-until-next-analysis']);
  const excludedStatus = new Set(['approved', 'dismissed', 'hidden']);
  return (item.inboxStatus === 'pending-review' || item.state === 'pending') && !excludedStates.has(item.state) && !excludedStatus.has(item.inboxStatus);
}

function isQuestionProposal(item) {
  return String(item.type || '').includes('question') || Boolean(item.question);
}

function isChecklistProposal(item) {
  return String(item.type || '').includes('checklist') || Array.isArray(item.items) && item.items.length > 0;
}

function byNewest(a, b) {
  return (b.createdAt || 0) - (a.createdAt || 0);
}

export default function NotesProcessorPage({ api }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [answerByQuestion, setAnswerByQuestion] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ text: '', projectId: '', isNewIdea: false, createProject: false, newProjectTitle: '', newProjectDescription: '' });

  const promptActions = useMemo(() => Object.values(getActivePromptProfile(api.data)?.promptActions || {}), [api.data]);
  const hiddenActionIds = api.data.settings.notesProcessorHiddenActionIds || [];
  const visiblePromptActions = promptActions.filter((action) => !hiddenActionIds.includes(action.id));
  const actionById = useMemo(() => Object.fromEntries(promptActions.map((action) => [action.id, action])), [promptActions]);
  const notes = useMemo(() => [...api.data.captures].sort(byNewest), [api.data.captures]);
  const pendingOutputs = api.data.suggestions.filter(isActiveProcessorItem);

  const toggleActionVisibility = (id) => api.setData((prev) => {
    const hidden = new Set(prev.settings.notesProcessorHiddenActionIds || []);
    if (hidden.has(id)) hidden.delete(id);
    else hidden.add(id);
    return { ...prev, settings: { ...prev.settings, notesProcessorHiddenActionIds: [...hidden] } };
  });

  const toggleTag = (noteId, tagId) => api.setData((prev) => ({
    ...prev,
    captures: prev.captures.map((note) => {
      if (note.id !== noteId) return note;
      const current = Array.isArray(note.processingTags) ? note.processingTags : [];
      const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
      return { ...note, processingTags: next };
    })
  }));

  const openEdit = (note) => {
    setEditingId(note.id);
    setDraft({ text: note.text || '', projectId: note.projectId || '', isNewIdea: !!note.isNewIdea, createProject: false, newProjectTitle: '', newProjectDescription: '' });
  };

  const saveEdit = () => {
    if (!editingId) return;
    const now = Date.now();
    api.setData((prev) => {
      const newProject = draft.createProject && draft.newProjectTitle.trim() ? normalizeProject({ id: crypto.randomUUID(), title: draft.newProjectTitle.trim(), description: draft.newProjectDescription.trim(), status: 'active', createdAt: now, updatedAt: now, lastInteractedAt: now, interactionCount: 1, notes: [], gallery: [] }) : null;
      const projectId = newProject?.id || draft.projectId || null;
      return {
        ...prev,
        projects: newProject ? [newProject, ...prev.projects] : prev.projects,
        captures: prev.captures.map((note) => note.id === editingId ? { ...note, text: draft.text, projectId, isNewIdea: draft.isNewIdea, needsProjectAssignment: draft.isNewIdea && !projectId, needsReanalysis: note.rawState === 'archived' ? true : note.needsReanalysis } : note),
        settings: { ...prev.settings, lastSelectedProjectId: projectId || prev.settings.lastSelectedProjectId }
      };
    });
    setEditingId(null);
  };

  const selectOutputAction = (id, action) => api.setData((prev) => ({
    ...prev,
    suggestions: prev.suggestions.map((s) => (s.id === id ? { ...s, selectedAction: action } : s))
  }));

  const approveOutput = (item) => {
    if (!item.selectedAction) return alert('Choose an action first.');
    api.setData((prev) => {
      const now = Date.now();
      let createdTask = null;
      let createdChecklist = null;
      let createdQuestion = null;

      const suggestions = prev.suggestions.map((s) => {
        if (s.id !== item.id) return s;
        if (s.selectedAction === 'important') {
          if (isQuestionProposal(s)) {
            createdQuestion = {
              id: crypto.randomUUID(),
              projectId: s.projectId || null,
              sourceSuggestionId: s.id,
              sourceCaptureId: s.sourceCaptureId || null,
              question: s.question || s.text || s.title,
              reason: s.reason || 'Imported AI proposal approved from Notes processor.',
              questionType: s.questionType || 'ai-imported',
              state: 'open',
              createdAt: now,
              answeredAt: null,
              answerNoteId: null,
              feedback: null,
              needsProjectAssignment: !s.projectId,
            };
            return { ...s, state: 'converted-to-question', inboxStatus: 'approved', importance: 'important', approvedAt: now, needsProjectAssignment: !s.projectId };
          }
          return { ...s, state: 'marked-important', inboxStatus: 'approved', importance: 'important', approvedAt: now };
        }
        if (s.selectedAction === 'bad-idea') return { ...s, state: 'bad-idea', inboxStatus: 'dismissed', dismissedAt: now };
        if (s.selectedAction === 'remind-me-later') return { ...s, state: 'hidden-until-next-analysis', inboxStatus: 'hidden', hiddenAt: now, hiddenUntil: 'next-analysis' };
        if (s.selectedAction === 'to-do-list') {
          const shouldCreateChecklist = isChecklistProposal(s) || checklistPattern.test(s.text || '');
          if (shouldCreateChecklist) {
            createdChecklist = {
              id: crypto.randomUUID(),
              projectId: s.projectId || null,
              title: s.title || (s.text || '').slice(0, 80) || 'Checklist from Notes processor',
              items: Array.isArray(s.items) ? s.items : [],
              sourceSuggestionId: s.id,
              sourceInboxItemId: s.id,
              needsProjectAssignment: !s.projectId,
              state: 'open',
              createdAt: now,
              updatedAt: now
            };
            return { ...s, state: 'converted-to-checklist', inboxStatus: 'approved', approvedAt: now, needsProjectAssignment: !s.projectId };
          }
          createdTask = {
            id: crypto.randomUUID(),
            projectId: s.projectId || null,
            title: s.title || s.text || 'Task from Notes processor',
            sourceSuggestionId: s.id,
            sourceInboxItemId: s.id,
            needsProjectAssignment: !s.projectId,
            state: 'open',
            createdAt: now,
            updatedAt: now
          };
          return { ...s, state: 'converted-to-task', inboxStatus: 'approved', approvedAt: now, needsProjectAssignment: !s.projectId };
        }
        return s;
      });

      const log = {
        id: crypto.randomUUID(),
        itemId: item.id,
        itemType: item.type || 'suggestion',
        action: item.selectedAction,
        projectId: item.projectId || null,
        createdAt: now
      };

      const badIdeaLog = item.selectedAction === 'bad-idea'
        ? [{ id: crypto.randomUUID(), sourceItemId: item.id, sourceItemType: item.type || 'suggestion', text: item.text, projectId: item.projectId || null, reason: null, createdAt: now }, ...(prev.badIdeaLog || [])]
        : prev.badIdeaLog;

      return {
        ...prev,
        suggestions,
        tasks: createdTask ? [createdTask, ...(prev.tasks || [])] : prev.tasks,
        checklists: createdChecklist ? [createdChecklist, ...(prev.checklists || [])] : prev.checklists,
        questions: createdQuestion ? [createdQuestion, ...(prev.questions || [])] : prev.questions,
        inboxActionLog: [log, ...(prev.inboxActionLog || [])],
        badIdeaLog,
      };
    });
  };

  const setFeedback = (question, feedback) => api.setData((prev) => ({
    ...prev,
    questions: prev.questions.map((q) => q.id === question.id ? { ...q, feedback } : q),
    questionFeedbackLog: [{ questionId: question.id, questionType: question.questionType, feedback, createdAt: Date.now() }, ...(prev.questionFeedbackLog || [])]
  }));

  const dismissQuestion = (id) => api.setData((prev) => ({ ...prev, questions: prev.questions.map((q) => q.id === id ? { ...q, state: 'dismissed' } : q) }));

  const answerQuestion = (q) => {
    const text = (answerByQuestion[q.id] || '').trim();
    if (!text) return;
    const now = Date.now();
    const noteId = crypto.randomUUID();
    api.setData((prev) => ({
      ...prev,
      captures: [{ id: noteId, text, projectId: q.projectId || null, linkedQuestionId: q.id, createdAt: now, isNewIdea: false, rawState: 'unprocessed', analysisState: 'not-analyzed', processedAt: null, archivedRawAt: null, needsReanalysis: false, needsProjectAssignment: false, candidateProjectIds: [], processingTags: [] }, ...prev.captures],
      questions: prev.questions.map((item) => item.id === q.id ? { ...item, state: 'answered', answeredAt: now, answerNoteId: noteId } : item)
    }));
    setAnswerByQuestion((prev) => ({ ...prev, [q.id]: '' }));
  };

  return <div className="stack"><div className="page-title-row"><h2>Notes processor</h2><button className="secondary-button" onClick={() => setSettingsOpen((value) => !value)}>Settings</button></div>
    {settingsOpen && <section className="card stack"><h3>Visible processing tags</h3>
      <div className="visibility-list">{promptActions.map((action) => <label className="checkbox-row" key={action.id}><input type="checkbox" checked={!hiddenActionIds.includes(action.id)} onChange={() => toggleActionVisibility(action.id)} /><span>{action.title}</span></label>)}</div>
    </section>}

    <section className="stack card-list"><h3>Notes</h3>
      {!notes.length && <p>No notes yet.</p>}
      {notes.map((note) => {
        const selectedTags = Array.isArray(note.processingTags) ? note.processingTags : [];
        const hiddenSelectedTags = selectedTags.filter((tagId) => !visiblePromptActions.some((action) => action.id === tagId));
        return <div key={note.id} className="card stack">
          <strong>{note.text?.slice(0, 180) || '(empty note)'}</strong>
          <small>Project: {projectLabel(api.data.projects, note.projectId)}</small>
          <small>Status: {note.analysisState || 'not-analyzed'} {note.needsReanalysis ? 'needs re-analysis' : ''}</small>
          <div className="tag-actions">{visiblePromptActions.map((action, index) => {
            const selected = selectedTags.includes(action.id);
            return <button key={action.id} type="button" className={`tag-pill ${selected ? 'selected' : ''}`} style={{ '--tag-color': tagColors[index % tagColors.length] }} onClick={() => toggleTag(note.id, action.id)}>{action.title}</button>;
          })}</div>
          {!!hiddenSelectedTags.length && <small>Hidden selected tags: {hiddenSelectedTags.map((tagId) => actionById[tagId]?.title || tagId).join(', ')}</small>}
          <div className="actions"><button onClick={() => openEdit(note)}>Edit</button></div>
          {editingId === note.id && <div className="edit-panel stack"><h3>Edit note</h3>
            <textarea rows={5} value={draft.text} onChange={(e) => setDraft((prev) => ({ ...prev, text: e.target.value }))} />
            <select value={draft.createProject ? '__new__' : draft.projectId} onChange={(e) => { const value = e.target.value; setDraft((prev) => ({ ...prev, createProject: value === '__new__', projectId: value === '__new__' ? prev.projectId : value })); }}>
              <option value="">No project</option>{api.data.projects.filter((p) => p.status !== 'archived' && p.status !== 'hidden').map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              <option value="__new__">+ Create new project</option>
            </select>
            {draft.createProject && <><input value={draft.newProjectTitle} onChange={(e) => setDraft((prev) => ({ ...prev, newProjectTitle: e.target.value }))} placeholder="Project title" /><input value={draft.newProjectDescription} onChange={(e) => setDraft((prev) => ({ ...prev, newProjectDescription: e.target.value }))} placeholder="Description (optional)" /></>}
            <label className="checkbox-row"><input type="checkbox" checked={draft.isNewIdea} onChange={(e) => setDraft((prev) => ({ ...prev, isNewIdea: e.target.checked }))} /><span>New project / new idea</span></label>
            <div className="actions"><button onClick={saveEdit}>Save changes</button><button className="secondary-button" onClick={() => setEditingId(null)}>Cancel</button></div>
          </div>}
        </div>;
      })}
    </section>

    <ContentSection title="AI outputs" items={pendingOutputs} headingLevel={3}>{pendingOutputs.map((s) => <div key={s.id} className="card stack"><small>{s.type || 'Suggestion'}</small><strong>{s.title || s.text}</strong>
      {s.title && s.text && <p>{s.text}</p>}
      {s.reason && <small>Reason: {s.reason}</small>}
      <small>Project: {suggestionProjectLabel(api.data.projects, s)}</small>
      {s.sourceCaptureId && <small>Source note: {s.sourceCaptureId}</small>}
      {s.sourceNoteId && <small>Source note: {s.sourceNoteId}</small>}
      <div className="actions">{outputActions.map((a) => <button key={a.id} className={s.selectedAction === a.id ? 'selected-action' : ''} onClick={() => selectOutputAction(s.id, a.id)}>{a.label}</button>)}</div>
      <button onClick={() => approveOutput(s)}>OK / Approve</button>
    </div>)}</ContentSection>
    {!pendingOutputs.length && <p>No AI outputs waiting.</p>}

    <ContentSection title="Follow-up questions" items={api.data.questions} headingLevel={3}>{api.data.questions.map((q) => <div key={q.id} className="card stack"><strong>{q.question}</strong><p>{q.reason}</p><small>Type: {q.questionType} - State: {q.state}</small>
      <small>Project: {q.projectId || 'none'} - Source note: {q.sourceCaptureId || 'n/a'}</small>
      <div className="actions"><button onClick={() => setFeedback(q, 'upvote')}>Upvote</button><button onClick={() => setFeedback(q, 'downvote')}>Downvote</button><button onClick={() => dismissQuestion(q.id)}>Dismiss</button></div>
      <textarea rows={2} placeholder="Answer with note" value={answerByQuestion[q.id] || ''} onChange={(e) => setAnswerByQuestion((prev) => ({ ...prev, [q.id]: e.target.value }))} />
      <button onClick={() => answerQuestion(q)}>Answer</button>
    </div>)}</ContentSection>
  </div>;
}
