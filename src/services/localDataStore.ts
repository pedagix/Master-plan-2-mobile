import { buildDefaultData, buildGlobalNoteCleanupData, migrateData } from '../lib/model';
import type { DataStore } from './dataStore';

const KEY = 'master_plan_v1';
const ROLLBACK_KEY = 'master_plan_rollbacks_v1';
const MAX_ROLLBACKS = 3;
const LEGACY_NOTE_LOCAL_KEYS = [
  'master_plan_notes_v1',
  'master_plan_raw_notes_v1',
  'master_plan_captures_v1',
  'master_plan_inbox_v1',
  'master_plan_inbox_groups_v1',
  'master_plan_note_groups_v1',
  'master_plan_suggestions_v1',
  'master_plan_tasks_v1',
  'master_plan_checklists_v1',
  'master_plan_questions_v1',
  'master_plan_ai_analysis_v1',
  'master_plan_ai_import_v1',
  'master_plan_ai_export_v1',
  'master_plan_notes_processor_v1',
];
const DEBUG_DATA_FLOW = typeof window !== 'undefined' && window.localStorage?.getItem('mp_debug_data_flow') === '1';

function debugDataCounts(label, data: any) {
  if (!DEBUG_DATA_FLOW) return;
  const migrated = migrateData(data);
  // eslint-disable-next-line no-console
  console.log(`[data-flow] ${label}`, {
    projects: migrated.projects.length,
    captures: migrated.captures.length,
    notes: migrated.notes?.length || 0,
    suggestions: migrated.suggestions.length,
    tasks: migrated.tasks.length,
    completedTasks: migrated.completedTasks?.length || 0,
    taskSessions: migrated.taskSessions?.length || 0,
    activeTask: migrated.activeTask?.taskNoteId || null,
    checklists: migrated.checklists.length,
    questions: migrated.questions.length,
    destructiveResetAt: migrated.meta?.destructiveResetAt ?? null,
    lastSelectedProjectId: migrated.settings?.lastSelectedProjectId ?? null,
    lastDestination: migrated.settings?.lastDestination ?? null,
  });
}

function loadData() {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    const defaults = buildDefaultData();
    debugDataCounts('localDataStore.load:default', defaults);
    return defaults;
  }
  try {
    const migrated = migrateData(JSON.parse(raw));
    debugDataCounts('localDataStore.load:stored', migrated);
    return migrated;
  } catch {
    const defaults = buildDefaultData();
    debugDataCounts('localDataStore.load:parse-fallback', defaults);
    return defaults;
  }
}

function saveData(data) {
  const migrated = migrateData(data);
  debugDataCounts('localDataStore.save', migrated);
  localStorage.setItem(KEY, JSON.stringify(migrated));
}

function downloadJson(payload, name) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  URL.revokeObjectURL(url);
}

function exportFullBackup(data) {
  downloadJson({ ...migrateData(data), meta: { ...(data.meta || {}), appName: 'Master Plan', schemaVersion: 7, exportType: 'full-backup', exportedAt: new Date().toISOString() } }, 'master-plan-full-backup');
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
    taskSessions: migrated.taskSessions?.length || 0,
    activeTask: migrated.activeTask?.taskNoteId || null,
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

function clearLegacyNoteLocalKeys() {
  const removedKeys = [];
  const keep = new Set([KEY]);
  for (const key of LEGACY_NOTE_LOCAL_KEYS) {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      removedKeys.push(key);
    }
  }
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const key = localStorage.key(i);
    if (!key || keep.has(key) || removedKeys.includes(key)) continue;
    if (!key.startsWith('master_plan_')) continue;
    const lower = key.toLowerCase();
    const looksLikeLegacyNoteKey = (
      lower.includes('note')
      || lower.includes('capture')
      || lower.includes('inbox')
      || lower.includes('analysis')
      || lower.includes('suggestion')
      || lower.includes('processor')
      || lower.includes('review')
      || lower.includes('import')
      || lower.includes('export')
      || lower.includes('raw')
    );
    if (!looksLikeLegacyNoteKey) continue;
    localStorage.removeItem(key);
    removedKeys.push(key);
  }
  return removedKeys;
}

function purgeLocalNoteData(data) {
  const cleaned = buildGlobalNoteCleanupData(data);
  saveData(cleaned);
  clearRollbacks();
  const removedLegacyKeys = clearLegacyNoteLocalKeys();
  return { data: cleaned, removedLegacyKeys };
}

export const localDataStore: DataStore<any> = {
  load: loadData,
  save: saveData,
  exportJson: exportFullBackup,
  exportFullBackup,
  saveRollbackSnapshot,
  getLatestRollback,
  getRollbacks,
  clearRollbacks,
  deleteRollbackById,
  clearLegacyNoteLocalKeys,
  purgeLocalNoteData,
};
