import { useMemo, useRef, useState } from 'react';
import NoteCard from '../components/NoteCard';
import NoteEditForm from '../components/NoteEditForm';
import { HMM_DESTINATION, PROJECT_DESTINATION, sortByPriorityThenNewest } from '../lib/model';

export default function HmmPage({ api }) {
  const [editingId, setEditingId] = useState(null);
  const submitHandlersRef = useRef({});

  const hmmNotes = useMemo(() => (api.data.notes || [])
    .filter((note) => !note.deleted && !note.legacyShape && note.destination === HMM_DESTINATION)
    .sort(sortByPriorityThenNewest), [api.data.notes]);

  const editingNote = hmmNotes.find((note) => note.id === editingId) || null;

  const saveEdit = (patch) => {
    if (!editingId) return;
    const now = Date.now();
    api.setData((prev) => ({
      ...prev,
      notes: (prev.notes || []).map((note) => note.id === editingId ? { ...note, ...patch, updatedAt: now } : note),
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
    setEditingId(null);
  };


  const deleteNote = (note) => {
    if (!window.confirm('Delete this note?')) return;
    const now = Date.now();
    api.setData((prev) => ({
      ...prev,
      notes: (prev.notes || []).map((item) => item.id === note.id ? { ...item, deleted: true, deletedAt: now, updatedAt: now } : item),
    }));
    if (editingId === note.id) setEditingId(null);
  };

  const toggleEdit = (noteId) => {
    if (editingId !== noteId) {
      setEditingId(noteId);
      return;
    }
    const submitHandler = submitHandlersRef.current[noteId];
    if (submitHandler) submitHandler();
    else setEditingId(null);
  };

  const renderNote = (note) => (
    <NoteCard key={note.id} note={note} projects={api.data.projects} onEdit={() => toggleEdit(note.id)}>
      {editingId === note.id && (
        <div className="edit-panel">
          <NoteEditForm api={api} initialNote={editingNote} submitLabel="Save note" onSave={saveEdit} onDelete={deleteNote} onCancel={() => setEditingId(null)} registerSubmitHandler={(submitHandler) => { if (submitHandler) submitHandlersRef.current[note.id] = submitHandler; else delete submitHandlersRef.current[note.id]; }} />
        </div>
      )}
    </NoteCard>
  );

  return (
    <div className="stack page-screen">
      <div className="page-title-row">
        <h2>Hmm</h2>
      </div>

      <div className="stack">
        {!hmmNotes.length ? <p className="empty-state">Nothing in Hmm.</p> : hmmNotes.map(renderNote)}
      </div>
    </div>
  );
}
