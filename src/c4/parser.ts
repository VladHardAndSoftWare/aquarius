import {
  type C4Boundary,
  type C4Element,
  type C4Rel,
  type Diagram,
  type DiagramType,
  type Layer,
  type RelDirection,
  DIAGRAM_TYPES,
} from "./types";
import { parseArgs } from "./args";
import {
  defaultSize,
  resolveBoundaryFunc,
  resolveElementFunc,
} from "./registry";
import { emptyMeta, META_PREFIX, parseMetaLine, type Meta } from "./metadata";

export interface ParseResult {
  diagram: Diagram;
  errors: string[];
}

interface RelSpec {
  bidirectional: boolean;
  direction: RelDirection;
}

function resolveRelFunc(name: string): RelSpec | null {
  let base = name;
  let bidirectional = false;
  if (base.startsWith("BiRel")) {
    bidirectional = true;
    base = base.slice(5);
  } else if (base.startsWith("Rel")) {
    base = base.slice(3);
  } else {
    return null;
  }
  // base is now "" or "_U" / "_Up" / "_Down" / "_Neighbor" etc.
  let direction: RelDirection = "auto";
  const suffix = base.replace(/^_/, "").replace(/_Neighbor$/i, "");
  switch (suffix.toLowerCase()) {
    case "":
    case "neighbor":
      direction = "auto";
      break;
    case "u":
    case "up":
      direction = "up";
      break;
    case "d":
    case "down":
      direction = "down";
      break;
    case "l":
    case "left":
      direction = "left";
      break;
    case "r":
    case "right":
      direction = "right";
      break;
    case "back":
      direction = "back";
      break;
    default:
      return null;
  }
  return { bidirectional, direction };
}

/** Count the net change in unquoted parenthesis depth for a line. */
function parenDelta(s: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (const c of s) {
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") depth--;
  }
  return depth;
}

const isMeta = (line: string): boolean => line.trim().startsWith(META_PREFIX);
const isComment = (line: string): boolean => line.trim().startsWith("%%");

interface Statement {
  text: string;
  opensBoundary: boolean;
  closesBoundary: boolean;
}

