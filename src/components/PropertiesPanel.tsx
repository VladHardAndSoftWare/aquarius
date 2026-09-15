import { useStore } from "../store";
import type { Diagram, ElementKind, RelDirection, ShapeVariant } from "../c4";

const KINDS: ElementKind[] = ["person", "system", "container", "component", "node"];
const VARIANTS: ShapeVariant[] = ["default", "db", "queue"];
const DIRECTIONS: RelDirection[] = ["auto", "up", "down", "left", "right", "back"];
const BOUNDARY_TYPES = ["enterprise", "system", "container", "generic"] as const;

function isDescendant(diagram: Diagram, candidate: string, ancestor: string): boolean {
  let cur = diagram.boundaries[candidate]?.parentId;
  while (cur) {
    if (cur === ancestor) return true;
    cur = diagram.boundaries[cur]?.parentId;
  }
  return false;
}

function LayerSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const layers = useStore((s) => s.diagram.layers);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {layers.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}

export function PropertiesPanel() {
  const diagram = useStore((s) => s.diagram);
  const selection = useStore((s) => s.selection);

  if (selection.relId) {
    const rel = diagram.rels.find((r) => r.id === selection.relId);
    if (!rel) return <Empty />;
    const aliases = Object.keys(diagram.elements);
    return (
      <div className="props">
        <div className="panel-head">
          <span>Relationship</span>
        </div>
        <Row label="From">
          <select value={rel.from} onChange={(e) => useStore.getState().updateRel(rel.id, { from: e.target.value })}>
            {aliases.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </Row>
        <Row label="To">
          <select value={rel.to} onChange={(e) => useStore.getState().updateRel(rel.id, { to: e.target.value })}>
            {aliases.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </Row>
        <Row label="Label">
          <input value={rel.label ?? ""} onChange={(e) => useStore.getState().updateRel(rel.id, { label: e.target.value })} />
        </Row>
        <Row label="Tech">
          <input value={rel.techn ?? ""} onChange={(e) => useStore.getState().updateRel(rel.id, { techn: e.target.value })} />
        </Row>
        <Row label="Direction">
          <select value={rel.direction} onChange={(e) => useStore.getState().updateRel(rel.id, { direction: e.target.value as RelDirection })}>
            {DIRECTIONS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Row>
        <Row label="Two-way">
          <input
            type="checkbox"
            checked={rel.bidirectional}
            onChange={(e) => useStore.getState().updateRel(rel.id, { bidirectional: e.target.checked })}
          />
        </Row>
        <Row label="Layer">
          <LayerSelect value={rel.layerId} onChange={(v) => useStore.getState().updateRel(rel.id, { layerId: v })} />
        </Row>
        <button className="danger-btn" onClick={() => useStore.getState().deleteSelection()}>
          Delete relationship
        </button>
      </div>
    );
  }

  if (selection.nodeIds.length > 1) {
    return (
      <div className="props">
        <div className="panel-head">
          <span>{selection.nodeIds.length} selected</span>
        </div>
        <p className="hint">Drag to move together. Use the Layers panel to move them to a layer, or Delete to remove.</p>
        <button className="danger-btn" onClick={() => useStore.getState().deleteSelection()}>
          Delete selection
        </button>
      </div>
    );
  }

  if (selection.nodeIds.length === 1) {
    const id = selection.nodeIds[0];
    const el = diagram.elements[id];
    if (el) {
      const variantDisabled = el.kind === "person" || el.kind === "node";
      const boundaries = Object.values(diagram.boundaries);
      return (
        <div className="props">
          <div className="panel-head">
            <span>Element</span>
          </div>
          <Row label="Alias">
            <input value={el.alias} onChange={(e) => useStore.getState().updateElement(id, { alias: e.target.value.trim() })} />
          </Row>
          <Row label="Kind">
            <select value={el.kind} onChange={(e) => useStore.getState().updateElement(id, { kind: e.target.value as ElementKind })}>
              {KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Row>
          <Row label="Variant">
            <select
              value={el.variant}
              disabled={variantDisabled}
              onChange={(e) => useStore.getState().updateElement(id, { variant: e.target.value as ShapeVariant })}
            >
              {VARIANTS.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Row>
          <Row label="External">
            <input type="checkbox" checked={el.external} onChange={(e) => useStore.getState().updateElement(id, { external: e.target.checked })} />
          </Row>
          <Row label="Label">
            <input value={el.label} onChange={(e) => useStore.getState().updateElement(id, { label: e.target.value })} />
          </Row>
          <Row label="Tech">
            <input value={el.techn ?? ""} onChange={(e) => useStore.getState().updateElement(id, { techn: e.target.value })} />
          </Row>
          <Row label="Descr">
            <textarea
              rows={2}
              value={el.descr ?? ""}
              onChange={(e) => useStore.getState().updateElement(id, { descr: e.target.value })}
            />
          </Row>
          <Row label="Parent">
            <select
              value={el.parentId ?? ""}
              onChange={(e) => useStore.getState().updateElement(id, { parentId: e.target.value || undefined })}
            >
              <option value="">— none —</option>
              {boundaries.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Layer">
            <LayerSelect value={el.layerId} onChange={(v) => useStore.getState().updateElement(id, { layerId: v })} />
          </Row>
          <PosRow x={el.x} y={el.y} />
          <button className="danger-btn" onClick={() => useStore.getState().deleteSelection()}>
            Delete element
          </button>
        </div>
      );
    }

    const b = diagram.boundaries[id];
    if (b) {
      const parents = Object.values(diagram.boundaries).filter((x) => x.id !== id && !isDescendant(diagram, x.id, id));
      return (
        <div className="props">
          <div className="panel-head">
            <span>Boundary</span>
          </div>
          <Row label="Alias">
            <input value={b.alias} onChange={(e) => useStore.getState().updateBoundary(id, { alias: e.target.value.trim() })} />
          </Row>
          <Row label="Label">
            <input value={b.label} onChange={(e) => useStore.getState().updateBoundary(id, { label: e.target.value })} />
          </Row>
          <Row label="Type">
            <select
              value={b.boundaryType}
              onChange={(e) => useStore.getState().updateBoundary(id, { boundaryType: e.target.value as typeof BOUNDARY_TYPES[number] })}
            >
              {BOUNDARY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Row>
          <Row label="Auto-fit">
            <input type="checkbox" checked={b.autoFit} onChange={(e) => useStore.getState().updateBoundary(id, { autoFit: e.target.checked })} />
          </Row>
          <Row label="Parent">
            <select
              value={b.parentId ?? ""}
              onChange={(e) => useStore.getState().updateBoundary(id, { parentId: e.target.value || undefined })}
            >
              <option value="">— none —</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Layer">
            <LayerSelect value={b.layerId} onChange={(v) => useStore.getState().updateBoundary(id, { layerId: v })} />
          </Row>
          <button className="danger-btn" onClick={() => useStore.getState().deleteSelection()}>
            Delete boundary
          </button>
        </div>
      );
    }
  }

  return <Empty />;
}

function Empty() {
  return (
    <div className="props">
      <div className="panel-head">
        <span>Properties</span>
      </div>
      <p className="hint">Select an element, boundary or relationship to edit its properties.</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="prop-row">
      <span className="prop-label">{label}</span>
      <span className="prop-field">{children}</span>
    </label>
  );
}

function PosRow({ x, y }: { x: number; y: number }) {
  return (
    <div className="prop-row">
      <span className="prop-label">Pos</span>
      <span className="prop-field pos">
        x {Math.round(x)} · y {Math.round(y)}
      </span>
    </div>
  );
}
