import {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_STYLE,
  normalizeThemePaletteId,
  normalizeThemeStyleId,
} from './theme';

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

const DEFAULT_PROMPT_ACTIONS = {
  suggestions: { id: 'suggestions', title: 'Suggestions', description: 'Generate useful suggestions from projects, notes, captures, and current project states.', enabled: true, prompt: "Generate useful suggestions based on the user's projects, captures, notes, suggestions, and current project states. Prioritize suggestions that help the user make progress, reduce confusion, or organize important material." },
  nextSteps: { id: 'nextSteps', title: 'Next steps', description: 'Create small realistic actions.', enabled: true, prompt: 'Create realistic next steps. If a project seems inactive, overwhelming, unclear, or avoided, make the next step smaller. A next step must be something the user can actually do.' },
  checklists: { id: 'checklists', title: 'Checklists', description: 'Convert suitable notes into practical checklists.', enabled: true, prompt: 'Convert suitable notes into practical checklists when this would make the information easier to use or act on.' },
  weeklyReview: { id: 'weeklyReview', title: 'Weekly review', description: 'Summarize progress, problems, and priorities.', enabled: true, prompt: 'Create a weekly review summary that highlights progress, stuck projects, important new ideas, unfinished loops, and recommended priorities.' },
  projectCleanup: { id: 'projectCleanup', title: 'Project cleanup', description: 'Find stale, unclear, overloaded, or low-value material.', enabled: true, prompt: 'Identify stale, duplicated, unclear, overloaded, or low-value material. Suggest whether items should be kept, clarified, connected to a project, hidden, archived, or deleted.' },
  motivation: { id: 'motivation', title: 'Motivation', description: 'Adapt motivation to project momentum.', enabled: true, prompt: "Give motivation that matches the user's actual project momentum. If progress is low, reduce task size and remove pressure. If momentum is strong, suggest a more ambitious next action." },
  brutalFilter: { id: 'brutalFilter', title: 'Brutal filter', description: 'Challenge weak ideas and overloaded project lists.', enabled: true, prompt: 'Be direct about weak ideas, overloaded project lists, avoidance patterns, and unclear priorities. Do not sugarcoat, but remain useful and constructive.' },
  connections: { id: 'connections', title: 'Connections', description: 'Find useful links between notes and projects.', enabled: true, prompt: 'Find meaningful connections between notes, captures, suggestions, and projects. Suggest when two items should be linked or merged.' },
  archiveDeleteRecommendations: { id: 'archiveDeleteRecommendations', title: 'Archive / delete recommendations', description: 'Recommend what should disappear from the active dashboard.', enabled: true, prompt: 'Recommend items that should be archived, hidden, dismissed, or deleted when they no longer deserve active attention.' },
  clarifyingQuestions: { id: 'clarifyingQuestions', title: 'Clarifying questions', description: 'Ask questions when missing information blocks progress.', enabled: true, prompt: 'Ask clarifying questions when important information is missing and the missing information blocks useful progress.' },
  followUpQuestions: { id: 'followUpQuestions', title: 'Follow-up questions', description: 'Generate useful questions from notes when there are blind spots or missing knowledge.', enabled: true, prompt: 'Generate follow-up questions based on notes when there is a useful blind spot, missing information, unclear assumption, weak plan, or knowledge gap that may block progress. Do not generate questions for every note. Prefer fewer high-quality questions over generic questions.' },
  newIdeaRouting: { id: 'newIdeaRouting', title: 'New idea routing', description: 'Connect new ideas to existing projects or ask the user to assign them.', enabled: true, prompt: 'When a capture or note has isNewIdea: true, treat it as an unprocessed idea. First check whether it clearly connects to an existing project using project title, description, notes, captures, and suggestions. If there is a clear connection, recommend connecting the idea to that project and make any generated suggestions, questions, next steps, or checklists use that projectId. If there is no clear connection, do not invent a project connection. Mark the item as needing project assignment and ask the user to choose or create the right project before generating project-specific outputs.' },
  inboxDecisionWorkflow: { id: 'inboxDecisionWorkflow', title: 'Legacy AI decision workflow', description: 'Keep imported AI-generated outputs pending until the user chooses what to do with them.', enabled: true, prompt: 'Treat new AI-generated outputs as pending legacy proposals first. New suggestions, next steps, checklists, questions, cleanup recommendations, and project routing recommendations should not become accepted project tasks or permanent project notes until the user approves them. The user may mark an item as important, convert it to a to-do, reject it, or delay it. Use badIdeaLog and inboxActionLog to learn what the user accepts, rejects, delays, or values.' }
  ,rawNotesWorkflow: { id: 'rawNotesWorkflow', title: 'Notes workflow', description: 'Unprocessed notes are analyzed only after the user manually selects processing tags, then preserved as archived notes.', enabled: true, prompt: 'Treat tagged unprocessed notes as the source material for analysis. Notes without processingTags must not be analyzed. After analysis, notes should not be deleted. They should be preserved and moved to archived notes only when the user explicitly marks them as analyzed. Archived notes are historical source material and should not be reprocessed unless explicitly marked for re-analysis.' }
};

