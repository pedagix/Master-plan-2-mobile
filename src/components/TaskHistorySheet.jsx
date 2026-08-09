import { useEffect, useMemo, useState } from 'react';
import {
  deleteTaskSessionData,
  formatHistoryDuration,
  getCompletionSessions,
  restoreCompletedTaskData,
  updateCompletedTaskRatingData,
  updateTaskSessionDurationData,
} from '../lib/taskTracking';

function formatDateTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}

function formatClock(timestamp) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

export default function TaskHistorySheet({ api, completedTask, projectName, onClose }) {
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [durationMinutes, setDurationMinutes] = useState('');
  const sessions = useMemo(() => getCompletionSessions(api.data, completedTask), [api.data, completedTask]);
  const latest = useMemo(() => (api.data.completedTasks || []).find((item) => item.id === completedTask.id) || completedTask, [api.data.completedTasks, completedTask]);
  const sourceNoteId = latest.sourceNoteId || latest.noteId;
  const alreadyActive = (api.data.notes || []).some((note) => note.id === sourceNoteId && !note.deleted);
  const latestCompletionForTask = [...(api.data.completedTasks || [])]
    .filter((item) => (item.sourceNoteId || item.noteId) === sourceNoteId)
    .sort((a, b) => Number(b.completedAt) - Number(a.completedAt))[0];
  const isLatestCompletion = latestCompletionForTask?.id === latest.id;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const editSession = (session) => {
    setEditingSessionId(session.id);
    setDurationMinutes(String(Math.round((Number(session.durationMs) || 0) / 60_000)));
  };

  const saveSession = (sessionId) => {
    api.setData((prev) => updateTaskSessionDurationData(prev, sessionId, durationMinutes));
    setEditingSessionId(null);
    setDurationMinutes('');
  };

  const deleteSession = (sessionId) => {
    if (!window.confirm('Delete this work session from the history?')) return;
    api.setData((prev) => deleteTaskSessionData(prev, sessionId));
  };

  const restore = () => {
    if (alreadyActive || !isLatestCompletion) return;
    api.setData((prev) => restoreCompletedTaskData(prev, latest));
  };

  return (
    <div className="task-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="task-sheet history-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="history-detail-title">
        <div className="task-sheet-handle" aria-hidden="true" />
        <div className="task-sheet-heading">
          <div>
            <small>HISTORY</small>
            <h3 id="history-detail-title">{latest.text}</h3>
            <p className="helper-text">{projectName || 'Plans'} · {formatDateTime(latest.completedAt)}</p>
          </div>
          <button type="button" className="icon-button task-sheet-close" onClick={onClose} aria-label="Close history details">×</button>
        </div>

        <div className="history-summary-grid">
          <div><small>Total time</small><strong>{formatHistoryDuration(latest.trackedMs)}</strong></div>
          <div><small>Sessions</small><strong>{latest.sessionCount || sessions.length || '—'}</strong></div>
        </div>

        <div className="stack history-rating-editor">
          <strong>Valuable</strong>
          <div className="value-rating-buttons" role="group" aria-label="Edit valuable rating">
            {[0, 1, 2, 3, 4, 5].map((rating) => (
              <button
                type="button"
                key={rating}
                className={latest.valueRating === rating ? 'selected' : ''}
                onClick={() => api.setData((prev) => updateCompletedTaskRatingData(prev, latest.id, rating))}
              >{rating}</button>
            ))}
          </div>
          <div className="value-rating-preview">{latest.valueRating === null || latest.valueRating === undefined ? 'Not rated' : `${'★'.repeat(latest.valueRating)}${'☆'.repeat(5 - latest.valueRating)} ${latest.valueRating}/5`}</div>
        </div>

        <div className="stack history-session-list">
          <div className="section-title-row"><h4>Work sessions</h4></div>
          {!sessions.length && <p className="empty-state compact-empty-state">No tracked work sessions.</p>}
          {sessions.map((session) => (
            <div key={session.id} className="history-session-row">
              {editingSessionId === session.id ? (
                <>
                  <label className="history-duration-edit">
                    Minutes
                    <input type="number" min="0" max="1440" inputMode="numeric" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} />
                  </label>
                  <div className="history-session-actions">
                    <button type="button" onClick={() => saveSession(session.id)}>Save</button>
                    <button type="button" className="secondary-button" onClick={() => setEditingSessionId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong>{formatHistoryDuration(session.durationMs)}</strong>
                    <small>{formatClock(session.startedAt)}–{formatClock(session.endedAt)}{session.manuallyEdited ? ' · corrected' : ''}</small>
                  </div>
                  <div className="history-session-actions">
                    <button type="button" className="secondary-button" onClick={() => editSession(session)}>Edit</button>
                    <button type="button" className="text-button" onClick={() => deleteSession(session.id)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="history-restore-block">
          <button type="button" className="secondary-button" disabled={alreadyActive || !isLatestCompletion} onClick={restore}>{alreadyActive ? 'Already on checklist' : !isLatestCompletion ? 'Older history entry' : 'Restore to checklist'}</button>
          {latest.restoredAt && <small>Previously restored {formatDateTime(latest.restoredAt)}</small>}
        </div>
      </section>
    </div>
  );
}
