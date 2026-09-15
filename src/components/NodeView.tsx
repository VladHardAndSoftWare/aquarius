import { useRef } from "react";
import type { C4Element } from "../c4";
import { paletteFor } from "../c4";
import { useStore } from "../store";

interface Props {
  el: C4Element;
  selected: boolean;
  dimmed: boolean;
}

interface DragRef {
  x: number;
  y: number;
  moved: boolean;
}

function ShapeBody({ el }: { el: C4Element }) {
  const p = paletteFor(el.kind, el.external);
  const { w, h, kind, variant } = el;

  if (kind === "person") {
    const headR = 16;
    return (
      <g>
        <rect x={0} y={headR + 6} width={w} height={h - headR - 6} rx={10} fill={p.bg} stroke={p.border} strokeWidth={1.5} />
        <circle cx={w / 2} cy={headR} r={headR} fill={p.bg} stroke={p.border} strokeWidth={1.5} />
      </g>
    );
  }
  if (variant === "db") {
    const ry = 12;
    return (
      <g>
        <path
          d={`M0,${ry} L0,${h - ry} A ${w / 2},${ry} 0 0 0 ${w},${h - ry} L${w},${ry}`}
          fill={p.bg}
          stroke={p.border}
          strokeWidth={1.5}
        />
        <ellipse cx={w / 2} cy={ry} rx={w / 2} ry={ry} fill={p.bg} stroke={p.border} strokeWidth={1.5} />
      </g>
    );
  }
  if (variant === "queue") {
    return <rect x={0} y={0} width={w} height={h} rx={h / 2} fill={p.bg} stroke={p.border} strokeWidth={1.5} />;
  }
  const dashed = kind === "node";
  return (
    <rect
      x={0}
      y={0}
      width={w}
      height={h}
      rx={8}
      fill={p.bg}
      stroke={p.border}
      strokeWidth={1.5}
      strokeDasharray={dashed ? "6 4" : undefined}
    />
  );
}

export function NodeView({ el, selected, dimmed }: Props) {
  const drag = useRef<DragRef | null>(null);
  const resizing = useRef<DragRef | null>(null);
  const p = paletteFor(el.kind, el.external);
  const textTop = el.kind === "person" ? 30 : el.variant === "db" ? 26 : 12;

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const st = useStore.getState();
    if (st.tool === "addRel") {
      st.nodeClicked(el.id, false);
      return;
    }
    if (!st.selection.nodeIds.includes(el.id)) st.nodeClicked(el.id, e.shiftKey);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const zoom = useStore.getState().view.zoom;
    const dx = (e.clientX - drag.current.x) / zoom;
    const dy = (e.clientY - drag.current.y) / zoom;
    if (dx !== 0 || dy !== 0) {
      useStore.getState().moveSelectedBy(dx, dy);
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
      drag.current.moved = true;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current?.moved) useStore.getState().commit();
    drag.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    resizing.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!resizing.current) return;
    const zoom = useStore.getState().view.zoom;
    const dx = (e.clientX - resizing.current.x) / zoom;
    const dy = (e.clientY - resizing.current.y) / zoom;
    useStore.getState().setNodeSize(el.id, el.w + dx, el.h + dy);
    resizing.current.x = e.clientX;
    resizing.current.y = e.clientY;
  };
  const onResizeUp = (e: React.PointerEvent) => {
    resizing.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <g
      transform={`translate(${el.x},${el.y})`}
      opacity={dimmed ? 0.35 : 1}
      style={{ cursor: "move" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <ShapeBody el={el} />
      {selected && (
        <rect
          x={-4}
          y={-4}
          width={el.w + 8}
          height={el.h + 8}
          rx={10}
          fill="none"
          stroke="#f2b705"
          strokeWidth={2}
          strokeDasharray="5 4"
          pointerEvents="none"
        />
      )}
      <foreignObject x={6} y={textTop} width={el.w - 12} height={el.h - textTop - 6} pointerEvents="none">
        <div className="node-label" style={{ color: p.text }}>
          <div className="node-title">{el.label}</div>
          {(el.techn || el.external) && (
            <div className="node-techn" style={{ color: p.subtext }}>
              {"[" + [labelFor(el), el.techn].filter(Boolean).join(": ") + "]"}
            </div>
          )}
          {el.descr && (
            <div className="node-descr" style={{ color: p.subtext }}>
              {el.descr}
            </div>
          )}
        </div>
      </foreignObject>
      {selected && (
        <rect
          className="resize-handle"
          x={el.w - 7}
          y={el.h - 7}
          width={14}
          height={14}
          rx={3}
          fill="#f2b705"
          stroke="#fff"
          strokeWidth={1.5}
          style={{ cursor: "nwse-resize" }}
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
        />
      )}
    </g>
  );
}

function labelFor(el: C4Element): string {
  const kind = el.kind.charAt(0).toUpperCase() + el.kind.slice(1);
  return el.external ? `${kind}, External` : kind;
}