function cleanPromptActionCopy(id, action = {}) {
  if (id === 'inboxDecisionWorkflow') {
    const clean = (value) => typeof value === 'string'
      ? value.replaceAll('Inbox', 'legacy proposal queue').replaceAll('Notes processor', 'legacy proposal queue')
      : value;
    return {
      ...action,
      title: action.title === 'Notes processor decision workflow' || action.title === 'Inbox decision workflow' ? DEFAULT_PROMPT_ACTIONS[id].title : clean(action.title),
      description: clean(action.description),
      prompt: clean(action.prompt),
    };
  }
  if (id === 'rawNotesWorkflow') {
    const clean = (value) => typeof value === 'string'
      ? value.replaceAll('RAW notes', 'notes').replaceAll('RAW note', 'note').replaceAll('Raw Notes', 'Notes').replaceAll('raw notes', 'notes').replaceAll('raw note', 'note')
      : value;
    return { ...action, title: action.title === 'RAW notes workflow' ? DEFAULT_PROMPT_ACTIONS[id].title : clean(action.title), description: clean(action.description), prompt: clean(action.prompt) };
  }
  return action;
}

function normalizePromptActions(actions = {}) {
  const ids = new Set([...Object.keys(DEFAULT_PROMPT_ACTIONS), ...Object.keys(actions || {})]);
  return Object.fromEntries([...ids].map((id) => {
    const defaults = DEFAULT_PROMPT_ACTIONS[id] || { id, title: id, description: '', enabled: true, prompt: '' };
    return [id, cleanPromptActionCopy(id, { ...structuredClone(defaults), ...(actions?.[id] || {}) })];
  }));
}

