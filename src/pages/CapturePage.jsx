import { useState } from 'react';

function maybeGenerateQuestion(capture) {
  const text = capture.text.toLowerCase();
  const triggers = ['not sure', 'unclear', 'blocked', 'stuck', 'maybe', 'decide', 'need to learn', 'assume'];
  if (!triggers.some((t) => text.includes(t))) return null;
  return { id: `q-${crypto.randomUUID()}`, sourceNoteId: null, sourceCaptureId: capture.id, projectId: capture.projectId || null, question: 'What is the most important missing detail that would unblock this capture?', reason: 'This capture looks like it may contain uncertainty, a blocker, or an unclear assumption.', questionType: 'clarify-blocker', state: 'open', createdAt: Date.now(), answeredAt: null, answerNoteId: null, feedback: null };
}

export default function CapturePage({ api }) {
  const [text, setText] = useState(''); const [projectId, setProjectId] = useState(''); const [isNewIdea, setIsNewIdea] = useState(false);
  const submit = (e) => {
    e.preventDefault(); if (!text.trim()) return;
    const capture = { id: crypto.randomUUID(), text, projectId: projectId || null, isNewIdea, needsProjectAssignment: isNewIdea && !projectId, candidateProjectIds: [], createdAt: Date.now(), createdWithPromptProfileId: api.data.settings.activePromptProfileId };
    const question = maybeGenerateQuestion(capture);
    api.setData((prev) => ({ ...prev, captures: [capture, ...prev.captures], projects: prev.projects.map((p) => p.id === capture.projectId ? { ...p, lastInteractedAt: Date.now(), interactionCount: (p.interactionCount || 0) + 1 } : p), questions: question ? [question, ...prev.questions] : prev.questions }));
    setText(''); setProjectId(''); setIsNewIdea(false);
  };

  return <form className="stack" onSubmit={submit}><h2>Fast Capture</h2>
    <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Capture idea quickly..." rows={5} />
    <select value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">No project</option>{api.data.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
    <label className="checkbox-row"><input type="checkbox" checked={isNewIdea} onChange={(e) => setIsNewIdea(e.target.checked)} /><span>New project / new idea</span></label>
    <button type="submit">Save Capture</button></form>;
}
