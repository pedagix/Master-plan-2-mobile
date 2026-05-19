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

const DEBUG_DATA_FLOW = typeof window !== 'undefined' && window.localStorage?.getItem('mp_debug_data_flow') === '1';

function debugDataCounts(label, data = {}) {
  if (!DEBUG_DATA_FLOW) return;
  const payload = migrateData(data || {});
  // eslint-disable-next-line no-console
  console.log(`[data-flow] ${label}`, {
    projects: payload.projects?.length ?? 0,
    captures: payload.captures?.length ?? 0,
    notes: payload.notes?.length ?? 0,
    suggestions: payload.suggestions?.length ?? 0,
    tasks: payload.tasks?.length ?? 0,
    completedTasks: payload.completedTasks?.length ?? 0,
    checklists: payload.checklists?.length ?? 0,
    questions: payload.questions?.length ?? 0,
    destructiveResetAt: payload.meta?.destructiveResetAt ?? null,
    lastSelectedProjectId: payload.settings?.lastSelectedProjectId ?? null,
    lastDestination: payload.settings?.lastDestination ?? null,
  });
}

function LoginGate() { return <div className="stack"><h2>Sign in to Master Plan</h2><p>Use Google sign-in to sync your private data with Firebase.</p><button onClick={() => signInWithGoogle()}>Sign in with Google</button></div>; }

function hasMeaningfulArrayData(items = []) {
  return Array.isArray(items) && items.some((item) => item && typeof item === 'object' && Object.keys(item).length > 0);
}

function hasMeaningfulFirestoreData(remote = {}) {
  return hasMeaningfulArrayData(remote.projects) || hasMeaningfulArrayData(remote.captures) || hasMeaningfulArrayData(remote.suggestions);
}

function parseTimeMs(value) {
  if (value == null) return Number.NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === 'string') {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) return numericValue;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      const millis = value.toMillis();
      return Number.isFinite(millis) ? millis : Number.NaN;
    }
    if (typeof value.seconds === 'number') {
      const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
      const millis = (value.seconds * 1000) + Math.floor(nanos / 1e6);
      return Number.isFinite(millis) ? millis : Number.NaN;
    }
  }
  return Number.NaN;
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
    const localUpdatedAt = parseTimeMs(localItem?.updatedAt);
    const remoteUpdatedAt = parseTimeMs(remoteItem?.updatedAt);
    if (Number.isFinite(localUpdatedAt) && Number.isFinite(remoteUpdatedAt)) {
      localById.set(remoteId, remoteUpdatedAt > localUpdatedAt ? remoteItem : localItem);
      continue;
    }
    localById.set(remoteId, localItem);
  }
  return [...localById.values()];
}

function hasPostResetEntities(items = [], resetAtMs = Number.NaN) {
  if (!Number.isFinite(resetAtMs)) return false;
  return (Array.isArray(items) ? items : []).some((item) => {
    const createdAt = parseTimeMs(item?.createdAt);
    const updatedAt = parseTimeMs(item?.updatedAt);
    return (Number.isFinite(createdAt) && createdAt >= resetAtMs) || (Number.isFinite(updatedAt) && updatedAt >= resetAtMs);
  });
}

function filterPreResetEntities(items = [], resetAtMs = Number.NaN) {
  if (!Number.isFinite(resetAtMs)) return Array.isArray(items) ? items : [];
  return (Array.isArray(items) ? items : []).filter((item) => {
    const createdAt = parseTimeMs(item?.createdAt);
    const updatedAt = parseTimeMs(item?.updatedAt);
    if (!Number.isFinite(createdAt) && !Number.isFinite(updatedAt)) return false;
    return (Number.isFinite(createdAt) && createdAt >= resetAtMs) || (Number.isFinite(updatedAt) && updatedAt >= resetAtMs);
  });
}

