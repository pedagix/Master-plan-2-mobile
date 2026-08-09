import { useMemo, useRef, useState } from 'react';
import { isFirebaseConfigured, signOutUser } from '../services/firebase';
import { buildImportPreview } from '../lib/importAnalysis';
import { HMM_DESTINATION, migrateData } from '../lib/model';

export default function SettingsPage({ api }) {
  const user = api.user;
  const fileRef = useRef(null);
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState(null);
  const [importMessage, setImportMessage] = useState('');
  const [cleanupReport, setCleanupReport] = useState(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [rollbackInfoOpen, setRollbackInfoOpen] = useState(false);

  const rollbackSnapshots = useMemo(() => api.getRollbacks?.() || [], [api.data]);
  const latestRollback = rollbackSnapshots[0] || null;

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
