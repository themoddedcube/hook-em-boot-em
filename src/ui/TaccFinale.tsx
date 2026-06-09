/**
 * The finale (PRD §5.2): a non-playable celebratory scene contrasting ENIAC
 * (1945) with TACC's modern supercomputers on UT's own campus — closing the arc
 * from a 30-ton vacuum-tube room to a top-tier supercomputer the player can walk
 * past. Reads the registry, so it needs no per-machine knowledge.
 */

import { LEVELS } from "../content/levels";
import { useGameStore } from "../state/gameStore";

const COMPARE: { label: string; eniac: string; tacc: string }[] = [
  { label: "Year", eniac: "1945", tacc: "2024 (Vista)" },
  { label: "Size", eniac: "a 30-ton room", tacc: "rows of cabinets in a data hall" },
  { label: "Speed", eniac: "~5,000 additions/sec", tacc: "quadrillions of operations/sec" },
  { label: "Memory", eniac: "twenty 10-digit numbers", tacc: "petabytes" },
  { label: "Power", eniac: "150 kilowatts", tacc: "megawatts" },
  { label: "Programmed by", eniac: "rewiring cables by hand", tacc: "code, compiled to instructions" },
];

export function TaccFinale({ year, title }: { year: number; title: string }) {
  const selectLevel = useGameStore((s) => s.selectLevel);
  const first = LEVELS[0];

  return (
    <main className="finale">
      <div className="finale-inner">
        <div className="finale-eyebrow">{year} · The present day · {title}</div>
        <h1 className="finale-title">You've arrived home. 🤘</h1>
        <p className="finale-lead">
          Your journey began with a 52-minute calculation on a tonne of glowing
          valves in Manchester, and a room in Pennsylvania you programmed by
          plugging in cables. It ends right here, at the <strong>Texas Advanced
          Computing Center</strong> on the University of Texas at Austin campus,
          home to some of the most powerful supercomputers on Earth. The bleeding
          edge of computing is, quite literally, in your backyard.
        </p>

        <div className="finale-compare">
          <div className="finale-col-head finale-eniac-head">ENIAC, 1945</div>
          <div className="finale-col-head finale-row-spacer" />
          <div className="finale-col-head finale-tacc-head">TACC, today</div>
          {COMPARE.map((c) => (
            <div className="finale-row" key={c.label}>
              <div className="finale-eniac">{c.eniac}</div>
              <div className="finale-metric">{c.label}</div>
              <div className="finale-tacc">{c.tacc}</div>
            </div>
          ))}
        </div>

        <p className="finale-outro">
          Every leap in between, from the stored program to the minicomputer to
          the microprocessor to the clean teaching ISA, you didn't just read
          about. You programmed it, in its own language, on its own machine.
          That's the history of computer architecture, and now it's yours.
        </p>

        <button className="btn btn-primary finale-replay" onClick={() => selectLevel(first.id)}>
          ↺ Travel back to {first.year} · {first.title}
        </button>
        <p className="finale-foot">
          Made by Chaithu Talasila · Hook 'em. · UT Austin ECE · EE 306 / EE 460N
        </p>
      </div>
    </main>
  );
}
