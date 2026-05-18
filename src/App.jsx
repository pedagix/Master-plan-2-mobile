import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { localDataStore } from './services/localDataStore';
import {
  deleteAllAppDataForUser,
  isFirebaseConfigured,
  listenToAuthState,
  loadUserData,
  saveUserData,
  signInWithGoogle
} from './services/firebase';
import AhaPage from './pages/AhaPage';
import HmmPage from './pages/HmmPage';
import TaDaPage from './pages/TaDaPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import SettingsPage from './pages/SettingsPage';
import { buildResetData, migrateData } from './lib/model';

function LoginGate() { return <div className="stack"><h2>Sign in to Master Plan</h2><p>Use Google sign-in to sync your private data with Firebase.</p><button onClick={() => signInWithGoogle()}>Sign in with Google</button></div>; }

function hasMeaningfulArrayData(items = []) {
  return Array.isArray(items) && items.some((item) => item && typeof item === 'object' && Object.keys(item).length > 0);
}

function hasMeaningfulFirestoreData(remote = {}) {
  return hasMeaningfulArrayData(remote.projects) || hasMeaningfulArrayData(remote.captures) || hasMeaningfulArrayData(remote.suggestions);
}

function mergeEntityArrays(localItems = [], remoteItems = []) {
  const localById = new Map((Array.isArray(localItems) ? localItems : []).map((item, index) => [item?.id ?? `local-${index}`, item]));
  for (const [index, remoteItem] of (Array.isArray(remoteItems) ? remoteItems : []).entries()) {
    const remoteId = remoteItem?.id ?? `remote-${index}`;
    const localItem = localById.get(remoteId);
    if (!localItem) {
      localById.set(remoteId, remoteItem);
      continue;
    }
    const localUpdatedAt = Number(localItem?.updatedAt);
    const remoteUpdatedAt = Number(remoteItem?.updatedAt);
    if (Number.isFinite(localUpdatedAt) && Number.isFinite(remoteUpdatedAt)) {
      localById.set(remoteId, remoteUpdatedAt > localUpdatedAt ? remoteItem : localItem);
      continue;
    }
    localById.set(remoteId, localItem);
  }
  return [...localById.values()];
}

function mergeRemoteIntoLocal(localData, remoteData) {
  const local = migrateData(localData);
  const remote = migrateData(remoteData || {});
  const remoteResetAt = Date.parse(remote?.meta?.destructiveResetAt || '');
  const localResetAt = Date.parse(local?.meta?.destructiveResetAt || '');
  if (Number.isFinite(remoteResetAt) && (!Number.isFinite(localResetAt) || remoteResetAt >= localResetAt)) {
    return remote;
  }
  if (Number.isFinite(localResetAt) && (!Number.isFinite(remoteResetAt) || remoteResetAt < localResetAt)) {
    return migrateData({
      ...local,
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'meta') ? { meta: { ...remote.meta, destructiveResetAt: local.meta.destructiveResetAt } } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'settings') ? { settings: remote.settings } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'aiInstructions') ? { aiInstructions: remote.aiInstructions } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'questionLearningSettings') ? { questionLearningSettings: remote.questionLearningSettings } : {}),
      projects: [],
      captures: [],
      suggestions: [],
      notes: [],
      completedTasks: [],
      tasks: [],
      checklists: [],
      questions: [],
      badIdeaLog: [],
      inboxActionLog: [],
      questionFeedbackLog: [],
    });
  }
  const has = (key) => Object.prototype.hasOwnProperty.call(remoteData || {}, key);
  return migrateData({
    ...local,
    ...(has("meta") ? { meta: remote.meta } : {}),
    ...(has("settings") ? { settings: remote.settings } : {}),
    ...(has("aiInstructions") ? { aiInstructions: remote.aiInstructions } : {}),
    ...(has("notes") ? { notes: remote.notes } : {}),
    ...(has("completedTasks") ? { completedTasks: remote.completedTasks } : {}),
    ...(has("tasks") ? { tasks: remote.tasks } : {}),
    ...(has("checklists") ? { checklists: remote.checklists } : {}),
    ...(has("questions") ? { questions: remote.questions } : {}),
    ...(has("badIdeaLog") ? { badIdeaLog: remote.badIdeaLog } : {}),
    ...(has("inboxActionLog") ? { inboxActionLog: remote.inboxActionLog } : {}),
    ...(has("questionFeedbackLog") ? { questionFeedbackLog: remote.questionFeedbackLog } : {}),
    ...(has("questionLearningSettings") ? { questionLearningSettings: remote.questionLearningSettings } : {}),
    projects: mergeEntityArrays(local.projects, remote.projects),
    captures: mergeEntityArrays(local.captures, remote.captures),
    suggestions: mergeEntityArrays(local.suggestions, remote.suggestions),
  });
}

