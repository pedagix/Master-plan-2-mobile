import { useEffect, useMemo, useState } from 'react';
import { completeTaskData, formatHistoryDuration } from '../lib/taskTracking';

const RATINGS = [0, 1, 2, 3, 4, 5];

export default function TaskCompletionSheet({ api, task, projectName, onClose, onCompleted }) {
  const [valueRating, setValueRating] = useState(null);
  const completionSessions = useMemo(() => (api.data.taskSessions || []).filter((session) => session.taskNoteId === task.id && (!task.restoredAt || Number(session.startedAt) >= Number(task.restoredAt))), [api.data.taskSessions, task.id, task.restoredAt]);
  const trackedMs = useMemo(() => {
    const stored = completionSessions.reduce((sum, session) => sum + Math.max(0, Number(session.durationMs) || 0), 0);
    const active = api.data.activeTask;
    if (!active || active.taskNoteId !== task.id || active.status !== 'running' || !active.segmentStartedAt) return stored;
    return stored + Math.max(0, Date.now() - active.segmentStartedAt);
  }, [completionSessions, api.data.activeTask, task.id]);
  const sessionCount = completionSessions.length + (api.data.activeTask?.taskNoteId === task.id && api.data.activeTask?.status === 'running' ? 1 : 0);
  const estimateMinutes = task.estimateMinutes ?? (api.data.activeTask?.taskNoteId === task.id ? api.data.activeTask?.estimateMinutes : null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const finish = (ratingOverride = valueRating) => {
    if (api.completeTask) api.completeTask(task, { valueRating: ratingOverride });
    else api.setData((prev) => completeTaskData(prev, task, { valueRating: ratingOverride }));
    onCompleted?.();
    onClose();
  };

  return (
    <div className="task-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="task-sheet completion-sheet" role="dialog" aria-modal="true" aria-labelledby="completion-title">
        <div className="task-sheet-handle" aria-hidden="true" />
        <div className="task-sheet-heading">
          <div>
            <small>TASK COMPLETE</small>
            <h3 id="completion-title">{task.text}</h3>
            <p className="helper-text">{projectName || 'Plans'}</p>
          </div>
          <button type="button" className="icon-button task-sheet-close" onClick={onClose} aria-label="Close completion">×</button>
        </div>

        <div className="completion-summary-grid">
          <div><small>Time</small><strong>{formatHistoryDuration(trackedMs)}</strong></div>
          <div><small>Sessions</small><strong>{sessionCount || '—'}</strong></div>
          {estimateMinutes && <div><small>Estimate</small><strong>{formatHistoryDuration(estimateMinutes * 60_000)}</strong></div>}
        </div>

        <div className="stack valuable-rating-block">
          <div>
            <strong>Valuable</strong>
            <p className="helper-text">0 = useless · 5 = completely worth doing</p>
          </div>
          <div className="value-rating-buttons" role="group" aria-label="Valuable rating from zero to five">
            {RATINGS.map((rating) => (
              <button
                type="button"
                key={rating}
                className={valueRating === rating ? 'selected' : ''}
                onClick={() => setValueRating(rating)}
                aria-pressed={valueRating === rating}
              >
                {rating}
              </button>
            ))}
          </div>
          <div className="value-rating-preview" aria-live="polite">
            {valueRating === null ? 'Not rated' : `${'★'.repeat(valueRating)}${'☆'.repeat(5 - valueRating)}  ${valueRating}/5`}
          </div>
        </div>

        <button type="button" className="task-start-button" onClick={() => finish()}>✓ Complete task</button>
        <button type="button" className="text-button completion-skip-button" onClick={() => finish(null)}>Skip rating & complete</button>
      </section>
    </div>
  );
}
