export const STATUSES = ['active', 'paused', 'hidden', 'archived'];
export const HMM_DESTINATION = 'hmm';
export const PROJECT_DESTINATION = 'project';
export const HMM_PROJECT_ID = 'hmm';
export const CREATE_PROJECT_VALUE = '__create_project__';

const LEGACY_PROJECT_NOTE_FIELDS = [
  'notes',
  'rawNotes',
  'captures',
  'ahaNotes',
  'hmmNotes',
  'projectNotes',
  'archivedNotes',
  'importantNotes',
  'inboxNotes',
  'processedNotes',
  'aiAnalysisNotes',
  'suggestions',
  'tasks',
  'checklists',
  'questions',
  'analysisResults',
  'analysisResultGroups',
  'importedJsonGroups',
  'processedNoteGroups',
  'inboxGroups',
  'suggestionGroups',
  'rawNoteArchives',
  'legacyReviewGroups',
  'processorGroups',
  'groupedAnalysisOutputs',
];

export function getProjectName(project = {}) {
  return String(project.name || project.title || 'Untitled project').trim() || 'Untitled project';
}

export function normalizeProject(project = {}) {
  const now = Date.now();
  const status = project.status || (project.archived ? 'archived' : project.hidden ? 'hidden' : 'active');
  const name = getProjectName(project);
  return {
    ...project,
    id: project.id || `project-${now}`,
    name,
    title: project.title || name,
    description: project.description || '',
    status,
    tasksDone: Number.isFinite(Number(project.tasksDone)) ? Number(project.tasksDone) : 0,
    archived: project.archived ?? status === 'archived',
    hidden: project.hidden ?? status === 'hidden',
    createdAt: project.createdAt || now,
    updatedAt: project.updatedAt || project.createdAt || now,
    lastInteractedAt: project.lastInteractedAt ?? null,
    lastOpenedAt: project.lastOpenedAt ?? null,
    interactionCount: project.interactionCount ?? 0,
    notes: Array.isArray(project.notes) ? project.notes : [],
    gallery: (Array.isArray(project.gallery) ? project.gallery : []).map((image) => ({
      ...image,
      rotation: ((Number(image?.rotation) || 0) % 360 + 360) % 360,
    })),
  };
}


function getProjectSortTime(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value === 'string') {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      const millis = value.toMillis();
      return Number.isFinite(millis) && millis > 0 ? millis : null;
    }
    if (typeof value.seconds === 'number') {
      const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
      const millis = (value.seconds * 1000) + Math.floor(nanos / 1e6);
      return Number.isFinite(millis) && millis > 0 ? millis : null;
    }
  }
  return null;
}

function getProjectOpenedSortTime(project = {}) {
  return getProjectSortTime(project.lastOpenedAt);
}

function getProjectFallbackSortTime(project = {}) {
  return getProjectSortTime(project.lastInteractedAt)
    ?? getProjectSortTime(project.updatedAt)
    ?? getProjectSortTime(project.createdAt)
    ?? 0;
}

export function compareProjectsByLastOpened(a, b) {
  const aLastOpenedAt = getProjectOpenedSortTime(a);
  const bLastOpenedAt = getProjectOpenedSortTime(b);
  if (aLastOpenedAt !== null || bLastOpenedAt !== null) {
    if (aLastOpenedAt === null) return 1;
    if (bLastOpenedAt === null) return -1;
    const lastOpenedDelta = bLastOpenedAt - aLastOpenedAt;
    if (lastOpenedDelta) return lastOpenedDelta;
  }
  const fallbackDelta = getProjectFallbackSortTime(b) - getProjectFallbackSortTime(a);
  if (fallbackDelta) return fallbackDelta;
  return getProjectName(a).localeCompare(getProjectName(b));
}

