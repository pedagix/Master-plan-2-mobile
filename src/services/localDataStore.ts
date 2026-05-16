import { seedData } from '../lib/model';
import type { DataStore } from './dataStore';

const KEY = 'master_plan_v1';

function loadData() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return structuredClone(seedData);
  try {
    return JSON.parse(raw);
  } catch {
    return structuredClone(seedData);
  }
}

function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function exportData(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `master-plan-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export const localDataStore: DataStore<any> = {
  load: loadData,
  save: saveData,
  exportJson: exportData,
};
