const CURSOR_STORAGE_PREFIX = 'master-plan:note-editor-cursor:';

function getVisibleElementHeight(selector) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return 0;
  const element = document.querySelector(selector);
  if (!element) return 0;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return 0;
  return element.getBoundingClientRect().height;
}

function getViewportMetrics() {
  if (typeof window === 'undefined') return { top: 0, height: 0, bottom: 0 };
  const visualViewport = window.visualViewport;
  const top = visualViewport?.offsetTop || 0;
  const height = visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
  return { top, height, bottom: top + height };
}

function clampSelectionPosition(value, textLength) {
  const number = Number(value);
  if (!Number.isFinite(number)) return textLength;
  return Math.max(0, Math.min(textLength, Math.round(number)));
}

export function noteCursorStorageKey(noteId) {
  return noteId ? `${CURSOR_STORAGE_PREFIX}${noteId}` : null;
}

export function readStoredCursorPosition(storageKey, textLength) {
  if (!storageKey || typeof window === 'undefined') return textLength;
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === null ? textLength : clampSelectionPosition(stored, textLength);
  } catch {
    return textLength;
  }
}

export function storeCursorPosition(storageKey, textarea) {
  if (!storageKey || !textarea || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, String(textarea.selectionStart ?? textarea.value.length));
  } catch {
    // Ignore private-mode or quota failures; falling back to end-of-note is acceptable.
  }
}

export function scrollTextareaToCursor(textarea, cursorPosition = textarea?.selectionStart ?? 0) {
  if (!textarea) return;

  const textBeforeCursor = textarea.value.slice(0, clampSelectionPosition(cursorPosition, textarea.value.length));
  const lineCount = textBeforeCursor.split('\n').length;
  const computedStyle = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 22;
  const verticalPadding = (Number.parseFloat(computedStyle.paddingTop) || 0) + (Number.parseFloat(computedStyle.paddingBottom) || 0);
  const estimatedCursorTop = Math.max(0, (lineCount - 1) * lineHeight + verticalPadding);
  const comfortableOffset = Math.max(0, textarea.clientHeight * 0.55);

  textarea.scrollTop = Math.max(0, estimatedCursorTop - comfortableOffset);
  if (cursorPosition >= textarea.value.length - 1) {
    textarea.scrollTop = textarea.scrollHeight;
  }
}

export function scrollEditPanelIntoView(formElement, preferredElement = null) {
  if (typeof window === 'undefined' || !formElement) return;

  const panel = formElement.closest('.edit-panel') || formElement;
  const viewport = getViewportMetrics();
  const panelRect = panel.getBoundingClientRect();
  const focusRect = (preferredElement || formElement).getBoundingClientRect();
  const headerHeight = getVisibleElementHeight('.top-header');
  const bottomNavHeight = getVisibleElementHeight('.bottom-nav');
  const topOffset = Math.ceil(viewport.top + headerHeight + 12);
  const bottomOffset = Math.ceil(bottomNavHeight + 18);
  const visibleBottom = viewport.bottom - bottomOffset;
  const availableHeight = Math.max(0, visibleBottom - topOffset);
  const currentScrollY = window.scrollY || window.pageYOffset || 0;

  let targetTop = currentScrollY + panelRect.top - topOffset;
  const panelFits = panelRect.height <= availableHeight;

  if (!panelFits) {
    if (focusRect.bottom > visibleBottom) {
      targetTop = currentScrollY + focusRect.bottom - visibleBottom;
    } else if (focusRect.top < topOffset) {
      targetTop = currentScrollY + focusRect.top - topOffset;
    }
  } else if (panelRect.bottom > visibleBottom) {
    targetTop = currentScrollY + panelRect.bottom - visibleBottom;
  } else if (panelRect.top < topOffset || Math.abs(panelRect.top - topOffset) > 24) {
    targetTop = currentScrollY + panelRect.top - topOffset;
  } else {
    return;
  }

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({
    top: Math.max(0, targetTop),
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });
}

export function focusTextareaForMobileEdit({ textarea, formElement, storageKey, shouldFocus = true }) {
  if (typeof window === 'undefined' || !textarea) return () => {};

  const cursorPosition = readStoredCursorPosition(storageKey, textarea.value.length);
  let cancelled = false;
  let firstFrame = 0;
  let secondFrame = 0;
  const timers = [];

  const focusAndScroll = () => {
    if (cancelled) return;
    textarea.setSelectionRange(cursorPosition, cursorPosition);
    scrollTextareaToCursor(textarea, cursorPosition);
    if (shouldFocus && document.activeElement !== textarea) {
      textarea.focus({ preventScroll: true });
    }
    scrollEditPanelIntoView(formElement || textarea, textarea);
  };

  firstFrame = window.requestAnimationFrame(() => {
    secondFrame = window.requestAnimationFrame(focusAndScroll);
  });
  [90, 240, 520].forEach((delay) => {
    timers.push(window.setTimeout(focusAndScroll, delay));
  });

  focusAndScroll();

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(firstFrame);
    window.cancelAnimationFrame(secondFrame);
    timers.forEach((timer) => window.clearTimeout(timer));
  };
}
