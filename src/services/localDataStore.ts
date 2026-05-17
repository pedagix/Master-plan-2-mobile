import { buildDefaultData, getEnabledPromptActions, migrateData } from '../lib/model';
import type { DataStore } from './dataStore';

const KEY = 'master_plan_v1';
const ROLLBACK_KEY = 'master_plan_rollbacks_v1';
const MAX_ROLLBACKS = 3;

function loadData() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return buildDefaultData();
  try { return migrateData(JSON.parse(raw)); } catch { return buildDefaultData(); }
}

function saveData(data) { localStorage.setItem(KEY, JSON.stringify(migrateData(data))); }

function downloadJson(payload, name) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  URL.revokeObjectURL(url);
}

function exportFullBackup(data) {
  downloadJson({ ...migrateData(data), meta: { ...(data.meta || {}), appName: 'Master Plan', schemaVersion: 2, exportType: 'full-backup', exportedAt: new Date().toISOString() } }, 'master-plan-full-backup');
}

function exportAiAnalysis(data) {
  const migrated = migrateData(data);
  const capturesForAnalysis = migrated.captures.filter((c) => Array.isArray(c.processingTags) && c.processingTags.length > 0 && (c.rawState !== 'archived' || c.needsReanalysis));
  const selectedProcessingTags = [...new Set(capturesForAnalysis.flatMap((c) => c.processingTags))];
  const enabledPromptActions = getEnabledPromptActions(migrated.aiInstructions.promptActions);
  const selectedPromptActions = Object.fromEntries(Object.entries(enabledPromptActions).filter(([id]) => selectedProcessingTags.includes(id)));
  const payload = {
    meta: { appName: 'Master Plan', schemaVersion: 2, exportType: 'ai-analysis-export', exportedAt: new Date().toISOString(), exportedNoteCount: capturesForAnalysis.length, selectedProcessingTags },
    settings: migrated.settings,
    aiInstructions: { ...migrated.aiInstructions, promptActions: selectedPromptActions },
    projects: migrated.projects, captures: capturesForAnalysis, suggestions: migrated.suggestions,
    questions: migrated.questions, tasks: migrated.tasks, checklists: migrated.checklists, badIdeaLog: migrated.badIdeaLog, inboxActionLog: migrated.inboxActionLog, questionFeedbackLog: migrated.questionFeedbackLog, questionLearningSettings: migrated.questionLearningSettings
  };
  downloadJson(payload, 'master-plan-ai-analysis');
}

function getRollbacks() {
  try { return JSON.parse(localStorage.getItem(ROLLBACK_KEY) || '[]'); } catch { return []; }
}

function saveRollbackSnapshot(state, reason) {
  const migrated = migrateData(state);
  const entry = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    reason,
    counts: {
      projects: migrated.projects.length,
      notes: migrated.notes?.length || 0,
      captures: migrated.captures.length,
      suggestions: migrated.suggestions.length,
      questions: migrated.questions.length,
      completedTasks: migrated.completedTasks?.length || 0,
      includesSettings: !!migrated.settings,
    },
    state: migrated,
  };
  const next = [entry, ...getRollbacks()].slice(0, MAX_ROLLBACKS);
  localStorage.setItem(ROLLBACK_KEY, JSON.stringify(next));
  return entry;
}

function getLatestRollback() { return getRollbacks()[0] || null; }
function deleteRollbackById(id) {
  const next = getRollbacks().filter((entry) => entry.id !== id);
  localStorage.setItem(ROLLBACK_KEY, JSON.stringify(next));
}
function clearRollbacks() { localStorage.removeItem(ROLLBACK_KEY); }

export const localDataStore: DataStore<any> = {
  load: loadData,
  save: saveData,
  exportJson: exportFullBackup,
  exportFullBackup,
  exportAiAnalysis,
  saveRollbackSnapshot,
  getLatestRollback,
  getRollbacks,
  clearRollbacks,
  deleteRollbackById,
};
