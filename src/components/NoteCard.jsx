import { getPriorityColor } from '../lib/model';

export default function NoteCard({ note, projects: _projects = [], onEdit, children }) {
  const openEditorFromText = () => {
    if (onEdit) onEdit(note);
  };

  const handleTextKeyDown = (event) => {
    if (!onEdit) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onEdit(note);
    }
  };

  return (
    <article
      className={`note-card card ${note.important ? 'important-note-rainbow-border' : ''}`.trim()}
      style={{ '--priority-color': getPriorityColor(note.priority) }}
    >
      {onEdit && (
        <button
          type="button"
          className="note-card-cog-button"
          aria-label="Edit note"
          onClick={() => onEdit(note)}
        >
          ⚙
        </button>
      )}
      <div
        className={`note-card-main ${onEdit ? 'note-card-main-editable' : ''}`.trim()}
        role={onEdit ? 'button' : undefined}
        tabIndex={onEdit ? 0 : undefined}
        aria-label={onEdit ? 'Edit note text' : undefined}
        onClick={openEditorFromText}
        onKeyDown={handleTextKeyDown}
      >
        <p>{note.text}</p>
      </div>
      {children}
    </article>
  );
}
