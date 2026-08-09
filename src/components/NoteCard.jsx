import { getPriorityColor } from '../lib/model';

export default function NoteCard({ note, projects: _projects = [], onEdit, children }) {
  const openEditorFromText = () => onEdit?.(note);
  const handleTextKeyDown = (event) => {
    if (!onEdit) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onEdit(note);
    }
  };

  return (
    <article
      className={`note-card ${note.important ? 'important-note-rainbow-border' : ''}`.trim()}
      style={{ '--priority-color': getPriorityColor(note.priority) }}
    >
      <div
        className={`note-card-main ${onEdit ? 'note-card-main-editable' : ''}`.trim()}
        role={onEdit ? 'button' : undefined}
        tabIndex={onEdit ? 0 : undefined}
        aria-label={onEdit ? 'Edit note' : undefined}
        onClick={openEditorFromText}
        onKeyDown={handleTextKeyDown}
      >
        <span className="note-priority-mark" aria-hidden="true" />
        <p>{note.text}</p>
        {onEdit && <span className="row-chevron" aria-hidden="true">›</span>}
      </div>
      {children}
    </article>
  );
}