export function normalizeSuggestion(s = {}) {
  const state = s.state || 'pending';
  const inboxStatus = s.inboxStatus || (state === 'pending' ? 'pending-review' : state === 'bad-idea' ? 'dismissed' : state === 'hidden-until-next-analysis' ? 'hidden' : 'approved');
  return { ...s, state, inboxStatus, selectedAction: s.selectedAction ?? null, approvedAt: s.approvedAt ?? null, dismissedAt: s.dismissedAt ?? null, hiddenAt: s.hiddenAt ?? null, hiddenUntil: s.hiddenUntil ?? null, importance: s.importance ?? null, sourceCaptureId: s.sourceCaptureId ?? null, sourceNoteId: s.sourceNoteId ?? null, sourceSuggestionId: s.sourceSuggestionId ?? null, needsProjectAssignment: s.needsProjectAssignment ?? !s.projectId };
}
export function normalizeCapture(c = {}) {
  const hasProcessedHint = c.processedAt || c.archivedRawAt || c.analysisState === 'analyzed' || c.rawState === 'archived';
  return { ...c, rawState: c.rawState || (hasProcessedHint ? 'archived' : 'unprocessed'), analysisState: c.analysisState || (hasProcessedHint ? 'analyzed' : 'not-analyzed'), processedAt: c.processedAt ?? null, archivedRawAt: c.archivedRawAt ?? null, needsReanalysis: c.needsReanalysis ?? false, needsProjectAssignment: c.needsProjectAssignment ?? (c.isNewIdea ? !c.projectId : false), candidateProjectIds: c.candidateProjectIds ?? [], processingTags: Array.isArray(c.processingTags) ? c.processingTags : [] };
}

export function clampPriority(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(10, Math.round(parsed)));
}

export function getPriorityColor(priority) {
  const t = (clampPriority(priority) - 1) / 9;
  return `color-mix(in srgb, var(--priority-hot) ${Math.round(t * 100)}%, var(--priority-cold) ${Math.round((1 - t) * 100)}%)`;
}

export function sortByPriorityThenNewest(a, b) {
  const priorityDelta = clampPriority(b.priority) - clampPriority(a.priority);
  if (priorityDelta) return priorityDelta;
  return (b.createdAt || b.updatedAt || 0) - (a.createdAt || a.updatedAt || 0);
}

export function isRealProject(project) {
  if (!project || project.id === HMM_PROJECT_ID) return false;
  return project.status !== 'archived' && project.status !== 'hidden' && !project.archived && !project.hidden;
}

export function getRealProjects(projects = []) {
  return projects.filter(isRealProject);
}

export function getDestinationForProjectId(projectId) {
  return projectId && projectId !== HMM_PROJECT_ID ? PROJECT_DESTINATION : HMM_DESTINATION;
}

export function normalizeNote(note = {}, projectIds = new Set()) {
  const now = Date.now();
  const rawProjectId = note.projectId && note.projectId !== HMM_PROJECT_ID ? note.projectId : null;
  const projectId = rawProjectId && projectIds.has(rawProjectId) ? rawProjectId : null;
  const destination = projectId ? PROJECT_DESTINATION : HMM_DESTINATION;
  const hasExplicitText = typeof note.text === 'string';
  const text = hasExplicitText ? note.text.trim() : '';
  const isLegacyShape = !hasExplicitText && Boolean(note.title || note.question || note.summary || note.description);
  return {
    ...note,
    id: note.id || `note-${now}`,
    text,
    createdAt: note.createdAt || now,
    updatedAt: note.updatedAt || note.createdAt || now,
    destination,
    projectId: destination === PROJECT_DESTINATION ? projectId : null,
    priority: clampPriority(note.priority),
    important: Boolean(note.important || note.importance === 'important'),
    isTodo: Boolean(note.isTodo),
    pendingTodoIntent: Boolean(note.pendingTodoIntent),
    deleted: Boolean(note.deleted),
    selectedActions: Array.isArray(note.selectedActions) ? note.selectedActions : [],
    sourceType: note.sourceType || null,
    sourceId: note.sourceId || null,
    sourceCaptureId: note.sourceCaptureId || null,
    sourceSuggestionId: note.sourceSuggestionId || null,
    estimateMinutes: note.estimateMinutes === null || note.estimateMinutes === undefined || note.estimateMinutes === '' ? null : Math.max(5, Math.min(24 * 60, Math.round(Number(note.estimateMinutes) || 0))),
    legacyShape: note.legacyShape ?? isLegacyShape,
  };
}

