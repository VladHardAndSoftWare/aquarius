import type { ElementKind, ShapeVariant } from "./types";

/** Result of resolving a Mermaid C4 function name. */
export interface ElementSpec {
  kind: ElementKind;
  external: boolean;
  variant: ShapeVariant;
  /** Number of positional args before the optional trailing description. */
  hasTechn: boolean; // container/component/node carry a technology arg
}

/**
 * Maps a Mermaid C4 element function name (e.g. `SystemDb_Ext`) to its
 * semantic kind / variant / external flag. Returns null for non-element funcs.
 */
export function resolveElementFunc(name: string): ElementSpec | null {
  let base = name;
  let external = false;
  if (base.endsWith("_Ext")) {
    external = true;
    base = base.slice(0, -4);
  }

  let variant: ShapeVariant = "default";
  if (base.endsWith("Db")) {
    variant = "db";
    base = base.slice(0, -2);
  } else if (base.endsWith("Queue")) {
    variant = "queue";
    base = base.slice(0, -5);
  }

  switch (base) {
    case "Person":
      return { kind: "person", external, variant, hasTechn: false };
    case "System":
      return { kind: "system", external, variant, hasTechn: false };
    case "Container":
      return { kind: "container", external, variant, hasTechn: true };
    case "Component":
      return { kind: "component", external, variant, hasTechn: true };
    // Deployment nodes
    case "Node":
    case "Node_L":
    case "Node_R":
    case "Deployment_Node":
      return { kind: "node", external, variant, hasTechn: false };
    default:
      return null;
  }
}

export interface BoundarySpec {
  boundaryType: "enterprise" | "system" | "container" | "generic";
}

export function resolveBoundaryFunc(name: string): BoundarySpec | null {
  switch (name) {
    case "Enterprise_Boundary":
      return { boundaryType: "enterprise" };
    case "System_Boundary":
    case "SystemBoundary":
      return { boundaryType: "system" };
    case "Container_Boundary":
    case "ContainerBoundary":
      return { boundaryType: "container" };
    case "Boundary":
      return { boundaryType: "generic" };
    default:
      return null;
  }
}

/** Serialize an element back to its Mermaid function name. */
export function elementFuncName(
  kind: ElementKind,
  external: boolean,
  variant: ShapeVariant
): string {
  const base =
    kind === "person"
      ? "Person"
      : kind === "system"
        ? "System"
        : kind === "container"
          ? "Container"
          : kind === "component"
            ? "Component"
            : "Node";
  const variantSuffix = variant === "db" ? "Db" : variant === "queue" ? "Queue" : "";
  const extSuffix = external ? "_Ext" : "";
  // Node has no Db/Queue variants in Mermaid; keep it plain.
  if (kind === "node") return "Node";
  return `${base}${variantSuffix}${extSuffix}`;
}

export function boundaryFuncName(
  boundaryType: "enterprise" | "system" | "container" | "generic"
): string {
  switch (boundaryType) {
    case "enterprise":
      return "Enterprise_Boundary";
    case "system":
      return "System_Boundary";
    case "container":
      return "Container_Boundary";
    default:
      return "Boundary";
  }
}

/** Default palette matching Mermaid's C4 renderer. */
export interface Palette {
  bg: string;
  border: string;
  text: string;
  subtext: string;
}

const PALETTES: Record<string, Palette> = {
  "person:false": { bg: "#08427b", border: "#073b6f", text: "#ffffff", subtext: "#cfe0f3" },
  "person:true": { bg: "#686868", border: "#8a8a8a", text: "#ffffff", subtext: "#e6e6e6" },
  "system:false": { bg: "#1168bd", border: "#3c7fc0", text: "#ffffff", subtext: "#cfe0f3" },
  "system:true": { bg: "#999999", border: "#8a8a8a", text: "#ffffff", subtext: "#f0f0f0" },
  "container:false": { bg: "#438dd5", border: "#3c7fc0", text: "#ffffff", subtext: "#e6f0fb" },
  "container:true": { bg: "#b3b3b3", border: "#a6a6a6", text: "#ffffff", subtext: "#f5f5f5" },
  "component:false": { bg: "#85bbf0", border: "#78a8d8", text: "#1b2a3a", subtext: "#33465c" },
  "component:true": { bg: "#cccccc", border: "#bfbfbf", text: "#1b2a3a", subtext: "#33465c" },
  "node:false": { bg: "#ffffff", border: "#8a8a8a", text: "#1b2a3a", subtext: "#5a6b7b" },
  "node:true": { bg: "#f2f2f2", border: "#8a8a8a", text: "#1b2a3a", subtext: "#5a6b7b" },
};

export function paletteFor(kind: ElementKind, external: boolean): Palette {
  return PALETTES[`${kind}:${external}`] ?? PALETTES["system:false"];
}

/** Default element size per kind (used when no stored geometry exists). */
export function defaultSize(kind: ElementKind): { w: number; h: number } {
  switch (kind) {
    case "person":
      return { w: 200, h: 130 };
    case "node":
      return { w: 220, h: 150 };
    default:
      return { w: 215, h: 120 };
  }
}