function mergeRemoteIntoLocal(localData, remoteData) {
  const local = migrateData(localData);
  const remote = migrateData(remoteData || {});
  debugDataCounts('mergeRemoteIntoLocal:local-in', local);
  debugDataCounts('mergeRemoteIntoLocal:remote-in', remoteData || {});
  const remoteResetAt = Date.parse(remote?.meta?.destructiveResetAt || '');
  const localResetAt = Date.parse(local?.meta?.destructiveResetAt || '');
  const hasLocalPostResetData = hasPostResetEntities(local.projects, localResetAt) || hasPostResetEntities(local.captures, localResetAt) || hasPostResetEntities(local.suggestions, localResetAt) || hasPostResetEntities(local.notes, localResetAt);

  if (Number.isFinite(remoteResetAt) && (!Number.isFinite(localResetAt) || remoteResetAt > localResetAt)) {
    const merged = migrateData({
      ...remote,
      projects: filterPreResetEntities(remote.projects, remoteResetAt),
      captures: filterPreResetEntities(remote.captures, remoteResetAt),
      suggestions: filterPreResetEntities(remote.suggestions, remoteResetAt),
      notes: mergeEntityArrays(filterPreResetEntities(local.notes, remoteResetAt), filterPreResetEntities(remote.notes, remoteResetAt)),
    });
    debugDataCounts('mergeRemoteIntoLocal:remote-reset-wins', merged);
    return merged;
  }
  if (Number.isFinite(remoteResetAt) && Number.isFinite(localResetAt) && remoteResetAt === localResetAt) {
    if (!hasMeaningfulFirestoreData(remote) && hasLocalPostResetData) return local;
    const merged = migrateData({
      ...local,
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'meta') ? { meta: remote.meta } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'settings') ? { settings: remote.settings } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'aiInstructions') ? { aiInstructions: remote.aiInstructions } : {}),
      notes: mergeEntityArrays(local.notes, filterPreResetEntities(remote.notes, remoteResetAt)),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'completedTasks') ? { completedTasks: remote.completedTasks } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'tasks') ? { tasks: remote.tasks } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'checklists') ? { checklists: remote.checklists } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'questions') ? { questions: remote.questions } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'badIdeaLog') ? { badIdeaLog: remote.badIdeaLog } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'inboxActionLog') ? { inboxActionLog: remote.inboxActionLog } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'questionFeedbackLog') ? { questionFeedbackLog: remote.questionFeedbackLog } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'questionLearningSettings') ? { questionLearningSettings: remote.questionLearningSettings } : {}),
      projects: mergeEntityArrays(local.projects, filterPreResetEntities(remote.projects, remoteResetAt)),
      captures: mergeEntityArrays(local.captures, filterPreResetEntities(remote.captures, remoteResetAt)),
      suggestions: mergeEntityArrays(local.suggestions, filterPreResetEntities(remote.suggestions, remoteResetAt)),
    });
    debugDataCounts('mergeRemoteIntoLocal:equal-reset-merged', merged);
    return merged;
  }
  if (Number.isFinite(localResetAt) && (!Number.isFinite(remoteResetAt) || remoteResetAt < localResetAt)) {
    const merged = migrateData({
      ...local,
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'meta') ? { meta: { ...remote.meta, destructiveResetAt: local.meta.destructiveResetAt } } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'settings') ? { settings: remote.settings } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'aiInstructions') ? { aiInstructions: remote.aiInstructions } : {}),
      ...(Object.prototype.hasOwnProperty.call(remoteData || {}, 'questionLearningSettings') ? { questionLearningSettings: remote.questionLearningSettings } : {}),
      projects: local.projects,
      captures: local.captures,
      suggestions: local.suggestions,
      notes: local.notes,
      completedTasks: local.completedTasks,
      tasks: local.tasks,
      checklists: local.checklists,
      questions: local.questions,
      badIdeaLog: local.badIdeaLog,
      inboxActionLog: local.inboxActionLog,
      questionFeedbackLog: local.questionFeedbackLog,
    });
    debugDataCounts('mergeRemoteIntoLocal:local-reset-wins', merged);
    return merged;
  }
  const has = (key) => Object.prototype.hasOwnProperty.call(remoteData || {}, key);
  const merged = migrateData({
    ...local,
    ...(has("meta") ? { meta: remote.meta } : {}),
    ...(has("settings") ? { settings: remote.settings } : {}),
    ...(has("aiInstructions") ? { aiInstructions: remote.aiInstructions } : {}),
    notes: mergeEntityArrays(local.notes, remote.notes),
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
  debugDataCounts('mergeRemoteIntoLocal:default-merged', merged);
  return merged;
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
        debugDataCounts('loadUserData:remote-result', remoteData);
        if (loadVersion !== remoteLoadVersionRef.current) return;
        setData((previous) => {
          debugDataCounts('setData:before-remote-merge', previous);
          const merged = mergeRemoteIntoLocal(previous, remoteData);
          debugDataCounts('setData:after-remote-merge', merged);
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
    debugDataCounts('local-save:before', data);
    localDataStore.save(data);
    if (!isFirebaseConfigured || !user?.uid || !isRemoteHydrationComplete) return;
    debugDataCounts('saveUserData:payload', data);
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
    if (DEBUG_DATA_FLOW) console.log('[data-flow] deleteAllAppData:start');
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
    if (DEBUG_DATA_FLOW) console.log('[data-flow] deleteAllAppData:end', purgeReport);
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