function makeMigratedNote(id, patch, projectIds) {
  return normalizeNote({ id, priority: 5, ...patch }, projectIds);
}

function addMigratedNote(map, id, patch, projectIds) {
  const note = makeMigratedNote(id, patch, projectIds);
  if (!note.text || map.has(note.id)) return;
  map.set(note.id, note);
}

function migrateNotesFromLegacy(input = {}, projects = []) {
  const projectIds = new Set(projects.map((project) => project.id));
  const notes = new Map();

  (Array.isArray(input.captures) ? input.captures : []).forEach((capture, index) => {
    const projectId = capture.projectId && projectIds.has(capture.projectId) ? capture.projectId : null;
    addMigratedNote(notes, `capture-${capture.id || index}`, {
      text: capture.text,
      createdAt: capture.createdAt,
      updatedAt: capture.updatedAt || capture.processedAt || capture.createdAt,
      destination: projectId ? PROJECT_DESTINATION : HMM_DESTINATION,
      projectId,
      priority: capture.priority,
      important: capture.important,
      isTodo: capture.isTodo,
      sourceType: 'capture',
      sourceId: capture.id || null,
      sourceCaptureId: capture.id || null,
    }, projectIds);
  });

  projects.forEach((project) => {
    (Array.isArray(project.notes) ? project.notes : []).forEach((note, index) => {
      addMigratedNote(notes, `project-note-${project.id}-${note.id || index}`, {
        text: note.text,
        createdAt: note.createdAt || project.createdAt,
        updatedAt: note.updatedAt || note.createdAt || project.updatedAt,
        destination: PROJECT_DESTINATION,
        projectId: project.id,
        priority: note.priority,
        important: note.important,
        isTodo: note.isTodo,
        sourceType: 'project-note',
        sourceId: note.id || null,
      }, projectIds);
    });
  });

  (Array.isArray(input.tasks) ? input.tasks : []).forEach((task, index) => {
    const projectId = task.projectId && projectIds.has(task.projectId) ? task.projectId : null;
    addMigratedNote(notes, `task-${task.id || index}`, {
      text: task.title || task.text,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt || task.createdAt,
      destination: projectId ? PROJECT_DESTINATION : HMM_DESTINATION,
      projectId,
      priority: task.priority,
      important: task.important,
      isTodo: Boolean(projectId),
      pendingTodoIntent: !projectId,
      sourceType: 'task',
      sourceId: task.id || null,
    }, projectIds);
  });

  (Array.isArray(input.checklists) ? input.checklists : []).forEach((checklist, checklistIndex) => {
    const projectId = checklist.projectId && projectIds.has(checklist.projectId) ? checklist.projectId : null;
    const items = Array.isArray(checklist.items) && checklist.items.length ? checklist.items : [checklist];
    items.forEach((item, itemIndex) => {
      const itemText = typeof item === 'string' ? item : item?.text || item?.title || checklist.title;
      addMigratedNote(notes, `checklist-${checklist.id || checklistIndex}-${item?.id || itemIndex}`, {
        text: itemText,
        createdAt: item?.createdAt || checklist.createdAt,
        updatedAt: item?.updatedAt || checklist.updatedAt || checklist.createdAt,
        destination: projectId ? PROJECT_DESTINATION : HMM_DESTINATION,
        projectId,
        priority: item?.priority || checklist.priority,
        important: item?.important || checklist.important,
        isTodo: Boolean(projectId),
        pendingTodoIntent: !projectId,
        sourceType: 'checklist',
        sourceId: checklist.id || null,
      }, projectIds);
    });
  });

  (Array.isArray(input.suggestions) ? input.suggestions : []).forEach((suggestion, index) => {
    const state = suggestion.state || suggestion.inboxStatus;
    if (['bad-idea', 'dismissed', 'hidden', 'hidden-until-next-analysis'].includes(state)) return;
    const projectId = suggestion.projectId && projectIds.has(suggestion.projectId) ? suggestion.projectId : null;
    const important = suggestion.importance === 'important' || suggestion.state === 'marked-important';
    const isTodo = Boolean(projectId && ['converted-to-task', 'converted-to-checklist'].includes(suggestion.state));
    addMigratedNote(notes, `suggestion-${suggestion.id || index}`, {
      text: suggestion.text || suggestion.title || suggestion.question,
      createdAt: suggestion.createdAt || suggestion.importedAt,
      updatedAt: suggestion.updatedAt || suggestion.approvedAt || suggestion.createdAt,
      destination: projectId ? PROJECT_DESTINATION : HMM_DESTINATION,
      projectId,
      priority: suggestion.priority,
      important,
      isTodo,
      pendingTodoIntent: !projectId && ['converted-to-task', 'converted-to-checklist'].includes(suggestion.state),
      sourceType: 'suggestion',
      sourceId: suggestion.id || null,
      sourceSuggestionId: suggestion.id || null,
    }, projectIds);
  });

  return [...notes.values()].sort(sortByPriorityThenNewest);
}

