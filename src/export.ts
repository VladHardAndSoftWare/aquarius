import { contentBounds, type Diagram } from "./c4";

function download(filename: string, data: Blob | string, type = "text/plain") {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadMermaid(code: string, name = "diagram.mmd") {
  download(name, code, "text/plain");
}

export async function copyMermaid(code: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(code);
    return true;
  } catch {
    return false;
  }
}

const PAD = 40;

/** Build a standalone SVG string from the live canvas in diagram coordinates. */
function buildSvgString(diagram: Diagram): string | null {
  const live = document.querySelector<SVGSVGElement>(".canvas-svg");
  const bounds = contentBounds(diagram);
  if (!live || !bounds) return null;

  const clone = live.cloneNode(true) as SVGSVGElement;
  clone.querySelector("[data-bg]")?.remove();
  const vp = clone.querySelector("#viewport");
  vp?.removeAttribute("transform");

  const x = bounds.x - PAD;
  const y = bounds.y - PAD;
  const w = bounds.w + PAD * 2;
  const h = bounds.h + PAD * 2;
  clone.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", String(x));
  bg.setAttribute("y", String(y));
  bg.setAttribute("width", String(w));
  bg.setAttribute("height", String(h));
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);

  return new XMLSerializer().serializeToString(clone);
}

export function exportSvg(diagram: Diagram, name = "diagram.svg") {
  const s = buildSvgString(diagram);
  if (!s) return;
  download(name, s, "image/svg+xml");
}

export function exportPng(diagram: Diagram, name = "diagram.png", scale = 2) {
  const s = buildSvgString(diagram);
  if (!s) return;
  const bounds = contentBounds(diagram);
  if (!bounds) return;
  const w = (bounds.w + PAD * 2) * scale;
  const h = (bounds.h + PAD * 2) * scale;
  const img = new Image();
  const svg64 = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (blob) download(name, blob, "image/png");
      }, "image/png");
    } catch {
      // Some browsers block canvas export of <foreignObject>; fall back to SVG.
      exportSvg(diagram, name.replace(/\.png$/, ".svg"));
    }
  };
  img.onerror = () => exportSvg(diagram, name.replace(/\.png$/, ".svg"));
  img.src = svg64;
}
