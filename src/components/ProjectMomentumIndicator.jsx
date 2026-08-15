import { getProjectMomentum } from '../lib/projectMomentum';

export default function ProjectMomentumIndicator({ data, projectId, compact = false }) {
  const momentum = getProjectMomentum(data, projectId);
  return (
    <div className={`project-momentum ${compact ? 'compact' : ''}`.trim()} title={`Project momentum: ${momentum.label.toLowerCase()}`}>
      <span className="project-momentum-pips" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => <i key={level} className={momentum.level >= level ? 'active' : ''} />)}
      </span>
      <small>{momentum.label}</small>
    </div>
  );
}