export function buildDefaultData() {
  const now = Date.now();
  return {
    meta: { appName: 'Master Plan', schemaVersion: 9, exportType: 'full-backup', exportedAt: new Date(now).toISOString() },
    settings: {
      lastDestination: HMM_DESTINATION,
      lastSelectedProjectId: null,
      hasCompletedInitialSetup: true,
      defaultCheckInMinutes: 30,
      notificationsEnabled: true,
      checkInNotificationsEnabled: true,
      breakNotificationsEnabled: true,
      estimateNotificationsEnabled: true,
      notificationSoundEnabled: true,
    },
    projects: [],
    notes: [],
    completedTasks: [],
    taskSessions: [],
    activeTask: null,
    taskTracking: { activeTaskUpdatedAt: 0, deletedCompletedTasks: {}, deletedTaskSessions: {} },
    captures: [],
    suggestions: [],
    tasks: [],
    checklists: [],
    questions: [],
    badIdeaLog: [],
    inboxActionLog: [],
    questionFeedbackLog: [],
    questionLearningSettings: { enabled: true, recentQuestionLimit: 150, generationMix: { upvotedTypeRatio: 0.5, downvotedTypeRatio: 0.1, newTypeRatio: 0.4 }, avoidRecentlyDownvoted: true, preferAnsweredAndUpvoted: true }
  };
}

export function buildResetData() {
  const defaults = buildDefaultData();
  const nowIso = new Date().toISOString();
  return migrateData({
    meta: {
      ...defaults.meta,
      destructiveResetAt: nowIso,
    },
    settings: defaults.settings,
    questionLearningSettings: defaults.questionLearningSettings,
    projects: [],
    notes: [],
    completedTasks: [],
    taskSessions: [],
    activeTask: null,
    taskTracking: { activeTaskUpdatedAt: 0, deletedCompletedTasks: {}, deletedTaskSessions: {} },
    captures: [],
    suggestions: [],
    tasks: [],
    checklists: [],
    questions: [],
    badIdeaLog: [],
    inboxActionLog: [],
    questionFeedbackLog: [],
  });
}

export const seedData = buildDefaultData();

function cleanupProjectNoteFields(project = {}, now = Date.now()) {
  const cleaned = {
    ...project,
    tasksDone: 0,
    updatedAt: now,
  };
  LEGACY_PROJECT_NOTE_FIELDS.forEach((field) => {
    if (field === 'notes') {
      cleaned.notes = [];
      return;
    }
    if (field in cleaned) delete cleaned[field];
  });
  return cleaned;
}

export function buildGlobalNoteCleanupData(input, now = Date.now()) {
  const migrated = migrateData(input);
  const cleanedProjects = (migrated.projects || []).map((project) => cleanupProjectNoteFields(project, now));
  return migrateData({
    ...migrated,
    projects: cleanedProjects,
    notes: [],
    completedTasks: [],
    taskSessions: [],
    activeTask: null,
    taskTracking: { activeTaskUpdatedAt: 0, deletedCompletedTasks: {}, deletedTaskSessions: {} },
    captures: [],
    suggestions: [],
    tasks: [],
    checklists: [],
    questions: [],
    badIdeaLog: [],
    inboxActionLog: [],
    questionFeedbackLog: [],
  });
}

