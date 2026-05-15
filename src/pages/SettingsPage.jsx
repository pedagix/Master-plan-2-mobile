export default function SettingsPage({ api }) {
  return <div className="stack"><h2>Settings</h2><p>Placeholder settings for future private sync and preferences.</p><button onClick={api.exportJson}>Export Data JSON</button></div>;
}
