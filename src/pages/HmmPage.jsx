import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import NoteCard from '../components/NoteCard';
import NoteEditForm from '../components/NoteEditForm';
import TaskActionSheet from '../components/TaskActionSheet';
import TaskCompletionSheet from '../components/TaskCompletionSheet';
import HistoryTimeline from '../components/HistoryTimeline';
import TaskHistorySheet from '../components/TaskHistorySheet';
import { HMM_DESTINATION, PROJECT_DESTINATION, sortByPriorityThenNewest } from '../lib/model';
import { deleteNoteData } from '../lib/taskTracking';

export default function HmmPage({ api }) {
  const [editingId, setEditingId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [completionTask, setCompletionTask] = useState(null);
  const [historyTask, setHistoryTask] = useState(null);
  const [plansView, setPlansView] = useState('current');

  const currentItems = useMemo(() => (api.data.notes || [])
    .filter((note) => !note.deleted && !note.legacyShape && note.destination === HMM_DESTINATION)
    .sort(sortByPriorityThenNewest), [api.data.notes]);

  const editingNote = currentItems.find((note) => note.id === editingId) || null;
  const selectedItem = currentItems.find((note) => note.id === selectedItemId) || null;
  const completedPlanTasks = (api.data.completedTasks || [])
    .filter((task) => !task.deleted && !task.projectId && (task.completedFrom === 'plans' || task.destination === HMM_DESTINATION));

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
    api.showNoteSavedConfirmation?.();
  };

  const deleteNote = (note) => {
    if (!window.confirm(`Delete “${note.text}”?`)) return;
    api.setData((prev) => deleteNoteData(prev, note));
    if (editingId === note.id) setEditingId(null);
    if (selectedItemId === note.id) setSelectedItemId(null);
  };

  const completeItem = (note) => {
    setCompletionTask(note);
    if (editingId === note.id) setEditingId(null);
    if (selectedItemId === note.id) setSelectedItemId(null);
  };

  return (
    <div className="stack page-screen">
      <div className="history-view-switch" role="tablist" aria-label="Plans view">
        <button type="button" role="tab" aria-selected={plansView === 'current'} className={plansView === 'current' ? 'selected' : ''} onClick={() => setPlansView('current')}>Current</button>
        <button type="button" role="tab" aria-selected={plansView === 'history'} className={plansView === 'history' ? 'selected' : ''} onClick={() => setPlansView('history')}>History <span>{completedPlanTasks.length}</span></button>
      </div>

      {plansView === 'current' && (
        <section className="stack note-card-list unified-item-list">
          {!currentItems.length && <p className="empty-state">Nothing in Plans.</p>}
          {currentItems.map((note) => (
            <NoteCard key={note.id} note={note} onOpen={() => setSelectedItemId(note.id)}>
              {editingId === note.id && (
                <div className="edit-panel">
                  <NoteEditForm
                    api={api}
                    initialNote={editingNote}
                    submitLabel="Save note"
                    onSave={saveEdit}
                    onDelete={deleteNote}
                    onCancel={() => setEditingId(null)}
                    autoScrollOnMount
                  />
                </div>
              )}
            </NoteCard>
          ))}
        </section>
      )}

      {selectedItem && (
        <TaskActionSheet
          api={api}
          task={selectedItem}
          projectName="Plans"
          onClose={() => setSelectedItemId(null)}
          onEdit={() => setEditingId(selectedItem.id)}
          onComplete={() => completeItem(selectedItem)}
          onDelete={deleteNote}
        />
      )}

      {plansView === 'history' && (
        <section className="stack project-history-section">
          <div className="section-title-row">
            <div>
              <h3>Progress timeline</h3>
              <p className="helper-text">Completed items, newest first.</p>
            </div>
            <Link className="secondary-button button-link" to="/reports?project=plans">Report</Link>
          </div>
          <HistoryTimeline completedTasks={completedPlanTasks} onSelect={setHistoryTask} />
        </section>
      )}

      {completionTask && (
        <TaskCompletionSheet api={api} task={completionTask} projectName="Plans" onClose={() => setCompletionTask(null)} />
      )}

      {historyTask && (
        <TaskHistorySheet api={api} completedTask={historyTask} projectName="Plans" onClose={() => setHistoryTask(null)} />
      )}
    </div>
  );
}
