/**
 * UT-themed game shell (PRD §6, §7). Renders the era timeline (always) and then
 * branches on the level's `kind`: an assembly machine (editor + inspector +
 * console), the ENIAC wiring puzzle, or the TACC finale. New eras of any kind
 * appear from the registry with no shell edits beyond this branch.
 */

import { useEffect, useState } from "react";
import { useGameStore } from "../state/gameStore";
import { getLevel, LEVELS } from "../content/levels";
import { challengeKey, isUnlocked } from "../engine/progression";
import { CodeEditor } from "../ui/CodeEditor";
import { RegisterInspector } from "../ui/RegisterInspector";
import { Console } from "../ui/Console";
import { LessonPanel } from "../ui/LessonPanel";
import { SpecCard } from "../ui/SpecCard";
import { IntroOverlay, hasSeenIntro } from "../ui/IntroOverlay";
import { EniacLevel } from "../ui/EniacLevel";
import { TaccFinale } from "../ui/TaccFinale";
import { MachineScene } from "../scene/MachineScene";

export function GameShell() {
  const [showIntro, setShowIntro] = useState(() => !hasSeenIntro());
  const levelId = useGameStore((s) => s.levelId);
  const selectLevel = useGameStore((s) => s.selectLevel);
  const challenges = useGameStore((s) => s.challenges);
  const challengeIndex = useGameStore((s) => s.challengeIndex);
  const completed = useGameStore((s) => s.save.completed);
  const selectChallenge = useGameStore((s) => s.selectChallenge);

  useEffect(() => {
    useGameStore.getState().init();
  }, []);

  const level = getLevel(levelId) ?? LEVELS[0];
  const kind = level.kind ?? "assembly";
  const ids = challenges.map((c) => c.id);

  return (
    <div className="shell">
      {showIntro && <IntroOverlay onStart={() => setShowIntro(false)} />}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">🤘</span>
          <div>
            <div className="brand-title">Hook 'Em, Boot 'Em</div>
            <div className="brand-sub">
              A journey through computer architecture · UT Austin ECE
            </div>
          </div>
        </div>

        <nav className="era-timeline" aria-label="Eras">
          {LEVELS.map((lvl, i) => (
            <span key={lvl.id} className="era-wrap">
              {i > 0 && <span className="era-arrow">→</span>}
              <button
                className={`era ${lvl.id === level.id ? "active" : ""}`}
                title={lvl.blurb}
                onClick={() => selectLevel(lvl.id)}
              >
                <span className="era-year">{lvl.year}</span>
                <span className="era-name">{lvl.title}</span>
              </button>
            </span>
          ))}
        </nav>

        {kind === "assembly" && (
          <nav className="challenge-dots">
            {challenges.map((c, i) => {
              const done = !!completed[challengeKey(level.id, c.id)];
              const unlocked = isUnlocked(completed, level.id, ids, i);
              const active = i === challengeIndex;
              const label = c.sandbox ? "∞" : done ? "✓" : i + 1;
              return (
                <button
                  key={c.id}
                  className={`dot ${active ? "active" : ""} ${done ? "done" : ""} ${unlocked ? "" : "locked"} ${c.sandbox ? "sandbox" : ""}`}
                  title={!unlocked ? "Complete the previous challenge first" : c.sandbox ? "Sandbox — free play" : c.title}
                  disabled={!unlocked}
                  onClick={() => selectChallenge(i)}
                >
                  {label}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {kind === "finale" ? (
        <TaccFinale year={level.year} title={level.title} />
      ) : kind === "puzzle" ? (
        <EniacLevel level={level} />
      ) : (
        <AssemblyView />
      )}
    </div>
  );
}

/** The assembly-machine experience: editor + 3D hardware + inspector + console. */
function AssemblyView() {
  const s = useGameStore();
  const level = getLevel(s.levelId) ?? LEVELS[0];
  const challenge = s.challenges[s.challengeIndex];

  if (!challenge || !s.machine) {
    return <div className="boot">Booting the time machine…</div>;
  }

  const descriptor = s.machine.descriptor;
  const isLast = s.challengeIndex === s.challenges.length - 1;
  const isSandbox = !!challenge.sandbox;
  const levelIdx = LEVELS.findIndex((l) => l.id === level.id);
  const nextLevel = levelIdx >= 0 ? LEVELS[levelIdx + 1] : undefined;

  return (
    <main className="layout">
      <section className="col col-lesson">
        <LessonPanel
          challenge={challenge}
          hintsRevealed={s.hintsRevealed}
          onRevealHint={s.revealHint}
          index={s.challengeIndex}
          total={s.challenges.length}
        />
      </section>

      <section className="col col-scene">
        <SpecCard title={level.title} year={level.year} specs={level.specs} />
        <MachineScene />
        <div className="scene-caption">
          Drag to orbit · click the orange knob to reset the machine
        </div>
      </section>

      <section className="col col-work">
        <div className="editor-wrap">
          <div className="editor-head">
            <span className="panel-title">Assembly · {descriptor.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={s.resetCodeToStarter}>
              Reset code
            </button>
          </div>
          <div className="editor-body">
            <CodeEditor value={s.code} onChange={s.setCode} />
          </div>
        </div>

        <div className="controls">
          <button className="btn btn-primary" onClick={s.run}>▶ Run</button>
          <button className="btn" onClick={s.step}>⏭ Step</button>
          <button className="btn" onClick={s.reset}>⟲ Reset</button>
          {!isSandbox && s.passed && !isLast && (
            <button className="btn btn-next" onClick={s.nextChallenge}>
              Next challenge →
            </button>
          )}
          {isSandbox && nextLevel && (
            <button className="btn btn-next" onClick={() => s.selectLevel(nextLevel.id)}>
              Travel to {nextLevel.year} · {nextLevel.title} →
            </button>
          )}
          {isSandbox && !nextLevel && (
            <span className="all-done">You've reached the present day. 🎉</span>
          )}
        </div>

        <RegisterInspector descriptor={descriptor} state={s.machineState} />

        <Console
          output={s.output}
          errors={s.errors}
          failures={s.failures}
          passed={s.passed}
          hasRun={s.hasRun}
          sandbox={isSandbox}
        />
      </section>
    </main>
  );
}
