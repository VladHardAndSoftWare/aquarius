import type { C4Rel, Rect } from "../c4";
import { connect } from "../c4";
import { useStore } from "../store";

interface Props {
  rel: C4Rel;
  fromRect: Rect;
  toRect: Rect;
  selected: boolean;
  dimmed: boolean;
}

export function RelationshipView({ rel, fromRect, toRect, selected, dimmed }: Props) {
  const { a, b } = connect(fromRect, toRect);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const color = selected ? "#f2b705" : "#6b6b76";
  const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    useStore.getState().selectRel(rel.id);
  };

  return (
    <g opacity={dimmed ? 0.3 : 1} style={{ cursor: "pointer" }} onPointerDown={onClick}>
      <path d={d} stroke="transparent" strokeWidth={14} fill="none" />
      <path
        d={d}
        stroke={color}
        strokeWidth={selected ? 2.5 : 1.6}
        fill="none"
        markerEnd="url(#arrow-end)"
        markerStart={rel.bidirectional ? "url(#arrow-start)" : undefined}
      />
      {(rel.label || rel.techn) && (
        <foreignObject x={mid.x - 85} y={mid.y - 20} width={170} height={54} pointerEvents="none">
          <div className="rel-label">
            {rel.label && <div className="rel-text">{rel.label}</div>}
            {rel.techn && <div className="rel-techn">[{rel.techn}]</div>}
          </div>
        </foreignObject>
      )}
    </g>
  );
}
