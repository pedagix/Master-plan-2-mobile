const actions = [
  { id: 'important', label: 'Important' },
  { id: 'to-do-list', label: 'To-do list' },
  { id: 'bad-idea', label: 'Bad idea' },
  { id: 'remind-me-later', label: 'Remind me later' }
];

export default function InboxPage({ api }) {
  const pending = api.data.suggestions.filter((s) => s.state === 'pending' || s.inboxStatus === 'pending-review' || s.state === 'hidden-until-next-analysis');

  const selectAction = (id, action) => api.setData((prev) => ({ ...prev, suggestions: prev.suggestions.map((s) => s.id === id ? { ...s, selectedAction: action } : s) }));

  const approve = (item) => {
    if (!item.selectedAction) return alert('Choose an action first.');
    api.setData((prev) => {
      const now = Date.now();
      const next = prev.suggestions.map((s) => {
        if (s.id !== item.id) return s;
        if (s.selectedAction === 'important') return { ...s, state: 'marked-important', inboxStatus: 'processed', importance: 'important', approvedAt: now };
        if (s.selectedAction === 'bad-idea') return { ...s, state: 'bad-idea', inboxStatus: 'processed', dismissedAt: now };
        if (s.selectedAction === 'remind-me-later') return { ...s, state: 'hidden-until-next-analysis', inboxStatus: 'pending-review', hiddenAt: now, hiddenUntil: 'next-analysis' };
        if (s.selectedAction === 'to-do-list') return { ...s, state: 'converted-to-task', inboxStatus: 'processed', approvedAt: now };
        return s;
      });
      const target = next.find((s) => s.id === item.id);
      const logs = [{ id: crypto.randomUUID(), itemId: item.id, itemType: item.type || 'suggestion', action: item.selectedAction, projectId: item.projectId || null, createdAt: now }, ...(prev.inboxActionLog || [])];
      const bad = item.selectedAction === 'bad-idea' ? [{ id: crypto.randomUUID(), sourceItemId: item.id, sourceItemType: 'suggestion', text: item.text, projectId: item.projectId || null, reason: null, createdAt: now }, ...(prev.badIdeaLog || [])] : prev.badIdeaLog;
      const tasks = item.selectedAction === 'to-do-list' ? [{ id: crypto.randomUUID(), projectId: item.projectId || null, title: item.text, items: [], sourceSuggestionId: item.id, state: 'open', createdAt: now }, ...(prev.tasks || [])] : prev.tasks;
      return { ...prev, suggestions: next, tasks, inboxActionLog: logs, badIdeaLog: bad, projects: prev.projects.map((p) => p.id === target?.projectId ? { ...p, lastInteractedAt: now, interactionCount: (p.interactionCount || 0) + 1 } : p) };
    });
  };

  return <div className="stack"><h2>Suggestion Inbox</h2>{pending.map((s) => <div key={s.id} className="card"><small>{s.type || 'Suggestion'}</small><p>{s.text}</p>
    {s.reason && <small>Reason: {s.reason}</small>}
    {s.sourceCaptureId && <small>Source capture: {s.sourceCaptureId}</small>}
    {(s.projectId || s.candidateProjectIds?.length) && <small>Project: {s.projectId || s.candidateProjectIds.join(', ')}</small>}
    <div className="actions">{actions.map((a) => <button key={a.id} className={s.selectedAction === a.id ? 'selected-action' : ''} onClick={() => selectAction(s.id, a.id)}>{a.label}</button>)}</div>
    <button onClick={() => approve(s)}>OK / Approve</button></div>)}</div>;
}
