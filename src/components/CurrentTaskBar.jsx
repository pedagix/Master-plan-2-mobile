import { useEffect, useMemo, useRef, useState } from 'react';
import TaskCompletionSheet from './TaskCompletionSheet';
import {
  continueAfterCheckInData,
  correctAndPauseActiveTaskData,
  formatDuration,
  getTaskTrackedMs,
  pauseActiveTaskData,
  resumeActiveTaskData,
  startBreakData,
} from '../lib/taskTracking';

function playCheckInTone() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
    oscillator.addEventListener('ended', () => context.close().catch(() => {}), { once: true });
  } catch {
    // Audio is a best-effort enhancement. Browser autoplay policies may block it.
  }
}

export default function CurrentTaskBar({ api, keyboardOpen = false }) {
  const active = api?.data?.activeTask;
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [customCorrection, setCustomCorrection] = useState('');
  const [completionTask, setCompletionTask] = useState(null);
  const lastPromptedAtRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active?.id, active?.status, active?.segmentStartedAt, active?.breakEndsAt]);

  useEffect(() => {
    if (!active || active.status !== 'running' || !active.nextCheckInAt) {
      setCheckInOpen(false);
      setCorrectionOpen(false);
      lastPromptedAtRef.current = null;
      return;
    }
    if (now < active.nextCheckInAt || lastPromptedAtRef.current === active.nextCheckInAt) return;
    lastPromptedAtRef.current = active.nextCheckInAt;
    setCheckInOpen(true);
    playCheckInTone();
  }, [active, now]);

  const trackedMs = useMemo(() => active ? getTaskTrackedMs(api.data, active.taskNoteId, now) : 0, [active, api.data, now]);
  const breakRemainingMs = active?.status === 'break' && active.breakEndsAt ? Math.max(0, active.breakEndsAt - now) : 0;
  const breakDone = active?.status === 'break' && active.breakEndsAt && now >= active.breakEndsAt;

  if (!active || keyboardOpen) return null;

  const pauseResume = () => {
    api.setData((prev) => active.status === 'running' ? pauseActiveTaskData(prev) : resumeActiveTaskData(prev));
  };

  const finish = () => {
    const task = (api.data.notes || []).find((note) => note.id === active.taskNoteId) || {
      id: active.taskNoteId,
      text: active.taskTextSnapshot,
      projectId: active.projectId,
      destination: active.destination,
      priority: 5,
      important: false,
    };
    setCompletionTask(task);
  };

  const correct = (minutes) => {
    api.setData((prev) => correctAndPauseActiveTaskData(prev, minutes));
    setCorrectionOpen(false);
    setCheckInOpen(false);
    setCustomCorrection('');
  };

  return (
    <>
      <section className={`now-bar now-bar-${active.status} ${expanded ? 'expanded' : ''}`} aria-label="Current task">
        <button type="button" className="now-bar-main" onClick={() => setExpanded((value) => !value)}>
          <span className="now-live-dot" aria-hidden="true" />
          <span className="now-label">{active.status === 'break' ? 'BREAK' : active.status === 'paused' ? 'PAUSED' : 'NOW'}</span>
          <span className="now-task-text">{active.taskTextSnapshot}</span>
          <strong className="now-time">{active.status === 'break' ? formatDuration(breakRemainingMs, { compact: true }) : formatDuration(trackedMs, { compact: true })}</strong>
        </button>
        <button type="button" className="now-quick-button" onClick={pauseResume} aria-label={active.status === 'running' ? 'Pause current task' : 'Resume current task'}>
          {active.status === 'running' ? 'Ⅱ' : '▶'}
        </button>
        {expanded && (
          <div className="now-expanded-controls">
            <div>
              <small>Total tracked</small>
              <strong>{formatDuration(trackedMs)}</strong>
            </div>
            {active.status === 'running' && active.checkInMinutes > 0 && <small>Check-in every {active.checkInMinutes} min</small>}
            {breakDone && <div className="now-break-ready">Break complete — ready when you are.</div>}
            <div className="actions">
              {active.status === 'running' && <button type="button" className="secondary-button" onClick={() => api.setData((prev) => startBreakData(prev, 5))}>5 min break</button>}
              <button type="button" className="secondary-button" onClick={pauseResume}>{active.status === 'running' ? 'Pause' : 'Resume'}</button>
              <button type="button" onClick={finish}>Finish task</button>
            </div>
          </div>
        )}
      </section>

      {completionTask && (
        <TaskCompletionSheet
          api={api}
          task={completionTask}
          projectName={(api.data.projects || []).find((project) => project.id === completionTask.projectId)?.name || (completionTask.projectId ? 'Project' : 'Plans')}
          onClose={() => setCompletionTask(null)}
          onCompleted={() => setExpanded(false)}
        />
      )}

      {checkInOpen && (
        <div className="task-sheet-backdrop checkin-backdrop" role="presentation">
          <section className="task-sheet checkin-sheet" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
            {!correctionOpen ? (
              <>
                <small>CHECK-IN</small>
                <h3 id="checkin-title">Still working on this task?</h3>
                <p>{active.taskTextSnapshot}</p>
                <div className="stack checkin-actions">
                  <button type="button" onClick={() => { api.setData((prev) => continueAfterCheckInData(prev)); setCheckInOpen(false); }}>Yes, still working</button>
                  <button type="button" className="secondary-button" onClick={() => setCorrectionOpen(true)}>No, I got distracted</button>
                  <div className="checkin-break-row">
                    <button type="button" className="secondary-button" onClick={() => { api.setData((prev) => startBreakData(prev, 5)); setCheckInOpen(false); }}>5 min break</button>
                    <button type="button" className="secondary-button" onClick={() => { api.setData((prev) => startBreakData(prev, 10)); setCheckInOpen(false); }}>10 min break</button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <small>CORRECT SESSION</small>
                <h3>About how long ago did you stop?</h3>
                <p className="helper-text">That distracted time will be removed and the task will be paused.</p>
                <div className="checkin-correction-presets">
                  {[5, 10, 15, 30].map((minutes) => <button key={minutes} type="button" className="secondary-button" onClick={() => correct(minutes)}>{minutes} min</button>)}
                </div>
                <label className="task-custom-interval">
                  Other minutes
                  <input type="number" min="0" max="600" inputMode="numeric" value={customCorrection} onChange={(event) => setCustomCorrection(event.target.value)} />
                </label>
                <div className="actions">
                  <button type="button" disabled={customCorrection === ''} onClick={() => correct(customCorrection)}>Correct & pause</button>
                  <button type="button" className="secondary-button" onClick={() => setCorrectionOpen(false)}>Back</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
