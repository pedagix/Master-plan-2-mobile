import { useEffect, useMemo, useRef, useState } from 'react';

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const ZOOM_STEP = 0.5;

const clampScale = (value) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
const getDistance = (first, second) => Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);

export default function ImageViewer({ image, onClose, onRotate, onDelete }) {
  const [transform, setTransform] = useState({ scale: MIN_SCALE, x: 0, y: 0 });
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const transformRef = useRef(transform);
  const safeName = useMemo(() => image?.name || 'project-photo', [image?.name]);
  const imageSource = image?.originalUrl || image?.previewUrl || image?.src || '';
  const rotation = Number(image?.rotation) || 0;

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    setTransform({ scale: MIN_SCALE, x: 0, y: 0 });
    pointersRef.current.clear();
    gestureRef.current = null;
  }, [image?.id, imageSource]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  if (!image || !imageSource) return null;

  const updateScale = (nextScale) => {
    const scale = clampScale(nextScale);
    setTransform((current) => ({
      scale,
      x: scale === MIN_SCALE ? 0 : current.x,
      y: scale === MIN_SCALE ? 0 : current.y,
    }));
  };

  const zoomIn = () => updateScale(transformRef.current.scale + ZOOM_STEP);
  const zoomOut = () => updateScale(transformRef.current.scale - ZOOM_STEP);
  const resetZoom = () => setTransform({ scale: MIN_SCALE, x: 0, y: 0 });

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    const pointers = Array.from(pointersRef.current.values());

    if (pointers.length === 1) {
      gestureRef.current = {
        type: 'pan',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTransform: transformRef.current,
      };
    }

    if (pointers.length >= 2) {
      gestureRef.current = {
        type: 'pinch',
        startDistance: getDistance(pointers[0], pointers[1]),
        startTransform: transformRef.current,
      };
    }
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    const pointers = Array.from(pointersRef.current.values());
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.type === 'pinch' && pointers.length >= 2) {
      const nextScale = clampScale((getDistance(pointers[0], pointers[1]) / gesture.startDistance) * gesture.startTransform.scale);
      setTransform({
        scale: nextScale,
        x: nextScale === MIN_SCALE ? 0 : gesture.startTransform.x,
        y: nextScale === MIN_SCALE ? 0 : gesture.startTransform.y,
      });
      return;
    }

    if (gesture.type === 'pan' && transformRef.current.scale > MIN_SCALE) {
      setTransform((current) => ({
        ...current,
        x: gesture.startTransform.x + event.clientX - gesture.startX,
        y: gesture.startTransform.y + event.clientY - gesture.startY,
      }));
    }
  };

  const handlePointerEnd = (event) => {
    pointersRef.current.delete(event.pointerId);
    const pointers = Array.from(pointersRef.current.values());
    if (pointers.length === 1) {
      gestureRef.current = {
        type: 'pan',
        pointerId: event.pointerId,
        startX: pointers[0].clientX,
        startY: pointers[0].clientY,
        startTransform: transformRef.current,
      };
      return;
    }
    gestureRef.current = null;
  };

  const handleDoubleClick = () => {
    if (transformRef.current.scale > MIN_SCALE) resetZoom();
    else updateScale(2.5);
  };

  const handleWheel = (event) => {
    event.preventDefault();
    updateScale(transformRef.current.scale + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  };

  return (
    <div className="image-viewer-overlay" role="dialog" aria-modal="true" aria-label={`Viewing ${safeName}`}>
      <div className="image-viewer-topbar">
        <button type="button" className="secondary-button image-viewer-close" onClick={onClose} aria-label="Close image viewer">Close</button>
        <div className="image-viewer-top-actions">
          {onRotate && <button type="button" className="secondary-button" onClick={onRotate}>↻ Rotate</button>}
          {onDelete && <button type="button" className="danger-button" onClick={onDelete}>Delete</button>}
          <a className="image-viewer-download" href={imageSource} download={safeName}>Download</a>
        </div>
      </div>

      <div
        className="image-viewer-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      >
        <img
          className={`image-viewer-image ${Math.abs(rotation % 180) === 90 ? 'quarter-turn' : ''}`.trim()}
          src={imageSource}
          alt={safeName}
          draggable="false"
          style={{ transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale}) rotate(${rotation}deg)` }}
        />
      </div>

      <div className="image-viewer-controls" aria-label="Image zoom controls">
        <button type="button" onClick={zoomOut} aria-label="Zoom out">−</button>
        <button type="button" className="secondary-button" onClick={resetZoom}>Reset</button>
        <button type="button" onClick={zoomIn} aria-label="Zoom in">+</button>
      </div>
    </div>
  );
}
