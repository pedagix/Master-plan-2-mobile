export const STATUSES = ['active', 'paused', 'hidden', 'archived'];

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
  inboxDecisionWorkflow: { id: 'inboxDecisionWorkflow', title: 'Inbox decision workflow', description: 'New AI-generated outputs must go to the Inbox first and wait for user approval.', enabled: true, prompt: 'Treat the Inbox as the review queue for new generated outputs. New suggestions, next steps, checklists, questions, cleanup recommendations, and project routing recommendations should be created as pending Inbox items first. Do not treat them as accepted project tasks or permanent project suggestions until the user approves them. The user may mark an item as Important, convert it to a To-do list, mark it as a Bad idea, or choose Remind me later. Use badIdeaLog and inboxActionLog to learn what the user accepts, rejects, delays, or values.' }
  ,rawNotesWorkflow: { id: 'rawNotesWorkflow', title: 'RAW notes workflow', description: 'Unprocessed raw notes are analyzed, then preserved as archived raw notes.', enabled: true, prompt: 'Treat unprocessed RAW notes as the main source material for new analysis. After analysis, RAW notes should not be deleted. They should be preserved and moved to archived RAW notes. Archived RAW notes are historical source material and should not be reprocessed unless explicitly marked for re-analysis.' }
};

export function buildDefaultPromptProfile(now = Date.now()) { return { id: 'default-master-plan-v1', name: 'Default Master Plan Analysis', isDefault: true, createdAt: now, updatedAt: now, promptActions: structuredClone(DEFAULT_PROMPT_ACTIONS) }; }

export function normalizeProject(project = {}) {
  return { ...project, status: project.status || 'active', lastInteractedAt: project.lastInteractedAt ?? null, interactionCount: project.interactionCount ?? 0, notes: Array.isArray(project.notes) ? project.notes : [], gallery: Array.isArray(project.gallery) ? project.gallery : [] };
}

export function normalizeSuggestion(s = {}) {
  const state = s.state || 'pending';
  const inboxStatus = s.inboxStatus || (state === 'pending' ? 'pending-review' : state === 'bad-idea' ? 'dismissed' : state === 'hidden-until-next-analysis' ? 'hidden' : 'approved');
  return { ...s, state, inboxStatus, selectedAction: s.selectedAction ?? null, approvedAt: s.approvedAt ?? null, dismissedAt: s.dismissedAt ?? null, hiddenAt: s.hiddenAt ?? null, hiddenUntil: s.hiddenUntil ?? null, importance: s.importance ?? null, sourceCaptureId: s.sourceCaptureId ?? null, sourceNoteId: s.sourceNoteId ?? null, sourceSuggestionId: s.sourceSuggestionId ?? null, needsProjectAssignment: s.needsProjectAssignment ?? !s.projectId };
}
export function normalizeCapture(c = {}) {
  const hasProcessedHint = c.processedAt || c.archivedRawAt || c.analysisState === 'analyzed' || c.rawState === 'archived';
  return { ...c, rawState: c.rawState || (hasProcessedHint ? 'archived' : 'unprocessed'), analysisState: c.analysisState || (hasProcessedHint ? 'analyzed' : 'not-analyzed'), processedAt: c.processedAt ?? null, archivedRawAt: c.archivedRawAt ?? null, needsReanalysis: c.needsReanalysis ?? false, needsProjectAssignment: c.needsProjectAssignment ?? (c.isNewIdea ? !c.projectId : false), candidateProjectIds: c.candidateProjectIds ?? [] };
}

export function buildDefaultData() {
  const now = Date.now(); const profile = buildDefaultPromptProfile(now);
  return { meta: { appName: 'Master Plan', schemaVersion: 2, exportType: 'full-backup', exportedAt: new Date(now).toISOString() }, settings: { activePromptProfileId: profile.id, promptProfiles: [profile] }, aiInstructions: { activePromptProfileId: profile.id, mainRole: 'You are analyzing a private mobile-first second brain system.', tone: 'Clear, direct, practical, and honest. Be brutally honest when useful, but still constructive.', goal: 'Help the user turn captured notes into useful next actions, project structure, suggestions, checklists, warnings, cleanup recommendations, and follow-up questions.', promptActions: structuredClone(DEFAULT_PROMPT_ACTIONS) }, projects: [normalizeProject({ id: 'p1', title: 'Master Plan Product', description: 'Shape v1 private system.', status: 'active' }), normalizeProject({ id: 'p2', title: 'Health Reboot', description: 'Daily routines and food plan.', status: 'active' }), normalizeProject({ id: 'p3', title: 'Backlog Ideas', description: 'Parking lot for ideas.', status: 'hidden' })], captures: [], suggestions: [], tasks: [], checklists: [], questions: [], badIdeaLog: [], inboxActionLog: [], questionFeedbackLog: [], questionLearningSettings: { enabled: true, recentQuestionLimit: 150, generationMix: { upvotedTypeRatio: 0.5, downvotedTypeRatio: 0.1, newTypeRatio: 0.4 }, avoidRecentlyDownvoted: true, preferAnsweredAndUpvoted: true } };
}

export const seedData = buildDefaultData();

export function migrateData(input) {
  const base = buildDefaultData(); const data = { ...base, ...(input || {}) };
  data.projects = (Array.isArray(input?.projects) ? input.projects : base.projects).map(normalizeProject);
  data.captures = (Array.isArray(input?.captures) ? input.captures : []).map(normalizeCapture);
  data.suggestions = (Array.isArray(input?.suggestions) ? input.suggestions : []).map(normalizeSuggestion);
  data.tasks = Array.isArray(input?.tasks) ? input.tasks : [];
  data.checklists = Array.isArray(input?.checklists) ? input.checklists : [];
  data.questions = Array.isArray(input?.questions) ? input.questions : [];
  data.badIdeaLog = Array.isArray(input?.badIdeaLog) ? input.badIdeaLog : [];
  data.inboxActionLog = Array.isArray(input?.inboxActionLog) ? input.inboxActionLog : [];
  data.questionFeedbackLog = Array.isArray(input?.questionFeedbackLog) ? input.questionFeedbackLog : [];
  data.settings = { ...base.settings, lastSelectedProjectId: null, ...(input?.settings || {}) };
  if (data.settings.lastSelectedProjectId && !data.projects.some((p) => p.id === data.settings.lastSelectedProjectId && p.status !== 'archived' && p.status !== 'hidden')) {
    data.settings.lastSelectedProjectId = data.projects.find((p) => p.status === 'active')?.id || null;
  }
  data.settings.promptProfiles = Array.isArray(data.settings.promptProfiles) && data.settings.promptProfiles.length ? data.settings.promptProfiles : [buildDefaultPromptProfile()];
  data.settings.activePromptProfileId = data.settings.activePromptProfileId || data.settings.promptProfiles[0].id;
  const activeProfile = data.settings.promptProfiles.find((p) => p.id === data.settings.activePromptProfileId) || data.settings.promptProfiles[0];
  data.aiInstructions = { ...base.aiInstructions, ...(input?.aiInstructions || {}), activePromptProfileId: data.settings.activePromptProfileId, promptActions: { ...structuredClone(DEFAULT_PROMPT_ACTIONS), ...(activeProfile?.promptActions || {}), ...(input?.aiInstructions?.promptActions || {}) } };
  data.questionLearningSettings = { ...base.questionLearningSettings, ...(input?.questionLearningSettings || {}) };
  return data;
}

export function getEnabledPromptActions(actions = {}) { return Object.fromEntries(Object.entries(actions).filter(([, value]) => value?.enabled)); }
