import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

export type DropPlacement = 'above' | 'below';

export interface PlayDragState {
  id: string;
  dy: number;
  targetId: string | null;
  placement: DropPlacement;
}

const HOLD_MS_TOUCH = 350;
const HOLD_MS_MOUSE = 200;
const MOVE_CANCEL_PX = 10;
const EDGE_PX = 70;

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null; // the page itself scrolls
}

interface Session {
  id: string;
  kind: 'touch' | 'mouse';
  touchId: number | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startScroll: number;
  scroller: HTMLElement | null;
  active: boolean;
  timer: number | null;
  raf: number | null;
  targetId: string | null;
  placement: DropPlacement;
}

/**
 * Press-and-hold a card (anything with data-play-id), then drag it over another card and let go.
 * Uses raw touch / mouse events on the document so it keeps working inside a mobile WebView, and a
 * quick swipe still scrolls the list as normal.
 */
export function usePlayDragReorder(onDrop: (dragId: string, targetId: string, placement: DropPlacement) => void) {
  const [drag, setDrag] = useState<PlayDragState | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const session = useRef<Session | null>(null);

  useEffect(() => {
    const scrollPos = (s: Session) => (s.scroller ? s.scroller.scrollTop : window.scrollY);

    const blockScroll = (e: TouchEvent) => {
      if (session.current?.active && e.cancelable) e.preventDefault();
    };
    const blockContextMenu = (e: Event) => {
      if (session.current) e.preventDefault();
    };
    const blockSelect = (e: Event) => {
      if (session.current) e.preventDefault();
    };

    const refresh = () => {
      const s = session.current;
      if (!s || !s.active) return;
      const dy = s.lastY - s.startY + (scrollPos(s) - s.startScroll);
      let targetId: string | null = null;
      let placement: DropPlacement = s.placement;
      for (const node of document.elementsFromPoint(s.lastX, s.lastY)) {
        const card = (node as HTMLElement).closest?.('[data-play-id]') as HTMLElement | null;
        if (card && card.dataset.playId !== s.id) {
          targetId = card.dataset.playId ?? null;
          const rect = card.getBoundingClientRect();
          placement = s.lastY < rect.top + rect.height / 2 ? 'above' : 'below';
          break;
        }
      }
      s.targetId = targetId;
      s.placement = placement;
      setDrag({ id: s.id, dy, targetId, placement });
    };

    const autoScroll = () => {
      const s = session.current;
      if (!s || !s.active) return;
      const top = s.scroller ? s.scroller.getBoundingClientRect().top : 0;
      const bottom = s.scroller ? s.scroller.getBoundingClientRect().bottom : window.innerHeight;
      let delta = 0;
      if (s.lastY < top + EDGE_PX) delta = -Math.ceil(((top + EDGE_PX - s.lastY) / EDGE_PX) * 14);
      else if (s.lastY > bottom - EDGE_PX) delta = Math.ceil(((s.lastY - (bottom - EDGE_PX)) / EDGE_PX) * 14);
      if (delta !== 0) {
        if (s.scroller) s.scroller.scrollTop += delta;
        else window.scrollBy(0, delta);
        refresh();
      }
      s.raf = requestAnimationFrame(autoScroll);
    };

    const finish = (drop: boolean) => {
      const s = session.current;
      if (!s) return;
      if (s.timer) window.clearTimeout(s.timer);
      if (s.raf) cancelAnimationFrame(s.raf);
      document.removeEventListener('touchmove', blockScroll);
      document.body.style.userSelect = '';
      (document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = '';
      session.current = null;
      setDrag(null);
      if (drop && s.active && s.targetId) onDropRef.current(s.id, s.targetId, s.placement);
    };

    const begin = (card: HTMLElement, kind: 'touch' | 'mouse', x: number, y: number, touchId: number | null) => {
      if (session.current) return;
      const scroller = getScrollParent(card);
      const s: Session = {
        id: card.dataset.playId!,
        kind,
        touchId,
        startX: x,
        startY: y,
        lastX: x,
        lastY: y,
        startScroll: scroller ? scroller.scrollTop : window.scrollY,
        scroller,
        active: false,
        timer: null,
        raf: null,
        targetId: null,
        placement: 'above',
      };
      s.timer = window.setTimeout(() => {
        if (session.current !== s) return;
        s.timer = null;
        s.active = true;
        // From now on the finger moves the card instead of scrolling the page
        document.addEventListener('touchmove', blockScroll, { passive: false });
        document.body.style.userSelect = 'none';
        (document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none';
        window.getSelection()?.removeAllRanges();
        if (navigator.vibrate) navigator.vibrate(15);
        s.raf = requestAnimationFrame(autoScroll);
        refresh();
      }, kind === 'mouse' ? HOLD_MS_MOUSE : HOLD_MS_TOUCH);
      session.current = s;
    };

    const move = (x: number, y: number) => {
      const s = session.current;
      if (!s) return;
      s.lastX = x;
      s.lastY = y;
      if (!s.active) {
        if (Math.hypot(x - s.startX, y - s.startY) > MOVE_CANCEL_PX) finish(false); // it's a scroll / swipe
        return;
      }
      refresh();
    };

    const findTouch = (list: TouchList, id: number | null) => {
      for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
      return null;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return finish(false);
      const t = e.touches[0];
      const target = e.target as HTMLElement | null;
      if (!target || target.closest('button, a, input, select, textarea')) return;
      const card = target.closest('[data-play-id]') as HTMLElement | null;
      if (card) begin(card, 'touch', t.clientX, t.clientY, t.identifier);
    };
    const onTouchMove = (e: TouchEvent) => {
      const s = session.current;
      if (!s || s.kind !== 'touch') return;
      const t = findTouch(e.touches, s.touchId);
      if (t) move(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      const s = session.current;
      if (!s || s.kind !== 'touch') return;
      if (findTouch(e.changedTouches, s.touchId)) {
        if (s.active && e.cancelable) e.preventDefault(); // no synthetic click after a drop
        finish(true);
      }
    };
    const onTouchCancel = () => finish(false);

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target || target.closest('button, a, input, select, textarea')) return;
      const card = target.closest('[data-play-id]') as HTMLElement | null;
      if (card) begin(card, 'mouse', e.clientX, e.clientY, null);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (session.current?.kind === 'mouse') move(e.clientX, e.clientY);
    };
    const onMouseUp = () => {
      if (session.current?.kind === 'mouse') finish(true);
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: false });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('contextmenu', blockContextMenu, true);
    document.addEventListener('selectstart', blockSelect, true);

    return () => {
      finish(false);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('contextmenu', blockContextMenu, true);
      document.removeEventListener('selectstart', blockSelect, true);
    };
  }, []);

  const getDragProps = useCallback(
    (playId: string) => {
      const isDragged = drag?.id === playId;
      const isTarget = drag?.targetId === playId;
      const extraClass = [
        'select-none [-webkit-touch-callout:none]',
        isDragged ? 'ring-2 ring-[#00BFA5] shadow-2xl opacity-95 relative z-30' : '',
        isTarget && drag?.placement === 'above' ? 'shadow-[0_-4px_0_0_#00BFA5]' : '',
        isTarget && drag?.placement === 'below' ? 'shadow-[0_4px_0_0_#00BFA5]' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return {
        'data-play-id': playId,
        'data-score-swipe-ignore': true,
        extraClass,
        style: isDragged
          ? ({ transform: `translateY(${drag!.dy}px) scale(1.02)`, transition: 'none' } as React.CSSProperties)
          : undefined,
      };
    },
    [drag]
  );

  return { dragging: drag, getDragProps };
}