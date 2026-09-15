import type { C4Element, C4Rel, Diagram } from "./types";
import { boundaryFuncName, elementFuncName } from "./registry";
import {
  boundaryMetaLine,
  layerMetaLine,
  nodeMetaLine,
  relMetaLine,
} from "./metadata";

const INDENT = "    ";
const qs = (s: string): string => `"${s.replace(/"/g, '\\"')}"`;

function namedSuffix(named?: Record<string, string>): string {
  if (!named) return "";
  const parts = Object.entries(named).map(([k, v]) => `${k}=${qs(v)}`);
  return parts.length ? ", " + parts.join(", ") : "";
}

function emitElement(el: C4Element): string {
  const func = elementFuncName(el.kind, el.external, el.variant);
  const parts = [el.alias, qs(el.label)];
  const hasTechn = el.kind === "container" || el.kind === "component" || el.kind === "node";
  if (hasTechn) {
    if (el.techn || el.descr) parts.push(qs(el.techn ?? ""));
    if (el.descr) parts.push(qs(el.descr));
  } else if (el.descr) {
    parts.push(qs(el.descr));
  }
  return `${func}(${parts.join(", ")}${namedSuffix(el.named)})`;
}

function emitRelFunc(rel: C4Rel): string {
  if (rel.bidirectional) return "BiRel";
  switch (rel.direction) {
    case "up":
      return "Rel_Up";
    case "down":
      return "Rel_Down";
    case "left":
      return "Rel_Left";
    case "right":
      return "Rel_Right";
    case "back":
      return "Rel_Back";
    default:
      return "Rel";
  }
}

function emitRel(rel: C4Rel): string {
  const parts = [rel.from, rel.to];
  if (rel.label || rel.techn) parts.push(qs(rel.label ?? ""));
  if (rel.techn) parts.push(qs(rel.techn));
  return `${emitRelFunc(rel)}(${parts.join(", ")}${namedSuffix(rel.named)})`;
}

function emitScope(diagram: Diagram, parentId: string | undefined, indent: string, out: string[]): void {
  for (const b of Object.values(diagram.boundaries)) {
    if (b.parentId !== parentId) continue;
    const parts = [b.alias, qs(b.label)];
    if (b.boundaryType === "generic" && b.typeLabel) parts.push(qs(b.typeLabel));
    out.push(`${indent}${boundaryFuncName(b.boundaryType)}(${parts.join(", ")}${namedSuffix(b.named)}) {`);
    emitScope(diagram, b.id, indent + INDENT, out);
    out.push(`${indent}}`);
  }
  for (const el of Object.values(diagram.elements)) {
    if (el.parentId !== parentId) continue;
    out.push(`${indent}${emitElement(el)}`);
  }
}

/** Serialize a diagram to Mermaid C4 text plus an `%% aquarius:` metadata block. */
export function serializeC4(diagram: Diagram): string {
  const out: string[] = [];
  out.push(diagram.type);
  if (diagram.title) out.push(`${INDENT}title ${diagram.title}`);
  out.push("");

  emitScope(diagram, undefined, INDENT, out);

  if (diagram.rels.length) out.push("");
  for (const rel of diagram.rels) out.push(`${INDENT}${emitRel(rel)}`);

  if (diagram.layoutConfig) {
    const s = diagram.layoutConfig.shapeInRow ?? 4;
    const b = diagram.layoutConfig.boundaryInRow ?? 2;
    out.push(`${INDENT}UpdateLayoutConfig(${s}, ${b})`);
  }

  for (const line of diagram.passthrough) out.push(`${INDENT}${line}`);

  // Round-trip metadata (ignored by real Mermaid).
  out.push("");
  for (const layer of diagram.layers) out.push(layerMetaLine(layer));
  for (const el of Object.values(diagram.elements)) {
    out.push(nodeMetaLine(el.alias, el.x, el.y, el.w, el.h, el.layerId));
  }
  for (const b of Object.values(diagram.boundaries)) {
    out.push(
      boundaryMetaLine(b.alias, b.autoFit, b.layerId, {
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
      })
    );
  }
  for (const rel of diagram.rels) {
    out.push(relMetaLine(rel.from, rel.to, rel.layerId));
  }

  return out.join("\n") + "\n";
}
