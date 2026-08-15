import { useEffect, useMemo, useState } from 'react';
import { formatDuration, getTaskTrackedMs } from '../lib/taskTracking';
import QuickCaptureSheet from './QuickCaptureSheet';

function formatUntil(timestamp, now) {
  const remaining = Math.max(0, Number(timestamp) - now);
  if (!Number(timestamp)) return 'Off';
  if (remaining <= 0) return 'Due now';
  const minutes = Math.ceil(remaining / 60_000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function FocusModePanel({ api, onShowApp }) {
  const active = api.data.activeTask;
  const [now, setNow] = useState(Date.now());
  const [captureOpen, setCaptureOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active?.id]);

  const trackedMs = useMemo(() => active ? getTaskTrackedMs(api.data, active.taskNoteId, now) : 0, [active, api.data, now]);
  const project = (api.data.projects || []).find((item) => item.id === active?.projectId);
  if (!active) return null;

  const estimateMs = Number(active.estimateMinutes) > 0 ? Number(active.estimateMinutes) * 60_000 : null;
  const estimateProgress = estimateMs ? Math.min(100, Math.round((trackedMs / estimateMs) * 100)) : null;
  const isBreak = active.status === 'break';
  const primaryTimeMs = isBreak && active.breakEndsAt ? Math.max(0, Number(active.breakEndsAt) - now) : trackedMs;

  return (
    <div className="focus-mode-screen">
      <div className="focus-mode-orbit" aria-hidden="true" />
      <div className="focus-mode-content">
        <small className="focus-mode-kicker">{isBreak ? 'BREAK' : 'FOCUS'}</small>
        <h2>{active.taskTextSnapshot}</h2>
        <p>{project?.name || 'Plans'}</p>
        <strong className="focus-mode-time">{formatDuration(primaryTimeMs)}</strong>
        {!isBreak && estimateProgress !== null && (
          <div className="focus-estimate-track" aria-label={`${estimateProgress}% of estimated time used`}>
            <span style={{ width: `${estimateProgress}%` }} />
          </div>
        )}
        <div className="focus-mode-meta">
          <div><small>{isBreak ? 'BREAK ENDS' : 'NEXT CHECK-IN'}</small><strong>{isBreak ? formatUntil(active.breakEndsAt, now) : formatUntil(active.nextCheckInAt, now)}</strong></div>
          <div><small>ESTIMATE</small><strong>{active.estimateMinutes ? `${active.estimateMinutes} min` : 'Off'}</strong></div>
        </div>
        <div className="focus-mode-actions">
          <button type="button" onClick={() => setCaptureOpen(true)}>Capture thought</button>
          <button type="button" className="secondary-button" onClick={onShowApp}>Show app</button>
        </div>
        <small className="focus-mode-hint">Pause, breaks and Finish stay in the NOW bar below.</small>
      </div>
      {captureOpen && <QuickCaptureSheet api={api} activeTask={active} onClose={() => setCaptureOpen(false)} />}
    </div>
  );
}
