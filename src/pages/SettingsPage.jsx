import { useMemo, useRef, useState } from 'react';
import { isFirebaseConfigured, signOutUser } from '../services/firebase';
import { buildImportPreview } from '../lib/importAnalysis';
import { HMM_DESTINATION, buildDefaultPromptProfile, migrateData } from '../lib/model';

export default function SettingsPage({ api }) {
  const user = api.user;
  const fileRef = useRef(null);
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState(null);
  const [importMessage, setImportMessage] = useState('');
  const [cleanupReport, setCleanupReport] = useState(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [rollbackInfoOpen, setRollbackInfoOpen] = useState(false);

  const profile = api.data.settings.promptProfiles.find((p) => p.id === api.data.settings.activePromptProfileId) || api.data.settings.promptProfiles[0];
  const actions = profile.promptActions;
  const rollbackSnapshots = useMemo(() => api.getRollbacks?.() || [], [api.data]);
  const latestRollback = rollbackSnapshots[0] || null;
  const confirmAction = (message, action) => {
    if (!window.confirm(message)) return;
    action();
  };

  const patchAction = (id, patch) => api.setData((prev) => {
    const next = migrateData(prev);
    const active = next.settings.promptProfiles.find((p) => p.id === next.settings.activePromptProfileId);
    active.promptActions[id] = { ...active.promptActions[id], ...patch };
    next.aiInstructions.promptActions = { ...active.promptActions };
    return next;
  });

  const resetOne = (id) => patchAction(id, buildDefaultPromptProfile().promptActions[id]);

  const resetAll = () => {
    api.createRollback?.('Before resetting all prompt actions');
    api.setData((prev) => {
      const next = migrateData(prev);
      const defaults = buildDefaultPromptProfile();
      const active = next.settings.promptProfiles.find((p) => p.id === next.settings.activePromptProfileId);
      active.promptActions = defaults.promptActions;
      next.aiInstructions.promptActions = { ...defaults.promptActions };
      return next;
    });
  };

  const applyPreview = () => {
    if (!preview?.data || !preview.canApply) return;
    api.createRollback?.(`Before ${preview.label || 'JSON'} import`);
    api.setData(preview.data);
    setImportMessage(`${preview.label || 'JSON'} import completed. Previous app state saved.`);
    setPreview(null); setPasteText('');
  };

  const applyImportSnapshot = (snapshot) => {
    if (!snapshot?.state) return;
    if (!window.confirm('This will replace your current app state with this saved import snapshot. Continue?')) return;
    api.setData(migrateData(snapshot.state));
    setImportMessage('Selected import snapshot applied.');
  };

  const deleteImportSnapshot = (snapshotId) => {
    if (!snapshotId) return;
    api.deleteRollbackById?.(snapshotId);
    setImportMessage('Import snapshot deleted.');
  };

  const handleFileImport = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    const text = await file.text();
    try { setPreview(buildImportPreview(JSON.parse(text), api.data)); } catch { setPreview({ plainText: text }); }
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
    const warning = 'This deletes all projects, notes, tasks, galleries, suggestions, settings, and app data. This cannot be undone unless you have exported a backup.';
    if (!window.confirm(warning)) return;
    const typed = window.prompt('Type DELETE to confirm permanent deletion of all app data.');
    if (typed !== 'DELETE') {
      setImportMessage('Delete all app data canceled: confirmation text did not match.');
      return;
    }

    setCleanupBusy(true);
    setCleanupReport(null);
    setImportMessage('Deleting all app data from local storage and Firestore...');
    try {
      const report = await api.deleteAllAppData?.();
      setCleanupReport(report || null);
      setPreview(null);
      setPasteText('');
      setRollbackInfoOpen(false);
      setImportMessage('Delete all app data completed. Your app now starts from a clean slate.');
    } catch (error) {
      console.warn('Delete all app data failed.', error);
      setImportMessage('Delete all app data failed. Check your connection and try again.');
    } finally {
      setCleanupBusy(false);
    }
  };

  return <div className="stack"><h2>Settings</h2>
    <section className="card stack"><h3>Import / Export</h3>
      <div className="settings-button-grid">
        <button onClick={() => confirmAction('Export full backup now?', api.exportFullBackup)}>Export full backup</button>
        <button onClick={() => confirmAction('Select and import a JSON file?', () => fileRef.current?.click())}>Import JSON file</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json" onChange={handleFileImport} style={{ display: 'none' }} />
      {importMessage && <p>{importMessage}</p>}

      <details className="stack">
        <summary>Advanced options</summary>
        <div className="settings-button-grid">
          <button className="danger-button" disabled={cleanupBusy} onClick={deleteAllAppData}>Delete all app data</button>
        </div>
        {cleanupBusy && <p>Running global cleanup...</p>}
        {cleanupReport && <div className="card stack">
          <strong>Cleanup report</strong>
          <p>users touched: {cleanupReport.touchedUsers ?? 0}</p>
          <p>documents deleted: {cleanupReport.deletedDocs ?? 0}</p>
          <p>user docs patched: {cleanupReport.patchedUserDocs ?? 0}</p>
          <p>project docs patched: {cleanupReport.patchedProjectDocs ?? 0}</p>
          <p>gallery docs patched: {cleanupReport.patchedGalleryDocs ?? 0}</p>
          <p>legacy localStorage keys removed: {(cleanupReport.localRemovedKeys || []).length}</p>
          {!!cleanupReport.cleanupErrors?.length && <div className="card stack">{cleanupReport.cleanupErrors.map((item, index) => <small key={index}>{item}</small>)}</div>}
        </div>}
        <textarea rows={4} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste JSON or text" />
        <button onClick={() => confirmAction('Preview this pasted JSON/Text import?', handlePastePreview)}>Paste JSON/Text Import</button>

        <div className="settings-button-grid">
          <button onClick={() => confirmAction('Toggle rollback/import info visibility?', () => setRollbackInfoOpen((v) => !v))}>View rollback info</button>
        </div>
        {rollbackInfoOpen && (rollbackSnapshots.length ? <div className="stack">
          <p>Each import, reset, or major settings reset keeps a saved snapshot below. Use <strong>Apply import</strong> to roll back to that snapshot, or delete snapshots you no longer need.</p>
          {rollbackSnapshots.map((snapshot, index) => <div className="card stack" key={snapshot.id}>
            <p><strong>Snapshot #{rollbackSnapshots.length - index}</strong>{snapshot.id === latestRollback?.id ? ' (latest)' : ''}</p>
            <p>createdAt: {new Date(snapshot.createdAt).toISOString()}</p>
            <p>reason: {snapshot.reason}</p>
            <p>projects: {snapshot.counts.projects}</p>
            <p>notes: {snapshot.counts.notes ?? snapshot.counts.captures}</p>
            <p>legacy captures: {snapshot.counts.captures}</p>
            <p>completed tasks: {snapshot.counts.completedTasks ?? 0}</p>
            <p>suggestions: {snapshot.counts.suggestions}</p>
            <p>questions: {snapshot.counts.questions}</p>
            <p>settings/prompt profiles included: {snapshot.counts.includesSettings ? 'yes' : 'no'}</p>
            <div className="settings-button-grid">
              <button onClick={() => confirmAction('Apply this import snapshot to your current data?', () => applyImportSnapshot(snapshot))}>Apply import</button>
              <button onClick={() => confirmAction('Delete this saved import snapshot?', () => deleteImportSnapshot(snapshot.id))}>Delete import</button>
            </div>
          </div>)}
        </div> : <p>No import snapshots saved yet.</p>)}
      </details>

      {preview && <div className="card stack"><strong>Import preview</strong>
        {preview.plainText ? <><p>Detected plain text import.</p><button onClick={() => confirmAction('Create a new capture from the pasted text?', importPlainText)}>Create capture from pasted text</button></> : <>
          <p>Type: {preview.label || preview.kind}</p>
          <p>Add: {preview.itemsToAdd} - Update: {preview.itemsToUpdate} - Skip: {preview.itemsToSkip}</p>
          <p>Conflicts: {preview.possibleConflicts} - Invalid: {preview.invalidItems}</p>
          <p>Needs project assignment: {preview.itemsNeedingProjectAssignment}</p>
          {!!preview.problems?.length && <div className="card stack">{preview.problems.map((problem, index) => <small key={index}>{problem}</small>)}</div>}
          <button disabled={!preview.canApply} onClick={() => confirmAction('Apply this import preview to your data?', applyPreview)}>Apply import</button>
        </>}
      </div>}
    </section>

    <details className="stack"><summary>Prompt/action settings</summary>
      {Object.values(actions).map((action) => <details className="card" key={action.id}><summary>{action.title}</summary><p>{action.description}</p>
        <label><input type="checkbox" checked={action.enabled} onChange={(e) => patchAction(action.id, { enabled: e.target.checked })} /> Enabled</label>
        <textarea rows={4} value={action.prompt} onChange={(e) => patchAction(action.id, { prompt: e.target.value })} />
        <button onClick={() => confirmAction(`Reset "${action.title}" to default?`, () => resetOne(action.id))}>Reset to default</button></details>)}
      <button onClick={() => confirmAction('Reset all prompt actions to default values?', resetAll)}>Reset all prompt actions to default</button>
    </details>

    {isFirebaseConfigured && user && <><div><strong>Signed in:</strong><div>{user.displayName || 'No name available'}</div><div>{user.email || 'No email available'}</div></div><div className="settings-button-grid"><button onClick={() => confirmAction('Import local data to Firebase now?', api.importLocalDataToFirebase)}>Import local data to Firebase</button><button onClick={() => confirmAction('Sign out now?', signOutUser)}>Sign out</button></div></>}
    {!isFirebaseConfigured && <p>Firebase is not configured. Running in local-only mode.</p>}
  </div>;
}
