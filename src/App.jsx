import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { localDataStore } from './services/localDataStore';
import HomePage from './pages/HomePage';
import CapturePage from './pages/CapturePage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import InboxPage from './pages/InboxPage';
import ReviewPage from './pages/ReviewPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const [data, setData] = useState(() => localDataStore.load());

  useEffect(() => localDataStore.save(data), [data]);

  const api = useMemo(() => ({
    data,
    setData,
    exportJson: () => localDataStore.exportJson(data)
  }), [data]);

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
