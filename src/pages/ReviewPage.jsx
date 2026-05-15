export default function ReviewPage({ api }) {
  return <div className="stack"><h2>Review</h2><p>Total captures: {api.data.captures.length}</p><p>Total projects: {api.data.projects.length}</p><button onClick={api.exportJson}>Export JSON</button></div>;
}
