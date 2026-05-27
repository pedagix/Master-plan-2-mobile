import { useEffect, useMemo, useRef, useState } from 'react';
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
  onDelete,
  autoFocus = false,
  registerSubmitHandler,
}) {
  const [text, setText] = useState(initialNote?.text || '');
  const [destination, setDestination] = useState(destinationFromNote(initialNote));
  const [priority, setPriority] = useState(clampPriority(initialNote?.priority));
  const [important, setImportant] = useState(Boolean(initialNote?.important));
  const [isTodo, setIsTodo] = useState(Boolean(initialNote?.isTodo));
  const [error, setError] = useState('');

  const [keyboardInset, setKeyboardInset] = useState(0);
  const [availableViewportHeight, setAvailableViewportHeight] = useState(null);
  const textareaRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (!registerSubmitHandler) return undefined;
    registerSubmitHandler(() => formRef.current?.requestSubmit());
    return () => registerSubmitHandler(null);
  }, [registerSubmitHandler]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return undefined;

    const viewport = window.visualViewport;

    const updateKeyboardInset = () => {
      const fullHeight = window.innerHeight || 0;
      const viewportHeight = Math.max(0, viewport.height || 0);
      const keyboardHeight = Math.max(0, fullHeight - viewportHeight - viewport.offsetTop);
      const hasFocus = document.activeElement === textareaRef.current;
      setAvailableViewportHeight(Math.round(viewportHeight));
      setKeyboardInset(hasFocus ? keyboardHeight : 0);
    };

    updateKeyboardInset();
    viewport.addEventListener('resize', updateKeyboardInset);
    viewport.addEventListener('scroll', updateKeyboardInset);
    window.addEventListener('focusin', updateKeyboardInset);
    window.addEventListener('focusout', updateKeyboardInset);

    return () => {
      viewport.removeEventListener('resize', updateKeyboardInset);
      viewport.removeEventListener('scroll', updateKeyboardInset);
      window.removeEventListener('focusin', updateKeyboardInset);
      window.removeEventListener('focusout', updateKeyboardInset);
    };
  }, []);

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

  const submit = (event) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Write the note first.');
      return;
    }
    const destinationType = destination === HMM_DESTINATION ? HMM_DESTINATION : PROJECT_DESTINATION;
    const selectedActions = [
      destinationType === HMM_DESTINATION ? 'save-to-plans' : 'add-to-project',
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
    <form
      ref={formRef}
      className="note-form stack"
      onSubmit={submit}
      style={{
        '--keyboard-inset': `${keyboardInset}px`,
        '--available-vh': availableViewportHeight ? `${availableViewportHeight}px` : '100dvh',
      }}
    >
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
          <div className="capture-top-actions">
            <button type="submit" className="capture-save-pill">{submitLabel}</button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          autoFocus={autoFocus}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Capture the idea quickly"
          rows={5}
        />
        <div className="capture-secondary-row">
          <button
            type="button"
            className={`important-toggle ${important ? 'is-active' : ''}`}
            onClick={() => setImportant((value) => !value)}
            aria-pressed={important}
          >
            Important
          </button>
          <button
            type="button"
            className={`important-toggle checklist-toggle ${isTodo ? 'is-active' : ''}`}
            onClick={() => setIsTodo((value) => !value)}
            aria-pressed={isTodo}
            aria-label={destination === HMM_DESTINATION ? 'Add this note to the Plans checklist' : 'Add this note to the selected project list'}
          >
            Add to list
          </button>
          <select className="capture-destination-select" value={destination || HMM_DESTINATION} onChange={(event) => handleDestinationChange(event.target.value)}>
            <option value={HMM_DESTINATION}>Plans</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{getProjectName(project)}</option>)}
            <option value={CREATE_PROJECT_VALUE}>+ Create new project</option>
          </select>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {(onCancel || onDelete) && (
        <div className="actions note-edit-actions-row">
          {onCancel ? <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button> : <span />}
          {onDelete && <button type="button" className="capture-delete-pill" onClick={() => onDelete(initialNote)}>Delete</button>}
        </div>
      )}
    </form>
  );
}
