/**
 * The ENIAC patch-cable puzzle UI. Two ways to wire, just like a real plugboard:
 *  - DRAG: press an output jack, drag to an input jack, and release.
 *  - CLICK: click an output jack, then click an input jack.
 * Click a cable to remove it. Sources feed accumulators (which add) which feed
 * the OUTPUT. Reports the live output + solved state to the parent.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cable,
  evaluatePlugboard,
  OUTPUT_PORT,
  PuzzleChallenge,
} from "../engine/puzzle";

interface Pt { x: number; y: number; }

const W = 460;
const H = 360;
const SRC_X = 78;
const ACC_X = 250;
const OUT_X = 410;

function spread(n: number, top = 50, bottom = H - 50): number[] {
  if (n <= 0) return [];
  if (n === 1) return [(top + bottom) / 2];
  const step = (bottom - top) / (n - 1);
  return Array.from({ length: n }, (_, i) => top + i * step);
}

export function PlugboardPuzzle({
  puzzle,
  onChange,
}: {
  puzzle: PuzzleChallenge;
  onChange: (output: number, solved: boolean) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cables, setCables] = useState<Cable[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  /** Active drag from an output jack: the source port + the live cursor point. */
  const [drag, setDrag] = useState<{ from: string; x: number; y: number } | null>(null);

  // Reset wiring whenever the puzzle changes.
  useEffect(() => {
    setCables([]);
    setPending(null);
    setDrag(null);
  }, [puzzle.id]);

  // While dragging, a release anywhere ends the drag (a release on an input
  // jack connects first, via that jack's own handler, then this clears it).
  useEffect(() => {
    if (!drag) return;
    const end = () => setDrag(null);
    window.addEventListener("pointerup", end);
    return () => window.removeEventListener("pointerup", end);
  }, [drag]);

  // Port coordinates.
  const ports = useMemo(() => {
    const map = new Map<string, Pt>();
    const sy = spread(puzzle.sources.length);
    puzzle.sources.forEach((s, i) => map.set(s.id, { x: SRC_X + 52, y: sy[i] }));
    const ay = spread(puzzle.accumulators.length, 90, H - 90);
    puzzle.accumulators.forEach((a, i) => {
      map.set(`${a.id}:in0`, { x: ACC_X - 42, y: ay[i] - 16 });
      map.set(`${a.id}:in1`, { x: ACC_X - 42, y: ay[i] + 16 });
      map.set(a.id, { x: ACC_X + 42, y: ay[i] });
    });
    map.set(OUTPUT_PORT, { x: OUT_X - 16, y: H / 2 });
    return map;
  }, [puzzle]);

  const accY = useMemo(() => spread(puzzle.accumulators.length, 90, H - 90), [puzzle]);
  const srcY = useMemo(() => spread(puzzle.sources.length), [puzzle]);

  const result = useMemo(() => evaluatePlugboard(puzzle, cables), [puzzle, cables]);
  const solved = !puzzle.sandbox && result.output === puzzle.target;

  useEffect(() => {
    onChange(result.output, solved);
  }, [result.output, solved, onChange]);

  const addCable = (from: string, to: string) => {
    if (from === to) return;
    const max = to === OUTPUT_PORT ? Infinity : 1; // an accumulator input holds one cable
    setCables((prev) => {
      let next = max === Infinity ? prev.slice() : prev.filter((c) => c.to !== to);
      next = next.filter((c) => !(c.from === from && c.to === to)); // dedupe
      return [...next, { from, to }];
    });
  };

  const clickJack = (id: string, isInput: boolean) => {
    if (!isInput) {
      setPending(id); // output jack: start a click-cable here
      return;
    }
    if (pending) {
      addCable(pending, id);
      setPending(null);
    }
  };

  // Convert a pointer event to SVG (viewBox) coordinates.
  const toSvg = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
    };
  };

  const removeCable = (idx: number) =>
    setCables((prev) => prev.filter((_, i) => i !== idx));

  const jack = (id: string, isInput: boolean) => {
    const p = ports.get(id)!;
    const active = pending === id || drag?.from === id;
    const connected = cables.some((c) => c.from === id || c.to === id);
    const dragging = drag !== null;
    return (
      <circle
        key={id}
        cx={p.x}
        cy={p.y}
        r={dragging && isInput ? 9 : 7}
        className={`pb-jack ${isInput ? "pb-in" : "pb-out"} ${active ? "pb-active" : ""} ${connected ? "pb-connected" : ""} ${dragging && isInput ? "pb-target-jack" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          clickJack(id, isInput);
        }}
        onPointerDown={(e) => {
          if (isInput) return;
          e.stopPropagation();
          e.preventDefault();
          setPending(null);
          setDrag({ from: id, x: p.x, y: p.y });
        }}
        onPointerUp={(e) => {
          if (!isInput || !drag) return;
          e.stopPropagation();
          addCable(drag.from, id);
          setDrag(null);
        }}
      />
    );
  };

  return (
    <div className="plugboard">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="pb-svg"
        onClick={() => setPending(null)}
        onPointerMove={(e) => {
          if (!drag) return;
          const pt = toSvg(e);
          setDrag((d) => (d ? { ...d, x: pt.x, y: pt.y } : d));
        }}
      >
        {/* committed cables */}
        {cables.map((c, i) => {
          const a = ports.get(c.from);
          const b = ports.get(c.to);
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2;
          const d = `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
          return (
            <g key={i} className="pb-cable" onClick={(e) => { e.stopPropagation(); removeCable(i); }}>
              <path d={d} className="pb-cable-hit" />
              <path d={d} className="pb-cable-line" />
            </g>
          );
        })}

        {/* live drag preview */}
        {drag && (() => {
          const a = ports.get(drag.from);
          if (!a) return null;
          const mx = (a.x + drag.x) / 2;
          const d = `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${drag.y}, ${drag.x} ${drag.y}`;
          return <path d={d} className="pb-cable-line pb-cable-drag" />;
        })()}

        {/* sources */}
        {puzzle.sources.map((s, i) => (
          <g key={s.id}>
            <rect x={SRC_X - 44} y={srcY[i] - 18} width={88} height={36} rx={6} className="pb-unit pb-src" />
            <text x={SRC_X} y={srcY[i] - 3} className="pb-unit-label">{s.label}</text>
            <text x={SRC_X} y={srcY[i] + 12} className="pb-unit-val">{s.value}</text>
            {jack(s.id, false)}
          </g>
        ))}

        {/* accumulators */}
        {puzzle.accumulators.map((a, i) => (
          <g key={a.id}>
            <rect x={ACC_X - 36} y={accY[i] - 30} width={72} height={60} rx={6} className="pb-unit pb-acc" />
            <text x={ACC_X} y={accY[i] - 8} className="pb-unit-label">{a.label}</text>
            <text x={ACC_X} y={accY[i] + 14} className="pb-unit-val pb-acc-val">{result.accumulators[a.id] ?? 0}</text>
            {jack(`${a.id}:in0`, true)}
            {jack(`${a.id}:in1`, true)}
            {jack(a.id, false)}
          </g>
        ))}

        {/* output */}
        <g>
          <rect x={OUT_X - 8} y={H / 2 - 28} width={56} height={56} rx={6}
            className={`pb-unit pb-output ${solved ? "pb-solved" : ""}`} />
          <text x={OUT_X + 20} y={H / 2 - 8} className="pb-unit-label">OUT</text>
          <text x={OUT_X + 20} y={H / 2 + 16} className="pb-unit-val pb-out-val">{result.output}</text>
          {jack(OUTPUT_PORT, true)}
        </g>
      </svg>

      <div className="pb-status">
        {drag ? (
          <span className="pb-hint">Release on an input jack (◀) to connect.</span>
        ) : pending ? (
          <span className="pb-hint">Now click an input jack (◀) to connect, or click empty space to cancel.</span>
        ) : (
          <span className="pb-hint">Drag from an output jack (▶) to an input jack, or click one then the other. Click a cable to remove it.</span>
        )}
        {!puzzle.sandbox && (
          <span className="pb-target">
            Output: <strong>{result.output}</strong> &nbsp;·&nbsp; Target: <strong>{puzzle.target}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
