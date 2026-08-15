import { clampPriority, getProjectName } from './model';
import { formatHistoryDuration } from './taskTracking';

const DAY_MS = 24 * 60 * 60 * 1000;
const DORMANT_AFTER_MS = 14 * DAY_MS;
const RETURN_PULSE_AFTER_MS = 6 * 60 * 60 * 1000;

function toTime(value) {
  const time = Number(value);
  return Number.isFinite(time) && time > 0 ? time : 0;
}

export function getProjectOpenItems(data, projectId) {
  if (!projectId) return [];
  return (data?.notes || [])
    .filter((note) => !note.deleted && !note.legacyShape && note.projectId === projectId)
    .sort((a, b) => {
      const priorityDelta = clampPriority(b.priority) - clampPriority(a.priority);
      if (priorityDelta) return priorityDelta;
      return (Number(b.updatedAt) || Number(b.createdAt) || 0) - (Number(a.updatedAt) || Number(a.createdAt) || 0);
    });
}

export function getNextProjectTask(data, projectId) {
  return getProjectOpenItems(data, projectId)[0] || null;
}

export function getLastWorkedProjectId(data) {
  const validProjects = new Set((data?.projects || [])
    .filter((project) => project.status === 'active' && !project.archived && !project.hidden && !project.finishedAt)
    .map((project) => project.id));
  const latestByProject = new Map();
  const record = (projectId, timestamp) => {
    if (!projectId || !validProjects.has(projectId)) return;
    latestByProject.set(projectId, Math.max(latestByProject.get(projectId) || 0, toTime(timestamp)));
  };

  (data?.taskSessions || []).forEach((session) => {
    record(session.projectId, Math.max(toTime(session.endedAt), toTime(session.startedAt)));
  });
  (data?.completedTasks || []).forEach((task) => {
    if (!task.deleted && !task.restoredAt) record(task.projectId, task.completedAt);
  });
  (data?.projects || []).forEach((project) => {
    if (!validProjects.has(project.id)) return;
    record(project.id, Math.max(toTime(project.lastInteractedAt), toTime(project.updatedAt), toTime(project.createdAt)));
  });

  let latestProjectId = null;
  let latestAt = 0;
  latestByProject.forEach((timestamp, projectId) => {
    if (timestamp > latestAt) {
      latestAt = timestamp;
      latestProjectId = projectId;
    }
  });
  return latestProjectId;
}

export function buildNextTaskSuggestion(data, preferredProjectId = null) {
  const projectId = preferredProjectId || getLastWorkedProjectId(data);
  if (!projectId) return null;
  const project = (data?.projects || []).find((item) => item.id === projectId);
  if (!project || project.status !== 'active' || project.finishedAt) return null;
  const task = getNextProjectTask(data, projectId);
  if (!task) return null;
  return {
    id: `${projectId}:${task.id}:${task.updatedAt || task.createdAt || 0}`,
    projectId,
    projectName: getProjectName(project),
    task,
    priority: clampPriority(task.priority),
  };
}

export function getProjectMeaningfulActivityAt(data, projectId) {
  const project = (data?.projects || []).find((item) => item.id === projectId);
  if (!project) return 0;
  const sessionAt = (data?.taskSessions || [])
    .filter((session) => session.projectId === projectId)
    .reduce((latest, session) => Math.max(latest, toTime(session.endedAt), toTime(session.startedAt)), 0);
  const completionAt = (data?.completedTasks || [])
    .filter((task) => !task.deleted && !task.restoredAt && task.projectId === projectId)
    .reduce((latest, task) => Math.max(latest, toTime(task.completedAt)), 0);
  const noteAt = (data?.notes || [])
    .filter((note) => !note.deleted && note.projectId === projectId)
    .reduce((latest, note) => Math.max(latest, toTime(note.updatedAt), toTime(note.createdAt)), 0);
  return Math.max(sessionAt, completionAt, noteAt, toTime(project.createdAt));
}

export function getProjectMomentum(data, projectId, now = Date.now()) {
  const lastActivityAt = getProjectMeaningfulActivityAt(data, projectId);
  if (!lastActivityAt) return { level: 0, label: 'QUIET', lastActivityAt: 0 };
  const age = Math.max(0, now - lastActivityAt);
  const weekAgo = now - (7 * DAY_MS);
  const recentMinutes = (data?.taskSessions || [])
    .filter((session) => session.projectId === projectId && Math.max(toTime(session.endedAt), toTime(session.startedAt)) >= weekAgo)
    .reduce((sum, session) => sum + Math.max(0, Number(session.durationMs) || 0), 0) / 60_000;
  const recentCompletions = (data?.completedTasks || [])
    .filter((task) => !task.deleted && !task.restoredAt && task.projectId === projectId && toTime(task.completedAt) >= weekAgo).length;

  if (age <= DAY_MS && (recentMinutes >= 45 || recentCompletions >= 2)) return { level: 4, label: 'FLOW', lastActivityAt };
  if (age <= 3 * DAY_MS && (recentMinutes >= 15 || recentCompletions >= 1)) return { level: 3, label: 'MOVING', lastActivityAt };
  if (age <= 7 * DAY_MS) return { level: 2, label: 'WARM', lastActivityAt };
  if (age <= DORMANT_AFTER_MS) return { level: 1, label: 'COOL', lastActivityAt };
  return { level: 0, label: 'QUIET', lastActivityAt };
}

