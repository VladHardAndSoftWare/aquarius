import { useEffect } from "react";
import { Toolbar } from "./components/Toolbar";
import { CodePanel } from "./components/CodePanel";
import { Canvas } from "./components/Canvas";
import { LayersPanel } from "./components/LayersPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { useStore } from "./store";

function isEditingField(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

export default function App() {
  const loadSample = useStore((s) => s.loadSample);

  useEffect(() => {
    loadSample();
  }, [loadSample]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditingField()) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        useStore.getState().deleteSelection();
      } else if (e.key === "Escape") {
        useStore.getState().cancelTool();
        useStore.getState().clearSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <Toolbar />
      <div className="main">
        <aside className="sidebar left">
          <CodePanel />
        </aside>
        <main className="center">
          <Canvas />
        </main>
        <aside className="sidebar right">
          <PropertiesPanel />
          <LayersPanel />
        </aside>
      </div>
    </div>
  );
}
