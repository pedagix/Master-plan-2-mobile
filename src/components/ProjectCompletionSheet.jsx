import { formatHistoryDuration } from '../lib/taskTracking';

export default function ProjectCompletionSheet({ summary, onClose }) {
  if (!summary) return null;
  return (
    <div className="task-sheet-backdrop project-complete-backdrop" role="presentation">
      <section className="task-sheet project-complete-sheet" role="dialog" aria-modal="true" aria-labelledby="project-complete-title">
        <div className="project-complete-symbol" aria-hidden="true">✓</div>
        <small>PROJECT FINISHED</small>
        <h3 id="project-complete-title">{summary.projectName}</h3>
        <p className="helper-text">A completed project is kept intact in Finished projects and its history remains available.</p>
        <small className="project-complete-dates">Started {summary.startedAt ? new Date(summary.startedAt).toLocaleDateString() : '—'} · Finished {summary.finishedAt ? new Date(summary.finishedAt).toLocaleDateString() : '—'}</small>
        <div className="project-complete-stats">
          <div><small>Focused</small><strong>{formatHistoryDuration(summary.trackedMs)}</strong></div>
          <div><small>Sessions</small><strong>{summary.sessionCount}</strong></div>
          <div><small>Steps</small><strong>{summary.completedCount}</strong></div>
        </div>
        {summary.remainingCount > 0 && <p className="system-message">{summary.remainingCount} unfinished {summary.remainingCount === 1 ? 'item remains' : 'items remain'} inside the finished project.</p>}
        <button type="button" onClick={onClose}>Done</button>
      </section>
    </div>
  );
}
