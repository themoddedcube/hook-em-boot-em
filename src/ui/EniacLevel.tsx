/**
 * The ENIAC level — a non-assembly "puzzle" experience. Reuses the shell's
 * three-column layout (lesson · diorama · work) but the work area is the patch
 * panel instead of a code editor. Manages its own puzzle progression and writes
 * completion through the store's generic markComplete/save.
 */

import { useEffect, useMemo, useState } from "react";
import { Level } from "../engine/level";
import { useGameStore } from "../state/gameStore";
import { LEVELS } from "../content/levels";
import { loadPuzzles } from "../content/puzzleLoader";
import { challengeKey, isUnlocked } from "../engine/progression";
import { LessonPanel } from "./LessonPanel";
import { PlugboardPuzzle } from "./PlugboardPuzzle";
import { SpecCard } from "./SpecCard";
import { MachineScene } from "../scene/MachineScene";

export function EniacLevel({ level }: { level: Level }) {
  const save = useGameStore((s) => s.save);
  const markComplete = useGameStore((s) => s.markComplete);
  const selectLevel = useGameStore((s) => s.selectLevel);

  const puzzles = useMemo(() => loadPuzzles(level.puzzleDir ?? level.id), [level]);
  const ids = puzzles.map((p) => p.id);
  const [index, setIndex] = useState(0);
  const [hintsRevealed, setHints] = useState(0);
  const [solved, setSolved] = useState(false);

  const puzzle = puzzles[index];

  useEffect(() => {
    setHints(0);
    setSolved(false);
  }, [index]);

  useEffect(() => {
    if (solved && puzzle && !puzzle.sandbox) markComplete(level.id, puzzle.id);
  }, [solved, puzzle, level.id, markComplete]);

  if (!puzzle) return <div className="boot">Loading the patch panel…</div>;

  const levelIdx = LEVELS.findIndex((l) => l.id === level.id);
  const nextLevel = levelIdx >= 0 ? LEVELS[levelIdx + 1] : undefined;
  const isSandbox = !!puzzle.sandbox;
  const isLast = index === puzzles.length - 1;
  const done = !!save.completed[challengeKey(level.id, puzzle.id)];

  return (
    <main className="layout">
      <section className="col col-lesson">
        <LessonPanel
          challenge={puzzle}
          hintsRevealed={hintsRevealed}
          onRevealHint={() => setHints((h) => Math.min(h + 1, puzzle.hints.length))}
          index={index}
          total={puzzles.length}
        />
      </section>

      <section className="col col-scene">
        <SpecCard title={level.title} year={level.year} specs={level.specs} />
        <MachineScene />
        <div className="scene-caption">ENIAC · 30 tons · 18,000 vacuum tubes · 1945</div>
      </section>

      <section className="col col-work col-eniac">
        <nav className="challenge-dots dots-inline">
          {puzzles.map((p, i) => {
            const d = !!save.completed[challengeKey(level.id, p.id)];
            const unlocked = isUnlocked(save.completed, level.id, ids, i);
            return (
              <button
                key={p.id}
                className={`dot ${i === index ? "active" : ""} ${d ? "done" : ""} ${unlocked ? "" : "locked"} ${p.sandbox ? "sandbox" : ""}`}
                disabled={!unlocked}
                title={unlocked ? p.title : "Solve the previous puzzle first"}
                onClick={() => setIndex(i)}
              >
                {p.sandbox ? "∞" : d ? "✓" : i + 1}
              </button>
            );
          })}
        </nav>

        <div className="pb-head">
          <span className="panel-title">Patch Panel · ENIAC</span>
        </div>

        <PlugboardPuzzle
          puzzle={puzzle}
          onChange={(_out, slv) => setSolved(slv)}
        />

        <div className="controls">
          {!isSandbox && (solved || done) && (
            <span className="result result-pass pb-result">✓ Wired correctly! 🤘</span>
          )}
          {isSandbox && (
            <span className="result result-sandbox pb-result">
              🧪 Sandbox: wire it up however you like, no target.
            </span>
          )}
          {!isSandbox && (solved || done) && !isLast && (
            <button className="btn btn-next" onClick={() => setIndex((i) => i + 1)}>
              Next puzzle →
            </button>
          )}
          {isSandbox && nextLevel && (
            <button className="btn btn-next" onClick={() => selectLevel(nextLevel.id)}>
              Travel to {nextLevel.year} · {nextLevel.title} →
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
