import { useCallback, useEffect, useRef, useState } from "react";
import {
  MousePointer2,
  Dot,
  Minus,
  Hexagon,
  Circle,
  FunctionSquare,
  Trash2,
  Maximize2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Canvas } from "./Canvas";
import { DEFAULT_VIEW, evalExpr, Viewport } from "../lib/plot";
import { ObjKind, Pt, SceneObject } from "../types";

export type ToolId = "move" | "point" | "segment" | "polygon" | "circle" | "function";

interface WorkspaceProps {
  tool: ToolId;
  onToolChange: (t: ToolId) => void;
}

const iconFor: Record<ToolId, typeof MousePointer2> = {
  move: MousePointer2,
  point: Dot,
  segment: Minus,
  polygon: Hexagon,
  circle: Circle,
  function: FunctionSquare,
};

const objColors = ["#2f5d9e", "#3f7d4e", "#c25f2e", "#a03b3b", "#6b5a9e"];

export function Workspace({ tool, onToolChange }: WorkspaceProps) {
  const tools: { id: ToolId; label: string }[] = [
    { id: "move", label: "Переміщення" },
    { id: "point", label: "Точка" },
    { id: "segment", label: "Відрізок" },
    { id: "polygon", label: "Многокутник" },
    { id: "circle", label: "Коло" },
    { id: "function", label: "Функція" },
  ];
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [draft, setDraft] = useState<Pt[]>([]);
  const [expr, setExpr] = useState("");
  const [exprError, setExprError] = useState<string | null>(null);
  const [view, setView] = useState<Viewport>(DEFAULT_VIEW);
  const [panelOpen, setPanelOpen] = useState(true);
  const idRef = useRef(1);

  const addObject = useCallback((kind: ObjKind, points: Pt[], color: string, expr?: string) => {
    const id = idRef.current++;
    setObjects((prev) => [...prev, { id, kind, points, color, expr, born: performance.now() }]);
  }, []);

  const handleCanvasClick = useCallback(
    (world: Pt) => {
      if (tool === "point") {
        addObject("point", [world], objColors[0]);
        return;
      }
      if (tool === "segment") {
        const pts = [...draft, world];
        if (pts.length === 2) {
          addObject("segment", pts, objColors[0]);
          setDraft([]);
        } else {
          setDraft(pts);
        }
        return;
      }
      if (tool === "circle") {
        const pts = [...draft, world];
        if (pts.length === 2) {
          addObject("circle", pts, objColors[1]);
          setDraft([]);
        } else {
          setDraft(pts);
        }
        return;
      }
      if (tool === "polygon") {
        setDraft((prev) => [...prev, world]);
      }
    },
    [tool, draft, addObject]
  );

  const finishPolygon = useCallback(() => {
    if (draft.length >= 3) addObject("polygon", draft, objColors[2]);
    setDraft([]);
  }, [draft, addObject]);

  const addFunction = useCallback(() => {
    const e = expr.trim();
    if (!e) return;
    try {
      evalExpr(e, 1);
    } catch (err) {
      setExprError((err as Error).message);
      return;
    }
    addObject("function", [], objColors[3], e);
    setExprError(null);
  }, [expr, addObject]);

  const clearAll = useCallback(() => {
    setObjects([]);
    setDraft([]);
  }, []);

  const resetView = useCallback(() => setView(DEFAULT_VIEW), []);

  // Enter у полі функції додає графік
  function onExprKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") addFunction();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDraft([]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = objects.length + draft.length;

  return (
    <div className="workspace">
      <aside className={"toolbar" + (panelOpen ? "" : " is-collapsed")}>
        <button className="toolbar-collapse" onClick={() => setPanelOpen((o) => !o)}>
          {panelOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="tool-list">
          {tools.map((t) => {
            const Icon = iconFor[t.id];
            return (
              <button
                key={t.id}
                className={"tool" + (tool === t.id ? " is-active" : "")}
                title={t.label}
                onClick={() => {
                  onToolChange(t.id);
                  setDraft([]);
                }}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span className="tool-tip">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-section">
          <label className="func-field">
            <span>f(x) =</span>
            <input
              placeholder="x^2"
              value={expr}
              onChange={(e) => {
                setExpr(e.target.value);
                setExprError(null);
              }}
              onKeyDown={onExprKey}
              spellCheck={false}
            />
          </label>
          <button className="add-btn" onClick={addFunction}>
            Додати графік
          </button>
        </div>

        <div className="toolbar-spacer" />

        <div className="toolbar-section is-bottom">
          <span className="obj-count">об'єктів: {active}</span>
          <button className="icon-btn" title="На весь начерк" onClick={resetView}>
            <Maximize2 size={17} strokeWidth={1.8} />
          </button>
          <button className="icon-btn is-danger" title="Очистити" onClick={clearAll}>
            <Trash2 size={17} strokeWidth={1.8} />
          </button>
        </div>
      </aside>

      <div className="canvas-area">
        <Canvas
          objects={objects}
          draft={draft}
          tool={tool}
          view={view}
          onViewChange={setView}
          onClickWorld={handleCanvasClick}
          onFinishPolygon={finishPolygon}
        />
        {draft.length > 0 && (
          <div className="draft-hint">
            {tool === "polygon" ? (
              <>
                точок: {draft.length} — Enter/подвійний клік завершить фігуру, Esc — скасувати
                {draft.length >= 3 && (
                  <button className="finish-btn" onClick={finishPolygon}>
                    Завершити
                  </button>
                )}
              </>
            ) : (
              "клікни другу точку · Esc — скасувати"
            )}
          </div>
        )}
      </div>

      <ObjectList
        objects={objects}
        expr={expr}
        exprError={exprError}
        onRemove={(id) => setObjects((prev) => prev.filter((o) => o.id !== id))}
      />
    </div>
  );
}

interface ObjectListProps {
  objects: SceneObject[];
  expr: string;
  exprError: string | null;
  onRemove: (id: number) => void;
}

function ObjectList({ objects, onRemove }: ObjectListProps) {
  if (objects.length === 0) return null;
  return (
    <div className="object-list">
      <div className="object-list-head">об'єкти</div>
      {objects.map((o, i) => (
        <div key={o.id} className="object-row" style={{ animationDelay: `${i * 40}ms` }}>
          <span className="object-dot" style={{ background: o.color }} />
          <span className="object-name">
            {o.kind === "point" && `A(${o.points[0].x.toFixed(1)}, ${o.points[0].y.toFixed(1)})`}
            {o.kind === "segment" && "відрізок"}
            {o.kind === "polygon" && `многокутник · ${o.points.length} верш.`}
            {o.kind === "circle" && "коло"}
            {o.kind === "function" && o.expr}
          </span>
          <button className="object-remove" onClick={() => onRemove(o.id)} title="видалити">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