export function migrateData(input) {
  const base = buildDefaultData(); const data = { ...base, ...(input || {}) };
  data.meta = { ...base.meta, ...(input?.meta || {}), schemaVersion: 9, appName: 'Master Plan' };
  data.projects = (Array.isArray(input?.projects) ? input.projects : []).map(normalizeProject).filter((project) => project.id !== HMM_PROJECT_ID);
  const projectIds = new Set(data.projects.map((project) => project.id));
  data.captures = (Array.isArray(input?.captures) ? input.captures : []).map(normalizeCapture);
  data.suggestions = (Array.isArray(input?.suggestions) ? input.suggestions : []).map(normalizeSuggestion);
  data.tasks = Array.isArray(input?.tasks) ? input.tasks : [];
  data.checklists = Array.isArray(input?.checklists) ? input.checklists : [];
  data.questions = Array.isArray(input?.questions) ? input.questions : [];
  data.notes = Array.isArray(input?.notes)
    ? input.notes.map((note) => normalizeNote(note, projectIds)).filter((note) => note.text)
    : migrateNotesFromLegacy(input || {}, data.projects);
  data.completedTasks = (Array.isArray(input?.completedTasks) ? input.completedTasks : []).map((task) => ({
    ...task,
    id: task.id || `completed-${task.sourceNoteId || task.completedAt || Date.now()}`,
    projectId: task.projectId && projectIds.has(task.projectId) ? task.projectId : null,
    text: String(task.text || task.title || '').trim(),
    priority: clampPriority(task.priority),
    completedAt: task.completedAt || Date.now(),
    createdAt: Number(task.createdAt) || Number(task.completedAt) || Date.now(),
    updatedAt: Number(task.updatedAt) || Number(task.completedAt) || Date.now(),
    trackedMs: Math.max(0, Number(task.trackedMs) || 0),
    sessionCount: Math.max(0, Number(task.sessionCount) || 0),
    sessionIds: Array.isArray(task.sessionIds) ? task.sessionIds.filter(Boolean) : [],
    valueRating: task.valueRating === null || task.valueRating === undefined || task.valueRating === '' ? null : Math.max(0, Math.min(5, Math.round(Number(task.valueRating) || 0))),
    estimateMinutes: task.estimateMinutes === null || task.estimateMinutes === undefined || task.estimateMinutes === '' ? null : Math.max(5, Math.min(24 * 60, Math.round(Number(task.estimateMinutes) || 0))),
    restoredAt: task.restoredAt == null ? null : Number(task.restoredAt),
  })).filter((task) => task.text);
  data.taskSessions = (Array.isArray(input?.taskSessions) ? input.taskSessions : []).map((session) => ({
    ...session,
    id: session.id || `session-${session.taskNoteId || Date.now()}-${session.startedAt || Date.now()}`,
    taskNoteId: session.taskNoteId || session.sourceNoteId || null,
    projectId: session.projectId && projectIds.has(session.projectId) ? session.projectId : null,
    taskTextSnapshot: String(session.taskTextSnapshot || session.text || '').trim(),
    startedAt: Number(session.startedAt) || Date.now(),
    endedAt: Number(session.endedAt) || Number(session.startedAt) || Date.now(),
    durationMs: Math.max(0, Number(session.durationMs) || ((Number(session.endedAt) || 0) - (Number(session.startedAt) || 0))),
    createdAt: Number(session.createdAt) || Number(session.startedAt) || Date.now(),
    updatedAt: Number(session.updatedAt) || Number(session.endedAt) || Date.now(),
  })).filter((session) => session.taskNoteId && session.durationMs >= 0);
  if (input?.activeTask?.taskNoteId) {
    const active = input.activeTask;
    data.activeTask = {
      ...active,
      projectId: active.projectId && projectIds.has(active.projectId) ? active.projectId : null,
      taskTextSnapshot: String(active.taskTextSnapshot || '').trim(),
      status: ['running', 'paused', 'break'].includes(active.status) ? active.status : 'paused',
      startedAt: Number(active.startedAt) || Date.now(),
      segmentStartedAt: active.segmentStartedAt == null ? null : Number(active.segmentStartedAt),
      pausedAt: active.pausedAt == null ? null : Number(active.pausedAt),
      checkInMinutes: active.checkInMinutes === 0 ? 0 : Math.max(5, Math.min(240, Number(active.checkInMinutes) || 30)),
      estimateMinutes: active.estimateMinutes === null || active.estimateMinutes === undefined || active.estimateMinutes === '' ? null : Math.max(5, Math.min(24 * 60, Math.round(Number(active.estimateMinutes) || 0))),
      nextCheckInAt: active.nextCheckInAt == null ? null : Number(active.nextCheckInAt),
      breakStartedAt: active.breakStartedAt == null ? null : Number(active.breakStartedAt),
      breakEndsAt: active.breakEndsAt == null ? null : Number(active.breakEndsAt),
      updatedAt: Number(active.updatedAt) || Date.now(),
    };
  } else {
    data.activeTask = null;
  }
  const activeTaskUpdatedAt = Number(input?.taskTracking?.activeTaskUpdatedAt)
    || Number(input?.activeTask?.updatedAt)
    || 0;
  data.taskTracking = {
    ...(base.taskTracking || {}),
    ...(input?.taskTracking || {}),
    activeTaskUpdatedAt,
    deletedCompletedTasks: { ...(input?.taskTracking?.deletedCompletedTasks || {}) },
    deletedTaskSessions: { ...(input?.taskTracking?.deletedTaskSessions || {}) },
  };
  data.completedTasks = data.completedTasks.filter((task) => !data.taskTracking.deletedCompletedTasks?.[task.id]);
  data.taskSessions = data.taskSessions.filter((session) => !data.taskTracking.deletedTaskSessions?.[session.id]);
  data.badIdeaLog = Array.isArray(input?.badIdeaLog) ? input.badIdeaLog : [];
  data.inboxActionLog = Array.isArray(input?.inboxActionLog) ? input.inboxActionLog : [];
  data.questionFeedbackLog = Array.isArray(input?.questionFeedbackLog) ? input.questionFeedbackLog : [];
  const {
    activePromptProfileId: _legacyActivePromptProfileId,
    promptProfiles: _legacyPromptProfiles,
    notesProcessorHiddenActionIds: _legacyHiddenActions,
    themePalette: _legacyThemePalette,
    themeStyle: _legacyThemeStyle,
    ...cleanInputSettings
  } = input?.settings || {};
  data.settings = { ...base.settings, lastSelectedProjectId: null, lastDestination: HMM_DESTINATION, ...cleanInputSettings };
  data.settings.defaultCheckInMinutes = data.settings.defaultCheckInMinutes === 0 ? 0 : Math.max(5, Math.min(240, Number(data.settings.defaultCheckInMinutes) || 30));
  data.settings.notificationsEnabled = data.settings.notificationsEnabled !== false;
  data.settings.checkInNotificationsEnabled = data.settings.checkInNotificationsEnabled !== false;
  data.settings.breakNotificationsEnabled = data.settings.breakNotificationsEnabled !== false;
  data.settings.estimateNotificationsEnabled = data.settings.estimateNotificationsEnabled !== false;
  data.settings.notificationSoundEnabled = data.settings.notificationSoundEnabled !== false;
  if (data.settings.lastSelectedProjectId && !data.projects.some((p) => p.id === data.settings.lastSelectedProjectId && p.status !== 'archived' && p.status !== 'hidden')) {
    data.settings.lastSelectedProjectId = data.projects.find((p) => p.status === 'active')?.id || null;
  }
  if (!data.settings.lastDestination || (data.settings.lastDestination !== HMM_DESTINATION && !projectIds.has(data.settings.lastDestination))) {
    data.settings.lastDestination = HMM_DESTINATION;
  }
  data.questionLearningSettings = { ...base.questionLearningSettings, ...(input?.questionLearningSettings || {}) };
  delete data.aiInstructions;
  return data;
}