export default function App() {
  const [data, setData] = useState(() => localDataStore.load());
  const [user, setUser] = useState(undefined);
  const [isRemoteHydrationComplete, setIsRemoteHydrationComplete] = useState(!isFirebaseConfigured);
  const remoteLoadVersionRef = useRef(0);
  const remoteSaveQueueRef = useRef(Promise.resolve());
  const enqueueRemoteSave = useCallback((uid, nextData) => {
    const save = remoteSaveQueueRef.current
      .catch(() => {})
      .then(() => saveUserData(uid, nextData));
    remoteSaveQueueRef.current = save.catch(() => {});
    return save;
  }, []);

  useEffect(() => { if (!isFirebaseConfigured) { setUser(null); return; } return listenToAuthState(setUser); }, []);
  useEffect(() => {
    if (!isFirebaseConfigured || !user?.uid) return;
    setIsRemoteHydrationComplete(false);
    const loadVersion = ++remoteLoadVersionRef.current;
    loadUserData(user.uid)
      .then((remoteData) => {
        if (loadVersion !== remoteLoadVersionRef.current) return;
        setData((previous) => {
          const merged = mergeRemoteIntoLocal(previous, remoteData);
          if (!hasMeaningfulFirestoreData(remoteData) && hasMeaningfulFirestoreData(previous)) {
            enqueueRemoteSave(user.uid, merged).catch((error) => console.warn('Failed to seed Firestore from local data.', error));
          }
          return merged;
        });
        setIsRemoteHydrationComplete(true);
      })
      .catch((error) => {
        console.warn('Failed to load Firestore data, using local fallback.', error);
        if (loadVersion === remoteLoadVersionRef.current) setIsRemoteHydrationComplete(true);
      });
  }, [enqueueRemoteSave, user?.uid]);
  useEffect(() => {
    localDataStore.save(data);
    if (!isFirebaseConfigured || !user?.uid || !isRemoteHydrationComplete) return;
    enqueueRemoteSave(user.uid, data).catch((error) => console.warn('Failed to sync to Firestore, local copy kept.', error));
  }, [data, enqueueRemoteSave, isRemoteHydrationComplete, user?.uid]);

  const importLocalDataToFirebase = useCallback(async () => {
    if (!user?.uid) return;
    const localData = localDataStore.load();
    await enqueueRemoteSave(user.uid, localData);
    setData(localData);
  }, [enqueueRemoteSave, user?.uid]);
  const resetAppData = useCallback(async () => {
    remoteLoadVersionRef.current += 1;
    const resetData = buildResetData();
    localDataStore.save(resetData);
    localDataStore.clearRollbacks?.();
    setData(resetData);
    if (isFirebaseConfigured && user?.uid) await enqueueRemoteSave(user.uid, resetData);
    return resetData;
  }, [enqueueRemoteSave, user?.uid]);
  const deleteAllAppData = useCallback(async () => {
    remoteLoadVersionRef.current += 1;
    setIsRemoteHydrationComplete(!isFirebaseConfigured || !user?.uid);
    const rollbackSnapshot = localDataStore.saveRollbackSnapshot?.(data, 'Before deleting all app data');
    const destructiveResetAt = new Date().toISOString();
    const baseResetData = buildResetData();
    const cleaned = migrateData({
      ...baseResetData,
      meta: {
        ...baseResetData.meta,
        destructiveResetAt,
      },
    });
    localDataStore.save(cleaned);
    localDataStore.clearRollbacks?.();
    const removedLegacyKeys = localDataStore.clearLegacyNoteLocalKeys?.() || [];
    setData(cleaned);
    let purgeReport = null;
    if (isFirebaseConfigured && user?.uid) {
      purgeReport = await deleteAllAppDataForUser(user.uid, cleaned);
    }
    return { rollbackSnapshotId: rollbackSnapshot?.id || null, localRemovedKeys: removedLegacyKeys, purgeReport };
  }, [data, user?.uid]);

  const api = useMemo(() => ({
    data, setData, user,
    exportJson: () => localDataStore.exportFullBackup?.(data),
    exportFullBackup: () => localDataStore.exportFullBackup?.(data),
    importLocalDataToFirebase,
    createRollback: (reason) => localDataStore.saveRollbackSnapshot?.(data, reason),
    getLatestRollback: () => localDataStore.getLatestRollback?.(),
    getRollbacks: () => localDataStore.getRollbacks?.(),
    clearRollbacks: () => localDataStore.clearRollbacks?.(),
    deleteRollbackById: (id) => localDataStore.deleteRollbackById?.(id),
    resetAppData,
    deleteAllAppData,
  }), [data, deleteAllAppData, importLocalDataToFirebase, resetAppData, user]);

  if (isFirebaseConfigured && user === undefined) return <div className="stack"><p>Checking authentication...</p></div>;
  if (isFirebaseConfigured && !user) return <Layout><LoginGate /></Layout>;

  return <Layout><Routes>
    <Route path="/" element={<Navigate to="/aha" replace />} />
    <Route path="/aha" element={<AhaPage api={api} />} />
    <Route path="/hmm" element={<HmmPage api={api} />} />
    <Route path="/ta-da" element={<TaDaPage api={api} />} />
    <Route path="/projects/:projectId" element={<ProjectDetailPage api={api} />} />
    <Route path="/capture" element={<Navigate to="/aha" replace />} />
    <Route path="/projects" element={<Navigate to="/ta-da" replace />} />
    <Route path="/notes-processor" element={<Navigate to="/hmm" replace />} />
    <Route path="/inbox" element={<Navigate to="/hmm" replace />} />
    <Route path="/ideas" element={<Navigate to="/hmm" replace />} />
    <Route path="/raw-notes" element={<Navigate to="/hmm" replace />} />
    <Route path="/settings" element={<SettingsPage api={api} />} />
    <Route path="*" element={<Navigate to="/aha" replace />} />
  </Routes></Layout>;
}
