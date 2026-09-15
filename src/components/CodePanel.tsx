import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";

export function CodePanel() {
  const code = useStore((s) => s.code);
  const errors = useStore((s) => s.errors);
  const [buffer, setBuffer] = useState(code);
  const [dirty, setDirty] = useState(false);
  const focused = useRef(false);

  // Keep the editor in sync with model-driven code changes (canvas edits),
  // but never clobber what the user is actively typing.
  useEffect(() => {
    if (!focused.current) {
      setBuffer(code);
      setDirty(false);
    }
  }, [code]);

  const apply = () => {
    useStore.getState().applyCode(buffer);
    setDirty(false);
  };

  return (
    <div className="code-panel">
      <div className="panel-head">
        <span>Mermaid C4</span>
        <button className="apply-btn" disabled={!dirty} onClick={apply}>
          Apply ⌘↵
        </button>
      </div>
      <textarea
        className="code-area"
        spellCheck={false}
        value={buffer}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          if (dirty) apply();
        }}
        onChange={(e) => {
          setBuffer(e.target.value);
          setDirty(true);
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            apply();
          }
        }}
      />
      {errors.length > 0 && (
        <div className="code-errors">
          {errors.map((err, i) => (
            <div key={i}>⚠ {err}</div>
          ))}
        </div>
      )}
    </div>
  );
}
