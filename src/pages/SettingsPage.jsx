import { importLocalToFirebase } from '../services/firestoreDataStore';
import { localDataStore } from '../services/localDataStore';

export default function SettingsPage({ api }) {
  const handleImport = async () => {
    if (!api.user) return;
    const localData = localDataStore.load();
    await importLocalToFirebase(api.user.uid, localData);
    alert('Local data imported to Firebase.');
  };

  return <div className="stack"><h2>Settings</h2>
    <p>Placeholder settings for future private sync and preferences.</p>
    {api.user ? <p>Signed in as: {api.user.displayName || 'Unknown'} ({api.user.email})</p> : <p>Not signed in.</p>}
    <button onClick={api.exportJson}>Export Data JSON</button>
    {api.isFirebaseConfigured && api.user ? <button onClick={handleImport}>Import local data to Firebase</button> : null}
    {api.isFirebaseConfigured && api.user ? <button onClick={api.signOut}>Sign out</button> : null}
  </div>;
}
