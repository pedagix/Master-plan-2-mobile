import { useState } from 'react';

export default function ReviewPage({ api }) {
  const [answerByQuestion, setAnswerByQuestion] = useState({});
  const markAnalyzed = () => api.setData((prev) => {
    const now = Date.now();
    return { ...prev, captures: prev.captures.map((c) => c.rawState === 'archived' ? c : { ...c, rawState: 'archived', analysisState: 'analyzed', processedAt: now, archivedRawAt: now, needsReanalysis: false }) };
  });

  const setFeedback = (question, feedback) => api.setData((prev) => ({
    ...prev,
    questions: prev.questions.map((q) => q.id === question.id ? { ...q, feedback } : q),
    questionFeedbackLog: [{ questionId: question.id, questionType: question.questionType, feedback, createdAt: Date.now() }, ...prev.questionFeedbackLog]
  }));

  const dismiss = (id) => api.setData((prev) => ({ ...prev, questions: prev.questions.map((q) => q.id === id ? { ...q, state: 'dismissed' } : q) }));

  const answer = (q) => {
    const text = (answerByQuestion[q.id] || '').trim(); if (!text) return;
    const noteId = crypto.randomUUID();
    api.setData((prev) => ({
      ...prev,
      captures: [{ id: noteId, text, projectId: q.projectId || null, linkedQuestionId: q.id, createdAt: Date.now(), isNewIdea: false }, ...prev.captures],
      questions: prev.questions.map((item) => item.id === q.id ? { ...item, state: 'answered', answeredAt: Date.now(), answerNoteId: noteId } : item)
    }));
  };

  return <div className="stack"><h2>Review</h2><p>Total captures: {api.data.captures.length}</p><p>Total projects: {api.data.projects.length}</p><button onClick={api.exportAiAnalysis}>Export AI analysis JSON</button><button onClick={markAnalyzed}>Mark unprocessed RAW notes as analyzed</button>
    <h3>Follow-up Questions</h3>
    {api.data.questions.map((q) => <div key={q.id} className="card stack"><strong>{q.question}</strong><p>{q.reason}</p><small>Type: {q.questionType} • State: {q.state}</small>
      <small>Project: {q.projectId || 'none'} • Source capture: {q.sourceCaptureId || 'n/a'}</small>
      <div className="actions"><button onClick={() => setFeedback(q, 'upvote')}>Upvote</button><button onClick={() => setFeedback(q, 'downvote')}>Downvote</button><button onClick={() => dismiss(q.id)}>Dismiss</button></div>
      <textarea rows={2} placeholder="Answer with note" value={answerByQuestion[q.id] || ''} onChange={(e) => setAnswerByQuestion((prev) => ({ ...prev, [q.id]: e.target.value }))} />
      <button onClick={() => answer(q)}>Answer</button>
    </div>)}
  </div>;
}
