import { formatHistoryDuration } from '../lib/taskTracking';

export default function AccomplishmentToast({ accomplishment }) {
  if (!accomplishment) return null;
  return (
    <div className="accomplishment-toast" role="status" aria-live="polite">
      <span className="accomplishment-mark" aria-hidden="true">✓</span>
      <div>
        <small>STEP FORWARD</small>
        <strong>{accomplishment.taskText}</strong>
        <span>
          {accomplishment.trackedMs > 0 ? `${formatHistoryDuration(accomplishment.trackedMs)} focused · ` : ''}
          {accomplishment.projectName ? `${accomplishment.projectName} moved forward` : 'Completed'}
        </span>
      </div>
    </div>
  );
}
