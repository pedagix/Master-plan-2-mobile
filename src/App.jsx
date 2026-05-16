import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { localDataStore } from './services/localDataStore';
import { isFirebaseConfigured, listenToAuthState, loadUserData, saveUserData, signInWithGoogle } from './services/firebase';
import HomePage from './pages/HomePage';
import CapturePage from './pages/CapturePage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import InboxPage from './pages/InboxPage';
import ReviewPage from './pages/ReviewPage';
import SettingsPage from './pages/SettingsPage';
import RawNotesPage from './pages/RawNotesPage';
import { buildResetData, migrateData } from './lib/model';

function LoginGate() { return <div className="stack"><h2>Sign in to Master Plan</h2><p>Use Google sign-in to sync your private data with Firebase.</p><button onClick={() => signInWithGoogle()}>Sign in with Google</button></div>; }

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
        if (remoteData && loadVersion === remoteLoadVersionRef.current) setData(migrateData(remoteData));
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

  const api = useMemo(() => ({
    data, setData, user,
    exportJson: () => localDataStore.exportFullBackup?.(data),
    exportFullBackup: () => localDataStore.exportFullBackup?.(data),
    exportAiAnalysis: () => localDataStore.exportAiAnalysis?.(data),
    importLocalDataToFirebase,
    createRollback: (reason) => localDataStore.saveRollbackSnapshot?.(data, reason),
    getLatestRollback: () => localDataStore.getLatestRollback?.(),
    getRollbacks: () => localDataStore.getRollbacks?.(),
    clearRollbacks: () => localDataStore.clearRollbacks?.(),
    deleteRollbackById: (id) => localDataStore.deleteRollbackById?.(id),
    resetAppData,
  }), [data, importLocalDataToFirebase, resetAppData, user]);

  if (isFirebaseConfigured && user === undefined) return <div className="stack"><p>Checking authentication…</p></div>;
  if (isFirebaseConfigured && !user) return <Layout><LoginGate /></Layout>;

  return <Layout><Routes>
    <Route path="/" element={<HomePage api={api} />} />
    <Route path="/capture" element={<CapturePage api={api} />} />
    <Route path="/projects" element={<ProjectsPage api={api} />} />
    <Route path="/projects/:projectId" element={<ProjectDetailPage api={api} />} />
    <Route path="/inbox" element={<InboxPage api={api} />} />
    <Route path="/review" element={<ReviewPage api={api} />} />
    <Route path="/raw-notes" element={<RawNotesPage api={api} />} />
    <Route path="/settings" element={<SettingsPage api={api} />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Layout>;
}
