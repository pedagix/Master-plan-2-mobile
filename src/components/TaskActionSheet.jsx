import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clampCheckInMinutes, clampEstimateMinutes, formatDuration, getTaskTrackedMs, startTaskData } from '../lib/taskTracking';
import { ensureNotificationPermission, syncBackupReminderNotifications, syncTaskNotifications } from '../services/notificationScheduler';

const CHECK_IN_MAX_MINUTES = 120;
const CHECK_IN_STEP_MINUTES = 5;
const ESTIMATE_MAX_MINUTES = 8 * 60;
const ESTIMATE_STEP_MINUTES = 15;

function clampSliderMinutes(value, max, step) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  const clamped = Math.min(max, parsed);
  return Math.max(step, Math.round(clamped / step) * step);
}

function formatSliderMinutes(minutes) {
  const value = Math.max(0, Number(minutes) || 0);
  if (value === 0) return 'Off';
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  if (!remainder) return `${hours} h`;
  return `${hours} h ${remainder} min`;
}

function rangeProgress(value, max) {
  return `${Math.max(0, Math.min(100, ((Number(value) || 0) / max) * 100))}%`;
}

export default function TaskActionSheet({ api, task, projectName, onClose, onEdit, onComplete, onDelete }) {
  const storedDefaultInterval = clampCheckInMinutes(api.data.settings?.defaultCheckInMinutes ?? 30);
  const defaultInterval = clampSliderMinutes(storedDefaultInterval, CHECK_IN_MAX_MINUTES, CHECK_IN_STEP_MINUTES);
  const backdropRef = useRef(null);
  const sheetRef = useRef(null);
  const [checkInMinutes, setCheckInMinutes] = useState(defaultInterval);
  const initialEstimate = clampEstimateMinutes(task.estimateMinutes);
  const [estimateMinutes, setEstimateMinutes] = useState(
    clampSliderMinutes(initialEstimate ?? 0, ESTIMATE_MAX_MINUTES, ESTIMATE_STEP_MINUTES),
  );
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

      // The action panel may use the entire live region, but it must always
      // leave at least 8px to the fixed header above and to the first
      // persistent module below (NOW when present, otherwise bottom nav).
      // Using measured element edges instead of only CSS height variables also
      // handles an expanded NOW bar and Android VisualViewport changes.
      const edgeGap = 8;
      const safeTop = Math.max(viewportTop, headerBottom + edgeGap);
      const safeBottom = Math.max(safeTop, Math.min(viewportBottom, persistentTop - edgeGap));
      const availableHeight = Math.max(0, safeBottom - safeTop);
      const layoutViewportHeight = window.innerHeight || viewportBottom;

      backdrop.style.setProperty('--task-action-safe-top', `${Math.round(safeTop)}px`);
      backdrop.style.setProperty('--task-action-safe-bottom', `${Math.round(Math.max(0, layoutViewportHeight - safeBottom))}px`);
      backdrop.style.setProperty('--task-action-max-height', `${Math.floor(availableHeight)}px`);
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
    const interval = checkInMinutes === 0 ? 0 : clampCheckInMinutes(checkInMinutes);
    const estimate = estimateMinutes === 0 ? null : clampEstimateMinutes(estimateMinutes);
    const next = startTaskData(api.data, task, { checkInMinutes: interval, estimateMinutes: estimate });
    api.setData(next);
    onClose();

    // Starting a task is a deliberate user action, so this is the right time
    // to request Android's notification permission if it has not been decided.
    // The task starts immediately either way; native scheduling never blocks it.
    if (next.settings?.notificationsEnabled !== false) {
      ensureNotificationPermission()
        .then(() => Promise.all([syncTaskNotifications(next), syncBackupReminderNotifications(next)]))
        .catch((error) => console.warn('Could not prepare task notifications.', error));
    }
  };

  const sheet = (
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
            <div className="task-range-section">
              <div className="task-range-heading">
                <strong>Check-in interval</strong>
                <output htmlFor="task-checkin-range" className="task-range-value">{formatSliderMinutes(checkInMinutes)}</output>
              </div>
              <p className="helper-text">Master Plan will ask if you are still on task and offer a break.</p>
              <div className="task-range-control">
                <input
                  id="task-checkin-range"
                  className="task-range-input"
                  type="range"
                  min="0"
                  max={CHECK_IN_MAX_MINUTES}
                  step={CHECK_IN_STEP_MINUTES}
                  value={checkInMinutes}
                  aria-label="Check-in interval"
                  aria-valuetext={formatSliderMinutes(checkInMinutes)}
                  style={{ '--task-range-progress': rangeProgress(checkInMinutes, CHECK_IN_MAX_MINUTES) }}
                  onChange={(event) => setCheckInMinutes(Number(event.target.value))}
                />
                <div className="task-range-limits" aria-hidden="true">
                  <span>Off</span>
                  <span>2 h</span>
                </div>
              </div>
            </div>

            <div className="task-estimate-block task-range-section">
              <div className="task-range-heading">
                <strong>Time estimate <small>optional</small></strong>
                <output htmlFor="task-estimate-range" className="task-range-value">{formatSliderMinutes(estimateMinutes)}</output>
              </div>
              <p className="helper-text">A rough guess is enough. Reports will compare it with actual tracked time.</p>
              <div className="task-range-control">
                <input
                  id="task-estimate-range"
                  className="task-range-input"
                  type="range"
                  min="0"
                  max={ESTIMATE_MAX_MINUTES}
                  step={ESTIMATE_STEP_MINUTES}
                  value={estimateMinutes}
                  aria-label="Optional time estimate"
                  aria-valuetext={formatSliderMinutes(estimateMinutes)}
                  style={{ '--task-range-progress': rangeProgress(estimateMinutes, ESTIMATE_MAX_MINUTES) }}
                  onChange={(event) => setEstimateMinutes(Number(event.target.value))}
                />
                <div className="task-range-limits" aria-hidden="true">
                  <span>Off</span>
                  <span>8 h</span>
                </div>
              </div>
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

  // Global overlays must live outside animated page containers. A transformed
  // ancestor changes the containing block for position: fixed on mobile, which
  // was shrinking this panel to the project page instead of the viewport.
  return createPortal(sheet, document.body);
}
