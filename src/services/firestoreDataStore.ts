import type { DataStore } from './dataStore';

// TODO: Implement Firestore-backed store when Firebase Auth + rules are in place.
export const firestoreDataStore: DataStore<any> = {
  load() {
    throw new Error('TODO: Firestore store not implemented yet.');
  },
  save() {
    // TODO: persist to Firestore.
  },
  exportJson(data) {
    // TODO: support server-side export flow; keeping local fallback for now.
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master-plan-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
