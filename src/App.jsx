import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { localDataStore } from './services/localDataStore';
import {
  deleteAllNoteDataForAllUsers,
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
import { buildGlobalNoteCleanupData, buildResetData, migrateData } from './lib/model';

function LoginGate() { return <div className="stack"><h2>Sign in to Master Plan</h2><p>Use Google sign-in to sync your private data with Firebase.</p><button onClick={() => signInWithGoogle()}>Sign in with Google</button></div>; }

function mergeRemoteIntoLocal(localData, remoteData) {
  const local = migrateData(localData);
  const remote = migrateData(remoteData || {});
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
    projects: remote.projects,
    captures: remote.captures,
    suggestions: remote.suggestions,
  });
}

export default function App() {
  const [data, setData] = useState(() => localDataStore.load());
  const [user, setUser] = useState(undefined);
  const remoteLoadVersionRef = useRef(0);
  const remoteSaveQueueRef = useRef(Promise.resolve());

  useEffect(() => { if (!isFirebaseConfigured) { setUser(null); return; } return listenToAuthState(setUser); }, []);
  useEffect(() => {
    if (!isFirebaseConfigured || !user?.uid) return;
    const loadVersion = ++remoteLoadVersionRef.current;
    loadUserData(user.uid)
      .then((remoteData) => {
        if (remoteData && loadVersion === remoteLoadVersionRef.current) {
          setData((previous) => mergeRemoteIntoLocal(previous, remoteData));
        }
      })
      .catch((error) => console.warn('Failed to load Firestore data, using local fallback.', error));
  }, [user?.uid]);
  const enqueueRemoteSave = useCallback((uid, nextData) => {
    const save = remoteSaveQueueRef.current
      .catch(() => {})
      .then(() => saveUserData(uid, nextData));
    remoteSaveQueueRef.current = save.catch(() => {});
    return save;
  }, []);

  useEffect(() => {
    localDataStore.save(data);
    if (!isFirebaseConfigured || !user?.uid) return;
    enqueueRemoteSave(user.uid, data).catch((error) => console.warn('Failed to sync to Firestore, local copy kept.', error));
  }, [data, enqueueRemoteSave, user?.uid]);

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
  const deleteAllNotesForAllUsers = useCallback(async () => {
    remoteLoadVersionRef.current += 1;
    const remoteReport = isFirebaseConfigured
      ? await deleteAllNoteDataForAllUsers()
      : {
        touchedUsers: 0,
        deletedDocs: 0,
        patchedUserDocs: 0,
        patchedProjectDocs: 0,
        patchedGalleryDocs: 0,
        collectionGroupsDeleted: {},
        cleanupErrors: [],
      };
    const localResult = localDataStore.purgeLocalNoteData?.(data);
    const cleaned = localResult?.data || buildGlobalNoteCleanupData(data);
    setData(cleaned);
    if (isFirebaseConfigured && user?.uid) await enqueueRemoteSave(user.uid, cleaned);
    return { ...remoteReport, localRemovedKeys: localResult?.removedLegacyKeys || [] };
  }, [data, enqueueRemoteSave, user?.uid]);

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
    deleteAllNotesForAllUsers,
  }), [data, deleteAllNotesForAllUsers, importLocalDataToFirebase, resetAppData, user]);

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
