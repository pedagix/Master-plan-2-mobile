import { useEffect, useRef, useState } from 'react';
import { HMM_DESTINATION } from '../lib/model';

export default function QuickCaptureSheet({ api, activeTask, onClose }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  const save = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();
    const note = {
      id: crypto.randomUUID(),
      text: trimmed,
      createdAt: now,
      updatedAt: now,
      destination: HMM_DESTINATION,
      projectId: null,
      priority: 5,
      important: false,
      isTodo: false,
      deleted: false,
      sourceType: 'now-distraction',
      sourceId: activeTask?.taskNoteId || null,
    };
    api.setData((prev) => ({ ...prev, notes: [note, ...(prev.notes || [])] }));
    api.showNoteSavedConfirmation?.();
    onClose?.();
  };

  return (
    <div className="task-sheet-backdrop quick-capture-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section className="task-sheet quick-capture-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-capture-title">
        <div className="task-sheet-handle" aria-hidden="true" />
        <small>CAPTURE & RETURN</small>
        <h3 id="quick-capture-title">Get it out of your head.</h3>
        <p className="helper-text">Saved to Plans without interrupting the current task.</p>
        <textarea ref={textareaRef} rows={4} value={text} onChange={(event) => setText(event.target.value)} placeholder="What pulled your attention?" />
        <div className="actions">
          <button type="button" disabled={!text.trim()} onClick={save}>Save & continue</button>
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        </div>
      </section>
    </div>
  );
}
