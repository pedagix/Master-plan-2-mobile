import { migrateData } from './model.js';

const AI_RETURN_TYPES = new Set(['ai-analysis-return', 'ai-analyzed-return', 'ai-generated-return', 'ai-analysis-result']);
const OUTPUT_KEYS = [
  ['suggestions', 'suggestion'],
  ['tasks', 'next-step'],
  ['nextSteps', 'next-step'],
  ['checklists', 'checklist'],
  ['questions', 'follow-up-question'],
  ['cleanupRecommendations', 'cleanup-recommendation'],
  ['archiveRecommendations', 'archive-delete-recommendation'],
  ['projectRoutingRecommendations', 'project-routing-recommendation'],
  ['recommendations', 'recommendation'],
  ['generatedOutputs', 'ai-output'],
  ['aiGeneratedOutputs', 'ai-output'],
  ['importedOutputs', 'ai-output'],
  ['proposals', 'ai-output'],
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compact(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function getText(item) {
  return String(item?.text || item?.description || item?.summary || item?.recommendation || item?.question || item?.title || '').trim();
}

function getTitle(item, type) {
  if (item?.title) return String(item.title);
  if (type.includes('question')) return 'Follow-up question';
  if (type.includes('checklist')) return 'Checklist proposal';
  if (type.includes('step')) return 'Next step';
  if (type.includes('routing')) return 'Project routing recommendation';
  if (type.includes('cleanup')) return 'Cleanup recommendation';
  return getText(item).slice(0, 80) || 'AI proposal';
}

function getContainers(input) {
  const containers = [input];
  ['analysis', 'analysisResults', 'results', 'generated', 'aiGenerated', 'output'].forEach((key) => {
    if (input?.[key] && typeof input[key] === 'object' && !Array.isArray(input[key])) containers.push(input[key]);
  });
  if (input?.outputs && typeof input.outputs === 'object' && !Array.isArray(input.outputs)) containers.push(input.outputs);
  return containers;
}

function collectCandidates(input) {
  const candidates = [];
  for (const container of getContainers(input || {})) {
    for (const [key, type] of OUTPUT_KEYS) {
      for (const item of asArray(container?.[key])) candidates.push({ item, type: item?.type || type, sourceKey: key });
    }
  }
  for (const item of asArray(input?.outputs)) candidates.push({ item, type: item?.type || 'ai-output', sourceKey: 'outputs' });
  return candidates;
}

function hasGeneratedContainer(input) {
  return ['analysis', 'analysisResults', 'results', 'generated', 'aiGenerated', 'output', 'outputs', 'generatedOutputs', 'aiGeneratedOutputs', 'importedOutputs', 'proposals'].some((key) => {
    const value = input?.[key];
    return Array.isArray(value) ? value.length > 0 : value && typeof value === 'object';
  });
}

function getExistingIds(data) {
  const ids = new Set();
  ['projects', 'captures', 'suggestions', 'tasks', 'checklists', 'questions'].forEach((key) => {
    for (const item of asArray(data[key])) if (item?.id) ids.add(item.id);
  });
  return ids;
}

function normalizeProjectId(item, projectIds, problems) {
  const projectId = item?.projectId || item?.project || null;
  if (!projectId) return null;
  if (projectIds.has(projectId)) return projectId;
  problems.push(`Unknown projectId "${projectId}" on "${getTitle(item, item?.type || 'AI proposal')}". It will need project assignment.`);
  return null;
}

function createProposal(candidate, current, now, existingIds, problems) {
  const { item, sourceKey } = candidate;
  if (!item || typeof item !== 'object') return { skipped: true, problem: `Skipped invalid ${sourceKey} item.` };
  const text = getText(item);
  if (!text) return { skipped: true, problem: `Skipped ${sourceKey} item with no text, title, question, or description.` };

  const type = String(candidate.type || item.type || 'ai-output');
  const projectIds = new Set(current.projects.map((project) => project.id));
  const projectId = normalizeProjectId(item, projectIds, problems);
  const incomingId = item.id ? String(item.id) : null;
  const id = incomingId && !existingIds.has(incomingId) ? incomingId : `ai-${type}-${crypto.randomUUID()}`;
  existingIds.add(id);

  const sourceCaptureId = item.sourceCaptureId || item.captureId || item.sourceNoteId || item.noteId || null;
  return {
    id,
    type,
    title: getTitle(item, type),
    text,
    reason: item.reason || item.rationale || item.explanation || null,
    projectId,
    candidateProjectIds: compact(item.candidateProjectIds || item.projectIds),
    sourceCaptureId,
    sourceNoteId: item.sourceNoteId || sourceCaptureId,
    sourceSuggestionId: item.sourceSuggestionId || null,
    question: item.question || (type.includes('question') ? text : null),
    questionType: item.questionType || (type.includes('question') ? 'ai-imported' : null),
    items: asArray(item.items),
    originalOutput: item,
    importedAt: now,
    importedFrom: 'ai-analysis-return',
    state: 'pending',
    inboxStatus: 'pending-review',
    selectedAction: null,
    approvedAt: null,
    dismissedAt: null,
    hiddenAt: null,
    hiddenUntil: null,
    needsProjectAssignment: !projectId,
    createdAt: item.createdAt || now,
  };
}

function hasSameJson(current, key, item) {
  if (!item?.id) return false;
  const existing = asArray(current[key]).find((candidate) => candidate.id === item.id);
  return existing && JSON.stringify(existing) === JSON.stringify(item);
}

function buildAiReturnPreview(incoming, current) {
  const now = Date.now();
  const next = migrateData(current);
  const existingIds = getExistingIds(next);
  const problems = [];
  const conflicts = [];
  let skipped = 0;

  const candidates = collectCandidates(incoming);
  const proposals = [];
  for (const candidate of candidates) {
    const item = candidate.item;
    const sameExisting = ['suggestions', 'tasks', 'checklists', 'questions'].some((key) => hasSameJson(next, key, item));
    if (sameExisting) { skipped += 1; continue; }
    if (item?.id && existingIds.has(item.id)) {
      conflicts.push(item.id);
      skipped += 1;
      continue;
    }
    const proposal = createProposal(candidate, next, now, existingIds, problems);
    if (proposal.skipped) {
      skipped += 1;
      problems.push(proposal.problem);
    } else {
      proposals.push(proposal);
    }
  }

  next.suggestions = next.suggestions.map((suggestion) => (
    suggestion.state === 'hidden-until-next-analysis' && suggestion.hiddenUntil === 'next-analysis'
      ? { ...suggestion, state: 'pending', inboxStatus: 'pending-review', selectedAction: null }
      : suggestion
  ));
  next.suggestions = [...proposals, ...next.suggestions];

  if (!proposals.length) {
    problems.push('No new AI proposals were found to import.');
  }
  if (incoming?.meta?.exportType === 'ai-analysis-export' && !proposals.length) {
    problems.push('This looks like the original AI analysis export, not an analyzed return file.');
  }

  return {
    kind: 'ai-analyzed-return',
    label: 'AI-analyzed return file',
    canApply: proposals.length > 0,
    itemsToAdd: proposals.length,
    itemsToUpdate: 0,
    itemsToSkip: skipped,
    possibleConflicts: conflicts.length,
    invalidItems: problems.filter((problem) => problem.startsWith('Skipped')).length,
    itemsNeedingProjectAssignment: proposals.filter((proposal) => proposal.needsProjectAssignment).length,
    problems: [...problems, ...conflicts.map((id) => `Skipped conflicting item id "${id}" to avoid overwriting local data.`)],
    data: next,
  };
}

function buildBackupPreview(incoming, current, kind, label) {
  const next = migrateData(incoming);
  const currentData = migrateData(current);
  const sections = ['projects', 'captures', 'suggestions', 'tasks', 'checklists', 'questions', 'badIdeaLog', 'inboxActionLog', 'questionFeedbackLog'];
  const report = { itemsToAdd: 0, itemsToUpdate: 0, itemsToSkip: 0, possibleConflicts: 0, invalidItems: 0 };

  sections.forEach((key) => {
    const currentItems = asArray(currentData[key]);
    const currentIds = new Set(currentItems.map((item) => item?.id).filter(Boolean));
    asArray(next[key]).forEach((item) => {
      if (!item?.id && !key.endsWith('Log')) report.invalidItems += 1;
      else if (!item?.id) report.itemsToAdd += 1;
      else if (!currentIds.has(item.id)) report.itemsToAdd += 1;
      else if (JSON.stringify(currentItems.find((candidate) => candidate.id === item.id)) !== JSON.stringify(item)) {
        report.itemsToUpdate += 1;
        report.possibleConflicts += 1;
      } else {
        report.itemsToSkip += 1;
      }
    });
  });

  return {
    kind,
    label,
    canApply: true,
    ...report,
    itemsNeedingProjectAssignment: [
      ...next.suggestions,
      ...next.tasks,
      ...next.checklists,
      ...next.questions,
      ...next.captures,
    ].filter((item) => item?.needsProjectAssignment || (item && 'projectId' in item && !item.projectId)).length,
    problems: report.possibleConflicts ? ['This import can update existing local records. Check counts before applying.'] : [],
    data: next,
  };
}

export function buildImportPreview(incoming, current) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return { kind: 'invalid', label: 'Invalid JSON', canApply: false, problems: ['Top-level JSON must be an object.'] };
  }

  const exportType = incoming?.meta?.exportType;
  const currentData = migrateData(current);
  const existingIds = getExistingIds(currentData);
  const hasNewCandidates = collectCandidates(incoming).some(({ item }) => item && typeof item === 'object' && getText(item) && (!item.id || !existingIds.has(item.id)));

  if (AI_RETURN_TYPES.has(exportType) || incoming?.meta?.sourceExportType === 'ai-analysis-export' || hasGeneratedContainer(incoming) || (exportType === 'ai-analysis-export' && hasNewCandidates)) {
    return buildAiReturnPreview(incoming, currentData);
  }

  if (exportType === 'ai-analysis-export') {
    return {
      kind: 'ai-analysis-export',
      label: 'AI analysis export',
      canApply: false,
      itemsToAdd: 0,
      itemsToUpdate: 0,
      itemsToSkip: 0,
      possibleConflicts: 0,
      invalidItems: 0,
      itemsNeedingProjectAssignment: 0,
      problems: ['This is the file intended for ChatGPT analysis. Import the analyzed return file instead.'],
    };
  }

  if (exportType === 'full-backup') return buildBackupPreview(incoming, currentData, 'full-backup', 'Full backup');
  if (incoming.projects || incoming.captures || incoming.suggestions) return buildBackupPreview(incoming, currentData, 'old-app-export', 'Old app export');

  return { kind: 'unknown', label: 'Unknown JSON', canApply: false, problems: ['Could not recognize this JSON as an app backup or AI analysis return.'] };
}
