import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import { localDataStore } from './services/localDataStore';
import AhaPage from './pages/AhaPage';
import HmmPage from './pages/HmmPage';
import TaDaPage from './pages/TaDaPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import { buildResetData, migrateData } from './lib/model';
import {
  addMasterPlanNotificationActionListener,
  syncBackupReminderNotifications,
  syncTaskNotifications,
} from './services/notificationScheduler';
import {
  getDriveBackupStatus,
  saveDriveBackup,
} from './services/backupService';

const DAY_MS = 24 * 60 * 60 * 1000;

const DEBUG_DATA_FLOW = typeof window !== 'undefined' && window.localStorage?.getItem('mp_debug_data_flow') === '1';

function debugDataCounts(label, data = {}) {
  if (!DEBUG_DATA_FLOW) return;
  const payload = migrateData(data || {});
  // eslint-disable-next-line no-console
  console.log(`[data-flow] ${label}`, {
    projects: payload.projects?.length ?? 0,
    notes: payload.notes?.length ?? 0,
    completedTasks: payload.completedTasks?.length ?? 0,
    taskSessions: payload.taskSessions?.length ?? 0,
    activeTask: payload.activeTask?.taskNoteId ?? null,
    lastSuccessfulBackupAt: payload.settings?.lastSuccessfulBackupAt ?? null,
  });
}

