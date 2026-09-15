import { useState } from "react";
import { useStore } from "../store";
import { DIAGRAM_TYPES, type DiagramType, type ElementKind, type ShapeVariant } from "../c4";
import { copyMermaid, downloadMermaid, exportPng, exportSvg } from "../export";

const KINDS: ElementKind[] = ["person", "system", "container", "component", "node"];
const VARIANTS: ShapeVariant[] = ["default", "db", "queue"];

export function Toolbar() {
  const type = useStore((s) => s.diagram.type);
  const title = useStore((s) => s.diagram.title ?? "");
  const tool = useStore((s) => s.tool);
  const code = useStore((s) => s.code);

  const [kind, setKind] = useState<ElementKind>("system");
  const [variant, setVariant] = useState<ShapeVariant>("default");
  const [external, setExternal] = useState(false);

  const variantDisabled = kind === "person" || kind === "node";

  return (
    <div className="toolbar">
      <div className="tb-group">
        <span className="brand">Aquarius</span>
        <select
          value={type}
          onChange={(e) => useStore.getState().setDiagramType(e.target.value as DiagramType)}
          title="Diagram type"
        >
          {DIAGRAM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          className="title-input"
          placeholder="Diagram title…"
          value={title}
          onChange={(e) => useStore.getState().setTitle(e.target.value)}
        />
      </div>

      <div className="tb-group">
        <select value={kind} onChange={(e) => setKind(e.target.value as ElementKind)} title="Element kind">
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select
          value={variant}
          onChange={(e) => setVariant(e.target.value as ShapeVariant)}
          disabled={variantDisabled}
          title="Shape variant"
        >
          {VARIANTS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <label className="chk" title="External element">
          <input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} />
          ext
        </label>
        <button
          onClick={() => useStore.getState().addElement(kind, external, variantDisabled ? "default" : variant)}
        >
          + Element
        </button>
        <button onClick={() => useStore.getState().addBoundary("system")}>+ Boundary</button>
        <button
          className={tool === "addRel" ? "active" : ""}
          onClick={() => (tool === "addRel" ? useStore.getState().cancelTool() : useStore.getState().startAddRel())}
        >
          + Relationship
        </button>
      </div>

      <div className="tb-group right">
        <button
          onClick={() => {
            const el = document.querySelector<HTMLDivElement>(".canvas-wrap");
            if (el) useStore.getState().fitView(el.clientWidth, el.clientHeight);
          }}
        >
          Fit
        </button>
        <button onClick={() => useStore.getState().resetView()}>1:1</button>
        <button onClick={() => useStore.getState().loadSample()}>Sample</button>
        <span className="sep" />
        <button onClick={() => copyMermaid(code)} title="Copy Mermaid to clipboard">
          Copy
        </button>
        <button onClick={() => downloadMermaid(code)}>.mmd</button>
        <button onClick={() => exportSvg(useStore.getState().diagram)}>SVG</button>
        <button onClick={() => exportPng(useStore.getState().diagram)}>PNG</button>
      </div>
    </div>
  );
}
