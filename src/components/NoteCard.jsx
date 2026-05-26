import { getPriorityColor } from '../lib/model';

export default function NoteCard({ note, projects: _projects = [], onEdit, children }) {
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
          ⚙️
        </button>
      )}
      <div className="note-card-main">
        <p>{note.text}</p>
      </div>
      {children}
    </article>
  );
}
