import { useEffect, useMemo, useRef } from 'react';
import {
  focusTextareaForMobileEdit,
  noteCursorStorageKey,
  storeCursorPosition,
} from '../lib/mobileEditorFocus';

export default function MobileFocusedTextarea({ storageId, value, onChange, ...props }) {
  const textareaRef = useRef(null);
  const wrapperRef = useRef(null);
  const cursorStorageKey = useMemo(() => noteCursorStorageKey(storageId), [storageId]);

  useEffect(() => focusTextareaForMobileEdit({
    textarea: textareaRef.current,
    formElement: wrapperRef.current,
    storageKey: cursorStorageKey,
  }), [cursorStorageKey, storageId]);

  return (
    <div ref={wrapperRef} className="mobile-focused-textarea-wrap">
      <textarea
        {...props}
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onChange?.(event);
          storeCursorPosition(cursorStorageKey, event.target);
        }}
        onSelect={(event) => storeCursorPosition(cursorStorageKey, event.target)}
        onKeyUp={(event) => storeCursorPosition(cursorStorageKey, event.target)}
        onClick={(event) => storeCursorPosition(cursorStorageKey, event.target)}
      />
    </div>
  );
}