/** Merge physical lines into logical statements, tracking `{`/`}` scope. */
function segment(lines: string[]): Statement[] {
  const statements: Statement[] = [];
  let buffer = "";
  let depth = 0;

  const flush = () => {
    let text = buffer.trim();
    buffer = "";
    if (text === "") return;
    // Leading close braces (possibly several) each pop a scope.
    while (text.startsWith("}")) {
      statements.push({ text: "", opensBoundary: false, closesBoundary: true });
      text = text.slice(1).trim();
      if (text === "") return;
    }
    let opens = false;
    if (text.endsWith("{")) {
      opens = true;
      text = text.slice(0, -1).trim();
    }
    let closesTrailing = false;
    if (text.endsWith("}")) {
      closesTrailing = true;
      text = text.slice(0, -1).trim();
    }
    if (text !== "") {
      statements.push({ text, opensBoundary: opens, closesBoundary: false });
    } else if (opens) {
      statements.push({ text: "", opensBoundary: true, closesBoundary: false });
    }
    if (closesTrailing) {
      statements.push({ text: "", opensBoundary: false, closesBoundary: true });
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (buffer === "" && trimmed === "") continue;
    buffer += (buffer ? " " : "") + trimmed;
    depth += parenDelta(trimmed);
    if (depth <= 0) {
      depth = 0;
      flush();
    }
  }
  flush();
  return statements;
}

function buildDiagram(
  statements: Statement[],
  meta: Meta,
  errors: string[]
): Diagram {
  const layers: Layer[] =
    meta.layers.length > 0
      ? meta.layers
      : [{ id: "layer-1", name: "Layer 1", visible: true, locked: false }];
  const layerIds = new Set(layers.map((l) => l.id));
  const defLayer = layers[0].id;
  const pickLayer = (id?: string) =>
    id && layerIds.has(id) ? id : defLayer;

  const diagram: Diagram = {
    type: "C4Context",
    elements: {},
    boundaries: {},
    rels: [],
    layers,
    passthrough: [],
  };

  const scope: string[] = [];
  let relIndex = 0;
  let relMetaCursor = 0;

  for (const st of statements) {
    if (st.closesBoundary) {
      scope.pop();
      continue;
    }
    const parentId = scope.length ? scope[scope.length - 1] : undefined;
    const text = st.text;

    if (text === "" && st.opensBoundary) continue;

    // Diagram type declaration (may be the bare word or `C4Context title...`).
    const firstWord = text.split(/\s+/)[0];
    if (DIAGRAM_TYPES.includes(firstWord as DiagramType)) {
      diagram.type = firstWord as DiagramType;
      const rest = text.slice(firstWord.length).trim();
      if (rest) diagram.title = rest;
      continue;
    }
    if (/^title\s+/i.test(text)) {
      diagram.title = text.replace(/^title\s+/i, "").trim();
      continue;
    }

    const call = /^([A-Za-z_]\w*)\s*\(([\s\S]*)\)\s*$/.exec(text);
    if (!call) {
      if (text) diagram.passthrough.push(text);
      continue;
    }
    const func = call[1];
    const args = parseArgs(call[2]);
    const pos = args.positional;

    if (func === "UpdateLayoutConfig") {
      diagram.layoutConfig = {
        shapeInRow: Number(pos[0]) || undefined,
        boundaryInRow: Number(pos[1]) || undefined,
      };
      continue;
    }

    const bspec = resolveBoundaryFunc(func);
    if (bspec) {
      const alias = pos[0];
      if (!alias) {
        errors.push(`Boundary missing alias: ${text}`);
        continue;
      }
      const bm = meta.boundaries[alias];
      const boundary: C4Boundary = {
        id: alias,
        alias,
        label: pos[1] ?? alias,
        boundaryType: bspec.boundaryType,
        typeLabel: bspec.boundaryType === "generic" ? pos[2] : undefined,
        parentId,
        layerId: pickLayer(bm?.layer),
        autoFit: bm ? bm.autofit : true,
        x: bm?.x,
        y: bm?.y,
        w: bm?.w,
        h: bm?.h,
        named: Object.keys(args.named).length ? args.named : undefined,
      };
      diagram.boundaries[alias] = boundary;
      if (st.opensBoundary) scope.push(alias);
      continue;
    }

    const espec = resolveElementFunc(func);
    if (espec) {
      const alias = pos[0];
      if (!alias) {
        errors.push(`Element missing alias: ${text}`);
        continue;
      }
      let techn: string | undefined;
      let descr: string | undefined;
      if (espec.hasTechn) {
        techn = pos[2];
        descr = pos[3];
      } else {
        descr = pos[2];
      }
      const size = defaultSize(espec.kind);
      const nm = meta.nodes[alias];
      const el: C4Element = {
        id: alias,
        alias,
        kind: espec.kind,
        external: espec.external,
        variant: espec.variant,
        label: pos[1] ?? alias,
        techn: techn || undefined,
        descr: descr || undefined,
        parentId,
        layerId: pickLayer(nm?.layer),
        x: nm?.x ?? Number.NaN,
        y: nm?.y ?? Number.NaN,
        w: nm?.w ?? size.w,
        h: nm?.h ?? size.h,
        named: Object.keys(args.named).length ? args.named : undefined,
      };
      diagram.elements[alias] = el;
      // Opening a boundary via an element func is invalid; ignore stray brace.
      continue;
    }

    const rspec = resolveRelFunc(func);
    if (rspec) {
      const from = pos[0];
      const to = pos[1];
      if (!from || !to) {
        errors.push(`Relationship missing endpoints: ${text}`);
        continue;
      }
      const rm = meta.rels[relMetaCursor];
      const useMeta = rm && rm.from === from && rm.to === to;
      if (useMeta) relMetaCursor++;
      const rel: C4Rel = {
        id: `rel-${relIndex++}`,
        from,
        to,
        label: pos[2] || undefined,
        techn: pos[3] || undefined,
        bidirectional: rspec.bidirectional,
        direction: rspec.direction,
        layerId: pickLayer(useMeta ? rm!.layer : undefined),
        named: Object.keys(args.named).length ? args.named : undefined,
      };
      diagram.rels.push(rel);
      continue;
    }

    // Unknown call (UpdateElementStyle, UpdateRelStyle, ...) — preserve it.
    diagram.passthrough.push(text);
  }

  autoLayout(diagram);
  return diagram;
}

/** Assign grid positions to any element that arrived without stored geometry. */
function autoLayout(diagram: Diagram): void {
  const COLS = 3;
  const CELL_W = 240;
  const CELL_H = 180;
  const GAP_X = 60;
  const GAP_Y = 70;

  const byParent = new Map<string, C4Element[]>();
  for (const el of Object.values(diagram.elements)) {
    const key = el.parentId ?? "__root__";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(el);
  }

  let cursorY = 60;
  for (const [, group] of byParent) {
    const needing = group.filter((e) => Number.isNaN(e.x) || Number.isNaN(e.y));
    if (needing.length === 0) {
      // Group already positioned; advance cursor past it.
      const maxY = Math.max(...group.map((e) => e.y + e.h));
      cursorY = Math.max(cursorY, maxY + GAP_Y);
      continue;
    }
    const startY = cursorY;
    needing.forEach((el, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      el.x = 80 + col * (CELL_W + GAP_X);
      el.y = startY + row * (CELL_H + GAP_Y);
    });
    const rows = Math.ceil(needing.length / COLS);
    cursorY = startY + rows * (CELL_H + GAP_Y) + 60;
  }
}

export function parseC4(text: string): ParseResult {
  const errors: string[] = [];
  const meta = emptyMeta();
  const contentLines: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    if (isMeta(line)) {
      parseMetaLine(line, meta);
      continue;
    }
    if (isComment(line)) continue; // ordinary Mermaid comment
    contentLines.push(line);
  }

  const statements = segment(contentLines);
  const diagram = buildDiagram(statements, meta, errors);
  return { diagram, errors };
}
