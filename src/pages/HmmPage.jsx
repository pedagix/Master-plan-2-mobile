import { useMemo, useState } from 'react';
import NoteCard from '../components/NoteCard';
import NoteEditForm from '../components/NoteEditForm';
import { HMM_DESTINATION, PROJECT_DESTINATION, sortByPriorityThenNewest } from '../lib/model';

const views = [
  ['notes', 'Notes'],
  ['projects', 'Projects'],
  ['priority', 'Priority'],
];

export default function HmmPage({ api }) {
  const [view, setView] = useState('notes');
  const [editingId, setEditingId] = useState(null);

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

  const renderNote = (note) => (
    <NoteCard key={note.id} note={note} projects={api.data.projects} onEdit={() => setEditingId(note.id)} onDelete={deleteNote}>
      {editingId === note.id && (
        <div className="edit-panel">
          <NoteEditForm api={api} initialNote={editingNote} submitLabel="Save note" onSave={saveEdit} onCancel={() => setEditingId(null)} />
        </div>
      )}
    </NoteCard>
  );

  const renderContent = () => {
    if (!hmmNotes.length) return <p className="empty-state">Nothing in Hmm.</p>;
    if (view === 'projects') {
      return (
        <section className="stack grouped-list">
          <h3>Hmm</h3>
          {hmmNotes.map(renderNote)}
        </section>
      );
    }
    if (view === 'priority') {
      return Array.from({ length: 10 }, (_, index) => 10 - index).map((priority) => {
        const group = hmmNotes.filter((note) => note.priority === priority);
        if (!group.length) return null;
        return (
          <section className="stack grouped-list" key={priority}>
            <h3>Priority {priority}</h3>
            {group.map(renderNote)}
          </section>
        );
      });
    }
    return hmmNotes.map(renderNote);
  };

  return (
    <div className="stack page-screen">
      <div className="page-title-row">
        <h2>Hmm</h2>
      </div>

      <div className="segmented-control" role="tablist" aria-label="Hmm view">
        {views.map(([id, label]) => (
          <button key={id} type="button" className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>

      <div className="stack">{renderContent()}</div>
    </div>
  );
}
