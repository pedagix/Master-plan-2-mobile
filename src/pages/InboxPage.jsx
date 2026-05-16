const actions = [
  { id: 'important', label: 'Important' },
  { id: 'to-do-list', label: 'To-do list' },
  { id: 'bad-idea', label: 'Bad idea' },
  { id: 'remind-me-later', label: 'Remind me later' }
];

const checklistPattern = /\n|(^|\s)(\-|\*|\d+\.)\s+/m;

function projectLabel(projects, suggestion) {
  if (suggestion.projectId) return projects.find((p) => p.id === suggestion.projectId)?.title || suggestion.projectId;
  if (suggestion.candidateProjectIds?.length) return suggestion.candidateProjectIds.join(', ');
  return 'No project assigned';
}

function isActiveInboxItem(item) {
  const excludedStates = new Set(['marked-important', 'approved', 'converted-to-task', 'converted-to-checklist', 'bad-idea', 'hidden-until-next-analysis']);
  const excludedStatus = new Set(['approved', 'dismissed', 'hidden']);
  return (item.inboxStatus === 'pending-review' || item.state === 'pending') && !excludedStates.has(item.state) && !excludedStatus.has(item.inboxStatus);
}

function isQuestionProposal(item) {
  return String(item.type || '').includes('question') || Boolean(item.question);
}

function isChecklistProposal(item) {
  return String(item.type || '').includes('checklist') || Array.isArray(item.items) && item.items.length > 0;
}

export default function InboxPage({ api }) {
  const pending = api.data.suggestions.filter(isActiveInboxItem);

  const selectAction = (id, action) => api.setData((prev) => ({
    ...prev,
    suggestions: prev.suggestions.map((s) => (s.id === id ? { ...s, selectedAction: action } : s))
  }));

  const approve = (item) => {
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
              reason: s.reason || 'Imported AI proposal approved from Inbox.',
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
              title: s.title || (s.text || '').slice(0, 80) || 'Checklist from inbox',
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
            title: s.title || s.text || 'Task from inbox',
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

  return <div className="stack"><h2>Suggestion Inbox</h2>
    {!pending.length && <p>No pending inbox items.</p>}
    {pending.map((s) => <div key={s.id} className="card stack"><small>{s.type || 'Suggestion'}</small><strong>{s.title || s.text}</strong>
      {s.title && s.text && <p>{s.text}</p>}
      {s.reason && <small>Reason: {s.reason}</small>}
      <small>Project: {projectLabel(api.data.projects, s)}</small>
      {s.sourceCaptureId && <small>Source capture: {s.sourceCaptureId}</small>}
      {s.sourceNoteId && <small>Source note: {s.sourceNoteId}</small>}
      <div className="actions">{actions.map((a) => <button key={a.id} className={s.selectedAction === a.id ? 'selected-action' : ''} onClick={() => selectAction(s.id, a.id)}>{a.label}</button>)}</div>
      <button onClick={() => approve(s)}>OK / Approve</button>
    </div>)}
  </div>;
}
