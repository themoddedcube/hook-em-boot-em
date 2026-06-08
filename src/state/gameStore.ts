/**
 * Central game state (Zustand).
 *
 * Owns the live `Machine` instance for the current challenge and bridges its
 * imperative step/run/reset model into React-friendly reactive state. The store
 * is machine-agnostic — it only ever speaks the `Machine` interface, so every
 * future era works through it unchanged.
 */

import { create } from "zustand";
import { Challenge } from "../engine/challenge";
import { evaluateCheck } from "../engine/challengeRunner";
import { Level } from "../engine/level";
import {
  AsmError,
  DisplayUpdate,
  Machine,
  MachineState,
} from "../engine/machineInterface";
import {
  challengeKey,
  isUnlocked,
  loadSave,
  SaveData,
  writeSave,
} from "../engine/progression";
import { loadChallenges } from "../content/challengeLoader";
import { getLevel, LEVELS } from "../content/levels";

interface GameState {
  // --- selection ---
  levelId: string;
  challengeIndex: number;
  challenges: Challenge[];

  // --- live machine + its derived, reactive state ---
  machine: Machine | null;
  unsubscribers: (() => void)[];
  code: string;
  machineState: MachineState | null;
  display: DisplayUpdate | null;
  output: string;
  errors: AsmError[];
  passed: boolean;
  failures: string[];
  hasRun: boolean;
  /** True once the current code has been assembled+loaded for stepping. */
  loaded: boolean;
  /** Code changed since last load — next step/run must re-assemble. */
  dirty: boolean;

  // --- progression ---
  save: SaveData;
  hintsRevealed: number;

  // --- actions ---
  init: () => void;
  selectLevel: (levelId: string) => void;
  selectChallenge: (index: number) => void;
  setCode: (code: string) => void;
  run: () => void;
  step: () => void;
  reset: () => void;
  revealHint: () => void;
  resetCodeToStarter: () => void;
  nextChallenge: () => void;
  /** Mark a challenge/puzzle complete + persist (used by non-assembly levels). */
  markComplete: (levelId: string, challengeId: string) => void;
}

const currentLevel = (s: { levelId: string }): Level =>
  getLevel(s.levelId) ?? LEVELS[0];

const isAssembly = (level: Level): boolean =>
  (level.kind ?? "assembly") === "assembly";

