import { getProjectName } from './model';

export const REPORT_PERIODS = ['today', 'week', 'month'];
export const PLANS_REPORT_SCOPE = 'plans';

function startOfLocalDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function getReportRange(period = 'month', now = Date.now()) {
  const current = new Date(now);
  if (period === 'today') {
    return { start: startOfLocalDay(now), end: now, label: 'Today' };
  }
  if (period === 'week') {
    const start = new Date(current);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay();
    const daysFromMonday = (day + 6) % 7;
    start.setDate(start.getDate() - daysFromMonday);
    return { start: start.getTime(), end: now, label: 'This week' };
  }
  const start = new Date(current.getFullYear(), current.getMonth(), 1);
  return { start: start.getTime(), end: now, label: current.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
}

function taskMatchesScope(task, scope) {
  if (!scope) return true;
  if (scope === PLANS_REPORT_SCOPE) return !task.projectId;
  return task.projectId === scope;
}

function safeRating(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(5, Math.round(number))) : null;
}

function safeEstimateMinutes(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function buildTimeReport(data, { period = 'month', scope = null, now = Date.now() } = {}) {
  const range = getReportRange(period, now);
  const projectMap = new Map((data?.projects || []).map((project) => [project.id, project]));
  const tasks = (data?.completedTasks || [])
    .filter((task) => {
      const completedAt = Number(task.completedAt) || 0;
      return completedAt >= range.start && completedAt <= range.end && taskMatchesScope(task, scope);
    })
    .sort((a, b) => Number(b.completedAt) - Number(a.completedAt));

  const trackedMs = tasks.reduce((sum, task) => sum + Math.max(0, Number(task.trackedMs) || 0), 0);
  const sessionCount = tasks.reduce((sum, task) => sum + Math.max(0, Number(task.sessionCount) || 0), 0);
  const rated = tasks.map((task) => safeRating(task.valueRating)).filter((value) => value !== null);
  const averageValue = rated.length ? rated.reduce((sum, value) => sum + value, 0) / rated.length : null;

  const estimatedTasks = tasks.filter((task) => safeEstimateMinutes(task.estimateMinutes) !== null && Number(task.trackedMs) > 0);
  const estimatedMs = estimatedTasks.reduce((sum, task) => sum + (safeEstimateMinutes(task.estimateMinutes) * 60_000), 0);
  const estimatedActualMs = estimatedTasks.reduce((sum, task) => sum + Math.max(0, Number(task.trackedMs) || 0), 0);

  const groupMap = new Map();
  for (const task of tasks) {
    const key = task.projectId || PLANS_REPORT_SCOPE;
    const project = task.projectId ? projectMap.get(task.projectId) : null;
    const current = groupMap.get(key) || {
      id: key,
      label: project ? getProjectName(project) : 'Plans',
      trackedMs: 0,
      completedCount: 0,
      ratings: [],
    };
    current.trackedMs += Math.max(0, Number(task.trackedMs) || 0);
    current.completedCount += 1;
    const rating = safeRating(task.valueRating);
    if (rating !== null) current.ratings.push(rating);
    groupMap.set(key, current);
  }

  const groups = [...groupMap.values()]
    .map((group) => ({
      ...group,
      averageValue: group.ratings.length ? group.ratings.reduce((sum, value) => sum + value, 0) / group.ratings.length : null,
    }))
    .sort((a, b) => b.trackedMs - a.trackedMs || b.completedCount - a.completedCount);

  const valueBreakdown = [0, 1, 2, 3, 4, 5].map((rating) => {
    const matching = tasks.filter((task) => safeRating(task.valueRating) === rating);
    return {
      rating,
      count: matching.length,
      trackedMs: matching.reduce((sum, task) => sum + Math.max(0, Number(task.trackedMs) || 0), 0),
    };
  });

  const lowValueHighTime = tasks
    .filter((task) => {
      const rating = safeRating(task.valueRating);
      return rating !== null && rating <= 2 && Number(task.trackedMs) > 0;
    })
    .sort((a, b) => Number(b.trackedMs) - Number(a.trackedMs))
    .slice(0, 5);

  const mostTime = [...tasks]
    .filter((task) => Number(task.trackedMs) > 0)
    .sort((a, b) => Number(b.trackedMs) - Number(a.trackedMs))
    .slice(0, 8);

  return {
    period,
    scope,
    range,
    tasks,
    groups,
    trackedMs,
    completedCount: tasks.length,
    ratedCount: rated.length,
    averageValue,
    sessionCount,
    averageSessionMs: sessionCount ? trackedMs / sessionCount : 0,
    estimatedTaskCount: estimatedTasks.length,
    estimatedMs,
    estimatedActualMs,
    estimateDeltaMs: estimatedActualMs - estimatedMs,
    valueBreakdown,
    lowValueHighTime,
    mostTime,
  };
}

export function formatRating(value) {
  const rating = safeRating(value);
  return rating === null ? 'Not rated' : `${rating}/5`;
}
