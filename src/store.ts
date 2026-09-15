import { create } from "zustand";
import {
  type C4Boundary,
  type C4Element,
  type C4Rel,
  type Diagram,
  type DiagramType,
  type ElementKind,
  type Layer,
  type ShapeVariant,
  contentBounds,
  defaultSize,
  parseC4,
  serializeC4,
} from "./c4";
import { SAMPLE_C4 } from "./sample";

export interface ViewState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface Selection {
  nodeIds: string[]; // element or boundary ids
  relId: string | null;
}

export type Tool = "select" | "addRel";

interface StoreState {
  diagram: Diagram;
  code: string;
  errors: string[];
  view: ViewState;
  selection: Selection;
  activeLayerId: string;
  tool: Tool;
  relFrom: string | null;

  // code <-> model
  applyCode: (text: string) => void;
  commit: () => void; // regenerate code from the model (after canvas edits)

  // node geometry
  moveSelectedBy: (dx: number, dy: number) => void;
  setNodeSize: (id: string, w: number, h: number) => void;

  // creation / deletion
  addElement: (kind: ElementKind, external?: boolean, variant?: ShapeVariant) => void;
  addBoundary: (type: C4Boundary["boundaryType"]) => void;
  deleteSelection: () => void;

  // relationships
  startAddRel: () => void;
  cancelTool: () => void;
  nodeClicked: (id: string, additive: boolean) => void;
  selectRel: (id: string) => void;
  clearSelection: () => void;

  // property edits
  updateElement: (id: string, patch: Partial<C4Element>) => void;
  updateBoundary: (id: string, patch: Partial<C4Boundary>) => void;
  updateRel: (id: string, patch: Partial<C4Rel>) => void;
  setDiagramType: (type: DiagramType) => void;
  setTitle: (title: string) => void;

  // layers
  addLayer: () => void;
  renameLayer: (id: string, name: string) => void;
  toggleLayerVisible: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  moveLayer: (id: string, dir: -1 | 1) => void;
  deleteLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;
  assignSelectionToLayer: (layerId: string) => void;

  // view
  setView: (v: Partial<ViewState>) => void;
  zoomAt: (factor: number, cx: number, cy: number) => void;
  panBy: (dx: number, dy: number) => void;
  fitView: (vw: number, vh: number) => void;
  resetView: () => void;

  loadSample: () => void;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function uniqueAlias(diagram: Diagram, base: string): string {
  let i = 1;
  let alias = `${base}${i}`;
  while (diagram.elements[alias] || diagram.boundaries[alias]) {
    i++;
    alias = `${base}${i}`;
  }
  return alias;
}

/** Collect a node id plus all descendant element/boundary ids of a boundary. */
function withDescendants(diagram: Diagram, id: string): string[] {
  const result = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const el of Object.values(diagram.elements)) {
      if (el.parentId && result.has(el.parentId) && !result.has(el.id)) {
        result.add(el.id);
        changed = true;
      }
    }
    for (const b of Object.values(diagram.boundaries)) {
      if (b.parentId && result.has(b.parentId) && !result.has(b.id)) {
        result.add(b.id);
        changed = true;
      }
    }
  }
  return [...result];
}

function centerOfView(view: ViewState, vw = 900, vh = 600): { x: number; y: number } {
  return {
    x: (vw / 2 - view.panX) / view.zoom,
    y: (vh / 2 - view.panY) / view.zoom,
  };
}

