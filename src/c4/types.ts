// Domain model for a Mermaid-compatible C4 diagram.
// The model is the single source of truth; Mermaid text is generated from it,
// and free-form geometry / layer data is round-tripped via `%%` comments.

export type DiagramType =
  | "C4Context"
  | "C4Container"
  | "C4Component"
  | "C4Dynamic"
  | "C4Deployment";

export const DIAGRAM_TYPES: DiagramType[] = [
  "C4Context",
  "C4Container",
  "C4Component",
  "C4Dynamic",
  "C4Deployment",
];

/** High-level C4 element category (drives shape + default colors). */
export type ElementKind =
  | "person"
  | "system"
  | "container"
  | "component"
  | "node"; // deployment node

/** Shape modifier for db/queue variants. */
export type ShapeVariant = "default" | "db" | "queue";

/** A concrete C4 element (Person, System, Container, Component, Node). */
export interface C4Element {
  id: string; // internal id, equal to the Mermaid alias
  alias: string; // Mermaid alias (unique identifier used by relationships)
  kind: ElementKind;
  external: boolean;
  variant: ShapeVariant;
  label: string;
  techn?: string;
  descr?: string;
  parentId?: string; // enclosing boundary id, if any
  layerId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Preserved named args ($tags, $link, $sprite, ...) so nothing is lost. */
  named?: Record<string, string>;
}

/** A boundary grouping (Enterprise/System/Container or generic). */
export interface C4Boundary {
  id: string;
  alias: string;
  label: string;
  boundaryType: "enterprise" | "system" | "container" | "generic";
  typeLabel?: string; // explicit type text for generic Boundary(a, b, "type")
  parentId?: string;
  layerId: string;
  /** When true, the rectangle is auto-fitted around its children. */
  autoFit: boolean;
  /** Manual geometry (used when autoFit is false). */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  named?: Record<string, string>;
}

export type RelDirection = "auto" | "up" | "down" | "left" | "right" | "back";

/** A relationship between two elements. */
export interface C4Rel {
  id: string;
  from: string;
  to: string;
  label?: string;
  techn?: string;
  bidirectional: boolean;
  direction: RelDirection;
  layerId: string;
  named?: Record<string, string>;
}

/** A drawing layer: controls visibility, locking and z-order. */
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface Diagram {
  type: DiagramType;
  title?: string;
  /** Layout config carried through from Mermaid `UpdateLayoutConfig`. */
  layoutConfig?: { shapeInRow?: number; boundaryInRow?: number };
  elements: Record<string, C4Element>;
  boundaries: Record<string, C4Boundary>;
  rels: C4Rel[];
  /** Ordered from bottom (index 0) to top of the z-stack. */
  layers: Layer[];
  /** Statements we don't model (styling, etc.) preserved verbatim for round-trip. */
  passthrough: string[];
}

export type C4Node = C4Element | C4Boundary;

export function isBoundary(n: C4Node): n is C4Boundary {
  return (n as C4Boundary).boundaryType !== undefined;
}
