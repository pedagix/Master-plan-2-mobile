import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import NoteCard from '../components/NoteCard';
import NoteEditForm from '../components/NoteEditForm';
import { fileToDataUrl } from '../lib/storage';
import { HMM_PROJECT_ID, PROJECT_DESTINATION, getProjectName, getPriorityColor, sortByPriorityThenNewest } from '../lib/model';

export default function ProjectDetailPage({ api }) {
  const { projectId } = useParams();
  const project = useMemo(() => api.data.projects.find((item) => item.id === projectId), [api.data.projects, projectId]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({ name: '', description: '' });
  const [editingNoteId, setEditingNoteId] = useState(null);
  const todoSubmitHandlersRef = useRef({});
  const noteSubmitHandlersRef = useRef({});
  const [newFormKey, setNewFormKey] = useState(0);
  const [newNoteOpen, setNewNoteOpen] = useState(false);

  useEffect(() => {
    if (!project) return;
    setSettingsDraft({ name: getProjectName(project), description: project.description || '' });
  }, [project?.id]);

  useEffect(() => {
    if (!projectId || projectId === HMM_PROJECT_ID) return;
    api.setData((prev) => ({
      ...prev,
      projects: prev.projects.map((item) => item.id === projectId
        ? { ...item, lastInteractedAt: Date.now(), interactionCount: (item.interactionCount || 0) + 1 }
        : item),
    }));
  }, [projectId]);

  if (projectId === HMM_PROJECT_ID) return <Navigate to="/hmm" replace />;
  if (!project) return <div className="stack"><p>Project not found.</p><Link to="/ta-da">Back to Projects</Link></div>;

  const projectNotes = (api.data.notes || []).filter((note) => !note.deleted && !note.legacyShape && note.projectId === projectId);
  const todos = projectNotes.filter((note) => note.isTodo).sort(sortByPriorityThenNewest);
  const notes = projectNotes.filter((note) => !note.isTodo).sort(sortByPriorityThenNewest);
  const editingNote = projectNotes.find((note) => note.id === editingNoteId) || null;

  const patchProject = (patch) => api.setData((prev) => ({
    ...prev,
    projects: prev.projects.map((item) => item.id === projectId ? { ...item, ...patch, updatedAt: Date.now() } : item),
  }));

  const saveProjectSettings = () => {
    const name = settingsDraft.name.trim();
    if (!name) return;
    patchProject({ name, title: name, description: settingsDraft.description.trim() });
    setSettingsOpen(false);
  };

  const setProjectStatus = (status) => {
    const label = status === 'archived' ? 'Archive' : 'Hide';
    if (!window.confirm(`${label} this project?`)) return;
    patchProject({ status, archived: status === 'archived', hidden: status === 'hidden' });
  };

  const addNote = (patch) => {
    const now = Date.now();
    const note = {
      id: crypto.randomUUID(),
      ...patch,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      sourceType: 'project-detail',
      sourceId: projectId,
    };
    api.setData((prev) => ({
      ...prev,
      notes: [note, ...(prev.notes || [])],
      projects: note.destination === PROJECT_DESTINATION ? prev.projects.map((item) => item.id === note.projectId
        ? { ...item, updatedAt: now, lastInteractedAt: now, interactionCount: (item.interactionCount || 0) + 1 }
        : item) : prev.projects,
    }));
    setNewFormKey((value) => value + 1);
    setNewNoteOpen(false);
  };

  const saveNoteEdit = (patch) => {
    if (!editingNoteId) return;
    const now = Date.now();
    api.setData((prev) => ({
      ...prev,
      notes: (prev.notes || []).map((note) => note.id === editingNoteId ? { ...note, ...patch, updatedAt: now } : note),
      projects: patch.destination === PROJECT_DESTINATION
        ? prev.projects.map((item) => item.id === patch.projectId
          ? { ...item, updatedAt: now, lastInteractedAt: now, interactionCount: (item.interactionCount || 0) + 1 }
          : item)
        : prev.projects,
    }));
    setEditingNoteId(null);
  };

  const deleteNote = (note) => {
    if (!window.confirm('Delete this note?')) return;
    const now = Date.now();
    api.setData((prev) => ({
      ...prev,
      notes: (prev.notes || []).map((item) => item.id === note.id ? { ...item, deleted: true, deletedAt: now, updatedAt: now } : item),
    }));
    if (editingNoteId === note.id) setEditingNoteId(null);
  };

  const completeTodo = (note) => {
    if (!window.confirm('Mark this task as done?')) return;
    const now = Date.now();
    const completed = {
      id: crypto.randomUUID(),
      sourceNoteId: note.id,
      projectId,
      text: note.text,
      priority: note.priority,
      completedAt: now,
    };
    api.setData((prev) => ({
      ...prev,
      notes: (prev.notes || []).map((item) => item.id === note.id
        ? { ...item, deleted: true, deletedAt: now, completedAt: now, updatedAt: now }
        : item),
      completedTasks: [completed, ...(prev.completedTasks || [])],
      projects: prev.projects.map((item) => item.id === projectId
        ? { ...item, tasksDone: (item.tasksDone || 0) + 1, updatedAt: now, lastInteractedAt: now }
        : item),
    }));
  };

  const toggleTodoEdit = (todoId) => {
    if (editingNoteId !== todoId) {
      setEditingNoteId(todoId);
      return;
    }
    const submitHandler = todoSubmitHandlersRef.current[todoId] || noteSubmitHandlersRef.current[todoId];
    if (submitHandler) {
      submitHandler();
      return;
    }
    setEditingNoteId(null);
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    patchProject({
      gallery: [...(project.gallery || []), { id: crypto.randomUUID(), name: file.name, createdAt: Date.now(), previewUrl: url, noteId: null }],
      lastInteractedAt: Date.now(),
    });
  };

  return (
    <div className="stack page-screen">
      <div className="page-title-row">
        <div>
          <Link to="/ta-da" className="back-link">Projects</Link>
          <h2>{getProjectName(project)}</h2>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button" onClick={() => setNewNoteOpen(true)}>New Note</button>
          <button type="button" className="secondary-button" onClick={() => setSettingsOpen((value) => !value)}>Settings</button>
        </div>
      </div>
      {project.description && <p className="project-description">{project.description}</p>}

      {settingsOpen && (
        <section className="edit-panel stack">
          <input value={settingsDraft.name} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="Project title" />
          <textarea rows={3} value={settingsDraft.description} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder="Description" />
          <div className="actions">
            <button type="button" onClick={saveProjectSettings}>Save settings</button>
            <button type="button" className="secondary-button" onClick={() => setSettingsOpen(false)}>Cancel</button>
            <button type="button" className="secondary-button" onClick={() => setProjectStatus('hidden')}>Hide</button>
            <button type="button" className="danger-button" onClick={() => setProjectStatus('archived')}>Archive</button>
          </div>
        </section>
      )}

      <section className="stack checklist-list">
        <div className="section-title-row">
          <h3>Checklist</h3>
          <span className="done-counter">{project.tasksDone || 0} done</span>
        </div>
        {!todos.length && <p className="empty-state">No active to-dos.</p>}
        {todos.map((todo) => (
          <div key={todo.id} className="stack checklist-item-stack">
            <div className={`todo-row ${todo.important ? 'important-note-rainbow-border' : ''}`.trim()} style={{ '--priority-color': getPriorityColor(todo.priority) }}>
              <input type="checkbox" checked={false} onChange={() => completeTodo(todo)} />
              <span>{todo.text}</span>
              <button
                type="button"
                className="todo-row-cog-button"
                aria-label={editingNoteId === todo.id ? 'Save and close checklist item editor' : 'Edit checklist item'}
                onClick={() => toggleTodoEdit(todo.id)}
              >
                ⚙
              </button>
            </div>
            {editingNoteId === todo.id && (
              <div className="edit-panel">
                <NoteEditForm
                  api={api}
                  initialNote={todo}
                  submitLabel="Save"
                  onSave={saveNoteEdit}
                  onDelete={deleteNote}
                  onCancel={() => setEditingNoteId(null)}
                  registerSubmitHandler={(submitHandler) => {
                    if (submitHandler) todoSubmitHandlersRef.current[todo.id] = submitHandler;
                    else delete todoSubmitHandlersRef.current[todo.id];
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </section>

      {newNoteOpen && (
        <section className="stack edit-panel new-aha-panel">
          <div className="section-title-row">
            <h3>New Note</h3>
          </div>
          <NoteEditForm
            key={`${projectId}-${newFormKey}`}
            api={api}
            initialNote={{ destination: PROJECT_DESTINATION, projectId, priority: 5, important: false, isTodo: false }}
            submitLabel="Save Note"
            onSave={addNote}
            onCancel={() => setNewNoteOpen(false)}
            autoFocus
          />
        </section>
      )}

      <section className="stack">
        <h3>Notes</h3>
        {!notes.length && <p className="empty-state">No project notes.</p>}
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} projects={api.data.projects} onEdit={() => toggleTodoEdit(note.id)}>
            {editingNoteId === note.id && (
              <div className="edit-panel">
                <NoteEditForm api={api} initialNote={editingNote} submitLabel="Save note" onSave={saveNoteEdit} onDelete={deleteNote} onCancel={() => setEditingNoteId(null)} registerSubmitHandler={(submitHandler) => { if (submitHandler) noteSubmitHandlersRef.current[note.id] = submitHandler; else delete noteSubmitHandlersRef.current[note.id]; }} />
              </div>
            )}
          </NoteCard>
        ))}
      </section>

      <details className="stack">
        <summary>Gallery</summary>
        <input type="file" accept="image/*" onChange={upload} />
        <div className="gallery">{[...(project.gallery || [])].sort((a, b) => a.createdAt - b.createdAt).map((img) => (
          <div className="img-card" key={img.id}><img src={img.previewUrl} alt={img.name} /><small>{img.name}</small></div>
        ))}</div>
      </details>
    </div>
  );
}
