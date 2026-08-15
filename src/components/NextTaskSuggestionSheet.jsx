import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPriorityColor } from '../lib/model';
import { startTaskData } from '../lib/taskTracking';
import { ensureNotificationPermission, syncBackupReminderNotifications, syncTaskNotifications } from '../services/notificationScheduler';

export default function NextTaskSuggestionSheet({ api, suggestion, onDismiss }) {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') onDismiss?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDismiss]);

  if (!suggestion?.task || api.data.activeTask) return null;

  const startSuggested = async () => {
    if (starting) return;
    setStarting(true);
    const interval = api.data.settings?.defaultCheckInMinutes ?? 30;
    const next = startTaskData(api.data, suggestion.task, {
      checkInMinutes: interval,
      estimateMinutes: suggestion.task.estimateMinutes ?? null,
    });
    api.setData(next);
    onDismiss?.();
    if (next.settings?.notificationsEnabled !== false) {
      try {
        await ensureNotificationPermission();
        await Promise.all([syncTaskNotifications(next), syncBackupReminderNotifications(next)]);
      } catch (error) {
        console.warn('Could not prepare suggested-task notifications.', error);
      }
    }
  };

  return (
    <div className="task-sheet-backdrop next-task-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onDismiss?.(); }}>
      <section className="task-sheet next-task-sheet" role="dialog" aria-modal="true" aria-labelledby="next-task-title">
        <div className="task-sheet-handle" aria-hidden="true" />
        <small>NEXT MOVE</small>
        <h3 id="next-task-title">Keep the project moving?</h3>
        <p className="helper-text">Highest-priority unfinished item in the project you worked on most recently.</p>
        <div className="next-task-card" style={{ '--priority-color': getPriorityColor(suggestion.priority) }}>
          <span className="note-priority-mark" aria-hidden="true" />
          <div>
            <small>{suggestion.projectName}</small>
            <strong>{suggestion.task.text}</strong>
            <span>Priority {suggestion.priority}/10</span>
          </div>
        </div>
        <div className="next-task-actions">
          <button type="button" disabled={starting} onClick={startSuggested}>{starting ? 'Starting…' : 'Start now'}</button>
          <button type="button" className="secondary-button" onClick={() => { onDismiss?.(); navigate(`/projects/${suggestion.projectId}`); }}>Open project</button>
          <button type="button" className="text-button" onClick={onDismiss}>Not now</button>
        </div>
      </section>
    </div>
  );
}
