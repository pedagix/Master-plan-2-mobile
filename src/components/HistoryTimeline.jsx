import { formatHistoryDuration } from '../lib/taskTracking';

function formatDay(timestamp) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(timestamp));
}

function ratingStars(value) {
  if (value === null || value === undefined) return 'Not rated';
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} ${rating}/5`;
}

export default function HistoryTimeline({ completedTasks, onSelect }) {
  const entries = [...(completedTasks || [])].sort((a, b) => Number(b.completedAt) - Number(a.completedAt));
  if (!entries.length) return <p className="empty-state">No completed tasks yet.</p>;

  let lastDay = '';
  return (
    <div className="history-timeline" aria-label="Completed task timeline">
      {entries.map((task) => {
        const day = formatDay(task.completedAt);
        const showDay = day !== lastDay;
        lastDay = day;
        return (
          <div key={task.id} className="history-entry-wrap">
            {showDay && <div className="history-day-label">{day}</div>}
            <button type="button" className="history-entry" onClick={() => onSelect(task)}>
              <span className="history-rail" aria-hidden="true"><span className="history-dot" /></span>
              <span className="history-entry-main">
                <strong>{task.text}</strong>
                <span className="history-entry-meta">
                  <span>{formatHistoryDuration(task.trackedMs)}</span>
                  <span>{ratingStars(task.valueRating)}</span>
                </span>
                {task.restoredAt && <small className="history-restored-label">Restored to checklist</small>}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