export const useGameStore = create<GameState>((set, get) => {
  /** Tear down the previous machine's subscriptions. */
  const teardown = () => {
    for (const u of get().unsubscribers) u();
  };

  /** Build a fresh machine for a challenge index and wire its callbacks. */
  const mountChallenge = (level: Level, index: number) => {
    teardown();
    const challenges = get().challenges.length
      ? get().challenges
      : loadChallenges(level.challengeDir!);
    const challenge = challenges[index];
    const machine = level.machineFactory!();

    const unsub: (() => void)[] = [];
    unsub.push(
      machine.onDisplayUpdate((update) => set({ display: update }))
    );
    unsub.push(
      machine.onOutput((text) =>
        set((s) => ({ output: s.output + text }))
      )
    );

    const save = get().save;
    const key = challengeKey(level.id, challenge.id);
    const code = save.code[key] ?? challenge.starterCode;

    set({
      levelId: level.id,
      challengeIndex: index,
      challenges,
      machine,
      unsubscribers: unsub,
      code,
      machineState: machine.getState(),
      output: "",
      errors: [],
      passed: false,
      failures: [],
      hasRun: false,
      loaded: false,
      dirty: true,
      hintsRevealed: 0,
    });

    // Persist "last visited" for resume.
    const next: SaveData = {
      ...save,
      last: { levelId: level.id, challengeId: challenge.id },
    };
    set({ save: next });
    writeSave(next);
  };

  /** Switch to a non-assembly level (puzzle / finale): no machine, no code. */
  const mountNonAssembly = (level: Level) => {
    teardown();
    set({
      levelId: level.id,
      challengeIndex: 0,
      challenges: [],
      machine: null,
      unsubscribers: [],
      machineState: null,
      display: null,
      output: "",
      errors: [],
      passed: false,
      failures: [],
      hasRun: false,
      hintsRevealed: 0,
    });
    const next: SaveData = {
      ...get().save,
      last: { levelId: level.id, challengeId: "" },
    };
    set({ save: next });
    writeSave(next);
  };

  /** Assemble current code and load it into the machine for execution. */
  const assembleAndLoad = (): boolean => {
    const { machine, code } = get();
    if (!machine) return false;
    const asm = machine.assemble(code);
    const hasErrors = asm.errors.some((e) => e.severity !== "warning");
    set({ errors: asm.errors });
    if (hasErrors) {
      set({ loaded: false, dirty: true });
      return false;
    }
    machine.load(asm.bytes, asm.origin);
    set({
      loaded: true,
      dirty: false,
      machineState: machine.getState(),
      output: "",
    });
    return true;
  };

  const evaluateAndPersist = () => {
    const { machine, challenges, challengeIndex, output, save, levelId } = get();
    if (!machine) return;
    const challenge = challenges[challengeIndex];
    const state = machine.getState();

    // Sandbox: no objective — just surface the resulting state, never pass/fail.
    if (challenge.sandbox) {
      set({ machineState: state, failures: [], passed: false, hasRun: true });
      return;
    }

    const failures = evaluateCheck(challenge.success, state, output);
    const passed = failures.length === 0;
    set({ machineState: state, failures, passed, hasRun: true });

    if (passed) {
      const key = challengeKey(levelId, challenge.id);
      if (!save.completed[key]) {
        const next: SaveData = {
          ...save,
          completed: { ...save.completed, [key]: true },
        };
        set({ save: next });
        writeSave(next);
      }
    }
  };

  return {
    levelId: LEVELS[0].id,
    challengeIndex: 0,
    challenges: [],
    machine: null,
    unsubscribers: [],
    code: "",
    machineState: null,
    display: null,
    output: "",
    errors: [],
    passed: false,
    failures: [],
    hasRun: false,
    loaded: false,
    dirty: true,
    save: { completed: {}, code: {} },
    hintsRevealed: 0,

    init: () => {
      // Always start the player on the first chronological level (ENIAC), no
      // matter what their saved progress says. Completion still persists, so
      // unlocked eras stay reachable from the timeline; we just want a
      // predictable, story-correct opening every time the page loads.
      const save = loadSave();
      set({ save });
      const level = LEVELS[0];
      if (!isAssembly(level)) {
        mountNonAssembly(level);
        return;
      }
      const challenges = loadChallenges(level.challengeDir!);
      set({ challenges });
      mountChallenge(level, 0);
    },

    selectLevel: (levelId) => {
      const level = getLevel(levelId);
      if (!level) return;
      if (!isAssembly(level)) {
        mountNonAssembly(level);
        return;
      }
      set({ challenges: loadChallenges(level.challengeDir!) });
      mountChallenge(level, 0);
    },

    selectChallenge: (index) => {
      const level = currentLevel(get());
      const challenges = get().challenges;
      if (index < 0 || index >= challenges.length) return;
      // Enforce the unlock rule.
      const ids = challenges.map((c) => c.id);
      if (!isUnlocked(get().save.completed, level.id, ids, index)) return;
      mountChallenge(level, index);
    },

    setCode: (code) => {
      const { levelId, challenges, challengeIndex, save } = get();
      set({ code, dirty: true });
      // Persist code per challenge.
      const challenge = challenges[challengeIndex];
      if (!challenge) return;
      const key = challengeKey(levelId, challenge.id);
      const next: SaveData = { ...save, code: { ...save.code, [key]: code } };
      set({ save: next });
      writeSave(next);
    },

    run: () => {
      const { machine } = get();
      if (!machine) return;
      if (!assembleAndLoad()) return;
      const challenge = get().challenges[get().challengeIndex];
      machine.run(challenge.maxSteps);
      evaluateAndPersist();
    },

    step: () => {
      const { machine, dirty, loaded } = get();
      if (!machine) return;
      if (dirty || !loaded) {
        if (!assembleAndLoad()) return;
      }
      machine.step();
      const state = machine.getState();
      set({ machineState: state });
      if (state.halted) evaluateAndPersist();
    },

    reset: () => {
      const { machine } = get();
      if (!machine) return;
      // Re-assemble + reload so stepping restarts from the program's origin.
      set({ output: "", passed: false, failures: [], hasRun: false });
      assembleAndLoad();
    },

    revealHint: () =>
      set((s) => {
        const challenge = s.challenges[s.challengeIndex];
        const max = challenge ? challenge.hints.length : 0;
        return { hintsRevealed: Math.min(s.hintsRevealed + 1, max) };
      }),

    resetCodeToStarter: () => {
      const challenge = get().challenges[get().challengeIndex];
      if (challenge) get().setCode(challenge.starterCode);
    },

    nextChallenge: () => {
      const { challengeIndex, challenges } = get();
      if (challengeIndex + 1 < challenges.length) {
        get().selectChallenge(challengeIndex + 1);
      }
    },

    markComplete: (levelId, challengeId) => {
      const save = get().save;
      const key = challengeKey(levelId, challengeId);
      if (save.completed[key]) return;
      const next: SaveData = {
        ...save,
        completed: { ...save.completed, [key]: true },
      };
      set({ save: next });
      writeSave(next);
    },
  };
});
