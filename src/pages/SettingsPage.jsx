import { useEffect, useMemo, useRef, useState } from 'react';
import { isFirebaseConfigured, signOutUser } from '../services/firebase';
import { buildImportPreview } from '../lib/importAnalysis';
import { HMM_DESTINATION, migrateData } from '../lib/model';
import {
  ensureNotificationPermission,
  getNotificationStatus,
  isNativeNotificationRuntime,
  openExactAlarmSettings,
  sendTestNotification,
  syncTaskNotifications,
} from '../services/notificationScheduler';


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

export default function SettingsPage({ api }) {
  const user = api.user;
  const fileRef = useRef(null);
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState(null);
  const [importMessage, setImportMessage] = useState('');
  const [cleanupReport, setCleanupReport] = useState(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [rollbackInfoOpen, setRollbackInfoOpen] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState({ native: isNativeNotificationRuntime(), displayPermission: 'unknown', exactAlarm: 'unknown' });
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationBusy, setNotificationBusy] = useState(false);

  const rollbackSnapshots = useMemo(() => api.getRollbacks?.() || [], [api.data]);
  const latestRollback = rollbackSnapshots[0] || null;

  const notificationSettings = api.data.settings || {};
  const notificationsEnabled = notificationSettings.notificationsEnabled !== false;
  const nativeNotifications = notificationStatus.native;

  const refreshNotificationStatus = async () => {
    try {
      setNotificationStatus(await getNotificationStatus());
    } catch (error) {
      console.warn('Could not refresh notification status.', error);
    }
  };

  useEffect(() => {
    refreshNotificationStatus();
  }, []);

  const updateNotificationSetting = (key, value) => {
    api.setData((prev) => ({
      ...prev,
      settings: { ...(prev.settings || {}), [key]: value },
    }));
  };

  const toggleNotifications = async (enabled) => {
    updateNotificationSetting('notificationsEnabled', enabled);
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
        await syncTaskNotifications(nextData);
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

  const confirmAction = (message, action) => {
    if (!window.confirm(message)) return;
    action();
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
    setImportMessage('Selected import snapshot applied.');
  };

  const deleteImportSnapshot = (snapshotId) => {
    if (!snapshotId) return;
    api.deleteRollbackById?.(snapshotId);
    setImportMessage('Import snapshot deleted.');
  };

  const handleFileImport = async (event) => {
    const file = event.target.files?.[0];
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
    const warning = 'This permanently deletes projects, notes, tasks, galleries, history, settings, and synced app data. Export a backup first if you may need it later.';
    if (!window.confirm(warning)) return;
    const typed = window.prompt('Type DELETE to confirm permanent deletion of all app data.');
    if (typed !== 'DELETE') {
      setImportMessage('Deletion canceled.');
      return;
    }

    setCleanupBusy(true);
    setCleanupReport(null);
    setImportMessage('Deleting local and synced app data…');
    try {
      const report = await api.deleteAllAppData?.();
      setCleanupReport(report || null);
      setPreview(null);
      setPasteText('');
      setRollbackInfoOpen(false);
      setImportMessage('All app data deleted.');
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
          <div>
            <small>NOTIFICATIONS</small>
            <strong>{nativeNotifications ? (notificationStatus.displayPermission === 'granted' ? 'READY' : String(notificationStatus.displayPermission || 'UNKNOWN').toUpperCase()) : 'WEB ONLY'}</strong>
          </div>
          <div>
            <small>PRECISE ALARMS</small>
            <strong>{nativeNotifications ? (notificationStatus.exactAlarm === 'granted' ? 'READY' : String(notificationStatus.exactAlarm || 'UNKNOWN').toUpperCase()) : 'N/A'}</strong>
          </div>
        </div>

        <div className="notification-toggle-list">
          <NotificationToggle
            label="Background notifications"
            description="Master switch for task alerts."
            checked={notificationsEnabled}
            onChange={toggleNotifications}
          />
          <NotificationToggle
            label="Check-ins"
            description="Ask if you are still working when the check-in interval is reached."
            checked={notificationSettings.checkInNotificationsEnabled !== false}
            disabled={!notificationsEnabled}
            onChange={(value) => updateNotificationSetting('checkInNotificationsEnabled', value)}
          />
          <NotificationToggle
            label="Break complete"
            description="Alert when a 5 or 10 minute break ends."
            checked={notificationSettings.breakNotificationsEnabled !== false}
            disabled={!notificationsEnabled}
            onChange={(value) => updateNotificationSetting('breakNotificationsEnabled', value)}
          />
          <NotificationToggle
            label="Estimate reached"
            description="Alert when the task's estimated working time has been used. Pauses and breaks pause this timer."
            checked={notificationSettings.estimateNotificationsEnabled !== false}
            disabled={!notificationsEnabled}
            onChange={(value) => updateNotificationSetting('estimateNotificationsEnabled', value)}
          />
          <NotificationToggle
            label="Sound"
            description="Use the Master Plan alert sound. Android system settings can override this."
            checked={notificationSettings.notificationSoundEnabled !== false}
            disabled={!notificationsEnabled}
            onChange={(value) => updateNotificationSetting('notificationSoundEnabled', value)}
          />
        </div>

        <div className="settings-button-grid notification-actions">
          <button type="button" disabled={notificationBusy || !notificationsEnabled} onClick={testNotification}>Test notification</button>
          <button type="button" className="secondary-button" disabled={notificationBusy || !nativeNotifications} onClick={enablePreciseAlarms}>Precise alarm settings</button>
        </div>
        {!nativeNotifications && <p className="system-message">The web/PWA version still shows in-app check-ins, but Android background sound requires the native Android build generated from this project.</p>}
        {nativeNotifications && notificationStatus.displayPermission !== 'granted' && <p className="system-message">Allow Master Plan notifications in Android so background alerts can appear and sound.</p>}
        {nativeNotifications && notificationStatus.exactAlarm !== 'granted' && <p className="system-message">Enable Alarms &amp; reminders for the most precise check-in and break timing while the phone is idle.</p>}
        {notificationMessage && <p className="system-message">{notificationMessage}</p>}
      </section>

      <section className="system-panel">
        <div className="system-panel-heading">
          <span>BACKUP</span>
          <small>Local first · cloud second</small>
        </div>
        <p className="helper-text">Your changes are stored on this device immediately. Export a full JSON copy whenever you want an independent backup.</p>
        <div className="settings-button-grid">
          <button onClick={() => confirmAction('Export a full backup now?', api.exportFullBackup)}>Export backup</button>
          <button className="secondary-button" onClick={() => fileRef.current?.click()}>Import JSON</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" onChange={handleFileImport} hidden />
        {importMessage && <p className="system-message">{importMessage}</p>}
      </section>

      {isFirebaseConfigured && user && (
        <section className="system-panel">
          <div className="system-panel-heading">
            <span>SYNC</span>
            <small>Connected</small>
          </div>
          <div className="system-account">
            <strong>{user.displayName || 'Signed in'}</strong>
            <small>{user.email || ''}</small>
          </div>
          <div className="settings-button-grid">
            <button onClick={() => confirmAction('Send the current local copy to Firebase now?', api.importLocalDataToFirebase)}>Sync local copy</button>
            <button className="secondary-button" onClick={() => confirmAction('Sign out now?', signOutUser)}>Sign out</button>
          </div>
        </section>
      )}

      {!isFirebaseConfigured && (
        <section className="system-panel">
          <div className="system-panel-heading"><span>SYNC</span><small>Offline</small></div>
          <p className="helper-text">Firebase is not configured. Master Plan is running entirely from local storage.</p>
        </section>
      )}

      <details className="system-panel system-advanced">
        <summary>
          <span>ADVANCED</span>
          <small>Import tools · recovery · reset</small>
        </summary>

        <div className="system-advanced-body stack">
          <label className="system-field">
            <span>Paste JSON or text</span>
            <textarea rows={4} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="Paste data here" />
          </label>
          <button className="secondary-button" onClick={() => handlePastePreview()}>Preview pasted data</button>

          {preview && (
            <div className="system-subpanel stack">
              <strong>IMPORT PREVIEW</strong>
              {preview.plainText ? (
                <>
                  <p>Plain text detected.</p>
                  <button onClick={() => confirmAction('Create a new Plans note from this text?', importPlainText)}>Create Plans note</button>
                </>
              ) : (
                <>
                  <p>{preview.label || preview.kind}</p>
                  <small>Add {preview.itemsToAdd} · Update {preview.itemsToUpdate} · Skip {preview.itemsToSkip}</small>
                  <small>Conflicts {preview.possibleConflicts} · Invalid {preview.invalidItems}</small>
                  {!!preview.problems?.length && <div className="system-problem-list">{preview.problems.map((problem, index) => <small key={index}>{problem}</small>)}</div>}
                  <button disabled={!preview.canApply} onClick={() => confirmAction('Apply this import?', applyPreview)}>Apply import</button>
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
                  <div>
                    <strong>SNAPSHOT {rollbackSnapshots.length - index}</strong>
                    {snapshot.id === latestRollback?.id && <small className="status-chip">LATEST</small>}
                  </div>
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
            <div>
              <strong>DELETE ALL DATA</strong>
              <small>Local and synced copies</small>
            </div>
            <button className="danger-button" disabled={cleanupBusy} onClick={deleteAllAppData}>{cleanupBusy ? 'Deleting…' : 'Delete all'}</button>
          </div>

          {cleanupReport && (
            <div className="system-subpanel stack">
              <strong>CLEANUP REPORT</strong>
              <small>{cleanupReport.deletedDocs ?? 0} cloud documents deleted</small>
              <small>{(cleanupReport.localRemovedKeys || []).length} legacy local keys removed</small>
              {!!cleanupReport.cleanupErrors?.length && cleanupReport.cleanupErrors.map((item, index) => <small key={index}>{item}</small>)}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
