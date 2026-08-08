import { useEffect, useMemo, useState } from 'react';
import { CHECK_IN_PRESETS, clampCheckInMinutes, formatDuration, getTaskTrackedMs, startTaskData } from '../lib/taskTracking';

export default function TaskActionSheet({ api, task, projectName, onClose, onEdit, onComplete }) {
  const defaultInterval = clampCheckInMinutes(api.data.settings?.defaultCheckInMinutes ?? 30);
  const [checkInMinutes, setCheckInMinutes] = useState(defaultInterval);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(defaultInterval || 30);
  const trackedMs = useMemo(() => getTaskTrackedMs(api.data, task.id), [api.data, task.id]);
  const active = api.data.activeTask;
  const isCurrentTask = active?.taskNoteId === task.id;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const start = () => {
    if (active && active.taskNoteId !== task.id) {
      const ok = window.confirm(`Pause “${active.taskTextSnapshot}” and start this task?`);
      if (!ok) return;
    }
    const interval = customOpen ? clampCheckInMinutes(customMinutes) : checkInMinutes;
    api.setData((prev) => startTaskData(prev, task, { checkInMinutes: interval }));
    onClose();
  };

  const choosePreset = (minutes) => {
    setCheckInMinutes(minutes);
    setCustomOpen(false);
  };

  return (
    <div className="task-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="task-sheet" role="dialog" aria-modal="true" aria-labelledby="task-sheet-title">
        <div className="task-sheet-handle" aria-hidden="true" />
        <div className="task-sheet-heading">
          <div>
            <small>{projectName || 'Plans'}</small>
            <h3 id="task-sheet-title">{task.text}</h3>
          </div>
          <button type="button" className="icon-button task-sheet-close" onClick={onClose} aria-label="Close task actions">×</button>
        </div>

        {trackedMs > 0 && <p className="task-sheet-time">Tracked so far <strong>{formatDuration(trackedMs)}</strong></p>}

        {!isCurrentTask && (
          <div className="stack task-start-options">
            <div>
              <strong>Check-in interval</strong>
              <p className="helper-text">Master Plan will ask if you are still on task and offer a break.</p>
            </div>
            <div className="checkin-presets" role="group" aria-label="Check-in interval">
              {CHECK_IN_PRESETS.map((minutes) => (
                <button key={minutes} type="button" className={!customOpen && checkInMinutes === minutes ? 'selected' : ''} onClick={() => choosePreset(minutes)}>{minutes} min</button>
              ))}
              <button type="button" className={!customOpen && checkInMinutes === 0 ? 'selected' : ''} onClick={() => choosePreset(0)}>Off</button>
              <button type="button" className={customOpen ? 'selected' : ''} onClick={() => setCustomOpen(true)}>Custom</button>
            </div>
            {customOpen && (
              <label className="task-custom-interval">
                Minutes
                <input type="number" min="5" max="240" inputMode="numeric" value={customMinutes} onChange={(event) => setCustomMinutes(event.target.value)} />
              </label>
            )}
            <button type="button" className="task-start-button" onClick={start}>▶ Start task</button>
          </div>
        )}

        {isCurrentTask && <p className="task-current-note">This is the current task. Use the NOW bar to pause, resume, take a break, or finish it.</p>}

        <div className="task-sheet-secondary-actions">
          <button type="button" className="secondary-button" onClick={() => { onClose(); onEdit(); }}>Edit</button>
          <button type="button" className="secondary-button" onClick={() => { onClose(); onComplete(); }}>Complete</button>
        </div>
      </section>
    </div>
  );
}
