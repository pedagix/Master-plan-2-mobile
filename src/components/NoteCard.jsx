import { getPriorityColor } from '../lib/model';

export default function NoteCard({ note, onOpen, children }) {
  const openActions = () => onOpen?.(note);
  const handleKeyDown = (event) => {
    if (!onOpen) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(note);
    }
  };

  return (
    <article className="note-card" style={{ '--priority-color': getPriorityColor(note.priority) }}>
      <div
        className={`note-card-main ${onOpen ? 'note-card-main-editable' : ''}`.trim()}
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        aria-label={onOpen ? 'Open note actions' : undefined}
        onClick={openActions}
        onKeyDown={handleKeyDown}
      >
        <span className="note-priority-mark" aria-hidden="true" />
        <p>{note.text}</p>
        {onOpen && <span className="row-chevron" aria-hidden="true">›</span>}
      </div>
      {children}
    </article>
  );
}
