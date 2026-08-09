import { HMM_DESTINATION } from './model';

export const DEFAULT_CHECK_IN_MINUTES = 30;
export const CHECK_IN_PRESETS = [20, 30, 45, 60];

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function withActiveTaskState(data, activeTask, updatedAt = Date.now()) {
  return {
    ...data,
    activeTask,
    taskTracking: {
      ...(data?.taskTracking || {}),
      activeTaskUpdatedAt: updatedAt,
    },
  };
}

export function clampCheckInMinutes(value) {
  if (value === 0 || value === '0' || value === null) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_CHECK_IN_MINUTES;
  return Math.max(5, Math.min(240, Math.round(parsed)));
}

export function clampEstimateMinutes(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.max(5, Math.min(24 * 60, Math.round(parsed)));
}

export function clampValueRating(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(5, Math.round(parsed)));
}

export function formatDuration(ms = 0, { compact = false } = {}) {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  if (compact) return `${minutes}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatHistoryDuration(ms = 0) {
  const safeMs = Math.max(0, Number(ms) || 0);
  if (safeMs < 1000) return 'Not tracked';
  const totalMinutes = Math.max(1, Math.round(safeMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function getTaskSessions(data, taskNoteId) {
  return (data?.taskSessions || []).filter((session) => session.taskNoteId === taskNoteId);
}

export function getTaskTrackedMs(data, taskNoteId, now = Date.now()) {
  const finishedMs = getTaskSessions(data, taskNoteId).reduce((sum, session) => sum + Math.max(0, Number(session.durationMs) || 0), 0);
  const active = data?.activeTask;
  if (!active || active.taskNoteId !== taskNoteId || active.status !== 'running' || !active.segmentStartedAt) return finishedMs;
  return finishedMs + Math.max(0, now - active.segmentStartedAt);
}

export function getCompletionSessions(data, completedTask) {
  if (!completedTask) return [];
  const all = getTaskSessions(data, completedTask.sourceNoteId || completedTask.noteId);
  if (Array.isArray(completedTask.sessionIds) && completedTask.sessionIds.length) {
    const ids = new Set(completedTask.sessionIds);
    return all.filter((session) => ids.has(session.id)).sort((a, b) => a.startedAt - b.startedAt);
  }
  const priorCompletion = (data?.completedTasks || [])
    .filter((item) => item.id !== completedTask.id && (item.sourceNoteId || item.noteId) === (completedTask.sourceNoteId || completedTask.noteId) && Number(item.completedAt) < Number(completedTask.completedAt))
    .sort((a, b) => Number(b.completedAt) - Number(a.completedAt))[0];
  const lowerBound = Number(priorCompletion?.completedAt) || 0;
  const upperBound = Number(completedTask.completedAt) || Number.MAX_SAFE_INTEGER;
  return all.filter((session) => Number(session.endedAt) > lowerBound && Number(session.endedAt) <= upperBound).sort((a, b) => a.startedAt - b.startedAt);
}

function appendSession(data, active, endedAt, { correctionMinutes = 0 } = {}) {
  if (!active?.segmentStartedAt) return data;
  const safeEnd = Math.max(active.segmentStartedAt, endedAt);
  const durationMs = Math.max(0, safeEnd - active.segmentStartedAt);
  if (durationMs < 1000) return data;
  const session = {
    id: makeId('session'),
    taskNoteId: active.taskNoteId,
    projectId: active.projectId || null,
    destination: active.destination || (active.projectId ? 'project' : HMM_DESTINATION),
    taskTextSnapshot: active.taskTextSnapshot || '',
    startedAt: active.segmentStartedAt,
    endedAt: safeEnd,
    durationMs,
    correctionMinutes: Math.max(0, Number(correctionMinutes) || 0),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return { ...data, taskSessions: [...(data.taskSessions || []), session] };
}

export function pauseActiveTaskData(data, now = Date.now()) {
  const active = data?.activeTask;
  if (!active || active.status !== 'running') return data;
  const withSession = appendSession(data, active, now);
  return withActiveTaskState(withSession, {
    ...active,
    status: 'paused',
    segmentStartedAt: null,
    pausedAt: now,
    nextCheckInAt: null,
    updatedAt: now,
  }, now);
}

export function resumeActiveTaskData(data, now = Date.now()) {
  const active = data?.activeTask;
  if (!active || active.status === 'running') return data;
  const checkInMinutes = clampCheckInMinutes(active.checkInMinutes);
  return withActiveTaskState(data, {
    ...active,
    status: 'running',
    segmentStartedAt: now,
    pausedAt: null,
    breakStartedAt: null,
    breakEndsAt: null,
    nextCheckInAt: checkInMinutes > 0 ? now + (checkInMinutes * 60_000) : null,
    updatedAt: now,
  }, now);
}

export function startTaskData(data, task, { checkInMinutes = DEFAULT_CHECK_IN_MINUTES, estimateMinutes = task?.estimateMinutes ?? null } = {}, now = Date.now()) {
  let next = data;
  if (next?.activeTask?.status === 'running') next = pauseActiveTaskData(next, now);
  const interval = clampCheckInMinutes(checkInMinutes);
  const estimate = clampEstimateMinutes(estimateMinutes);
  return withActiveTaskState({
    ...next,
    notes: (next.notes || []).map((note) => note.id === task.id ? { ...note, estimateMinutes: estimate, updatedAt: now } : note),
    settings: {
      ...(next.settings || {}),
      defaultCheckInMinutes: interval,
    },
  }, {
    id: makeId('active-task'),
    taskNoteId: task.id,
    taskTextSnapshot: task.text || '',
    projectId: task.projectId || null,
    destination: task.destination || (task.projectId ? 'project' : HMM_DESTINATION),
    status: 'running',
    startedAt: now,
    segmentStartedAt: now,
    pausedAt: null,
    checkInMinutes: interval,
    estimateMinutes: estimate,
    nextCheckInAt: interval > 0 ? now + (interval * 60_000) : null,
    createdAt: now,
    updatedAt: now,
  }, now);
}

export function continueAfterCheckInData(data, now = Date.now()) {
  const active = data?.activeTask;
  if (!active || active.status !== 'running') return data;
  const interval = clampCheckInMinutes(active.checkInMinutes);
  return withActiveTaskState(data, {
    ...active,
    nextCheckInAt: interval > 0 ? now + (interval * 60_000) : null,
    lastCheckInAt: now,
    updatedAt: now,
  }, now);
}

export function correctAndPauseActiveTaskData(data, minutesAgo, now = Date.now()) {
  const active = data?.activeTask;
  if (!active || active.status !== 'running') return data;
  const correctionMinutes = Math.max(0, Number(minutesAgo) || 0);
  const correctedEnd = Math.max(active.segmentStartedAt || now, now - (correctionMinutes * 60_000));
  const withSession = appendSession(data, active, correctedEnd, { correctionMinutes });
  return withActiveTaskState(withSession, {
    ...active,
    status: 'paused',
    segmentStartedAt: null,
    pausedAt: correctedEnd,
    nextCheckInAt: null,
    lastCorrectionMinutes: correctionMinutes,
    updatedAt: now,
  }, now);
}

export function startBreakData(data, minutes = 5, now = Date.now()) {
  const active = data?.activeTask;
  if (!active || active.status !== 'running') return data;
  const withSession = appendSession(data, active, now);
  const breakMinutes = Math.max(1, Math.min(60, Math.round(Number(minutes) || 5)));
  return withActiveTaskState(withSession, {
    ...active,
    status: 'break',
    segmentStartedAt: null,
    pausedAt: now,
    breakStartedAt: now,
    breakEndsAt: now + (breakMinutes * 60_000),
    nextCheckInAt: null,
    updatedAt: now,
  }, now);
}

export function completeTaskData(data, task, { valueRating = null } = {}, now = Date.now()) {
  let next = data;
  const active = next?.activeTask;
  if (active?.taskNoteId === task.id && active.status === 'running') {
    next = appendSession(next, active, now);
  }

  const taskSessions = (next.taskSessions || []).filter((session) => session.taskNoteId === task.id);
  const completionSessions = task.restoredAt
    ? taskSessions.filter((session) => Number(session.startedAt) >= Number(task.restoredAt))
    : taskSessions;
  const sessionIds = completionSessions.map((session) => session.id);
  const trackedMs = completionSessions.reduce((sum, session) => sum + Math.max(0, Number(session.durationMs) || 0), 0);
  const projectId = task.projectId || null;
  const completed = {
    id: makeId('completed'),
    sourceNoteId: task.id,
    noteId: task.id,
    projectId,
    destination: task.destination || (projectId ? 'project' : HMM_DESTINATION),
    text: task.text,
    priority: task.priority,
    important: Boolean(task.important),
    completedAt: now,
    createdAt: now,
    updatedAt: now,
    trackedMs,
    sessionCount: completionSessions.length,
    sessionIds,
    valueRating: clampValueRating(valueRating),
    estimateMinutes: clampEstimateMinutes(task.estimateMinutes ?? active?.estimateMinutes),
    completedFrom: projectId ? 'project' : 'plans',
    restoredFromCompletionId: task.restoredFromCompletionId || null,
  };
  const completedData = {
    ...next,
    notes: (next.notes || []).map((item) => item.id === task.id
      ? { ...item, deleted: true, deletedAt: now, completedAt: now, updatedAt: now }
      : item),
    completedTasks: [completed, ...(next.completedTasks || [])],
    projects: projectId
      ? (next.projects || []).map((project) => project.id === projectId
        ? { ...project, tasksDone: (project.tasksDone || 0) + 1, updatedAt: now, lastInteractedAt: now }
        : project)
      : next.projects,
  };
  return active?.taskNoteId === task.id
    ? withActiveTaskState(completedData, null, now)
    : completedData;
}

export function updateCompletedTaskRatingData(data, completedTaskId, valueRating, now = Date.now()) {
  return {
    ...data,
    completedTasks: (data.completedTasks || []).map((item) => item.id === completedTaskId
      ? { ...item, valueRating: clampValueRating(valueRating), updatedAt: now }
      : item),
  };
}

export function restoreCompletedTaskData(data, completedTask, now = Date.now()) {
  const sourceNoteId = completedTask?.sourceNoteId || completedTask?.noteId;
  if (!sourceNoteId) return data;
  const existing = (data.notes || []).find((note) => note.id === sourceNoteId);
  if (existing && !existing.deleted) return data;

  const restoredNote = existing
    ? {
      ...existing,
      text: completedTask.text || existing.text,
      projectId: completedTask.projectId || null,
      destination: completedTask.destination || (completedTask.projectId ? 'project' : HMM_DESTINATION),
      isTodo: true,
      deleted: false,
      deletedAt: null,
      completedAt: null,
      restoredAt: now,
      restoredFromCompletionId: completedTask.id,
      estimateMinutes: clampEstimateMinutes(completedTask.estimateMinutes),
      updatedAt: now,
    }
    : {
      id: sourceNoteId,
      text: completedTask.text || '',
      projectId: completedTask.projectId || null,
      destination: completedTask.destination || (completedTask.projectId ? 'project' : HMM_DESTINATION),
      priority: completedTask.priority || 5,
      important: Boolean(completedTask.important),
      isTodo: true,
      deleted: false,
      restoredAt: now,
      restoredFromCompletionId: completedTask.id,
      estimateMinutes: clampEstimateMinutes(completedTask.estimateMinutes),
      createdAt: Number(completedTask.createdAt) || now,
      updatedAt: now,
    };

  const notes = existing
    ? (data.notes || []).map((note) => note.id === sourceNoteId ? restoredNote : note)
    : [restoredNote, ...(data.notes || [])];
  const projectId = completedTask.projectId || null;
  return {
    ...data,
    notes,
    completedTasks: (data.completedTasks || []).map((item) => item.id === completedTask.id
      ? { ...item, restoredAt: now, updatedAt: now }
      : item),
    projects: projectId
      ? (data.projects || []).map((project) => project.id === projectId
        ? { ...project, tasksDone: Math.max(0, (project.tasksDone || 0) - 1), updatedAt: now, lastInteractedAt: now }
        : project)
      : data.projects,
  };
}

function recalculateCompletionFromSessions(data, completedTask) {
  const sessions = getCompletionSessions(data, completedTask);
  return {
    ...completedTask,
    trackedMs: sessions.reduce((sum, session) => sum + Math.max(0, Number(session.durationMs) || 0), 0),
    sessionCount: sessions.length,
    sessionIds: sessions.map((session) => session.id),
    updatedAt: Date.now(),
  };
}

export function updateTaskSessionDurationData(data, sessionId, durationMinutes, now = Date.now()) {
  const minutes = Math.max(0, Math.min(24 * 60, Number(durationMinutes) || 0));
  const target = (data.taskSessions || []).find((session) => session.id === sessionId);
  if (!target) return data;
  const affectedCompletionIds = new Set((data.completedTasks || [])
    .filter((item) => getCompletionSessions(data, item).some((session) => session.id === sessionId))
    .map((item) => item.id));
  const durationMs = Math.round(minutes * 60_000);
  const next = {
    ...data,
    taskSessions: (data.taskSessions || []).map((session) => session.id === sessionId
      ? { ...session, durationMs, endedAt: Number(session.startedAt) + durationMs, manuallyEdited: true, updatedAt: now }
      : session),
  };
  return {
    ...next,
    completedTasks: (next.completedTasks || []).map((item) => affectedCompletionIds.has(item.id) ? recalculateCompletionFromSessions(next, item) : item),
  };
}

export function deleteTaskSessionData(data, sessionId) {
  const affectedCompletionIds = new Set((data.completedTasks || [])
    .filter((item) => getCompletionSessions(data, item).some((session) => session.id === sessionId))
    .map((item) => item.id));
  const next = {
    ...data,
    taskSessions: (data.taskSessions || []).filter((session) => session.id !== sessionId),
  };
  return {
    ...next,
    completedTasks: (next.completedTasks || []).map((item) => affectedCompletionIds.has(item.id) ? recalculateCompletionFromSessions(next, item) : item),
  };
}
