import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NoteCard from '../components/NoteCard';
import NoteEditForm from '../components/NoteEditForm';
import TaskActionSheet from '../components/TaskActionSheet';
import TaskCompletionSheet from '../components/TaskCompletionSheet';
import HistoryTimeline from '../components/HistoryTimeline';
import TaskHistorySheet from '../components/TaskHistorySheet';
import { HMM_DESTINATION, PROJECT_DESTINATION, getPriorityColor, sortByPriorityThenNewest } from '../lib/model';

export default function HmmPage({ api }) {
  const [editingId, setEditingId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [completionTask, setCompletionTask] = useState(null);
  const [historyTask, setHistoryTask] = useState(null);
  const [plansView, setPlansView] = useState('current');
  const submitHandlersRef = useRef({});

  const hmmNotes = useMemo(() => (api.data.notes || [])
    .filter((note) => !note.deleted && !note.legacyShape && note.destination === HMM_DESTINATION)
    .sort(sortByPriorityThenNewest), [api.data.notes]);
  const todos = hmmNotes.filter((note) => note.isTodo);
  const notes = hmmNotes.filter((note) => !note.isTodo);

  const editingNote = hmmNotes.find((note) => note.id === editingId) || null;
  const selectedTask = todos.find((note) => note.id === selectedTaskId) || null;
  const completedPlanTasks = (api.data.completedTasks || []).filter((task) => !task.projectId && (task.completedFrom === 'plans' || task.destination === HMM_DESTINATION));

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

  const completeTodo = (note) => {
    setCompletionTask(note);
    if (editingId === note.id) setEditingId(null);
    if (selectedTaskId === note.id) setSelectedTaskId(null);
  };

  const renderNote = (note) => (
    <NoteCard key={note.id} note={note} projects={api.data.projects} onEdit={() => toggleEdit(note.id)}>
      {editingId === note.id && (
        <div className="edit-panel">
          <NoteEditForm api={api} initialNote={editingNote} submitLabel="Save note" onSave={saveEdit} onDelete={deleteNote} onCancel={() => setEditingId(null)} autoScrollOnMount registerSubmitHandler={(submitHandler) => { if (submitHandler) submitHandlersRef.current[note.id] = submitHandler; else delete submitHandlersRef.current[note.id]; }} />
        </div>
      )}
    </NoteCard>
  );

  return (
    <div className="stack page-screen">
      <div className="history-view-switch" role="tablist" aria-label="Plans view">
        <button type="button" role="tab" aria-selected={plansView === 'current'} className={plansView === 'current' ? 'selected' : ''} onClick={() => setPlansView('current')}>Current</button>
        <button type="button" role="tab" aria-selected={plansView === 'history'} className={plansView === 'history' ? 'selected' : ''} onClick={() => setPlansView('history')}>History <span>{completedPlanTasks.length}</span></button>
      </div>

      {plansView === 'current' && (<>
      {!!todos.length && (
        <section className="stack checklist-list">
          <div className="section-title-row">
            <h3>Plans checklist</h3>
          </div>
          {todos.map((todo) => (
            <div key={todo.id} className="stack checklist-item-stack">
              <div className={`todo-row ${todo.important ? 'important-note-rainbow-border' : ''}`.trim()} style={{ '--priority-color': getPriorityColor(todo.priority) }}>
                <input type="checkbox" checked={false} onChange={() => completeTodo(todo)} />
                <span role="button" tabIndex={0} onClick={() => setSelectedTaskId(todo.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedTaskId(todo.id); } }}>{todo.text}</span>
                <button type="button" className="todo-row-cog-button" aria-label={editingId === todo.id ? 'Save and close checklist item editor' : 'Edit checklist item'} onClick={() => toggleEdit(todo.id)}>⚙️</button>
              </div>
              {editingId === todo.id && (
                <div className="edit-panel">
                  <NoteEditForm api={api} initialNote={editingNote} submitLabel="Save note" onSave={saveEdit} onDelete={deleteNote} onCancel={() => setEditingId(null)} autoScrollOnMount registerSubmitHandler={(submitHandler) => { if (submitHandler) submitHandlersRef.current[todo.id] = submitHandler; else delete submitHandlersRef.current[todo.id]; }} />
                </div>
              )}
            </div>
          ))}
        </section>
      )}


      {selectedTask && (
        <TaskActionSheet
          api={api}
          task={selectedTask}
          projectName="Plans"
          onClose={() => setSelectedTaskId(null)}
          onEdit={() => setEditingId(selectedTask.id)}
          onComplete={() => completeTodo(selectedTask)}
        />
      )}

      <div className="stack note-card-list">
        {!notes.length ? <p className="empty-state">Nothing in Plans.</p> : notes.map(renderNote)}
      </div>
      </>)}

      {plansView === 'history' && (
        <section className="stack project-history-section">
          <div className="section-title-row">
            <div>
              <h3>Progress timeline</h3>
              <p className="helper-text">Completed general tasks, newest first.</p>
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
