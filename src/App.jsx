import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import Layout from './components/Layout';
import { localDataStore } from './services/localDataStore';
import { auth, googleProvider, isFirebaseConfigured } from './services/firebase';
import { loadUserData, saveUserData } from './services/firestoreDataStore';
import HomePage from './pages/HomePage';
import CapturePage from './pages/CapturePage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import InboxPage from './pages/InboxPage';
import ReviewPage from './pages/ReviewPage';
import SettingsPage from './pages/SettingsPage';

function LoginScreen() {
  const [error, setError] = useState('');
  const handleSignIn = async () => {
    try {
      setError('');
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError(e.message || 'Login failed');
    }
  };

  return (
    <div className="login-screen">
      <div className="card">
        <h2>Master Plan</h2>
        <p>Sign in with Google to access your private workspace.</p>
        <button onClick={handleSignIn}>Sign in with Google</button>
        {error ? <p>{error}</p> : null}
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(() => localDataStore.load());
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          const cloudData = await loadUserData(nextUser.uid);
          setData(cloudData.projects?.length || cloudData.captures?.length || cloudData.suggestions?.length ? cloudData : localDataStore.load());
        } catch (e) {
          console.warn('Failed to load Firestore data; using local fallback.', e);
          setData(localDataStore.load());
        }
      } else {
        setData(localDataStore.load());
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    localDataStore.save(data);
    if (isFirebaseConfigured && user) {
      saveUserData(user.uid, data).catch((e) => {
        console.warn('Failed to save to Firestore; local data retained.', e);
      });
    }
  }, [data, user]);

  const api = useMemo(() => ({
    data,
    setData,
    user,
    isFirebaseConfigured,
    signOut: () => (auth ? signOut(auth) : Promise.resolve()),
    exportJson: () => localDataStore.exportJson(data),
  }), [data, user]);

  if (authLoading) return <div className="stack"><p>Loading account…</p></div>;
  if (isFirebaseConfigured && !user) return <LoginScreen />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage api={api} />} />
        <Route path="/capture" element={<CapturePage api={api} />} />
        <Route path="/projects" element={<ProjectsPage api={api} />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage api={api} />} />
        <Route path="/inbox" element={<InboxPage api={api} />} />
        <Route path="/review" element={<ReviewPage api={api} />} />
        <Route path="/settings" element={<SettingsPage api={api} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
