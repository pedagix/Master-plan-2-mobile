import { useEffect, useMemo, useState } from 'react';
import {
  CREATE_PROJECT_VALUE,
  HMM_DESTINATION,
  PROJECT_DESTINATION,
  clampPriority,
  getPriorityColor,
  getProjectName,
  getRealProjects,
  normalizeProject,
} from '../lib/model';

function destinationFromNote(note) {
  return note?.destination === PROJECT_DESTINATION && note.projectId ? note.projectId : HMM_DESTINATION;
}

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

export default function NoteEditForm({
  api,
  initialNote = null,
  submitLabel = 'Save note',
  onSave,
  onCancel,
  autoFocus = false,
}) {
  const [text, setText] = useState(initialNote?.text || '');
  const [destination, setDestination] = useState(destinationFromNote(initialNote));
  const [priority, setPriority] = useState(clampPriority(initialNote?.priority));
  const [important, setImportant] = useState(Boolean(initialNote?.important));
  const [isTodo, setIsTodo] = useState(Boolean(initialNote?.isTodo));
  const [error, setError] = useState('');

  useEffect(() => {
    setText(initialNote?.text || '');
    setDestination(destinationFromNote(initialNote));
    setPriority(clampPriority(initialNote?.priority));
    setImportant(Boolean(initialNote?.important));
    setIsTodo(Boolean(initialNote?.isTodo));
    setError('');
  }, [initialNote?.id, initialNote?.destination, initialNote?.projectId]);

  const projects = useMemo(() => getRealProjects(api.data.projects), [api.data.projects]);

  const createProjectFromPrompt = () => {
    const name = window.prompt('Project name');
    if (!name?.trim()) return destination || HMM_DESTINATION;
    const project = buildProject(name.trim());
    api.setData((prev) => ({
      ...prev,
      projects: [project, ...prev.projects],
      settings: { ...prev.settings, lastSelectedProjectId: project.id, lastDestination: project.id },
    }));
    setDestination(project.id);
    return project.id;
  };

  const handleDestinationChange = (value) => {
    if (value === CREATE_PROJECT_VALUE) {
      createProjectFromPrompt();
      return;
    }
    setDestination(value || HMM_DESTINATION);
  };

  const showProjectTodoOption = destination !== HMM_DESTINATION;

  useEffect(() => {
    if (!showProjectTodoOption && isTodo) setIsTodo(false);
  }, [showProjectTodoOption, isTodo]);

  const submit = (event) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Write the note first.');
      return;
    }
    if (isTodo && destination === HMM_DESTINATION) {
      setError('Choose or create a real project before adding this to a to-do list.');
      return;
    }
    const destinationType = destination === HMM_DESTINATION ? HMM_DESTINATION : PROJECT_DESTINATION;
    const selectedActions = [
      destinationType === HMM_DESTINATION ? 'save-to-hmm' : 'add-to-project',
      isTodo ? 'add-to-do-list' : null,
      important ? 'mark-important' : null,
    ].filter(Boolean);
    onSave({
      text: trimmed,
      destination: destinationType,
      projectId: destinationType === PROJECT_DESTINATION ? destination : null,
      priority: clampPriority(priority),
      important,
      isTodo,
      pendingTodoIntent: false,
      selectedActions,
    });
  };

  return (
    <form className="note-form stack" onSubmit={submit}>
      <div className="capture-input-wrap">
        <div className="capture-top-controls" style={{ '--priority-color': getPriorityColor(priority) }}>
          <div className="priority-picker priority-picker-inline">
            <span className="priority-scale-label">cold</span>
            <input
              className="priority-slider"
              type="range"
              min={1}
              max={10}
              step={1}
              value={priority}
              aria-label="Priority level"
              onChange={(event) => setPriority(clampPriority(Number(event.target.value)))}
            />
            <span className="priority-scale-label">hot</span>
          </div>
          <button type="submit" className="capture-save-pill">{submitLabel}</button>
        </div>
        <textarea
          autoFocus={autoFocus}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Capture the idea quickly"
          rows={5}
        />
      </div>

      <div className="capture-secondary-row">
        <button
          type="button"
          className={`important-toggle ${important ? 'is-active' : ''}`}
          onClick={() => setImportant((value) => !value)}
          aria-pressed={important}
        >
          Important
        </button>
        <label className="destination-strip">
          <span>To</span>
          <select value={destination || HMM_DESTINATION} onChange={(event) => handleDestinationChange(event.target.value)}>
            <option value={HMM_DESTINATION}>Hmm</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{getProjectName(project)}</option>)}
            <option value={CREATE_PROJECT_VALUE}>+ Create new project</option>
          </select>
        </label>
      </div>

      {showProjectTodoOption && (
        <div className="option-grid">
          <label className="checkbox-row">
            <input type="checkbox" checked={isTodo} onChange={(event) => setIsTodo(event.target.checked)} />
            <span>Add to project to-do list</span>
          </label>
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
      {onCancel && <div className="actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button></div>}
    </form>
  );
}
