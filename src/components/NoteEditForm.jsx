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
import {
  focusTextareaForMobileEdit,
  noteCursorStorageKey,
  scrollEditPanelIntoView,
  storeCursorPosition,
} from '../lib/mobileEditorFocus';

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
  autoScrollOnMount = false,
  fitAvailableSpace = false,
  registerSubmitHandler,
}) {
  const [text, setText] = useState(initialNote?.text || '');
  const [destination, setDestination] = useState(destinationFromNote(initialNote));
  const [priority, setPriority] = useState(clampPriority(initialNote?.priority));
  const [error, setError] = useState('');
  const textareaRef = useRef(null);
  const formRef = useRef(null);
  const captureRef = useRef(null);
  const cursorStorageKey = useMemo(() => noteCursorStorageKey(initialNote?.id), [initialNote?.id]);

  useEffect(() => {
    if (!autoFocus && !autoScrollOnMount) return undefined;
    return focusTextareaForMobileEdit({
      textarea: textareaRef.current,
      formElement: formRef.current,
      storageKey: cursorStorageKey,
      shouldFocus: autoFocus || autoScrollOnMount,
    });
  }, [autoFocus, autoScrollOnMount, cursorStorageKey, initialNote?.id]);

  useEffect(() => {
    if (!registerSubmitHandler) return undefined;
    registerSubmitHandler(() => formRef.current?.requestSubmit());
    return () => registerSubmitHandler(null);
  }, [registerSubmitHandler]);

  useEffect(() => {
    if (!fitAvailableSpace || typeof window === 'undefined') return undefined;

    const form = formRef.current;
    const capture = captureRef.current;
    if (!form || !capture) return undefined;

    let frame = 0;
    const observed = new Set();
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => scheduleMeasure())
      : null;

    const observe = (element) => {
      if (!resizeObserver || !element || observed.has(element)) return;
      observed.add(element);
      resizeObserver.observe(element);
    };

    const measureAvailableSpace = () => {
      frame = 0;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight ?? document.documentElement.clientHeight ?? 0;
      const viewportBottom = viewportTop + viewportHeight;
      const header = document.querySelector('.top-header');
      const nav = document.querySelector('.bottom-nav');
      const nowBar = document.querySelector('.now-bar');

      observe(form);
      observe(capture);
      observe(header);
      observe(nav);
      observe(nowBar);

      const formRect = form.getBoundingClientRect();
      const captureRect = capture.getBoundingClientRect();
      const headerBottom = header?.getBoundingClientRect().bottom ?? viewportTop;
      const bottomModuleTop = nowBar?.getBoundingClientRect().top
        ?? nav?.getBoundingClientRect().top
        ?? viewportBottom;

      const safeTop = Math.max(viewportTop + 8, headerBottom + 8);
      const safeBottom = Math.max(safeTop, Math.min(viewportBottom - 8, bottomModuleTop - 8));

      // Keep room for any validation/actions rendered below the capture window.
      // The capture itself is the only flexible part of this form.
      const outsideCaptureHeight = Math.max(0, formRect.height - captureRect.height);
      const captureTop = Math.max(captureRect.top, safeTop);
      const availableHeight = Math.max(0, Math.floor(safeBottom - captureTop - outsideCaptureHeight));

      form.style.setProperty('--note-capture-max-height', `${availableHeight}px`);

      if (document.activeElement === textareaRef.current) {
        window.requestAnimationFrame(() => scrollEditPanelIntoView(form, textareaRef.current));
      }
    };

    const scheduleMeasure = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measureAvailableSpace);
    };

    scheduleMeasure();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', scheduleMeasure);
    viewport?.addEventListener('scroll', scheduleMeasure);
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', scheduleMeasure);
    window.addEventListener('focusin', scheduleMeasure);
    window.addEventListener('focusout', scheduleMeasure);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      viewport?.removeEventListener('resize', scheduleMeasure);
      viewport?.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleMeasure);
      window.removeEventListener('focusin', scheduleMeasure);
      window.removeEventListener('focusout', scheduleMeasure);
      form.style.removeProperty('--note-capture-max-height');
    };
  }, [fitAvailableSpace, Boolean(api.data.activeTask)]);

  useEffect(() => {
    setText(initialNote?.text || '');
    setDestination(destinationFromNote(initialNote));
    setPriority(clampPriority(initialNote?.priority));
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
    storeCursorPosition(cursorStorageKey, textareaRef.current);
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Write the note first.');
      return;
    }
    const destinationType = destination === HMM_DESTINATION ? HMM_DESTINATION : PROJECT_DESTINATION;
    onSave({
      text: trimmed,
      destination: destinationType,
      projectId: destinationType === PROJECT_DESTINATION ? destination : null,
      priority: clampPriority(priority),
      important: false,
      isTodo: false,
      pendingTodoIntent: false,
      selectedActions: [destinationType === HMM_DESTINATION ? 'save-to-plans' : 'add-to-project'],
    });
  };

  return (
    <form
      ref={formRef}
      className={`note-form stack ${fitAvailableSpace ? 'note-form-fit-viewport' : ''}`.trim()}
      onSubmit={submit}
    >
      <div ref={captureRef} className="capture-input-wrap">
        <div className="capture-top-controls" style={{ '--priority-color': getPriorityColor(priority) }}>
          <div className="priority-picker priority-picker-inline">
            <span className="priority-scale-label">priority</span>
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
          </div>
          <div className="capture-top-actions">
            <button type="submit" className="capture-save-pill">{submitLabel}</button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className="note-capture-textarea"
          autoFocus={autoFocus}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            storeCursorPosition(cursorStorageKey, event.target);
          }}
          onSelect={(event) => storeCursorPosition(cursorStorageKey, event.target)}
          onKeyUp={(event) => storeCursorPosition(cursorStorageKey, event.target)}
          onClick={(event) => storeCursorPosition(cursorStorageKey, event.target)}
          placeholder="Capture the idea quickly"
          rows={5}
        />
        <div className="capture-secondary-row capture-destination-only">
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
