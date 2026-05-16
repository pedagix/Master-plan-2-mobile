import { isFirebaseConfigured, signOutUser } from '../services/firebase';

export default function SettingsPage({ api }) {
  const user = api.user;

  return (
    <div className="stack">
      <h2>Settings</h2>
      <p>Manage your export, sync, and account details.</p>
      <button onClick={api.exportJson}>Export Data JSON</button>

      {isFirebaseConfigured && user && (
        <>
          <div>
            <strong>Signed in:</strong>
            <div>{user.displayName || 'No name available'}</div>
            <div>{user.email || 'No email available'}</div>
          </div>
          <button onClick={api.importLocalDataToFirebase}>Import local data to Firebase</button>
          <button onClick={signOutUser}>Sign out</button>
        </>
      )}

      {!isFirebaseConfigured && (
        <p>Firebase is not configured. Running in local-only mode.</p>
      )}
    </div>
  );
}
