import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  deleteCompletedTaskData,
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
  const backdropRef = useRef(null);
  const sheetRef = useRef(null);
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

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      if (!sheetRef.current) return;
      sheetRef.current.scrollTop = 0;
      sheetRef.current.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useEffect(() => {
    const backdrop = backdropRef.current;
    if (!backdrop || typeof window === 'undefined') return undefined;

    let frame = 0;
    const observed = new Set();
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => scheduleMeasure())
      : null;

    const observe = (element) => {
      if (!resizeObserver || !element || observed.has(element)) return;
      observed.add(element);
      resizeObserver.observe(element);
    };

    const measureSafeRegion = () => {
      frame = 0;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportBottom = viewportTop + viewportHeight;
      const header = document.querySelector('.top-header');
      const nav = document.querySelector('.bottom-nav');
      const nowBar = document.querySelector('.now-bar');

      observe(header);
      observe(nav);
      observe(nowBar);

      const headerBottom = header?.getBoundingClientRect().bottom ?? viewportTop;
      const persistentTop = nowBar?.getBoundingClientRect().top
        ?? nav?.getBoundingClientRect().top
        ?? viewportBottom;

      const safeTop = Math.max(viewportTop, headerBottom) + 8;
      const safeBottom = Math.max(safeTop, Math.min(viewportBottom, persistentTop - 6));
      const backdropPadding = 16;
      const availableHeight = Math.max(0, safeBottom - safeTop - backdropPadding);
      const preferredMaxHeight = Math.max(180, Math.floor(availableHeight * 0.70));

      backdrop.style.setProperty('--history-detail-safe-top', `${Math.round(safeTop)}px`);
      backdrop.style.setProperty('--history-detail-safe-bottom', `${Math.round(Math.max(0, viewportBottom - safeBottom))}px`);
      backdrop.style.setProperty('--history-detail-max-height', `${preferredMaxHeight}px`);
    };

    const scheduleMeasure = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measureSafeRegion);
    };

    scheduleMeasure();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', scheduleMeasure);
    viewport?.addEventListener('scroll', scheduleMeasure);
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', scheduleMeasure);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      viewport?.removeEventListener('resize', scheduleMeasure);
      viewport?.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleMeasure);
    };
  }, [Boolean(api.data.activeTask)]);

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

  const deleteCompleted = () => {
    if (!window.confirm('Delete this completed item and its associated timing history? This cannot be undone.')) return;
    api.setData((prev) => deleteCompletedTaskData(prev, latest));
    onClose();
  };

  const sheet = (
    <div
      ref={backdropRef}
      className={`task-sheet-backdrop history-detail-backdrop ${api.data.activeTask ? 'with-now' : ''}`.trim()}
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section ref={sheetRef} tabIndex={-1} className="task-sheet history-detail-sheet" role="dialog" aria-modal="false" aria-labelledby="history-detail-title">
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
          {latest.estimateMinutes && <div><small>Estimate</small><strong>{formatHistoryDuration(latest.estimateMinutes * 60_000)}</strong></div>}
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
          <button type="button" className="secondary-button" disabled={alreadyActive || !isLatestCompletion} onClick={restore}>{alreadyActive ? 'Already current' : !isLatestCompletion ? 'Older history entry' : 'Restore to current'}</button>
          {latest.restoredAt && <small>Previously restored {formatDateTime(latest.restoredAt)}</small>}
        </div>

        <div className="history-delete-block">
          <button type="button" className="danger-button" onClick={deleteCompleted}>Delete from history</button>
          <small>Removes this completion and its timing records from Master Plan and from cloud storage on the next sync.</small>
        </div>
      </section>
    </div>
  );

  // Keep history details outside animated/transformed page containers so fixed
  // positioning and viewport measurements use the real mobile viewport.
  return createPortal(sheet, document.body);
}
