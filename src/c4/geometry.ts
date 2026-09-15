import type { C4Boundary, Diagram } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Point {
  x: number;
  y: number;
}

export const BOUNDARY_PAD = 24;
export const BOUNDARY_HEADER = 34;

export function center(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Rectangle for a boundary: manual geometry, or auto-fit around descendants. */
export function boundaryRect(diagram: Diagram, b: C4Boundary): Rect {
  if (!b.autoFit && b.x != null && b.y != null && b.w != null && b.h != null) {
    return { x: b.x, y: b.y, w: b.w, h: b.h };
  }
  const rects: Rect[] = [];
  for (const el of Object.values(diagram.elements)) {
    if (el.parentId === b.id) rects.push({ x: el.x, y: el.y, w: el.w, h: el.h });
  }
  for (const cb of Object.values(diagram.boundaries)) {
    if (cb.parentId === b.id) rects.push(boundaryRect(diagram, cb));
  }
  if (rects.length === 0) {
    return { x: b.x ?? 60, y: b.y ?? 60, w: b.w ?? 260, h: b.h ?? 160 };
  }
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  return {
    x: minX - BOUNDARY_PAD,
    y: minY - BOUNDARY_PAD - BOUNDARY_HEADER,
    w: maxX - minX + BOUNDARY_PAD * 2,
    h: maxY - minY + BOUNDARY_PAD * 2 + BOUNDARY_HEADER,
  };
}

/** Point where a ray from the rect center toward `towards` crosses the border. */
export function borderPoint(rect: Rect, towards: Point): Point {
  const c = center(rect);
  const dx = towards.x - c.x;
  const dy = towards.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const scaleX = dx !== 0 ? rect.w / 2 / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? rect.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(scaleX, scaleY);
  return { x: c.x + dx * s, y: c.y + dy * s };
}

/** Endpoints of an edge between two rects, clipped to their borders. */
export function connect(from: Rect, to: Rect): { a: Point; b: Point } {
  return {
    a: borderPoint(from, center(to)),
    b: borderPoint(to, center(from)),
  };
}

/** Bounding box over all elements and boundaries (for fit-to-screen). */
export function contentBounds(diagram: Diagram): Rect | null {
  const rects: Rect[] = [];
  for (const el of Object.values(diagram.elements)) {
    rects.push({ x: el.x, y: el.y, w: el.w, h: el.h });
  }
  for (const b of Object.values(diagram.boundaries)) {
    rects.push(boundaryRect(diagram, b));
  }
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
