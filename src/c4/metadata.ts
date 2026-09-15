import type { Layer } from "./types";

// Round-trip metadata is stored as Mermaid comments so the text stays 100%
// valid Mermaid. Every directive is a single `%% aquarius:<kind> k=v ...` line.

export const META_PREFIX = "%% aquarius:";

export interface NodeMeta {
  x: number;
  y: number;
  w?: number;
  h?: number;
  layer?: string;
}

export interface BoundaryMeta {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  autofit: boolean;
  layer?: string;
}

export interface RelMeta {
  from: string;
  to: string;
  layer?: string;
}

export interface Meta {
  layers: Layer[];
  nodes: Record<string, NodeMeta>;
  boundaries: Record<string, BoundaryMeta>;
  rels: RelMeta[];
}

export function emptyMeta(): Meta {
  return { layers: [], nodes: {}, boundaries: {}, rels: [] };
}

/** Parse `key=value key2="v 2"` into a flat record. */
function parseKV(rest: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z_]\w*)=("(?:[^"\\]|\\.)*"|[^\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest)) !== null) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) {
      v = v.slice(1, -1).replace(/\\"/g, '"');
    }
    out[m[1]] = v;
  }
  return out;
}

const num = (v: string | undefined): number | undefined => {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Parse a single metadata comment line into the accumulating Meta object. */
export function parseMetaLine(line: string, meta: Meta): void {
  const body = line.trim().slice(META_PREFIX.length).trim();
  const sp = body.indexOf(" ");
  const kind = sp === -1 ? body : body.slice(0, sp);
  const rest = sp === -1 ? "" : body.slice(sp + 1);
  const kv = parseKV(rest);

  switch (kind) {
    case "layer":
      meta.layers.push({
        id: kv.id ?? `l${meta.layers.length + 1}`,
        name: kv.name ?? `Layer ${meta.layers.length + 1}`,
        visible: kv.visible !== "0",
        locked: kv.locked === "1",
      });
      break;
    case "node":
      if (kv.alias) {
        meta.nodes[kv.alias] = {
          x: num(kv.x) ?? 0,
          y: num(kv.y) ?? 0,
          w: num(kv.w),
          h: num(kv.h),
          layer: kv.layer,
        };
      }
      break;
    case "boundary":
      if (kv.alias) {
        meta.boundaries[kv.alias] = {
          x: num(kv.x),
          y: num(kv.y),
          w: num(kv.w),
          h: num(kv.h),
          autofit: kv.autofit !== "0",
          layer: kv.layer,
        };
      }
      break;
    case "rel":
      if (kv.from && kv.to) {
        meta.rels.push({ from: kv.from, to: kv.to, layer: kv.layer });
      }
      break;
    default:
      break;
  }
}

const q = (v: string): string =>
  /\s|"/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v;

export function layerMetaLine(l: Layer): string {
  return `${META_PREFIX}layer id=${l.id} name=${q(l.name)} visible=${
    l.visible ? 1 : 0
  } locked=${l.locked ? 1 : 0}`;
}

export function nodeMetaLine(
  alias: string,
  x: number,
  y: number,
  w: number,
  h: number,
  layer: string
): string {
  return `${META_PREFIX}node alias=${alias} x=${Math.round(x)} y=${Math.round(
    y
  )} w=${Math.round(w)} h=${Math.round(h)} layer=${layer}`;
}

export function boundaryMetaLine(
  alias: string,
  autofit: boolean,
  layer: string,
  geom?: { x?: number; y?: number; w?: number; h?: number }
): string {
  let s = `${META_PREFIX}boundary alias=${alias} autofit=${autofit ? 1 : 0} layer=${layer}`;
  if (!autofit && geom) {
    s += ` x=${Math.round(geom.x ?? 0)} y=${Math.round(geom.y ?? 0)} w=${Math.round(
      geom.w ?? 0
    )} h=${Math.round(geom.h ?? 0)}`;
  }
  return s;
}

export function relMetaLine(from: string, to: string, layer: string): string {
  return `${META_PREFIX}rel from=${from} to=${to} layer=${layer}`;
}
