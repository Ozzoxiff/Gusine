import { useCallback, useEffect, useRef, useState } from "react";
import { evalExpr, fmt, jitter, niceStep, toCanvas, toWorld, Viewport } from "../lib/plot";
import { Pt, SceneObject } from "../types";
import type { ToolId } from "./Workspace";

interface CanvasProps {
  objects: SceneObject[];
  draft: Pt[];
  tool: ToolId;
  view: Viewport;
  onViewChange: (v: Viewport) => void;
  onClickWorld: (p: Pt) => void;
  onFinishPolygon: () => void;
}

export function Canvas({ objects, draft, tool, view, onViewChange, onClickWorld, onFinishPolygon }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const drag = useRef<{ lastX: number; lastY: number; moved: boolean } | null>(null);
  const rafRef = useRef(0);
  const [cursor, setCursor] = useState<Pt | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Постійний цикл малювання — для анімацій появи та «дихання» ліній
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let stop = false;

    function frame() {
      if (stop) return;
      draw();
      rafRef.current = requestAnimationFrame(frame);
    }

    function draw() {
      const ctx = canvas!.getContext("2d")!;
      const { w, h } = size;
      const dpr = window.devicePixelRatio || 1;
      if (canvas!.width !== w * dpr || canvas!.height !== h * dpr) {
        canvas!.width = w * dpr;
        canvas!.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const step = niceStep(view.scale);
      const tl = toWorld({ x: 0, y: h }, view, w, h);
      const br = toWorld({ x: w, y: 0 }, view, w, h);
      const origin = toCanvas({ x: 0, y: 0 }, view, w, h);

      // Сітка
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(96, 120, 96, 0.13)";
      for (let gx = Math.ceil(tl.x / step) * step; gx <= br.x; gx += step) {
        const px = toCanvas({ x: gx, y: 0 }, view, w, h).x;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      }
      for (let gy = Math.ceil(tl.y / step) * step; gy <= br.y; gy += step) {
        const py = toCanvas({ x: 0, y: gy }, view, w, h).y;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
        ctx.stroke();
      }

      // Осі
      ctx.strokeStyle = "rgba(74, 66, 52, 0.65)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, origin.y);
      ctx.lineTo(w, origin.y);
      ctx.moveTo(origin.x, 0);
      ctx.lineTo(origin.x, h);
      ctx.stroke();

      // Підписи
      ctx.fillStyle = "rgba(74, 66, 52, 0.55)";
      ctx.font = "12px 'STIX Two Text', Georgia, serif";
      ctx.textAlign = "center";
      for (let gx = Math.ceil(tl.x / step) * step; gx <= br.x; gx += step) {
        if (Math.abs(gx) < step / 2) continue;
        const px = toCanvas({ x: gx, y: 0 }, view, w, h).x;
        ctx.fillText(fmt(gx, 2), px, Math.min(Math.max(origin.y + 16, 12), h - 4));
      }
      ctx.textAlign = "right";
      for (let gy = Math.ceil(tl.y / step) * step; gy <= br.y; gy += step) {
        if (Math.abs(gy) < step / 2) continue;
        const py = toCanvas({ x: 0, y: gy }, view, w, h).y;
        ctx.fillText(fmt(gy, 2), Math.min(Math.max(origin.x - 6, 30), w - 4), py + 4);
      }

      // Об'єкти
      const now = performance.now();
      for (const o of objects) {
        const age = Math.min(1, (now - o.born) / 450);
        const ease = 1 - Math.pow(1 - age, 3); // easeOutCubic
        ctx.globalAlpha = ease;

        if (o.kind === "function" && o.expr) {
          ctx.strokeStyle = o.color;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          let started = false;
          let prevY: number | null = null;
          // анімація «прорисовування» зліва направо
          const limit = w * ease;
          for (let px = 0; px <= limit; px += 2) {
            const wx = toWorld({ x: px, y: 0 }, view, w, h).x;
            let wy: number;
            try {
              wy = evalExpr(o.expr, wx);
            } catch {
              break;
            }
            if (!isFinite(wy)) {
              started = false;
              prevY = null;
              continue;
            }
            const py = toCanvas({ x: wx, y: wy }, view, w, h).y;
            if (prevY !== null && Math.abs(py - prevY) > h * 2) started = false;
            if (!started) {
              ctx.moveTo(px, py);
              started = true;
            } else {
              ctx.lineTo(px, py);
            }
            prevY = py;
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
          continue;
        }

        const pts = o.points.map((p) => toCanvas(p, view, w, h));

        if (o.kind === "point") {
          const [c] = pts;
          const pop = ease < 1 ? 1 + 0.4 * Math.sin(ease * Math.PI) : 1;
          ctx.beginPath();
          ctx.arc(c.x, c.y, 5.5 * pop, 0, Math.PI * 2);
          ctx.fillStyle = o.color;
          ctx.fill();
          ctx.strokeStyle = "#f6f1e3";
          ctx.lineWidth = 1.6;
          ctx.stroke();
        } else if (o.kind === "circle") {
          const r = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) * ease;
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2);
          ctx.strokeStyle = o.color;
          ctx.lineWidth = 2.2;
          ctx.stroke();
        } else {
          // segment / polygon — лінії з олівцевим тремтінням
          const closed = o.kind === "polygon";
          ctx.strokeStyle = o.color;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          const seq = closed ? [...pts, pts[0]] : pts;
          for (let i = 0; i < seq.length - (closed ? 0 : 1) * 0 - 0; i++) {
            const j = seq[i];
            const k = seq[i + 1];
            if (!k) break;
            const jx = j.x + jitter(o.id * 31 + i * 7, 1.4);
            const jy = j.y + jitter(o.id * 17 + i * 13, 1.4);
            const kx = k.x + jitter(o.id * 23 + i * 11, 1.4);
            const ky = k.y + jitter(o.id * 29 + i * 5, 1.4);
            if (i === 0) ctx.moveTo(jx, jy);
            else ctx.lineTo(jx, jy);
            ctx.lineTo(kx, ky);
          }
          if (closed) ctx.closePath();
          ctx.stroke();
          if (closed) {
            ctx.fillStyle = o.color + "1c";
            ctx.fill();
          }
          // вершини
          ctx.fillStyle = o.color;
          for (const p of pts) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      // Чернетка (незавершена фігура)
      if (draft.length > 0) {
        const pts = draft.map((p) => toCanvas(p, view, w, h));
        const mouseC = cursor ? toCanvas(cursor, view, w, h) : null;
        ctx.strokeStyle = "rgba(47, 93, 158, 0.55)";
        ctx.lineWidth = 1.8;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (mouseC && (tool === "segment" || tool === "polygon" || tool === "circle")) {
          ctx.lineTo(mouseC.x, mouseC.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(47, 93, 158, 0.75)";
        for (const p of pts) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (tool === "circle" && pts.length === 1 && mouseC) {
          const r = Math.hypot(mouseC.x - pts[0].x, mouseC.y - pts[0].y);
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(63, 125, 78, 0.4)";
          ctx.stroke();
        }
      }
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      stop = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [objects, draft, view, size, tool, cursor]);

  const worldFromEvent = useCallback(
    (e: React.MouseEvent): Pt => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return toWorld(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        view,
        size.w,
        size.h
      );
    },
    [view, size]
  );

  function handleClick(e: React.MouseEvent) {
    if (drag.current?.moved) return;
    if (tool === "move") return;
    onClickWorld(snap(worldFromEvent(e)));
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const anchor = toWorld({ x: mx, y: my }, view, size.w, size.h);
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const scale = Math.min(0.6, Math.max(0.0015, view.scale * factor));
    // зум до курсора
    const k = view.scale / scale;
    onViewChange({
      scale,
      cx: anchor.x + (view.cx - anchor.x) / k,
      cy: anchor.y + (view.cy - anchor.y) / k,
    });
  }

  function handleDown(e: React.MouseEvent) {
    drag.current = { lastX: e.clientX, lastY: e.clientY, moved: false };
  }

  function handleMove(e: React.MouseEvent) {
    const w = worldFromEvent(e);
    setCursor(w);
    if (!drag.current) return;
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    onViewChange({ ...view, cx: view.cx - dx * view.scale, cy: view.cy + dy * view.scale });
  }

  function handleUp() {
    drag.current = null;
  }

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="gusine-canvas"
        style={{ width: size.w, height: size.h, cursor: tool === "move" ? "grab" : "crosshair" }}
        onClick={handleClick}
        onDoubleClick={onFinishPolygon}
        onWheel={handleWheel}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={() => {
          handleUp();
          setCursor(null);
        }}
      />
      {cursor && (
        <div className="coord-badge">
          {fmt(cursor.x, 1)} ; {fmt(cursor.y, 1)}
        </div>
      )}
    </div>
  );
}

function snap(p: Pt): Pt {
  return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
}
