# Aquarius

A C4 diagram editor that speaks Mermaid. Drag boxes where you want them, keep the
source as valid Mermaid C4 text.

Mermaid renders C4 diagrams with an automatic layout you cannot steer — elements
land where the layout engine puts them. Aquarius gives you free X/Y placement,
resizing and layers on a canvas, then writes the result back as ordinary Mermaid.
Positions travel inside `%%` comments, so the same file still renders anywhere
Mermaid is supported: GitHub, GitLab, Notion, Obsidian, mermaid.live.

## Quick start

```bash
npm install
npm run dev
```

The dev server starts on <http://localhost:5173> and opens a browser. A sample
Internet Banking context diagram is loaded so there is something to click on.

Requires Node 18+.

## How it works

The diagram model is the single source of truth. The Mermaid text on the left is
generated from it on every edit, and parsing that text rebuilds the model. Layout
data that Mermaid has no syntax for — coordinates, sizes, layers — is round-tripped
through comment directives appended below the diagram:

```
%% aquarius:layer id=systems name="Systems" visible=1 locked=0
%% aquarius:node alias=bankingSystem x=520 y=120 w=215 h=130 layer=systems
%% aquarius:boundary alias=b0 autofit=1 layer=systems
%% aquarius:rel from=customerA to=bankingSystem layer=actors
```

| Directive | Keys |
| --- | --- |
| `layer` | `id`, `name`, `visible` (`0`/`1`), `locked` (`0`/`1`) — order in the file is the z-order, bottom first |
| `node` | `alias`, `x`, `y`, `w`, `h`, `layer` |
| `boundary` | `alias`, `autofit` (`0`/`1`), `layer`, plus `x`/`y`/`w`/`h` when `autofit=0` |
| `rel` | `from`, `to`, `layer` |

Mermaid ignores `%%` lines, so nothing here breaks rendering elsewhere.

Paste a diagram that has no `aquarius:` directives and the editor keeps the
geometry it already had for every alias that still matches, so you can paste
hand-written Mermaid over a laid-out diagram without losing the layout. Elements
that are genuinely new get default sizes and are placed at the origin.

## Supported Mermaid C4 syntax

- **Diagram types** — `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`
- **Elements** — `Person`, `System`, `Container`, `Component`, `Node` (also `Node_L`, `Node_R`, `Deployment_Node`), with the `Db` and `Queue` shape variants and the `_Ext` external suffix, in any combination: `SystemDb_Ext`, `ContainerQueue`, …
- **Boundaries** — `Enterprise_Boundary`, `System_Boundary`, `Container_Boundary` and generic `Boundary`, including `{ … }` nesting
- **Relationships** — `Rel` and `BiRel` with the direction suffixes `_U`/`_Up`, `_D`/`_Down`, `_L`/`_Left`, `_R`/`_Right`, `_Back`, `_Neighbor`
- **Other** — `title`, `UpdateLayoutConfig`, and named arguments (`$tags`, `$link`, `$sprite`, …) which are preserved verbatim

Statements the editor does not model — styling calls such as `UpdateElementStyle`,
for example — are carried through to the output untouched rather than dropped.
Parse problems appear under the code editor and never discard your text.

## Using the editor

**Canvas**

| Action | Control |
| --- | --- |
| Pan | Drag empty canvas, or middle-drag anywhere |
| Zoom | Mouse wheel (zooms at the cursor, 0.15×–4×) |
| Move | Drag an element; dragging a boundary moves everything inside it |
| Resize | Drag the handle on a selected element's bottom-right corner |
| Multi-select | Shift-click |
| Delete selection | <kbd>Delete</kbd> / <kbd>Backspace</kbd> |
| Cancel / deselect | <kbd>Esc</kbd> |

Resizing a boundary switches it from auto-fit to manual geometry. Auto-fit
boundaries track the bounding box of their children instead.

**Toolbar** — diagram type and title, an element builder (kind + `db`/`queue`
variant + external flag), `+ Boundary`, and `+ Relationship`, which then asks you
to click a source and a target element. `Fit` frames the whole diagram, `1:1`
resets the view, `Sample` reloads the demo.

**Code panel** — edit the Mermaid text directly and apply with
<kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Enter</kbd>, or just click away from the
editor. Canvas edits refresh the text live, except while you are typing in it.

**Layers panel** — create, rename, reorder, show/hide and lock layers, and move
the current selection onto the active layer. Elements on a locked layer cannot be
dragged; hidden layers disappear from the canvas and from exports. Deleting a
layer moves its contents to the bottom layer rather than deleting them.

## Export

`Copy` puts the Mermaid source on the clipboard, `.mmd` downloads it, and `SVG`
and `PNG` (2× scale) render the current canvas with a 40px margin and a white
background. Hidden layers stay hidden in the export. If a browser refuses to
rasterize the canvas — some block `<foreignObject>` in PNG export — Aquarius falls
back to writing an SVG.

## Project layout

```
src/
  c4/              Mermaid C4 <-> model layer, framework-independent
    parser.ts      text -> Diagram (plus aquarius: metadata)
    serializer.ts  Diagram -> text
    registry.ts    function-name <-> kind/variant mapping, palette, default sizes
    metadata.ts    the %% aquarius: comment format
    geometry.ts    bounds, boundary auto-fit, edge routing
    args.ts        C4 call-argument parsing
  components/      Toolbar, Canvas, CodePanel, LayersPanel, PropertiesPanel, node/rel views
  store.ts         zustand store: the model, selection, view, and every command
  export.ts        .mmd / SVG / PNG output
```

Built with React 18, TypeScript and Vite; state lives in a single zustand store.
The canvas is hand-written SVG — no diagramming library.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |

## Deployment

Live at <https://vladhardandsoftware.github.io/aquarius/>.

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml),
which type-checks, builds, and publishes `dist/` to GitHub Pages. No `gh-pages`
branch is involved — the build artifact is uploaded and served directly.

The production build sets the base path to `/aquarius/` so asset URLs resolve
under the project-site subpath. Change `base` in [vite.config.ts](vite.config.ts)
if you deploy somewhere else.

## Current limits

- No undo/redo yet.
- Nothing is persisted: a reload starts from the sample diagram. Export or copy
  your work, and paste it back into the code panel to continue.
- No file picker — import happens through the code panel.

## License

MIT — see [LICENSE](LICENSE).
