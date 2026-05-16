import { useMemo, useRef, useState } from 'react';
import { isFirebaseConfigured, signOutUser } from '../services/firebase';
import { buildDefaultData, buildDefaultPromptProfile, migrateData } from '../lib/model';

export default function SettingsPage({ api }) {
  const user = api.user;
  const fileRef = useRef(null);
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState(null);
  const [importMessage, setImportMessage] = useState('');
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

  const buildImportPreview = (incoming) => {
    const current = migrateData(api.data); const next = migrateData(incoming);
    const sections = ['projects', 'captures', 'suggestions', 'questions'];
    const report = { itemsToAdd: 0, itemsToUpdate: 0, itemsToSkip: 0, possibleConflicts: 0, invalidItems: 0, data: next };
    sections.forEach((key) => {
      const currentIds = new Set(current[key].map((i) => i.id));
      next[key].forEach((item) => {
        if (!item?.id) report.invalidItems += 1;
        else if (!currentIds.has(item.id)) report.itemsToAdd += 1;
        else if (JSON.stringify(current[key].find((i) => i.id === item.id)) !== JSON.stringify(item)) { report.itemsToUpdate += 1; report.possibleConflicts += 1; }
        else report.itemsToSkip += 1;
      });
    });
    return report;
  };

  const reactivateNextAnalysisInboxItems = (input) => {
    const next = migrateData(input);
    next.suggestions = next.suggestions.map((s) => (s.state === 'hidden-until-next-analysis' && s.hiddenUntil === 'next-analysis' ? { ...s, state: 'pending', inboxStatus: 'pending-review', selectedAction: null } : s));
    return next;
  };

  const applyPreview = () => {
    if (!preview?.data) return;
    api.createRollback?.('Before JSON import');
    api.setData(reactivateNextAnalysisInboxItems(preview.data));
    setImportMessage('Import completed. Previous app state saved. You can review and apply any import snapshot below.');
    setPreview(null); setPasteText('');
  };

  const applyImportSnapshot = (snapshot) => {
    if (!snapshot?.state) return;
    if (!window.confirm('This will replace your current app state with this saved import snapshot. Continue?')) return;
    api.setData(reactivateNextAnalysisInboxItems(snapshot.state));
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
    try { setPreview(buildImportPreview(JSON.parse(text))); } catch { setPreview({ plainText: text }); }
  };

  const handlePastePreview = () => {
    try { setPreview(buildImportPreview(JSON.parse(pasteText))); }
    catch { setPreview({ plainText: pasteText }); }
  };

  const importPlainText = () => api.setData((prev) => ({ ...prev, captures: [{ id: crypto.randomUUID(), text: (preview?.plainText || '').trim(), projectId: null, isNewIdea: false, rawState: 'unprocessed', analysisState: 'not-analyzed', processedAt: null, archivedRawAt: null, createdAt: Date.now() }, ...prev.captures] }));

  const resetAppData = () => {
    api.createRollback?.('Before app data reset');
    const defaults = buildDefaultData();
    api.setData({ ...defaults, projects: [], suggestions: [] });
  };

  return <div className="stack"><h2>Settings</h2>
    <section className="card stack"><h3>Import / Export</h3>
      <div className="settings-button-grid">
        <button onClick={() => confirmAction('Export full backup now?', api.exportFullBackup)}>Export full backup</button>
        <button onClick={() => confirmAction('Reset app data to defaults? This cannot be undone without rollback.', resetAppData)}>Reset app data</button>
        <button onClick={() => confirmAction('Export current data for AI analysis?', api.exportAiAnalysis)}>Export for AI analysis</button>
        <button onClick={() => confirmAction('Select and import a JSON file?', () => fileRef.current?.click())}>Import updated JSON file</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json" onChange={handleFileImport} style={{ display: 'none' }} />
      <textarea rows={4} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste JSON or text" />
      <button onClick={() => confirmAction('Preview this pasted JSON/Text import?', handlePastePreview)}>Paste JSON/Text Import</button>
      {importMessage && <p>{importMessage}</p>}

      <div className="card stack">
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
            <p>captures/notes: {snapshot.counts.captures}</p>
            <p>suggestions: {snapshot.counts.suggestions}</p>
            <p>questions: {snapshot.counts.questions}</p>
            <p>settings/prompt profiles included: {snapshot.counts.includesSettings ? 'yes' : 'no'}</p>
            <div className="settings-button-grid">
              <button onClick={() => confirmAction('Apply this import snapshot to your current data?', () => applyImportSnapshot(snapshot))}>Apply import</button>
              <button onClick={() => confirmAction('Delete this saved import snapshot?', () => deleteImportSnapshot(snapshot.id))}>Delete import</button>
            </div>
          </div>)}
        </div> : <p>No import snapshots saved yet.</p>)}
      </div>

      {preview && <div className="card stack"><strong>Import preview</strong>
        {preview.plainText ? <><p>Detected plain text import.</p><button onClick={() => confirmAction('Create a new capture from the pasted text?', importPlainText)}>Create capture from pasted text</button></> : <>
          <p>Add: {preview.itemsToAdd} • Update: {preview.itemsToUpdate} • Skip: {preview.itemsToSkip}</p>
          <p>Conflicts: {preview.possibleConflicts} • Invalid: {preview.invalidItems}</p>
          <button onClick={() => confirmAction('Apply this import preview to your data?', applyPreview)}>Apply import</button>
        </>}
      </div>}
    </section>

    <section className="stack"><h3>Prompt Actions</h3><button onClick={() => confirmAction('Reset all prompt actions to default values?', resetAll)}>Reset all prompt actions to default</button>
      {Object.values(actions).map((action) => <details className="card" key={action.id}><summary>{action.title}</summary><p>{action.description}</p>
        <label><input type="checkbox" checked={action.enabled} onChange={(e) => patchAction(action.id, { enabled: e.target.checked })} /> Enabled</label>
        <textarea rows={4} value={action.prompt} onChange={(e) => patchAction(action.id, { prompt: e.target.value })} />
        <button onClick={() => confirmAction(`Reset "${action.title}" to default?`, () => resetOne(action.id))}>Reset to default</button></details>)}
    </section>

    {isFirebaseConfigured && user && <><div><strong>Signed in:</strong><div>{user.displayName || 'No name available'}</div><div>{user.email || 'No email available'}</div></div><div className="settings-button-grid"><button onClick={() => confirmAction('Import local data to Firebase now?', api.importLocalDataToFirebase)}>Import local data to Firebase</button><button onClick={() => confirmAction('Sign out now?', signOutUser)}>Sign out</button></div></>}
    {!isFirebaseConfigured && <p>Firebase is not configured. Running in local-only mode.</p>}
  </div>;
}
