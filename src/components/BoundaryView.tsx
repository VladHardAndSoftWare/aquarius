import { useRef } from "react";
import type { C4Boundary } from "../c4";
import type { Rect } from "../c4";
import { useStore } from "../store";

interface Props {
  boundary: C4Boundary;
  rect: Rect;
  selected: boolean;
  dimmed: boolean;
}

const TYPE_LABEL: Record<C4Boundary["boundaryType"], string> = {
  enterprise: "Enterprise",
  system: "System",
  container: "Container",
  generic: "Boundary",
};

export function BoundaryView({ boundary, rect, selected, dimmed }: Props) {
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const st = useStore.getState();
    if (st.tool === "addRel") return;
    if (!st.selection.nodeIds.includes(boundary.id)) st.nodeClicked(boundary.id, e.shiftKey);
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

  const typeText = boundary.typeLabel || TYPE_LABEL[boundary.boundaryType];

  return (
    <g transform={`translate(${rect.x},${rect.y})`} opacity={dimmed ? 0.4 : 1}>
      {/* Header strip is the grab target so inner nodes stay draggable. */}
      <rect
        x={0}
        y={0}
        width={rect.w}
        height={rect.h}
        rx={8}
        fill="transparent"
        stroke={selected ? "#f2b705" : "#8a8a8a"}
        strokeWidth={selected ? 2 : 1.5}
        strokeDasharray="8 6"
      />
      <rect
        x={0}
        y={0}
        width={rect.w}
        height={28}
        fill="transparent"
        style={{ cursor: "move" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <text x={14} y={19} className="boundary-label">
        {boundary.label} <tspan className="boundary-type">[{typeText}]</tspan>
      </text>
    </g>
  );
}
