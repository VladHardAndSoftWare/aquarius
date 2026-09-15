import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { boundaryRect, type Rect } from "../c4";
import { NodeView } from "./NodeView";
import { BoundaryView } from "./BoundaryView";
import { RelationshipView } from "./RelationshipView";

export function Canvas() {
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);
  const selection = useStore((s) => s.selection);
  const relFrom = useStore((s) => s.relFrom);
  const tool = useStore((s) => s.tool);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const panning = useRef<boolean>(false);
  const [midPanning, setMidPanning] = useState(false);
  const didFit = useRef(false);

  // Native wheel listener so we can preventDefault (React onWheel is passive).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      useStore.getState().zoomAt(factor, mx, my);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // Middle-button panning. Captured on the svg so it works anywhere on the
  // canvas, including over nodes and boundaries, and never touches selection.
  // Native listeners so the middle-click autoscroll widget can be suppressed.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let active = false;
    let lastX = 0;
    let lastY = 0;
    let pointerId = -1;

    const stop = () => {
      if (!active) return;
      active = false;
      try {
        svg.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      pointerId = -1;
      setMidPanning(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      active = true;
      lastX = e.clientX;
      lastY = e.clientY;
      pointerId = e.pointerId;
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      setMidPanning(true);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!active) return;
      e.preventDefault();
      useStore.getState().panBy(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!active || e.button !== 1) return;
      e.preventDefault();
      stop();
    };
    // Chrome opens autoscroll from the compatibility mouse events.
    const swallowMiddle = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    svg.addEventListener("pointerdown", onPointerDown, true);
    svg.addEventListener("pointermove", onPointerMove);
    svg.addEventListener("pointerup", onPointerUp);
    svg.addEventListener("pointercancel", stop);
    svg.addEventListener("lostpointercapture", stop);
    svg.addEventListener("mousedown", swallowMiddle, true);
    svg.addEventListener("auxclick", swallowMiddle);
    return () => {
      svg.removeEventListener("pointerdown", onPointerDown, true);
      svg.removeEventListener("pointermove", onPointerMove);
      svg.removeEventListener("pointerup", onPointerUp);
      svg.removeEventListener("pointercancel", stop);
      svg.removeEventListener("lostpointercapture", stop);
      svg.removeEventListener("mousedown", swallowMiddle, true);
      svg.removeEventListener("auxclick", swallowMiddle);
    };
  }, []);

  // Fit once after the first diagram with content is available.
  useEffect(() => {
    if (didFit.current) return;
    const count = Object.keys(diagram.elements).length + Object.keys(diagram.boundaries).length;
    if (count === 0) return;
    const el = wrapRef.current;
    if (!el) return;
    didFit.current = true;
    requestAnimationFrame(() => useStore.getState().fitView(el.clientWidth, el.clientHeight));
  }, [diagram]);

  const layerOrder = useMemo(() => {
    const m: Record<string, number> = {};
    diagram.layers.forEach((l, i) => (m[l.id] = i));
    return m;
  }, [diagram.layers]);
  const visibleLayers = useMemo(() => {
    const s = new Set<string>();
    for (const l of diagram.layers) if (l.visible) s.add(l.id);
    return s;
  }, [diagram.layers]);

  const boundaryRects = useMemo(() => {
    const m: Record<string, Rect> = {};
    for (const b of Object.values(diagram.boundaries)) m[b.id] = boundaryRect(diagram, b);
    return m;
  }, [diagram]);

  const sortedBoundaries = useMemo(
    () =>
      Object.values(diagram.boundaries)
        .filter((b) => visibleLayers.has(b.layerId))
        .sort((a, b) => (layerOrder[a.layerId] ?? 0) - (layerOrder[b.layerId] ?? 0)),
    [diagram.boundaries, visibleLayers, layerOrder]
  );
  const sortedElements = useMemo(
    () =>
      Object.values(diagram.elements)
        .filter((e) => visibleLayers.has(e.layerId))
        .sort((a, b) => (layerOrder[a.layerId] ?? 0) - (layerOrder[b.layerId] ?? 0)),
    [diagram.elements, visibleLayers, layerOrder]
  );

  const elementVisible = (alias: string) => {
    const el = diagram.elements[alias];
    return el ? visibleLayers.has(el.layerId) : false;
  };

  const onBgPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    useStore.getState().clearSelection();
    if (tool === "addRel") useStore.getState().cancelTool();
    panning.current = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onBgPointerMove = (e: React.PointerEvent) => {
    if (!panning.current) return;
    useStore.getState().panBy(e.movementX, e.movementY);
  };
  const onBgPointerUp = (e: React.PointerEvent) => {
    panning.current = false;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <svg
        ref={svgRef}
        className="canvas-svg"
        style={{ cursor: midPanning ? "grabbing" : tool === "addRel" ? "crosshair" : "default" }}
      >
        <defs>
          <marker id="arrow-end" markerWidth={12} markerHeight={12} refX={9} refY={4} orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0 L9,4 L0,8 Z" fill="#6b6b76" />
          </marker>
          <marker id="arrow-start" markerWidth={12} markerHeight={12} refX={0} refY={4} orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M0,0 L9,4 L0,8 Z" fill="#6b6b76" />
          </marker>
          <pattern id="grid" width={28} height={28} patternUnits="userSpaceOnUse">
            <path d="M28 0 L0 0 0 28" fill="none" stroke="#e7e9ef" strokeWidth={1} />
          </pattern>
        </defs>

        <rect
          data-bg
          x={0}
          y={0}
          width="100%"
          height="100%"
          fill="url(#grid)"
          onPointerDown={onBgPointerDown}
          onPointerMove={onBgPointerMove}
          onPointerUp={onBgPointerUp}
        />

        <g
          id="viewport"
          transform={`translate(${view.panX},${view.panY}) scale(${view.zoom})`}
          pointerEvents={midPanning ? "none" : undefined}
        >
          {sortedBoundaries.map((b) => (
            <BoundaryView
              key={b.id}
              boundary={b}
              rect={boundaryRects[b.id]}
              selected={selection.nodeIds.includes(b.id)}
              dimmed={false}
            />
          ))}

          {diagram.rels
            .filter((r) => elementVisible(r.from) && elementVisible(r.to))
            .map((r) => (
              <RelationshipView
                key={r.id}
                rel={r}
                fromRect={rectOf(diagram, r.from)}
                toRect={rectOf(diagram, r.to)}
                selected={selection.relId === r.id}
                dimmed={false}
              />
            ))}

          {sortedElements.map((el) => (
            <NodeView
              key={el.id}
              el={el}
              selected={selection.nodeIds.includes(el.id) || relFrom === el.id}
              dimmed={false}
            />
          ))}
        </g>
      </svg>
      {tool === "addRel" && (
        <div className="canvas-hint">
          {relFrom ? "Click the target element" : "Click the source element"} · Esc to cancel
        </div>
      )}
    </div>
  );
}

function rectOf(diagram: ReturnType<typeof useStore.getState>["diagram"], alias: string): Rect {
  const el = diagram.elements[alias];
  return { x: el.x, y: el.y, w: el.w, h: el.h };
}
