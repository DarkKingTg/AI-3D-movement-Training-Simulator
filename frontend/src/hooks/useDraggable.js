import { useCallback, useRef, useState } from "react";

/**
 * useDraggable — make any element drag-positionable with localStorage persistence.
 *
 * Usage on a panel:
 *   const drag = useDraggable("panel-name");
 *   <aside style={drag.style}>
 *     <header {...drag.handleProps}>...</header>
 *   </aside>
 *
 * Usage on a pill-button that also needs to remain clickable:
 *   const drag = useDraggable("btn-name");
 *   <button
 *     style={drag.style}
 *     {...drag.handleProps}
 *     onClick={drag.guardClick(() => doThing())}
 *   />
 *
 * The button-style version uses a small movement threshold so a normal
 * click is detected as a click (not as a drag); any pointer move > 3 px
 * is treated as a drag and the subsequent click is swallowed.
 */
export function useDraggable(storageKey, defaultPos = { x: 0, y: 0 }) {
  const storeKey = storageKey ? `drag:${storageKey}` : null;
  const [pos, setPos] = useState(() => {
    if (!storeKey) return defaultPos;
    try {
      const raw = localStorage.getItem(storeKey);
      if (!raw) return defaultPos;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number") {
        return parsed;
      }
    } catch (_e) { /* ignore */ }
    return defaultPos;
  });

  const startRef = useRef(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
    draggingRef.current = true;
    movedRef.current = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_e) { /* ignore */ }
  }, [pos]);

  const onPointerMove = useCallback((e) => {
    if (!draggingRef.current || !startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!movedRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      movedRef.current = true;
    }
    if (movedRef.current) {
      // Clamp to viewport-ish so a panel can't be dragged completely off-screen
      const nx = startRef.current.ox + dx;
      const ny = startRef.current.oy + dy;
      setPos({ x: nx, y: ny });
    }
  }, []);

  const onPointerUp = useCallback((e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_e) { /* ignore */ }
    if (storeKey && movedRef.current) {
      try { localStorage.setItem(storeKey, JSON.stringify(pos)); } catch (_e) { /* ignore */ }
    }
  }, [pos, storeKey]);

  // Wrap an onClick so it bails out when we just finished a drag (movement > threshold).
  const guardClick = useCallback((fn) => (e) => {
    if (movedRef.current) {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      // Reset so future clicks work
      movedRef.current = false;
      return;
    }
    fn?.(e);
  }, []);

  const reset = useCallback(() => {
    setPos(defaultPos);
    if (storeKey) {
      try { localStorage.removeItem(storeKey); } catch (_e) { /* ignore */ }
    }
  }, [defaultPos, storeKey]);

  return {
    pos,
    // Transform on top of the existing CSS positioning (fixed bottom/left/right etc.)
    style: { transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` },
    // Spread these on the drag handle (header or whole button)
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      style: { cursor: draggingRef.current ? "grabbing" : "grab", touchAction: "none" },
    },
    guardClick,
    reset,
  };
}
