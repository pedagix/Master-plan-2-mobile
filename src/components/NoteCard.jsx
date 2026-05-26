import { HMM_DESTINATION, getPriorityColor, getProjectName } from '../lib/model';

function destinationLabel(note, projects) {
  if (note.destination === HMM_DESTINATION || !note.projectId) return 'Hmm';
  return getProjectName(projects.find((project) => project.id === note.projectId));
}

export default function NoteCard({ note, projects = [], onEdit, onDelete, children }) {
  const openFromCard = (event) => {
    if (!onEdit || event.target.closest('button, input, select, textarea, label, a')) return;
    onEdit(note);
  };

  const openFromKeyboard = (event) => {
    if (!onEdit || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    onEdit(note);
  };

  return (
    <article
      className={`note-card card ${note.important ? 'important-note-rainbow-border' : ''}`.trim()}
      style={{ '--priority-color': getPriorityColor(note.priority) }}
      tabIndex={onEdit ? 0 : undefined}
      onClick={openFromCard}
      onKeyDown={openFromKeyboard}
    >
      <div className="note-card-main">
        <p>{note.text}</p>
        <div className="note-meta">
          <span className="priority-badge">P{note.priority}</span>
          <span>{destinationLabel(note, projects)}</span>
          {note.important && <span>Important</span>}
          {note.isTodo && <span>To-do</span>}
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div className="note-actions">
          {onEdit && <button type="button" className="secondary-button" onClick={() => onEdit(note)}>Edit</button>}
          {onDelete && <button type="button" className="danger-button" onClick={() => onDelete(note)}>Delete</button>}
        </div>
      )}
      {children}
    </article>
  );
}
