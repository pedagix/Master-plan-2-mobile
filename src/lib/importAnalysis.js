import { migrateData } from './model.js';

const LEGACY_AI_EXPORT_TYPES = new Set(['ai-analysis-export', 'ai-analysis-return', 'ai-analyzed-return', 'ai-generated-return', 'ai-analysis-result']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasLegacyAiContainer(input) {
  return ['analysis', 'analysisResults', 'results', 'generated', 'aiGenerated', 'output', 'outputs', 'generatedOutputs', 'aiGeneratedOutputs', 'importedOutputs', 'proposals'].some((key) => {
    const value = input?.[key];
    return Array.isArray(value) ? value.length > 0 : value && typeof value === 'object';
  });
}

function buildBackupPreview(incoming, current, kind, label) {
  const next = migrateData(incoming);
  const currentData = migrateData(current);
  const sections = ['projects', 'notes', 'completedTasks', 'captures', 'suggestions', 'tasks', 'checklists', 'questions', 'badIdeaLog', 'inboxActionLog', 'questionFeedbackLog'];
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
      ...next.notes,
    ].filter((item) => item?.needsProjectAssignment || (item && 'projectId' in item && !item.projectId && item.destination !== 'hmm')).length,
    problems: report.possibleConflicts ? ['This import can update existing local records. Check counts before applying.'] : [],
    data: next,
  };
}

export function buildImportPreview(incoming, current) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return { kind: 'invalid', label: 'Invalid JSON', canApply: false, problems: ['Top-level JSON must be an object.'] };
  }

  const exportType = incoming?.meta?.exportType;
  if (LEGACY_AI_EXPORT_TYPES.has(exportType) || incoming?.meta?.sourceExportType === 'ai-analysis-export' || hasLegacyAiContainer(incoming)) {
    return {
      kind: 'legacy-ai-import',
      label: 'Legacy AI analysis import (disabled)',
      canApply: false,
      itemsToAdd: 0,
      itemsToUpdate: 0,
      itemsToSkip: 0,
      possibleConflicts: 0,
      invalidItems: 0,
      itemsNeedingProjectAssignment: 0,
      problems: ['Legacy AI analysis export/import files are no longer supported in the current Aha/Hmm/Ta-da workflow.'],
    };
  }

  if (exportType === 'full-backup') return buildBackupPreview(incoming, current, 'full-backup', 'Full backup');
  if (incoming.projects || incoming.notes || incoming.captures || incoming.suggestions) return buildBackupPreview(incoming, current, 'old-app-export', 'Old app export');

  return { kind: 'unknown', label: 'Unknown JSON', canApply: false, problems: ['Could not recognize this JSON as an app backup.'] };
}