export default function App() {
  const navigate = useNavigate();
  const [data, setData] = useState(() => localDataStore.load());
  const dataRef = useRef(data);
  dataRef.current = data;
  const [noteSaveConfirmation, setNoteSaveConfirmation] = useState({ visible: false, id: 0 });
  const noteSaveConfirmationTimerRef = useRef(null);

  const setDataPersisted = useCallback((nextOrUpdater) => {
    const previous = dataRef.current;
    const candidate = typeof nextOrUpdater === 'function' ? nextOrUpdater(previous) : nextOrUpdater;
    const next = migrateData(candidate);
    dataRef.current = next;
    localDataStore.save(next);
    setData(next);
  }, []);

  const showNoteSavedConfirmation = useCallback(() => {
    setNoteSaveConfirmation((current) => ({ visible: true, id: current.id + 1 }));
    window.clearTimeout(noteSaveConfirmationTimerRef.current);
    noteSaveConfirmationTimerRef.current = window.setTimeout(() => {
      setNoteSaveConfirmation((current) => ({ ...current, visible: false }));
    }, 1500);
  }, []);

  useEffect(() => () => window.clearTimeout(noteSaveConfirmationTimerRef.current), []);

  // Persist migrated data once on startup. This also records newly introduced
  // local-only settings without relying on any network service.
  useEffect(() => {
    debugDataCounts('local-save', data);
    localDataStore.save(data);
  }, [data]);

  useEffect(() => {
    syncTaskNotifications(data).catch((error) => console.warn('Failed to sync native task notifications.', error));
  }, [
    data.activeTask?.id,
    data.activeTask?.status,
    data.activeTask?.updatedAt,
    data.activeTask?.nextCheckInAt,
    data.activeTask?.breakEndsAt,
    data.activeTask?.estimateMinutes,
    data.taskSessions?.length,
    data.settings?.notificationsEnabled,
    data.settings?.checkInNotificationsEnabled,
    data.settings?.breakNotificationsEnabled,
    data.settings?.estimateNotificationsEnabled,
    data.settings?.notificationSoundEnabled,
  ]);

  useEffect(() => {
    syncBackupReminderNotifications(data).catch((error) => console.warn('Failed to sync backup reminders.', error));
  }, [
    data.settings?.notificationsEnabled,
    data.settings?.notificationSoundEnabled,
    data.settings?.backupReminderEnabled,
    data.settings?.backupReminderAnchorAt,
    data.settings?.lastSuccessfulBackupAt,
    data.settings?.backupReminderSnoozeUntil,
  ]);

  useEffect(() => {
    let listener;
    addMasterPlanNotificationActionListener(async (event) => {
      if (event?.notification?.extra?.kind !== 'backup-reminder') return;
      const actionId = event?.actionId || 'tap';

      if (actionId === 'remind-tomorrow') {
        const snoozeUntil = Date.now() + DAY_MS;
        setDataPersisted((previous) => ({
          ...previous,
          settings: {
            ...(previous.settings || {}),
            backupReminderSnoozeUntil: snoozeUntil,
          },
        }));
        return;
      }

      if (actionId === 'backup-now') {
        try {
          const status = await getDriveBackupStatus();
          if (status?.connected) {
            await saveDriveBackup(dataRef.current);
            const completedAt = Date.now();
            setDataPersisted((previous) => ({
              ...previous,
              settings: {
                ...(previous.settings || {}),
                lastSuccessfulBackupAt: completedAt,
                backupReminderAnchorAt: completedAt,
                backupReminderSnoozeUntil: null,
              },
            }));
          }
        } catch (error) {
          console.warn('Notification backup action failed.', error);
        }
      }

      // A normal tap, a failed one-tap backup, or an unconnected Drive folder
      // lands on Settings so the user can complete the backup manually.
      navigate('/settings');
    }).then((handle) => { listener = handle; }).catch((error) => console.warn('Could not attach notification action listener.', error));
    return () => { listener?.remove?.(); };
  }, [navigate, setDataPersisted]);

  const resetAppData = useCallback(async () => {
    const resetData = buildResetData();
    localDataStore.save(resetData);
    localDataStore.clearRollbacks?.();
    setDataPersisted(resetData);
    return resetData;
  }, [setDataPersisted]);

  const deleteAllAppData = useCallback(async () => {
    localDataStore.saveRollbackSnapshot?.(dataRef.current, 'Before deleting all app data');
    const baseResetData = buildResetData();
    const cleaned = migrateData({
      ...baseResetData,
      meta: {
        ...baseResetData.meta,
        destructiveResetAt: new Date().toISOString(),
      },
    });
    localDataStore.save(cleaned);
    localDataStore.clearRollbacks?.();
    const removedLegacyKeys = localDataStore.clearLegacyNoteLocalKeys?.() || [];
    setDataPersisted(cleaned);
    return { localRemovedKeys: removedLegacyKeys };
  }, [setDataPersisted]);

  const restoreBackupState = useCallback((state, reason = 'Before backup restore') => {
    const snapshot = localDataStore.saveRollbackSnapshot?.(dataRef.current, reason);
    const restored = migrateData(state);
    setDataPersisted(restored);
    return { restored, rollbackSnapshotId: snapshot?.id || null };
  }, [setDataPersisted]);

  const markBackupSuccessful = useCallback((timestamp = Date.now()) => {
    setDataPersisted((previous) => ({
      ...previous,
      settings: {
        ...(previous.settings || {}),
        lastSuccessfulBackupAt: Number(timestamp) || Date.now(),
        backupReminderAnchorAt: Number(timestamp) || Date.now(),
        backupReminderSnoozeUntil: null,
      },
    }));
  }, [setDataPersisted]);

  const api = useMemo(() => ({
    data,
    setData: setDataPersisted,
    showNoteSavedConfirmation,
    createRollback: (reason) => localDataStore.saveRollbackSnapshot?.(dataRef.current, reason),
    getLatestRollback: () => localDataStore.getLatestRollback?.(),
    getRollbacks: () => localDataStore.getRollbacks?.(),
    clearRollbacks: () => localDataStore.clearRollbacks?.(),
    deleteRollbackById: (id) => localDataStore.deleteRollbackById?.(id),
    restoreBackupState,
    markBackupSuccessful,
    resetAppData,
    deleteAllAppData,
  }), [data, deleteAllAppData, markBackupSuccessful, resetAppData, restoreBackupState, setDataPersisted, showNoteSavedConfirmation]);

  return <Layout api={api} noteSaveConfirmation={noteSaveConfirmation}><Routes>
    <Route path="/" element={<Navigate to="/aha" replace />} />
    <Route path="/notes" element={<Navigate to="/aha" replace />} />
    <Route path="/plans" element={<Navigate to="/hmm" replace />} />
    <Route path="/projects" element={<Navigate to="/ta-da" replace />} />
    <Route path="/aha" element={<AhaPage api={api} />} />
    <Route path="/hmm" element={<HmmPage api={api} />} />
    <Route path="/ta-da" element={<TaDaPage api={api} />} />
    <Route path="/projects/:projectId" element={<ProjectDetailPage api={api} />} />
    <Route path="/capture" element={<Navigate to="/aha" replace />} />
    <Route path="/notes-processor" element={<Navigate to="/hmm" replace />} />
    <Route path="/inbox" element={<Navigate to="/hmm" replace />} />
    <Route path="/ideas" element={<Navigate to="/hmm" replace />} />
    <Route path="/raw-notes" element={<Navigate to="/hmm" replace />} />
    <Route path="/settings" element={<SettingsPage api={api} />} />
    <Route path="/reports" element={<ReportsPage api={api} />} />
    <Route path="*" element={<Navigate to="/aha" replace />} />
  </Routes></Layout>;
}
