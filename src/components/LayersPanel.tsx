import { useStore } from "../store";
import type { Layer } from "../c4";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M1.5 8C3.5 4 12.5 4 14.5 8 12.5 12 3.5 12 1.5 8Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="2.2" fill="currentColor" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M2 8S4.5 3.5 8 3.5c1 0 1.9.3 2.7.7M13.5 8S12.5 9.8 10.8 11M2.5 3l11 10" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        d={locked ? "M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" : "M5.5 7V5.2a2.5 2.5 0 0 1 5 0"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function LayersPanel() {
  const layers = useStore((s) => s.diagram.layers);
  const elements = useStore((s) => s.diagram.elements);
  const boundaries = useStore((s) => s.diagram.boundaries);
  const activeLayerId = useStore((s) => s.activeLayerId);
  const selection = useStore((s) => s.selection);

  const count = (id: string) => {
    let n = 0;
    for (const e of Object.values(elements)) if (e.layerId === id) n++;
    for (const b of Object.values(boundaries)) if (b.layerId === id) n++;
    return n;
  };

  // Display top-of-stack first (array is bottom→top).
  const ordered: Layer[] = [...layers].reverse();

  return (
    <div className="layers-panel">
      <div className="panel-head">
        <span>Layers</span>
        <button className="apply-btn" onClick={() => useStore.getState().addLayer()}>
          + Add
        </button>
      </div>

      <div className="layer-list">
        {ordered.map((l) => {
          const idx = layers.findIndex((x) => x.id === l.id);
          const isTop = idx === layers.length - 1;
          const isBottom = idx === 0;
          const active = l.id === activeLayerId;
          return (
            <div
              key={l.id}
              className={"layer-row" + (active ? " active" : "")}
              onClick={() => useStore.getState().setActiveLayer(l.id)}
            >
              <button
                className={"icon-btn" + (l.visible ? "" : " off")}
                title={l.visible ? "Hide layer" : "Show layer"}
                onClick={(e) => {
                  e.stopPropagation();
                  useStore.getState().toggleLayerVisible(l.id);
                }}
              >
                <EyeIcon open={l.visible} />
              </button>
              <button
                className={"icon-btn" + (l.locked ? " on" : "")}
                title={l.locked ? "Unlock layer" : "Lock layer"}
                onClick={(e) => {
                  e.stopPropagation();
                  useStore.getState().toggleLayerLock(l.id);
                }}
              >
                <LockIcon locked={l.locked} />
              </button>
              <input
                className="layer-name"
                value={l.name}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => useStore.getState().renameLayer(l.id, e.target.value)}
              />
              <span className="layer-count">{count(l.id)}</span>
              <div className="layer-actions" onClick={(e) => e.stopPropagation()}>
                <button className="mini" disabled={isTop} onClick={() => useStore.getState().moveLayer(l.id, 1)} title="Move up">
                  ▲
                </button>
                <button className="mini" disabled={isBottom} onClick={() => useStore.getState().moveLayer(l.id, -1)} title="Move down">
                  ▼
                </button>
                <button
                  className="mini danger"
                  disabled={layers.length <= 1}
                  onClick={() => useStore.getState().deleteLayer(l.id)}
                  title="Delete layer"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        className="assign-btn"
        disabled={selection.nodeIds.length === 0}
        onClick={() => useStore.getState().assignSelectionToLayer(activeLayerId)}
      >
        Move selection → active layer
      </button>
    </div>
  );
}