export function isDormantProject(data, project, now = Date.now()) {
  if (!project || project.status !== 'active' || project.finishedAt) return false;
  const activityAt = getProjectMeaningfulActivityAt(data, project.id);
  return Boolean(activityAt && now - activityAt >= DORMANT_AFTER_MS);
}

export function buildProjectReturnPulse(data, projectId, now = Date.now()) {
  const project = (data?.projects || []).find((item) => item.id === projectId);
  if (!project || !project.lastOpenedAt || now - Number(project.lastOpenedAt) < RETURN_PULSE_AFTER_MS) return null;

  const latestSession = (data?.taskSessions || [])
    .filter((session) => session.projectId === projectId)
    .sort((a, b) => Math.max(toTime(b.endedAt), toTime(b.startedAt)) - Math.max(toTime(a.endedAt), toTime(a.startedAt)))[0] || null;
  const latestCompleted = (data?.completedTasks || [])
    .filter((task) => !task.deleted && !task.restoredAt && task.projectId === projectId)
    .sort((a, b) => toTime(b.completedAt) - toTime(a.completedAt))[0] || null;
  const nextTask = getNextProjectTask(data, projectId);
  const latestNote = (data?.notes || [])
    .filter((note) => !note.deleted && note.projectId === projectId && note.id !== nextTask?.id)
    .sort((a, b) => Math.max(toTime(b.updatedAt), toTime(b.createdAt)) - Math.max(toTime(a.updatedAt), toTime(a.createdAt)))[0] || null;

  if (!latestSession && !latestCompleted && !nextTask && !latestNote) return null;
  return {
    lastOpenedAt: Number(project.lastOpenedAt),
    latestSession,
    latestCompleted,
    nextTask,
    latestNote,
  };
}

function overlapMs(start, end, rangeStart, rangeEnd) {
  const from = Math.max(toTime(start), rangeStart);
  const to = Math.min(toTime(end) || toTime(start), rangeEnd);
  return Math.max(0, to - from);
}

export function buildDailyProgress(data, now = Date.now()) {
  const date = new Date(now);
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayEnd = dayStart + DAY_MS;
  let focusedMs = (data?.taskSessions || []).reduce((sum, session) => sum + overlapMs(session.startedAt, session.endedAt, dayStart, dayEnd), 0);
  const active = data?.activeTask;
  if (active?.status === 'running' && active.segmentStartedAt) {
    focusedMs += overlapMs(active.segmentStartedAt, now, dayStart, dayEnd);
  }
  const completedToday = (data?.completedTasks || []).filter((task) => !task.deleted && !task.restoredAt && toTime(task.completedAt) >= dayStart && toTime(task.completedAt) < dayEnd);
  const projectIds = new Set([
    ...(data?.taskSessions || []).filter((session) => session.projectId && overlapMs(session.startedAt, session.endedAt, dayStart, dayEnd) > 0).map((session) => session.projectId),
    ...completedToday.filter((task) => task.projectId).map((task) => task.projectId),
  ]);
  if (active?.projectId && active.status === 'running') projectIds.add(active.projectId);
  return {
    focusedMs,
    focusedLabel: focusedMs < 1000 ? '0m' : formatHistoryDuration(focusedMs),
    completedCount: completedToday.length,
    projectsAdvanced: projectIds.size,
  };
}

export function buildProjectCompletionSummary(data, projectId, now = Date.now()) {
  const project = (data?.projects || []).find((item) => item.id === projectId);
  if (!project) return null;
  const sessions = (data?.taskSessions || []).filter((session) => session.projectId === projectId);
  const completed = (data?.completedTasks || []).filter((task) => !task.deleted && !task.restoredAt && task.projectId === projectId);
  const trackedMs = sessions.reduce((sum, session) => sum + Math.max(0, Number(session.durationMs) || 0), 0);
  const firstWorkAt = sessions.reduce((earliest, session) => Math.min(earliest, toTime(session.startedAt) || earliest), Number.MAX_SAFE_INTEGER);
  return {
    projectId,
    projectName: getProjectName(project),
    startedAt: Number.isFinite(firstWorkAt) && firstWorkAt !== Number.MAX_SAFE_INTEGER ? firstWorkAt : toTime(project.createdAt),
    finishedAt: now,
    trackedMs,
    sessionCount: sessions.length,
    completedCount: completed.length,
    remainingCount: getProjectOpenItems(data, projectId).length,
  };
}
