import { useEffect, useMemo, useRef, useState } from 'react';
import { CHECK_IN_PRESETS, clampCheckInMinutes, clampEstimateMinutes, formatDuration, getTaskTrackedMs, startTaskData } from '../lib/taskTracking';

const ESTIMATE_PRESETS = [30, 60, 120];

export default function TaskActionSheet({ api, task, projectName, onClose, onEdit, onComplete, onDelete }) {
  const defaultInterval = clampCheckInMinutes(api.data.settings?.defaultCheckInMinutes ?? 30);
  const backdropRef = useRef(null);
  const sheetRef = useRef(null);
  const [checkInMinutes, setCheckInMinutes] = useState(defaultInterval);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(defaultInterval || 30);
  const initialEstimate = clampEstimateMinutes(task.estimateMinutes);
  const [estimateMinutes, setEstimateMinutes] = useState(initialEstimate);
  const [estimateCustomOpen, setEstimateCustomOpen] = useState(Boolean(initialEstimate && !ESTIMATE_PRESETS.includes(initialEstimate)));
  const [customEstimateMinutes, setCustomEstimateMinutes] = useState(initialEstimate || 60);
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

      backdrop.style.setProperty('--task-action-safe-top', `${Math.round(safeTop)}px`);
      backdrop.style.setProperty('--task-action-safe-bottom', `${Math.round(Math.max(0, viewportBottom - safeBottom))}px`);
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

  const start = () => {
    if (active && active.taskNoteId !== task.id) {
      const ok = window.confirm(`Pause “${active.taskTextSnapshot}” and start this item?`);
      if (!ok) return;
    }
    const interval = customOpen ? clampCheckInMinutes(customMinutes) : checkInMinutes;
    const estimate = estimateCustomOpen ? clampEstimateMinutes(customEstimateMinutes) : clampEstimateMinutes(estimateMinutes);
    api.setData((prev) => startTaskData(prev, task, { checkInMinutes: interval, estimateMinutes: estimate }));
    onClose();
  };

  const choosePreset = (minutes) => {
    setCheckInMinutes(minutes);
    setCustomOpen(false);
  };

  const chooseEstimate = (minutes) => {
    setEstimateMinutes(minutes);
    setEstimateCustomOpen(false);
  };

  return (
    <div ref={backdropRef} className={`task-sheet-backdrop task-action-backdrop ${api.data.activeTask ? 'with-now' : ''}`.trim()} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={sheetRef} tabIndex={-1} className="task-sheet task-action-sheet" role="dialog" aria-modal="false" aria-labelledby="task-sheet-title">
        <div className="task-sheet-handle" aria-hidden="true" />
        <div className="task-sheet-heading">
          <div>
            <small>{projectName || 'Plans'}</small>
            <h3 id="task-sheet-title">{task.text}</h3>
          </div>
          <button type="button" className="icon-button task-sheet-close" onClick={onClose} aria-label="Close actions">×</button>
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

            <div className="task-estimate-block">
              <strong>Time estimate <small>optional</small></strong>
              <p className="helper-text">A rough guess is enough. Reports will compare it with actual tracked time.</p>
              <div className="checkin-presets estimate-presets" role="group" aria-label="Optional time estimate">
                {ESTIMATE_PRESETS.map((minutes) => (
                  <button key={minutes} type="button" className={!estimateCustomOpen && estimateMinutes === minutes ? 'selected' : ''} onClick={() => chooseEstimate(minutes)}>{minutes < 60 ? `${minutes} min` : `${minutes / 60}h`}</button>
                ))}
                <button type="button" className={!estimateCustomOpen && estimateMinutes === null ? 'selected' : ''} onClick={() => chooseEstimate(null)}>No estimate</button>
                <button type="button" className={estimateCustomOpen ? 'selected' : ''} onClick={() => setEstimateCustomOpen(true)}>Custom</button>
              </div>
              {estimateCustomOpen && (
                <label className="task-custom-interval">
                  Estimated minutes
                  <input type="number" min="5" max="1440" inputMode="numeric" value={customEstimateMinutes} onChange={(event) => setCustomEstimateMinutes(event.target.value)} />
                </label>
              )}
            </div>

            <button type="button" className="task-start-button" onClick={start}>▶ Start</button>
          </div>
        )}

        {isCurrentTask && <p className="task-current-note">This is the current item. Use the NOW bar to pause, resume, take a break, or finish it.</p>}

        <div className={`task-sheet-secondary-actions ${onDelete ? 'has-delete' : ''}`.trim()}>
          <button type="button" className="secondary-button" onClick={() => { onClose(); onEdit(); }}>Edit</button>
          <button type="button" className="secondary-button" onClick={() => { onClose(); onComplete(); }}>Complete</button>
          {onDelete && <button type="button" className="danger-button" onClick={() => { onClose(); onDelete(task); }}>Delete</button>}
        </div>
      </section>
    </div>
  );
}
