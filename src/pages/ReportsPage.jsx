import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import TaskHistorySheet from '../components/TaskHistorySheet';
import { formatHistoryDuration } from '../lib/taskTracking';
import { buildTimeReport, PLANS_REPORT_SCOPE, REPORT_PERIODS } from '../lib/reporting';
import { getProjectName } from '../lib/model';

function formatSignedDuration(ms) {
  const value = Number(ms) || 0;
  if (!value) return 'On estimate';
  const sign = value > 0 ? '+' : '−';
  return `${sign}${formatHistoryDuration(Math.abs(value))}`;
}

function ratingStars(value) {
  if (value === null || value === undefined) return 'Not rated';
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} ${rating}/5`;
}

export default function ReportsPage({ api }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = REPORT_PERIODS.includes(searchParams.get('period')) ? searchParams.get('period') : 'month';
  const requestedScope = searchParams.get('project');
  const project = requestedScope && requestedScope !== PLANS_REPORT_SCOPE
    ? (api.data.projects || []).find((item) => item.id === requestedScope)
    : null;
  const scope = requestedScope === PLANS_REPORT_SCOPE || project ? requestedScope : null;
  const [selectedTask, setSelectedTask] = useState(null);

  const report = useMemo(() => buildTimeReport(api.data, { period, scope }), [api.data, period, scope]);
  const scopeLabel = scope === PLANS_REPORT_SCOPE ? 'Plans' : project ? getProjectName(project) : 'All work';
  const maxGroupMs = Math.max(1, ...report.groups.map((group) => group.trackedMs));
  const maxValueMs = Math.max(1, ...report.valueBreakdown.map((item) => item.trackedMs));

  const setPeriod = (nextPeriod) => {
    const next = new URLSearchParams(searchParams);
    next.set('period', nextPeriod);
    setSearchParams(next);
  };

  const setScope = (nextScope) => {
    const next = new URLSearchParams(searchParams);
    if (nextScope) next.set('project', nextScope);
    else next.delete('project');
    setSearchParams(next);
  };

  const backTo = scope === PLANS_REPORT_SCOPE ? '/hmm' : project ? `/projects/${project.id}` : '/ta-da';
  const selectedProjectName = selectedTask?.projectId
    ? getProjectName((api.data.projects || []).find((item) => item.id === selectedTask.projectId) || {})
    : 'Plans';

  return (
    <div className="stack page-screen reports-page">
      <div className="page-title-row reports-title-row">
        <div>
          <Link to={backTo} className="back-link">{scope ? scopeLabel : 'Projects'}</Link>
          <h2>Reports</h2>
          <p className="helper-text">{scopeLabel} · {report.range.label}</p>
        </div>
        {scope && <button type="button" className="secondary-button" onClick={() => setScope(null)}>All work</button>}
      </div>

      <div className="report-period-switch" role="tablist" aria-label="Report period">
        {REPORT_PERIODS.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={period === item} className={period === item ? 'selected' : ''} onClick={() => setPeriod(item)}>
            {item === 'today' ? 'Today' : item === 'week' ? 'Week' : 'Month'}
          </button>
        ))}
      </div>

      <section className="report-summary-grid" aria-label="Report summary">
        <div><small>Tracked</small><strong>{formatHistoryDuration(report.trackedMs)}</strong></div>
        <div><small>Completed</small><strong>{report.completedCount}</strong></div>
        <div><small>Avg. Valuable</small><strong>{report.averageValue === null ? '—' : report.averageValue.toFixed(1)}</strong></div>
        <div><small>Avg. session</small><strong>{report.sessionCount ? formatHistoryDuration(report.averageSessionMs) : '—'}</strong></div>
      </section>

      {!report.completedCount && (
        <p className="empty-state">No completed tasks in this period yet.</p>
      )}

      {!scope && report.groups.length > 0 && (
        <section className="stack report-section">
          <div className="section-title-row"><div><h3>Time by project</h3><p className="helper-text">Tap a row for its report.</p></div></div>
          <div className="report-bar-list">
            {report.groups.map((group) => (
              <button key={group.id} type="button" className="report-bar-row" onClick={() => setScope(group.id)}>
                <span className="report-bar-heading"><strong>{group.label}</strong><span>{formatHistoryDuration(group.trackedMs)}</span></span>
                <span className="report-bar-track"><span style={{ width: `${Math.max(3, (group.trackedMs / maxGroupMs) * 100)}%` }} /></span>
                <small>{group.completedCount} completed{group.averageValue === null ? '' : ` · Valuable ${group.averageValue.toFixed(1)}/5`}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {scope && report.tasks.length > 0 && (
        <section className="stack report-section">
          <div className="section-title-row"><div><h3>Completed tasks</h3><p className="helper-text">Newest first. Tap for full history.</p></div></div>
          <div className="report-task-list">
            {report.tasks.map((task) => (
              <button type="button" className="report-task-row" key={task.id} onClick={() => setSelectedTask(task)}>
                <span><strong>{task.text}</strong><small>{new Date(task.completedAt).toLocaleDateString()}</small></span>
                <span className="report-task-metrics"><strong>{formatHistoryDuration(task.trackedMs)}</strong><small>{ratingStars(task.valueRating)}</small></span>
              </button>
            ))}
          </div>
        </section>
      )}

      {report.estimatedTaskCount > 0 && (
        <section className="stack report-section estimate-report-card">
          <div className="section-title-row"><div><h3>Estimate vs actual</h3><p className="helper-text">Only tasks with an estimate and tracked time.</p></div></div>
          <div className="report-estimate-summary">
            <div><small>Estimated</small><strong>{formatHistoryDuration(report.estimatedMs)}</strong></div>
            <div><small>Actual</small><strong>{formatHistoryDuration(report.estimatedActualMs)}</strong></div>
            <div><small>Difference</small><strong className={report.estimateDeltaMs > 0 ? 'report-over-estimate' : ''}>{formatSignedDuration(report.estimateDeltaMs)}</strong></div>
          </div>
        </section>
      )}

      {report.ratedCount > 0 && (
        <section className="stack report-section">
          <div className="section-title-row"><div><h3>Time by Valuable rating</h3><p className="helper-text">How much tracked time went to work you later considered worthwhile.</p></div></div>
          <div className="report-value-list">
            {report.valueBreakdown.map((item) => (
              <div key={item.rating} className="report-value-row">
                <span className="report-value-label">{item.rating}/5</span>
                <span className="report-bar-track"><span style={{ width: item.trackedMs ? `${Math.max(3, (item.trackedMs / maxValueMs) * 100)}%` : '0%' }} /></span>
                <span>{item.trackedMs ? formatHistoryDuration(item.trackedMs) : '—'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {report.lowValueHighTime.length > 0 && (
        <section className="stack report-section report-review-section">
          <div className="section-title-row"><div><h3>High time / low value</h3><p className="helper-text">Tasks rated 0–2 that consumed the most tracked time.</p></div></div>
          <div className="report-task-list">
            {report.lowValueHighTime.map((task) => (
              <button type="button" className="report-task-row" key={task.id} onClick={() => setSelectedTask(task)}>
                <span><strong>{task.text}</strong><small>{task.projectId ? getProjectName((api.data.projects || []).find((item) => item.id === task.projectId) || {}) : 'Plans'}</small></span>
                <span className="report-task-metrics"><strong>{formatHistoryDuration(task.trackedMs)}</strong><small>Valuable {task.valueRating}/5</small></span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!scope && report.mostTime.length > 0 && (
        <section className="stack report-section">
          <div className="section-title-row"><div><h3>Most time</h3><p className="helper-text">The longest completed tasks in this period.</p></div></div>
          <div className="report-task-list">
            {report.mostTime.map((task) => (
              <button type="button" className="report-task-row" key={task.id} onClick={() => setSelectedTask(task)}>
                <span><strong>{task.text}</strong><small>{task.projectId ? getProjectName((api.data.projects || []).find((item) => item.id === task.projectId) || {}) : 'Plans'}</small></span>
                <span className="report-task-metrics"><strong>{formatHistoryDuration(task.trackedMs)}</strong><small>{ratingStars(task.valueRating)}</small></span>
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedTask && (
        <TaskHistorySheet api={api} completedTask={selectedTask} projectName={selectedProjectName} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
