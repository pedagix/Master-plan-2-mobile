import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NoteCard from '../components/NoteCard';
import NoteEditForm from '../components/NoteEditForm';
import { HMM_DESTINATION, PROJECT_DESTINATION, getProjectName, getRealProjects, normalizeProject, sortByPriorityThenNewest } from '../lib/model';

function buildProject(name) {
  const now = Date.now();
  return normalizeProject({
    id: crypto.randomUUID(),
    name,
    title: name,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    lastInteractedAt: now,
    interactionCount: 1,
    tasksDone: 0,
    notes: [],
    gallery: [],
  });
}

export default function TaDaPage({ api }) {
  const [editingImportantId, setEditingImportantId] = useState(null);
  const submitHandlersRef = useRef({});

  const projects = useMemo(() => getRealProjects(api.data.projects)
    .sort((a, b) => (b.lastInteractedAt || b.updatedAt || b.createdAt || 0) - (a.lastInteractedAt || a.updatedAt || a.createdAt || 0)), [api.data.projects]);
  const importantNotes = useMemo(() => (api.data.notes || [])
    .filter((note) => !note.deleted && !note.legacyShape && note.important)
    .sort(sortByPriorityThenNewest), [api.data.notes]);
  const editingImportantNote = importantNotes.find((note) => note.id === editingImportantId) || null;

  const createProject = () => {
    const name = window.prompt('Project name');
    if (!name?.trim()) return;
    const project = buildProject(name.trim());
    api.setData((prev) => ({
      ...prev,
      projects: [project, ...prev.projects],
      settings: { ...prev.settings, lastSelectedProjectId: project.id, lastDestination: project.id },
    }));
  };

  const saveImportantEdit = (patch) => {
    if (!editingImportantId) return;
    const now = Date.now();
    api.setData((prev) => ({
      ...prev,
      notes: (prev.notes || []).map((note) => note.id === editingImportantId ? { ...note, ...patch, updatedAt: now } : note),
      projects: patch.destination === PROJECT_DESTINATION
        ? prev.projects.map((project) => project.id === patch.projectId
          ? { ...project, updatedAt: now, lastInteractedAt: now, interactionCount: (project.interactionCount || 0) + 1 }
          : project)
        : prev.projects,
      settings: {
        ...prev.settings,
        lastDestination: patch.destination === HMM_DESTINATION ? HMM_DESTINATION : patch.projectId,
        lastSelectedProjectId: patch.projectId || prev.settings.lastSelectedProjectId,
      },
    }));
    setEditingImportantId(null);
  };


  const deleteImportantNote = (note) => {
    if (!window.confirm('Delete this note?')) return;
    const now = Date.now();
    api.setData((prev) => ({
      ...prev,
      notes: (prev.notes || []).map((item) => item.id === note.id ? { ...item, deleted: true, deletedAt: now, updatedAt: now } : item),
    }));
    if (editingImportantId === note.id) setEditingImportantId(null);
  };

  const toggleImportantEdit = (noteId) => {
    if (editingImportantId !== noteId) {
      setEditingImportantId(noteId);
      return;
    }
    const submitHandler = submitHandlersRef.current[noteId];
    if (submitHandler) submitHandler();
    else setEditingImportantId(null);
  };

  const projectTodoCount = (projectId) => (api.data.notes || []).filter((note) => !note.deleted && !note.legacyShape && note.projectId === projectId && note.isTodo).length;

  return (
    <div className="stack page-screen">
      <div className="page-title-row">
        <h2>Ta-da</h2>
      </div>

      <section className="stack">
        <div className="section-title-row">
          <h3>Projects</h3>
          <button type="button" className="secondary-button" onClick={createProject}>New</button>
        </div>
        {!projects.length && <p className="empty-state">No projects yet.</p>}
        <div className="project-grid">
          {projects.map((project) => (
            <Link key={project.id} className="project-tile card" to={`/projects/${project.id}`}>
              <strong>{getProjectName(project)}</strong>
              <span>{projectTodoCount(project.id)} to-do</span>
              <span>{project.tasksDone || 0} done</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="stack">
        <h3>Important</h3>
        {!importantNotes.length && <p className="empty-state">No important notes.</p>}
        {importantNotes.map((note) => (
          <NoteCard key={note.id} note={note} projects={api.data.projects} onEdit={() => toggleImportantEdit(note.id)}>
            {editingImportantId === note.id && (
              <div className="edit-panel">
                <NoteEditForm api={api} initialNote={editingImportantNote} submitLabel="Save note" onSave={saveImportantEdit} onDelete={deleteImportantNote} onCancel={() => setEditingImportantId(null)} registerSubmitHandler={(submitHandler) => { if (submitHandler) submitHandlersRef.current[note.id] = submitHandler; else delete submitHandlersRef.current[note.id]; }} />
              </div>
            )}
          </NoteCard>
        ))}
      </section>
    </div>
  );
}
