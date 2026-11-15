import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiagramObject } from '@/types/project';
import { draw, fitView, hitTest, rotateHandlePos, toWorld, type DrawOptions, type PlanLink, type View } from './draw';
import type { PlanView } from '@/lib/gear/catalog';

interface Props {
  objects: DiagramObject[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onLive: (objects: DiagramObject[]) => void;
  onCommit: (objects: DiagramObject[]) => void;
  onTapSelected?: (id: string) => void;
  snap: boolean;
  gridSize: number;
  cameraFovDeg: number;
  theme: 'light' | 'dark';
  sunPath: DrawOptions['sunPath'];
  fitKey: number;
  planView?: PlanView;
  links?: PlanLink[];
}

type Mode = { kind: 'none' } | { kind: 'pan'; sx: number; sy: number; view: View } | { kind: 'move'; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | { kind: 'rotate'; id: string } | { kind: 'pinch'; d0: number; view: View; cx: number; cy: number };

export function DiagramCanvas({ objects, selectedId, onSelect, onLive, onCommit, onTapSelected, snap, gridSize, cameraFovDeg, theme, sunPath, fitKey, planView = 'all', links }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ ox: 300, oy: 300, scale: 60 });
  const [size, setSize] = useState({ w: 600, h: 600 });
  const mode = useRef<Mode>({ kind: 'none' });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const objRef = useRef(objects);
  const viewRef = useRef(view);
  useEffect(() => {
    objRef.current = objects;
  }, [objects]);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Resize observer keeps the canvas crisp at devicePixelRatio
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: Math.max(100, Math.floor(r.width)), h: Math.max(100, Math.floor(r.height)) });
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // Fit when asked (initial mount, "fit" button, preset load)
  const fitDone = useRef(-1);
  useEffect(() => {
    if (fitDone.current === fitKey) return;
    fitDone.current = fitKey;
    setView(fitView(objRef.current, size.w, size.h));
  }, [fitKey, size.w, size.h]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, { objects, view, width: size.w, height: size.h, selectedId, gridSize, cameraFovDeg, theme, sunPath, planView, links });
  }, [objects, view, size, selectedId, gridSize, cameraFovDeg, theme, sunPath, planView, links]);

  const snapVal = useCallback((v: number, step: number) => (snap ? Math.round(v / step) * step : v), [snap]);

  function local(e: { clientX: number; clientY: number }) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e: React.PointerEvent) {
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      mode.current = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), view: viewRef.current, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      return;
    }
    const v = viewRef.current;
    const objs = objRef.current;
    // Rotate handle of the selected object
    if (selectedId) {
      const sel = objs.find((o) => o.id === selectedId);
      if (sel && !sel.locked) {
        const [hx, hy] = rotateHandlePos(sel, v);
        if (Math.hypot(p.x - hx, p.y - hy) < 16) {
          mode.current = { kind: 'rotate', id: sel.id };
          return;
        }
      }
    }
    const hit = hitTest(objs, v, p.x, p.y, planView);
    if (hit) {
      onSelect(hit.id);
      mode.current = { kind: 'move', id: hit.id, sx: p.x, sy: p.y, ox: hit.x, oy: hit.y, moved: false };
    } else {
      onSelect(null);
      mode.current = { kind: 'pan', sx: p.x, sy: p.y, view: v };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const m = mode.current;
    const v = viewRef.current;
    if (m.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = Array.from(pointers.current.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const k = Math.max(0.2, Math.min(5, d / m.d0));
      const scale = Math.max(15, Math.min(300, m.view.scale * k));
      const f = scale / m.view.scale;
      setView({ scale, ox: m.cx - (m.cx - m.view.ox) * f, oy: m.cy - (m.cy - m.view.oy) * f });
      return;
    }
    if (m.kind === 'pan') {
      setView({ ...m.view, ox: m.view.ox + (p.x - m.sx), oy: m.view.oy + (p.y - m.sy) });
    } else if (m.kind === 'move') {
      const obj = objRef.current.find((o) => o.id === m.id);
      if (!obj || obj.locked) return;
      const dx = (p.x - m.sx) / v.scale;
      const dy = -(p.y - m.sy) / v.scale;
      if (!m.moved && Math.hypot(p.x - m.sx, p.y - m.sy) < 4) return;
      m.moved = true;
      const nx = snapVal(m.ox + dx, 0.25);
      const ny = snapVal(m.oy + dy, 0.25);
      onLive(objRef.current.map((o) => (o.id === m.id ? { ...o, x: Math.round(nx * 100) / 100, y: Math.round(ny * 100) / 100 } : o)));
    } else if (m.kind === 'rotate') {
      const obj = objRef.current.find((o) => o.id === m.id);
      if (!obj) return;
      const [wx, wy] = toWorld(v, p.x, p.y);
      let rot = (Math.atan2(wx - obj.x, wy - obj.y) * 180) / Math.PI;
      rot = snapVal(rot, 5);
      onLive(objRef.current.map((o) => (o.id === m.id ? { ...o, rotation: Math.round(((rot % 360) + 360) % 360) } : o)));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    const m = mode.current;
    if (m.kind === 'move') {
      if (m.moved) onCommit(objRef.current);
      else onTapSelected?.(m.id);
    } else if (m.kind === 'rotate') onCommit(objRef.current);
    if (pointers.current.size === 0) mode.current = { kind: 'none' };
    else if (pointers.current.size === 1) {
      const [p] = Array.from(pointers.current.values());
      mode.current = { kind: 'pan', sx: p.x, sy: p.y, view: viewRef.current };
    }
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const p = local(e);
    const v = viewRef.current;
    const k = Math.exp(-e.deltaY * 0.0015);
    const scale = Math.max(15, Math.min(300, v.scale * k));
    const f = scale / v.scale;
    setView({ scale, ox: p.x - (p.x - v.ox) * f, oy: p.y - (p.y - v.oy) * f });
  }

  // Non-passive wheel listener so preventDefault works
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const h = (e: WheelEvent) => e.preventDefault();
    c.addEventListener('wheel', h, { passive: false });
    return () => c.removeEventListener('wheel', h);
  }, []);

  return (
    <div ref={hostRef} className="diagram-host">
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, touchAction: 'none', display: 'block' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        tabIndex={0}
        role="application"
        aria-label="Lighting diagram canvas. Drag objects to move them, drag the yellow handle to rotate, drag empty space to pan, pinch or scroll to zoom."
      />
    </div>
  );
}
