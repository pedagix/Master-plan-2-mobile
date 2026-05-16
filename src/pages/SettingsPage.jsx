import { useMemo, useRef, useState } from 'react';
import { isFirebaseConfigured, signOutUser } from '../services/firebase';
import { buildDefaultPromptProfile, migrateData } from '../lib/model';

export default function SettingsPage({ api }) {
  const user = api.user;
  const fileRef = useRef(null);
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState(null);
  const [importMessage, setImportMessage] = useState('');
  const [rollbackInfoOpen, setRollbackInfoOpen] = useState(false);

  const profile = api.data.settings.promptProfiles.find((p) => p.id === api.data.settings.activePromptProfileId) || api.data.settings.promptProfiles[0];
  const actions = profile.promptActions;
  const latestRollback = useMemo(() => api.getLatestRollback?.(), [api.data]);

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

  const applyPreview = () => {
    if (!preview?.data) return;
    api.createRollback?.('Before JSON import');
    api.setData(preview.data);
    setImportMessage('Import completed. Previous app state saved. You can roll back if something looks wrong.');
    setPreview(null); setPasteText('');
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

  const importPlainText = () => api.setData((prev) => ({ ...prev, captures: [{ id: crypto.randomUUID(), text: (preview?.plainText || '').trim(), projectId: null, isNewIdea: false, createdAt: Date.now() }, ...prev.captures] }));

  const restoreRollback = () => {
    const rollback = api.getLatestRollback?.();
    if (!rollback) return;
    if (!window.confirm('This will replace the current app state with the previous saved state. Current changes after the import may be lost.')) return;
    api.setData(migrateData(rollback.state));
  };

  return <div className="stack"><h2>Settings</h2>
    <section className="card stack"><h3>Import / Export</h3>
      <button onClick={api.exportFullBackup}>Export full backup</button>
      <button onClick={api.exportAiAnalysis}>Export for AI analysis</button>
      <button onClick={() => fileRef.current?.click()}>Import updated JSON file</button>
      <input ref={fileRef} type="file" accept="application/json" onChange={handleFileImport} style={{ display: 'none' }} />
      <textarea rows={4} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste JSON or text" />
      <button onClick={handlePastePreview}>Paste JSON/Text Import</button>
      {importMessage && <p>{importMessage}</p>}

      <div className="card stack">
        <button onClick={restoreRollback} disabled={!latestRollback}>Restore previous state</button>
        <button onClick={() => setRollbackInfoOpen((v) => !v)}>View rollback info</button>
        <button onClick={api.clearRollbacks} disabled={!latestRollback}>Delete rollback snapshot</button>
        {rollbackInfoOpen && (latestRollback ? <div>
          <p>createdAt: {new Date(latestRollback.createdAt).toISOString()}</p>
          <p>reason: {latestRollback.reason}</p>
          <p>projects: {latestRollback.counts.projects}</p>
          <p>captures/notes: {latestRollback.counts.captures}</p>
          <p>suggestions: {latestRollback.counts.suggestions}</p>
          <p>questions: {latestRollback.counts.questions}</p>
          <p>settings/prompt profiles included: {latestRollback.counts.includesSettings ? 'yes' : 'no'}</p>
        </div> : <p>No rollback snapshot saved yet.</p>)}
      </div>

      {preview && <div className="card stack"><strong>Import preview</strong>
        {preview.plainText ? <><p>Detected plain text import.</p><button onClick={importPlainText}>Create capture from pasted text</button></> : <>
          <p>Add: {preview.itemsToAdd} • Update: {preview.itemsToUpdate} • Skip: {preview.itemsToSkip}</p>
          <p>Conflicts: {preview.possibleConflicts} • Invalid: {preview.invalidItems}</p>
          <button onClick={applyPreview}>Apply import</button>
        </>}
      </div>}
    </section>

    <section className="stack"><h3>Prompt Actions</h3><button onClick={resetAll}>Reset all prompt actions to default</button>
      {Object.values(actions).map((action) => <details className="card" key={action.id}><summary>{action.title}</summary><p>{action.description}</p>
        <label><input type="checkbox" checked={action.enabled} onChange={(e) => patchAction(action.id, { enabled: e.target.checked })} /> Enabled</label>
        <textarea rows={4} value={action.prompt} onChange={(e) => patchAction(action.id, { prompt: e.target.value })} />
        <button onClick={() => resetOne(action.id)}>Reset to default</button></details>)}
    </section>

    {isFirebaseConfigured && user && <><div><strong>Signed in:</strong><div>{user.displayName || 'No name available'}</div><div>{user.email || 'No email available'}</div></div><button onClick={api.importLocalDataToFirebase}>Import local data to Firebase</button><button onClick={signOutUser}>Sign out</button></>}
    {!isFirebaseConfigured && <p>Firebase is not configured. Running in local-only mode.</p>}
  </div>;
}
