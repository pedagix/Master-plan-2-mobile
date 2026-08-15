import { useEffect, useMemo, useRef, useState } from 'react';
import { buildImportPreview } from '../lib/importAnalysis';
import { HMM_DESTINATION, migrateData } from '../lib/model';
import {
  ensureNotificationPermission,
  getNotificationStatus,
  isNativeNotificationRuntime,
  openExactAlarmSettings,
  sendTestNotification,
  syncBackupReminderNotifications,
  syncTaskNotifications,
} from '../services/notificationScheduler';
import {
  connectDriveBackupFolder,
  disconnectDriveBackupFolder,
  exportBackupFile,
  getDriveBackupStatus,
  isNativeBackupRuntime,
  listDriveBackups,
  parseAndValidateBackup,
  pickBackupFileNative,
  readDriveBackup,
  saveDriveBackup,
} from '../services/backupService';

function NotificationToggle({ label, description, checked, disabled = false, onChange }) {
  return (
    <label className={`notification-toggle-row ${disabled ? 'is-disabled' : ''}`.trim()}>
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="notification-switch" aria-hidden="true"><span /></span>
    </label>
  );
}

function formatDateTime(value) {
  const time = Number(value);
  if (!Number.isFinite(time) || time <= 0) return 'Never';
  return new Date(time).toLocaleString();
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SettingsPage({ api }) {
  const legacyImportFileRef = useRef(null);
  const restoreFileRef = useRef(null);
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState(null);
  const [importMessage, setImportMessage] = useState('');
  const [cleanupReport, setCleanupReport] = useState(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [rollbackInfoOpen, setRollbackInfoOpen] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState({ native: isNativeNotificationRuntime(), displayPermission: 'unknown', exactAlarm: 'unknown' });
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [backupStatus, setBackupStatus] = useState({ native: isNativeBackupRuntime(), connected: false, folderName: null });
  const [driveBackups, setDriveBackups] = useState([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [restoreUndoSnapshotId, setRestoreUndoSnapshotId] = useState(null);

  const rollbackSnapshots = useMemo(() => api.getRollbacks?.() || [], [api.data]);
  const latestRollback = rollbackSnapshots[0] || null;
  const notificationSettings = api.data.settings || {};
  const notificationsEnabled = notificationSettings.notificationsEnabled !== false;
  const nativeNotifications = notificationStatus.native;
  const nativeBackup = backupStatus.native;

  const refreshNotificationStatus = async () => {
    try {
      setNotificationStatus(await getNotificationStatus());
    } catch (error) {
      console.warn('Could not refresh notification status.', error);
    }
  };

  const refreshBackupStatus = async () => {
    if (!isNativeBackupRuntime()) {
      setBackupStatus({ native: false, connected: false, folderName: null });
      setDriveBackups([]);
      return;
    }
    try {
      const status = await getDriveBackupStatus();
      setBackupStatus({ native: true, ...status });
      if (status.connected) setDriveBackups(await listDriveBackups());
      else setDriveBackups([]);
    } catch (error) {
      console.warn('Could not refresh Drive backup status.', error);
      setBackupStatus({ native: true, connected: false, folderName: null });
      setDriveBackups([]);
    }
  };

  useEffect(() => {
    refreshNotificationStatus();
    refreshBackupStatus();
  }, []);

  const updateSetting = (key, value) => {
    api.setData((prev) => ({
      ...prev,
      settings: { ...(prev.settings || {}), [key]: value },
    }));
  };

  const toggleNotifications = async (enabled) => {
    updateSetting('notificationsEnabled', enabled);
    setNotificationMessage('');
    if (!enabled) return;
    if (!nativeNotifications) {
      setNotificationMessage('Background sound notifications require the Android app build. Browser mode keeps the in-app alert only.');
      return;
    }
    setNotificationBusy(true);
    try {
      const permission = await ensureNotificationPermission();
      await refreshNotificationStatus();
      if (permission.display === 'granted') {
        const nextData = { ...api.data, settings: { ...(api.data.settings || {}), notificationsEnabled: true } };
        await Promise.all([syncTaskNotifications(nextData), syncBackupReminderNotifications(nextData)]);
        setNotificationMessage('Notifications enabled.');
      } else {
        setNotificationMessage('Android notification permission is not enabled.');
      }
    } catch (error) {
      console.warn('Could not enable notifications.', error);
      setNotificationMessage('Could not enable Android notifications.');
    } finally {
      setNotificationBusy(false);
    }
  };

  const toggleBackupReminder = async (enabled) => {
    updateSetting('backupReminderEnabled', enabled);
    setBackupMessage('');
    if (!enabled) return;
    if (!nativeNotifications) {
      setBackupMessage('Weekly reminders are available in the Android app build.');
      return;
    }
    try {
      const permission = await ensureNotificationPermission();
      if (permission.display !== 'granted') {
        setBackupMessage('Allow Master Plan notifications in Android to receive weekly backup reminders.');
      }
    } catch (error) {
      console.warn('Could not enable backup reminders.', error);
    }
  };

  const enablePreciseAlarms = async () => {
    if (!nativeNotifications) return;
    setNotificationBusy(true);
    setNotificationMessage('Opening Android alarm settings…');
    try {
      await openExactAlarmSettings();
      await refreshNotificationStatus();
    } catch (error) {
      console.warn('Could not open exact-alarm settings.', error);
      setNotificationMessage('Could not open Android alarm settings.');
    } finally {
      setNotificationBusy(false);
    }
  };

  const testNotification = async () => {
    if (!nativeNotifications) {
      setNotificationMessage('Install/run the Android build to test background notifications.');
      return;
    }
    setNotificationBusy(true);
    setNotificationMessage('Scheduling a test notification in a few seconds…');
    try {
      const result = await sendTestNotification(api.data);
      await refreshNotificationStatus();
      setNotificationMessage(result.sent ? 'Test scheduled. Lock the screen or switch apps now.' : 'Notification permission is not enabled.');
    } catch (error) {
      console.warn('Could not schedule test notification.', error);
      setNotificationMessage('Could not schedule the test notification.');
    } finally {
      setNotificationBusy(false);
    }
  };

  const connectDrive = async () => {
    if (!nativeBackup || backupBusy) return;
    setBackupBusy(true);
    setBackupMessage('Choose Google Drive, then select or create a Master Plan Backups folder.');
    try {
      const result = await connectDriveBackupFolder();
      if (result?.cancelled) {
        setBackupMessage('Drive connection canceled.');
      } else if (result?.connected) {
        setBackupMessage(`Backup folder connected${result.folderName ? `: ${result.folderName}` : ''}.`);
      }
      await refreshBackupStatus();
    } catch (error) {
      console.warn('Could not connect Drive backup folder.', error);
      setBackupMessage(error?.message || 'Could not connect the backup folder.');
    } finally {
      setBackupBusy(false);
    }
  };

  const disconnectDrive = async () => {
    if (!window.confirm('Disconnect this Google Drive backup folder? Existing backup files will stay in Drive.')) return;
    setBackupBusy(true);
    try {
      await disconnectDriveBackupFolder();
      setBackupMessage('Drive folder disconnected. Existing backups were not deleted.');
      await refreshBackupStatus();
    } catch (error) {
      setBackupMessage(error?.message || 'Could not disconnect the backup folder.');
    } finally {
      setBackupBusy(false);
    }
  };

  const backupNow = async () => {
    if (!nativeBackup || backupBusy) return;
    setBackupBusy(true);
    setBackupMessage('Creating backup…');
    try {
      let status = await getDriveBackupStatus();
      if (!status.connected) {
        const connected = await connectDriveBackupFolder();
        if (!connected?.connected) {
          setBackupMessage('Backup canceled. Connect a Google Drive folder first.');
          return;
        }
        status = connected;
      }
      const result = await saveDriveBackup(api.data);
      const completedAt = Date.now();
      api.markBackupSuccessful?.(completedAt);
      setBackupMessage(`Backup saved. ${result.backups?.length ?? Math.min(3, driveBackups.length + 1)} protected ${result.backups?.length === 1 ? 'copy' : 'copies'} in the selected Drive folder.`);
      await refreshBackupStatus();
    } catch (error) {
      console.warn('Drive backup failed.', error);
      setBackupMessage(error?.message || 'Backup failed. Your local data was not changed.');
    } finally {
      setBackupBusy(false);
    }
  };

  const restoreValidatedBackup = async (backup, sourceLabel) => {
    if (!backup?.state) return;
    const created = backup.createdAt ? new Date(backup.createdAt).toLocaleString() : 'unknown date';
    const counts = backup.counts || {};
    const prompt = `Restore ${sourceLabel} from ${created}?\n\n${counts.projects ?? 0} projects · ${counts.notes ?? 0} notes · ${counts.completedTasks ?? 0} completed tasks\n\nYour current data will first be saved as a local recovery snapshot.`;
    if (!window.confirm(prompt)) return;
    const result = api.restoreBackupState?.(backup.state, `Before restoring ${sourceLabel}`);
    setRestoreUndoSnapshotId(result?.rollbackSnapshotId || null);
    setBackupMessage('Backup restored. Your previous state is protected and can be restored immediately below.');
  };

  const undoLastBackupRestore = () => {
    if (!restoreUndoSnapshotId) return;
    const snapshot = (api.getRollbacks?.() || []).find((entry) => entry.id === restoreUndoSnapshotId);
    if (!snapshot?.state) {
      setRestoreUndoSnapshotId(null);
      setBackupMessage('The recovery snapshot for that restore is no longer available.');
      return;
    }
    if (!window.confirm('Undo the last backup restore and return to the state from immediately before it?')) return;
    api.createRollback?.('Before undoing backup restore');
    api.setData(migrateData(snapshot.state));
    setRestoreUndoSnapshotId(null);
    setBackupMessage('Last backup restore undone.');
  };

  const restoreDriveBackup = async (entry) => {
    if (!entry?.id || backupBusy) return;
    setBackupBusy(true);
    setBackupMessage('Checking backup before restore…');
    try {
      const backup = await readDriveBackup(entry.id);
      await restoreValidatedBackup(backup, entry.name || 'Drive backup');
    } catch (error) {
      console.warn('Drive restore failed.', error);
      setBackupMessage(error?.message || 'Restore failed. Current data was not changed.');
    } finally {
      setBackupBusy(false);
    }
  };

  const exportPortableBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupMessage('Preparing backup file…');
    try {
      const result = await exportBackupFile(api.data);
      if (result?.cancelled) {
        setBackupMessage('Export canceled.');
      } else {
        api.markBackupSuccessful?.(Date.now());
        setBackupMessage('Backup file created. You chose where it is stored.');
      }
    } catch (error) {
      console.warn('Backup export failed.', error);
      setBackupMessage(error?.message || 'Could not export the backup file.');
    } finally {
      setBackupBusy(false);
    }
  };

  const restorePortableBackup = async () => {
    if (backupBusy) return;
    if (!isNativeBackupRuntime()) {
      restoreFileRef.current?.click();
      return;
    }
    setBackupBusy(true);
    setBackupMessage('Choose a Master Plan backup file…');
    try {
      const backup = await pickBackupFileNative();
      await restoreValidatedBackup(backup, backup.fileName || 'backup file');
    } catch (error) {
      if (String(error?.message || '').toLowerCase().includes('cancel')) setBackupMessage('Restore canceled.');
      else setBackupMessage(error?.message || 'Could not read that backup file.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handlePortableFileRestore = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBackupBusy(true);
    try {
      const backup = await parseAndValidateBackup(await file.text());
      await restoreValidatedBackup({ ...backup, fileName: file.name }, file.name);
    } catch (error) {
      setBackupMessage(error?.message || 'Could not read that backup file.');
    } finally {
      setBackupBusy(false);
    }
  };

  const applyPreview = () => {
    if (!preview?.data || !preview.canApply) return;
    api.createRollback?.(`Before ${preview.label || 'JSON'} import`);
    api.setData(preview.data);
    setImportMessage(`${preview.label || 'JSON'} import completed. Previous app state saved.`);
    setPreview(null);
    setPasteText('');
  };

  const applyImportSnapshot = (snapshot) => {
    if (!snapshot?.state) return;
    if (!window.confirm('Replace the current app state with this saved snapshot?')) return;
    api.setData(migrateData(snapshot.state));
    setImportMessage('Selected recovery snapshot applied.');
  };

  const deleteImportSnapshot = (snapshotId) => {
    if (!snapshotId) return;
    api.deleteRollbackById?.(snapshotId);
    setImportMessage('Recovery snapshot deleted.');
  };

  const handleLegacyFileImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    try { setPreview(buildImportPreview(JSON.parse(text), api.data)); }
    catch { setPreview({ plainText: text }); }
  };

  const handlePastePreview = () => {
    try { setPreview(buildImportPreview(JSON.parse(pasteText), api.data)); }
    catch { setPreview({ plainText: pasteText }); }
  };

  const importPlainText = () => {
    const text = (preview?.plainText || '').trim();
    if (!text) return;
    const now = Date.now();
    api.setData((prev) => ({
      ...prev,
      notes: [{
        id: crypto.randomUUID(),
        text,
        createdAt: now,
        updatedAt: now,
        destination: HMM_DESTINATION,
        projectId: null,
        priority: 5,
        important: false,
        isTodo: false,
        deleted: false,
        sourceType: 'settings-import',
        sourceId: null,
      }, ...(prev.notes || [])],
    }));
    setPreview(null);
    setPasteText('');
    setImportMessage('Plain text imported into Plans.');
  };

  const deleteAllAppData = async () => {
    if (cleanupBusy) return;
    const warning = 'This permanently deletes projects, notes, tasks, galleries, history, and settings from this device. Your separate backup files are not deleted.';
    if (!window.confirm(warning)) return;
    const typed = window.prompt('Type DELETE to confirm permanent deletion of all local app data.');
    if (typed !== 'DELETE') {
      setImportMessage('Deletion canceled.');
      return;
    }

    setCleanupBusy(true);
    setCleanupReport(null);
    setImportMessage('Deleting local app data…');
    try {
      const report = await api.deleteAllAppData?.();
      setCleanupReport(report || null);
      setPreview(null);
      setPasteText('');
      setRollbackInfoOpen(false);
      setImportMessage('All local app data deleted. Drive and exported backup files were left untouched.');
    } catch (error) {
      console.warn('Delete all app data failed.', error);
      setImportMessage('Delete failed. Local data was kept where possible.');
    } finally {
      setCleanupBusy(false);
    }
  };

  return (
    <div className="stack page-screen settings-page">
      <section className="system-panel notification-settings-panel">
        <div className="system-panel-heading">
          <span>NOTIFICATIONS</span>
          <small>{nativeNotifications ? 'Android local' : 'Browser mode'}</small>
        </div>
        <p className="helper-text">Task alerts are scheduled on the phone itself. On Android they can sound with the screen locked and while Master Plan is in the background.</p>

        <div className="notification-status-grid">
          <div><small>NOTIFICATIONS</small><strong>{nativeNotifications ? (notificationStatus.displayPermission === 'granted' ? 'READY' : String(notificationStatus.displayPermission || 'UNKNOWN').toUpperCase()) : 'WEB ONLY'}</strong></div>
          <div><small>PRECISE ALARMS</small><strong>{nativeNotifications ? (notificationStatus.exactAlarm === 'granted' ? 'READY' : String(notificationStatus.exactAlarm || 'UNKNOWN').toUpperCase()) : 'N/A'}</strong></div>
        </div>

        <div className="notification-toggle-list">
          <NotificationToggle label="Background notifications" description="Master switch for task and backup reminders." checked={notificationsEnabled} onChange={toggleNotifications} />
          <NotificationToggle label="Check-ins" description="Ask if you are still working when the check-in interval is reached." checked={notificationSettings.checkInNotificationsEnabled !== false} disabled={!notificationsEnabled} onChange={(value) => updateSetting('checkInNotificationsEnabled', value)} />
          <NotificationToggle label="Break complete" description="Alert when a 5 or 10 minute break ends." checked={notificationSettings.breakNotificationsEnabled !== false} disabled={!notificationsEnabled} onChange={(value) => updateSetting('breakNotificationsEnabled', value)} />
          <NotificationToggle label="Estimate reached" description="Alert when the task's estimated working time has been used. Pauses and breaks pause this timer." checked={notificationSettings.estimateNotificationsEnabled !== false} disabled={!notificationsEnabled} onChange={(value) => updateSetting('estimateNotificationsEnabled', value)} />
          <NotificationToggle label="Sound" description="Use the Master Plan alert sound. Android system settings can override this." checked={notificationSettings.notificationSoundEnabled !== false} disabled={!notificationsEnabled} onChange={(value) => updateSetting('notificationSoundEnabled', value)} />
        </div>

        <div className="settings-button-grid notification-actions">
          <button type="button" disabled={notificationBusy || !notificationsEnabled} onClick={testNotification}>Test notification</button>
          <button type="button" className="secondary-button" disabled={notificationBusy || !nativeNotifications} onClick={enablePreciseAlarms}>Precise alarm settings</button>
        </div>
        {!nativeNotifications && <p className="system-message">The web/PWA version still shows in-app check-ins, but Android background sound requires the native Android build generated from this project.</p>}
        {nativeNotifications && notificationStatus.displayPermission !== 'granted' && <p className="system-message">Allow Master Plan notifications in Android so background alerts and weekly backup reminders can appear.</p>}
        {nativeNotifications && notificationStatus.exactAlarm !== 'granted' && <p className="system-message">Enable Alarms &amp; reminders for the most precise check-in and break timing while the phone is idle.</p>}
        {notificationMessage && <p className="system-message">{notificationMessage}</p>}
      </section>

      <section className="system-panel backup-settings-panel">
        <div className="system-panel-heading">
          <span>BACKUP</span>
          <small>Local first · user owned</small>
        </div>
        <p className="helper-text">Master Plan keeps its live database on this phone. Google Drive is used only for manual recovery copies that you control.</p>

        <div className="notification-status-grid backup-status-grid">
          <div><small>GOOGLE DRIVE</small><strong>{nativeBackup ? (backupStatus.connected ? 'CONNECTED' : 'NOT CONNECTED') : 'ANDROID ONLY'}</strong></div>
          <div><small>LAST BACKUP</small><strong>{notificationSettings.lastSuccessfulBackupAt ? new Date(notificationSettings.lastSuccessfulBackupAt).toLocaleDateString() : 'NEVER'}</strong></div>
        </div>

        {backupStatus.connected ? (
          <>
            <div className="backup-location-card">
              <div><small>BACKUP FOLDER</small><strong>{backupStatus.folderName || 'Selected Drive folder'}</strong></div>
              <small>{driveBackups.length}/3 protected copies</small>
            </div>
            <div className="settings-button-grid">
              <button disabled={backupBusy} onClick={backupNow}>{backupBusy ? 'Working…' : 'Back up now'}</button>
              <button className="secondary-button" disabled={backupBusy} onClick={connectDrive}>Change Drive folder</button>
            </div>
            <button className="text-button backup-disconnect-button" disabled={backupBusy} onClick={disconnectDrive}>Disconnect Drive folder</button>

            <div className="backup-copy-list">
              {driveBackups.map((entry, index) => (
                <div className="backup-copy-row" key={entry.id || entry.name}>
                  <div>
                    <strong>BACKUP {index + 1}</strong>
                    <small>{entry.lastModified ? formatDateTime(entry.lastModified) : entry.name}</small>
                    {!!entry.size && <small>{formatBytes(entry.size)}</small>}
                  </div>
                  <button className="secondary-button" disabled={backupBusy} onClick={() => restoreDriveBackup(entry)}>Restore</button>
                </div>
              ))}
              {!driveBackups.length && <p className="empty-state compact-empty-state">No Master Plan backups in this folder yet.</p>}
            </div>
          </>
        ) : (
          <div className="stack backup-connect-block">
            <p className="helper-text">Connect once, choose <strong>Google Drive</strong> in Android's folder picker, then select or create a <strong>Master Plan Backups</strong> folder. Master Plan remembers that folder for future one-tap backups.</p>
            <button disabled={backupBusy || !nativeBackup} onClick={connectDrive}>{backupBusy ? 'Opening…' : 'Connect Google Drive'}</button>
          </div>
        )}

        <div className="notification-toggle-list backup-reminder-toggle">
          <NotificationToggle label="Weekly backup reminder" description="Remind me one week after the last successful backup. The notification offers Back up or Remind tomorrow." checked={notificationSettings.backupReminderEnabled !== false} disabled={!notificationsEnabled} onChange={toggleBackupReminder} />
        </div>
        {Number(notificationSettings.backupReminderSnoozeUntil) > Date.now() && (
          <p className="helper-text backup-snooze-status">Reminder snoozed until {formatDateTime(notificationSettings.backupReminderSnoozeUntil)}.</p>
        )}

        <div className="system-subpanel portable-backup-panel">
          <strong>PORTABLE BACKUP</strong>
          <small>Create the same complete backup as a file. Android lets you choose where to save it, so you can keep or move it however you want.</small>
          <div className="settings-button-grid">
            <button className="secondary-button" disabled={backupBusy} onClick={exportPortableBackup}>Export backup file</button>
            <button className="secondary-button" disabled={backupBusy} onClick={restorePortableBackup}>Restore backup file</button>
          </div>
        </div>
        <input ref={restoreFileRef} type="file" accept=".mpbackup,application/json" onChange={handlePortableFileRestore} hidden />
        {backupMessage && <p className="system-message">{backupMessage}</p>}
        {restoreUndoSnapshotId && <button className="secondary-button backup-undo-button" disabled={backupBusy} onClick={undoLastBackupRestore}>Undo last restore</button>}
      </section>

      <details className="system-panel system-advanced">
        <summary><span>ADVANCED</span><small>Import tools · recovery · reset</small></summary>
        <div className="system-advanced-body stack">
          <label className="system-field">
            <span>Paste JSON or text</span>
            <textarea rows={4} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="Paste data here" />
          </label>
          <div className="settings-button-grid">
            <button className="secondary-button" onClick={() => handlePastePreview()}>Preview pasted data</button>
            <button className="secondary-button" onClick={() => legacyImportFileRef.current?.click()}>Import legacy JSON</button>
          </div>
          <input ref={legacyImportFileRef} type="file" accept="application/json" onChange={handleLegacyFileImport} hidden />

          {preview && (
            <div className="system-subpanel stack">
              <strong>IMPORT PREVIEW</strong>
              {preview.plainText ? (
                <><p>Plain text detected.</p><button onClick={importPlainText}>Create Plans note</button></>
              ) : (
                <>
                  <p>{preview.label || preview.kind}</p>
                  <small>Add {preview.itemsToAdd} · Update {preview.itemsToUpdate} · Skip {preview.itemsToSkip}</small>
                  <small>Conflicts {preview.possibleConflicts} · Invalid {preview.invalidItems}</small>
                  {!!preview.problems?.length && <div className="system-problem-list">{preview.problems.map((problem, index) => <small key={index}>{problem}</small>)}</div>}
                  <button disabled={!preview.canApply} onClick={() => { if (window.confirm('Apply this import?')) applyPreview(); }}>Apply import</button>
                </>
              )}
            </div>
          )}

          <button className="secondary-button" onClick={() => setRollbackInfoOpen((value) => !value)}>{rollbackInfoOpen ? 'Hide recovery snapshots' : 'Recovery snapshots'}</button>
          {rollbackInfoOpen && (
            <div className="stack rollback-list">
              {!rollbackSnapshots.length && <p className="empty-state compact-empty-state">No recovery snapshots.</p>}
              {rollbackSnapshots.map((snapshot, index) => (
                <div className="system-subpanel rollback-item" key={snapshot.id}>
                  <div><strong>SNAPSHOT {rollbackSnapshots.length - index}</strong>{snapshot.id === latestRollback?.id && <small className="status-chip">LATEST</small>}</div>
                  <small>{new Date(snapshot.createdAt).toLocaleString()}</small>
                  <small>{snapshot.reason}</small>
                  <small>{snapshot.counts.projects} projects · {snapshot.counts.notes ?? snapshot.counts.captures} notes · {snapshot.counts.completedTasks ?? 0} completed</small>
                  <div className="settings-button-grid">
                    <button onClick={() => applyImportSnapshot(snapshot)}>Restore</button>
                    <button className="text-button" onClick={() => deleteImportSnapshot(snapshot.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="danger-zone">
            <div><strong>DELETE ALL DATA</strong><small>This device only</small></div>
            <button className="danger-button" disabled={cleanupBusy} onClick={deleteAllAppData}>{cleanupBusy ? 'Deleting…' : 'Delete all'}</button>
          </div>

          {cleanupReport && (
            <div className="system-subpanel stack">
              <strong>CLEANUP REPORT</strong>
              <small>{(cleanupReport.localRemovedKeys || []).length} legacy local keys removed</small>
            </div>
          )}
          {importMessage && <p className="system-message">{importMessage}</p>}
        </div>
      </details>
    </div>
  );
}