export const useStore = create<StoreState>((set, get) => ({
  diagram: { type: "C4Context", elements: {}, boundaries: {}, rels: [], layers: [], passthrough: [] },
  code: "",
  errors: [],
  view: { panX: 0, panY: 0, zoom: 1 },
  selection: { nodeIds: [], relId: null },
  activeLayerId: "layer-1",
  tool: "select",
  relFrom: null,

  applyCode: (text) => {
    const prev = get().diagram;
    const { diagram, errors } = parseC4(text);

    const hadLayerMeta = /aquarius:layer\b/.test(text);
    if (!hadLayerMeta && prev.layers.length > 0) {
      diagram.layers = prev.layers.map((l) => ({ ...l }));
    }
    if (diagram.layers.length === 0) {
      diagram.layers = [{ id: "layer-1", name: "Layer 1", visible: true, locked: false }];
    }
    const layerIds = new Set(diagram.layers.map((l) => l.id));
    const defLayer = diagram.layers[0].id;

    for (const el of Object.values(diagram.elements)) {
      const hasMeta = new RegExp(`aquarius:node\\s+alias=${escapeRe(el.alias)}(?!\\w)`).test(text);
      const old = prev.elements[el.alias];
      if (!hasMeta && old) {
        el.x = old.x;
        el.y = old.y;
        el.w = old.w;
        el.h = old.h;
      }
      if (!layerIds.has(el.layerId)) {
        el.layerId = old && layerIds.has(old.layerId) ? old.layerId : defLayer;
      }
    }
    for (const b of Object.values(diagram.boundaries)) {
      if (!layerIds.has(b.layerId)) {
        const old = prev.boundaries[b.alias];
        b.layerId = old && layerIds.has(old.layerId) ? old.layerId : defLayer;
      }
    }
    for (const r of diagram.rels) {
      if (!layerIds.has(r.layerId)) r.layerId = defLayer;
    }

    const activeLayerId = layerIds.has(get().activeLayerId) ? get().activeLayerId : defLayer;
    set({
      diagram,
      code: serializeC4(diagram),
      errors,
      activeLayerId,
      selection: { nodeIds: [], relId: null },
    });
  },

  commit: () => {
    const { diagram } = get();
    set({ code: serializeC4(diagram) });
  },

  moveSelectedBy: (dx, dy) => {
    const { diagram, selection } = get();
    const locked = new Set(diagram.layers.filter((l) => l.locked).map((l) => l.id));
    const toMove = new Set<string>();
    for (const id of selection.nodeIds) {
      const b = diagram.boundaries[id];
      if (b) {
        for (const d of withDescendants(diagram, id)) toMove.add(d);
      } else {
        toMove.add(id);
      }
    }
    const elements = { ...diagram.elements };
    const boundaries = { ...diagram.boundaries };
    for (const id of toMove) {
      const el = elements[id];
      if (el && !locked.has(el.layerId)) {
        elements[id] = { ...el, x: el.x + dx, y: el.y + dy };
        continue;
      }
      const b = boundaries[id];
      if (b && !b.autoFit && b.x != null && b.y != null && !locked.has(b.layerId)) {
        boundaries[id] = { ...b, x: b.x + dx, y: b.y + dy };
      }
    }
    set({ diagram: { ...diagram, elements, boundaries } });
  },

  setNodeSize: (id, w, h) => {
    const { diagram } = get();
    if (diagram.elements[id]) {
      const el = diagram.elements[id];
      set({
        diagram: {
          ...diagram,
          elements: { ...diagram.elements, [id]: { ...el, w: Math.max(120, w), h: Math.max(70, h) } },
        },
      });
    } else if (diagram.boundaries[id]) {
      const b = diagram.boundaries[id];
      set({
        diagram: {
          ...diagram,
          boundaries: { ...diagram.boundaries, [id]: { ...b, autoFit: false, w: Math.max(160, w), h: Math.max(120, h) } },
        },
      });
    }
    get().commit();
  },

  addElement: (kind, external = false, variant = "default") => {
    const { diagram, view, activeLayerId } = get();
    const alias = uniqueAlias(diagram, kind);
    const size = defaultSize(kind);
    const c = centerOfView(view);
    const label = kind.charAt(0).toUpperCase() + kind.slice(1);
    const el: C4Element = {
      id: alias,
      alias,
      kind,
      external,
      variant,
      label: `New ${label}`,
      layerId: activeLayerId,
      x: Math.round(c.x - size.w / 2),
      y: Math.round(c.y - size.h / 2),
      w: size.w,
      h: size.h,
    };
    set({
      diagram: { ...diagram, elements: { ...diagram.elements, [alias]: el } },
      selection: { nodeIds: [alias], relId: null },
    });
    get().commit();
  },

  addBoundary: (type) => {
    const { diagram, view, activeLayerId } = get();
    const alias = uniqueAlias(diagram, "boundary");
    const c = centerOfView(view);
    const b: C4Boundary = {
      id: alias,
      alias,
      label: "New Boundary",
      boundaryType: type,
      layerId: activeLayerId,
      autoFit: false,
      x: Math.round(c.x - 200),
      y: Math.round(c.y - 140),
      w: 400,
      h: 280,
    };
    set({
      diagram: { ...diagram, boundaries: { ...diagram.boundaries, [alias]: b } },
      selection: { nodeIds: [alias], relId: null },
    });
    get().commit();
  },

  deleteSelection: () => {
    const { diagram, selection } = get();
    const remove = new Set<string>();
    for (const id of selection.nodeIds) {
      if (diagram.boundaries[id]) {
        for (const d of withDescendants(diagram, id)) remove.add(d);
      } else {
        remove.add(id);
      }
    }
    const elements = { ...diagram.elements };
    const boundaries = { ...diagram.boundaries };
    for (const id of remove) {
      delete elements[id];
      delete boundaries[id];
    }
    // orphan children of removed boundaries become top-level
    for (const el of Object.values(elements)) {
      if (el.parentId && !boundaries[el.parentId]) elements[el.id] = { ...el, parentId: undefined };
    }
    let rels = diagram.rels;
    if (selection.relId) rels = rels.filter((r) => r.id !== selection.relId);
    rels = rels.filter((r) => elements[r.from] && elements[r.to]);
    set({
      diagram: { ...diagram, elements, boundaries, rels },
      selection: { nodeIds: [], relId: null },
    });
    get().commit();
  },

  startAddRel: () => set({ tool: "addRel", relFrom: null }),
  cancelTool: () => set({ tool: "select", relFrom: null }),

  nodeClicked: (id, additive) => {
    const { tool, relFrom, diagram } = get();
    if (tool === "addRel") {
      if (!diagram.elements[id]) return; // relationships only between elements
      if (!relFrom) {
        set({ relFrom: id });
        return;
      }
      if (relFrom === id) {
        set({ relFrom: null });
        return;
      }
      const rel: C4Rel = {
        id: `rel-${Date.now()}`,
        from: relFrom,
        to: id,
        bidirectional: false,
        direction: "auto",
        layerId: diagram.elements[relFrom].layerId,
      };
      set({
        diagram: { ...diagram, rels: [...diagram.rels, rel] },
        tool: "select",
        relFrom: null,
        selection: { nodeIds: [], relId: rel.id },
      });
      get().commit();
      return;
    }
    const sel = get().selection;
    if (additive) {
      const has = sel.nodeIds.includes(id);
      set({
        selection: {
          nodeIds: has ? sel.nodeIds.filter((n) => n !== id) : [...sel.nodeIds, id],
          relId: null,
        },
      });
    } else {
      set({ selection: { nodeIds: [id], relId: null } });
    }
  },

  selectRel: (id) => set({ selection: { nodeIds: [], relId: id } }),
  clearSelection: () => set({ selection: { nodeIds: [], relId: null } }),

  updateElement: (id, patch) => {
    const { diagram } = get();
    const el = diagram.elements[id];
    if (!el) return;
    let elements = { ...diagram.elements };
    // handle alias rename: update key + relationship endpoints
    let rels = diagram.rels;
    if (patch.alias && patch.alias !== el.alias && !diagram.elements[patch.alias] && !diagram.boundaries[patch.alias]) {
      delete elements[id];
      const newEl = { ...el, ...patch, id: patch.alias };
      elements[patch.alias] = newEl;
      rels = rels.map((r) => ({
        ...r,
        from: r.from === el.alias ? patch.alias! : r.from,
        to: r.to === el.alias ? patch.alias! : r.to,
      }));
      set({ diagram: { ...diagram, elements, rels }, selection: { nodeIds: [patch.alias], relId: null } });
    } else {
      elements[id] = { ...el, ...patch, id: el.id, alias: el.alias };
      set({ diagram: { ...diagram, elements } });
    }
    get().commit();
  },

  updateBoundary: (id, patch) => {
    const { diagram } = get();
    const b = diagram.boundaries[id];
    if (!b) return;
    set({
      diagram: { ...diagram, boundaries: { ...diagram.boundaries, [id]: { ...b, ...patch, id: b.id, alias: b.alias } } },
    });
    get().commit();
  },

  updateRel: (id, patch) => {
    const { diagram } = get();
    set({
      diagram: { ...diagram, rels: diagram.rels.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r)) },
    });
    get().commit();
  },

  setDiagramType: (type) => {
    set({ diagram: { ...get().diagram, type } });
    get().commit();
  },
  setTitle: (title) => {
    set({ diagram: { ...get().diagram, title: title || undefined } });
    get().commit();
  },

  addLayer: () => {
    const { diagram } = get();
    const id = `layer-${Date.now()}`;
    const layer: Layer = { id, name: `Layer ${diagram.layers.length + 1}`, visible: true, locked: false };
    set({ diagram: { ...diagram, layers: [...diagram.layers, layer] }, activeLayerId: id });
    get().commit();
  },
  renameLayer: (id, name) => {
    const { diagram } = get();
    set({ diagram: { ...diagram, layers: diagram.layers.map((l) => (l.id === id ? { ...l, name } : l)) } });
    get().commit();
  },
  toggleLayerVisible: (id) => {
    const { diagram } = get();
    set({ diagram: { ...diagram, layers: diagram.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)) } });
    get().commit();
  },
  toggleLayerLock: (id) => {
    const { diagram } = get();
    set({ diagram: { ...diagram, layers: diagram.layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)) } });
    get().commit();
  },
  moveLayer: (id, dir) => {
    const { diagram } = get();
    const layers = [...diagram.layers];
    const i = layers.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= layers.length) return;
    [layers[i], layers[j]] = [layers[j], layers[i]];
    set({ diagram: { ...diagram, layers } });
    get().commit();
  },
  deleteLayer: (id) => {
    const { diagram, activeLayerId } = get();
    if (diagram.layers.length <= 1) return;
    const layers = diagram.layers.filter((l) => l.id !== id);
    const fallback = layers[0].id;
    const elements = { ...diagram.elements };
    for (const el of Object.values(elements)) {
      if (el.layerId === id) elements[el.id] = { ...el, layerId: fallback };
    }
    const boundaries = { ...diagram.boundaries };
    for (const b of Object.values(boundaries)) {
      if (b.layerId === id) boundaries[b.id] = { ...b, layerId: fallback };
    }
    const rels = diagram.rels.map((r) => (r.layerId === id ? { ...r, layerId: fallback } : r));
    set({
      diagram: { ...diagram, layers, elements, boundaries, rels },
      activeLayerId: activeLayerId === id ? fallback : activeLayerId,
    });
    get().commit();
  },
  setActiveLayer: (id) => set({ activeLayerId: id }),
  assignSelectionToLayer: (layerId) => {
    const { diagram, selection } = get();
    const ids = new Set(selection.nodeIds);
    const elements = { ...diagram.elements };
    const boundaries = { ...diagram.boundaries };
    for (const id of ids) {
      if (elements[id]) elements[id] = { ...elements[id], layerId };
      if (boundaries[id]) boundaries[id] = { ...boundaries[id], layerId };
    }
    set({ diagram: { ...diagram, elements, boundaries } });
    get().commit();
  },

  setView: (v) => set({ view: { ...get().view, ...v } }),
  zoomAt: (factor, cx, cy) => {
    const { view } = get();
    const zoom = Math.min(4, Math.max(0.15, view.zoom * factor));
    const k = zoom / view.zoom;
    set({
      view: {
        zoom,
        panX: cx - (cx - view.panX) * k,
        panY: cy - (cy - view.panY) * k,
      },
    });
  },
  panBy: (dx, dy) => {
    const { view } = get();
    set({ view: { ...view, panX: view.panX + dx, panY: view.panY + dy } });
  },
  fitView: (vw, vh) => {
    const bounds = contentBounds(get().diagram);
    if (!bounds) {
      set({ view: { panX: 0, panY: 0, zoom: 1 } });
      return;
    }
    const pad = 80;
    const zoom = Math.min(2, Math.max(0.15, Math.min((vw - pad) / bounds.w, (vh - pad) / bounds.h)));
    set({
      view: {
        zoom,
        panX: vw / 2 - (bounds.x + bounds.w / 2) * zoom,
        panY: vh / 2 - (bounds.y + bounds.h / 2) * zoom,
      },
    });
  },
  resetView: () => set({ view: { panX: 0, panY: 0, zoom: 1 } }),

  loadSample: () => get().applyCode(SAMPLE_C4),
}));
