import { useEffect, useMemo, useState } from 'react';
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
import { migrateData } from './lib/model';

function LoginGate() { return <div className="stack"><h2>Sign in to Master Plan</h2><p>Use Google sign-in to sync your private data with Firebase.</p><button onClick={() => signInWithGoogle()}>Sign in with Google</button></div>; }

export default function App() {
  const [data, setData] = useState(() => localDataStore.load());
  const [user, setUser] = useState(undefined);

  useEffect(() => { if (!isFirebaseConfigured) { setUser(null); return; } return listenToAuthState(setUser); }, []);
  useEffect(() => { if (!isFirebaseConfigured || !user?.uid) return; loadUserData(user.uid).then((remoteData) => remoteData && setData(migrateData(remoteData))).catch((error) => console.warn('Failed to load Firestore data, using local fallback.', error)); }, [user?.uid]);
  useEffect(() => { localDataStore.save(data); if (!isFirebaseConfigured || !user?.uid) return; saveUserData(user.uid, data).catch((error) => console.warn('Failed to sync to Firestore, local copy kept.', error)); }, [data, user?.uid]);

  const importLocalDataToFirebase = async () => { if (!user?.uid) return; const localData = localDataStore.load(); await saveUserData(user.uid, localData); setData(localData); };

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
  }), [data, user]);

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