export function buildDefaultPromptProfile(now = Date.now()) { return { id: 'default-master-plan-v1', name: 'Default Master Plan Analysis', isDefault: true, createdAt: now, updatedAt: now, promptActions: structuredClone(DEFAULT_PROMPT_ACTIONS) }; }

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
    gallery: Array.isArray(project.gallery) ? project.gallery : [],
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
  const now = Date.now(); const profile = buildDefaultPromptProfile(now);
  return {
    meta: { appName: 'Master Plan', schemaVersion: 5, exportType: 'full-backup', exportedAt: new Date(now).toISOString() },
    settings: { activePromptProfileId: profile.id, promptProfiles: [profile], notesProcessorHiddenActionIds: [], lastDestination: HMM_DESTINATION, hasCompletedInitialSetup: true, themePalette: DEFAULT_THEME_PALETTE, themeStyle: DEFAULT_THEME_STYLE, defaultCheckInMinutes: 30 },
    aiInstructions: { activePromptProfileId: profile.id, mainRole: 'You are analyzing a private mobile-first second brain system.', tone: 'Clear, direct, practical, and honest. Be brutally honest when useful, but still constructive.', goal: 'Help the user turn captured notes into useful next actions, project structure, suggestions, checklists, warnings, cleanup recommendations, and follow-up questions.', promptActions: structuredClone(DEFAULT_PROMPT_ACTIONS) },
    projects: [],
    notes: [],
    completedTasks: [],
    taskSessions: [],
    activeTask: null,
    taskTracking: { activeTaskUpdatedAt: 0 },
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
    aiInstructions: defaults.aiInstructions,
    questionLearningSettings: defaults.questionLearningSettings,
    projects: [],
    notes: [],
    completedTasks: [],
    taskSessions: [],
    activeTask: null,
    taskTracking: { activeTaskUpdatedAt: 0 },
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
    taskTracking: { activeTaskUpdatedAt: 0 },
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
  data.meta = { ...base.meta, ...(input?.meta || {}), schemaVersion: 5, appName: 'Master Plan' };
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
  };
  data.badIdeaLog = Array.isArray(input?.badIdeaLog) ? input.badIdeaLog : [];
  data.inboxActionLog = Array.isArray(input?.inboxActionLog) ? input.inboxActionLog : [];
  data.questionFeedbackLog = Array.isArray(input?.questionFeedbackLog) ? input.questionFeedbackLog : [];
  data.settings = { ...base.settings, lastSelectedProjectId: null, lastDestination: HMM_DESTINATION, ...(input?.settings || {}) };
  data.settings.themePalette = normalizeThemePaletteId(data.settings.themePalette);
  data.settings.themeStyle = normalizeThemeStyleId(data.settings.themeStyle);
  data.settings.defaultCheckInMinutes = data.settings.defaultCheckInMinutes === 0 ? 0 : Math.max(5, Math.min(240, Number(data.settings.defaultCheckInMinutes) || 30));
  if (data.settings.lastSelectedProjectId && !data.projects.some((p) => p.id === data.settings.lastSelectedProjectId && p.status !== 'archived' && p.status !== 'hidden')) {
    data.settings.lastSelectedProjectId = data.projects.find((p) => p.status === 'active')?.id || null;
  }
  if (!data.settings.lastDestination || (data.settings.lastDestination !== HMM_DESTINATION && !projectIds.has(data.settings.lastDestination))) {
    data.settings.lastDestination = HMM_DESTINATION;
  }
  data.settings.promptProfiles = Array.isArray(data.settings.promptProfiles) && data.settings.promptProfiles.length ? data.settings.promptProfiles : [buildDefaultPromptProfile()];
  data.settings.promptProfiles = data.settings.promptProfiles.map((profile) => ({ ...profile, promptActions: normalizePromptActions(profile.promptActions) }));
  data.settings.activePromptProfileId = data.settings.activePromptProfileId || data.settings.promptProfiles[0].id;
  data.settings.notesProcessorHiddenActionIds = Array.isArray(data.settings.notesProcessorHiddenActionIds) ? data.settings.notesProcessorHiddenActionIds : [];
  const activeProfile = data.settings.promptProfiles.find((p) => p.id === data.settings.activePromptProfileId) || data.settings.promptProfiles[0];
  data.aiInstructions = { ...base.aiInstructions, ...(input?.aiInstructions || {}), activePromptProfileId: data.settings.activePromptProfileId, promptActions: normalizePromptActions({ ...(activeProfile?.promptActions || {}), ...(input?.aiInstructions?.promptActions || {}) }) };
  data.questionLearningSettings = { ...base.questionLearningSettings, ...(input?.questionLearningSettings || {}) };
  return data;
}

export function getEnabledPromptActions(actions = {}) { return Object.fromEntries(Object.entries(actions).filter(([, value]) => value?.enabled)); }
