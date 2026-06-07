/**
 * Declarative challenge format (PRD §6.4, §7.1).
 *
 * Challenges are pure data — authored as JSON under
 * `src/content/challenges/<machine>/` — so new levels/puzzles can be added
 * without touching engine or UI code. The success-check is expressed against
 * the generic `MachineState` shape (registers / flags / memory), never against
 * a specific machine's internals.
 */

/** A single declarative success predicate. All listed predicates must hold. */
export interface SuccessCheck {
  /** Each named register must end at exactly this value. */
  registers?: Record<string, number>;
  /** Each named flag must end at exactly this boolean. */
  flags?: Record<string, boolean>;
  /** Specific memory addresses that must hold specific bytes. */
  memoryEquals?: { addr: number; value: number; label?: string }[];
  /** An exact byte sequence beginning at `start`. */
  memoryBytes?: { start: number; bytes: number[]; label?: string };
  /** Every byte in [start, start+length) must equal `value`. */
  rangeAllEqual?: { start: number; length: number; value: number; label?: string };
  /** Every byte in [start, start+length) must be non-zero. */
  rangeAllNonZero?: { start: number; length: number; label?: string };
  /** Console output must contain / equal this text. */
  output?: { contains?: string; equals?: string };
  /** The machine must (or must not) have halted. */
  halted?: boolean;
}

export interface Challenge {
  /** Stable id, unique within its machine (e.g. "first-light"). */
  id: string;
  /** Display title. */
  title: string;
  /** Short historical/architectural lesson shown before the puzzle. */
  lesson: string;
  /** The task statement. */
  prompt: string;
  /** Code pre-filled in the editor. */
  starterCode: string;
  /** Progressive hints, revealed one at a time. */
  hints: string[];
  /** Declarative success condition. */
  success: SuccessCheck;
  /** One-line description of what "success" means, shown to the player. */
  successText?: string;
  /** Optional safety cap on instructions executed for this challenge. */
  maxSteps?: number;
  /**
   * A known-good solution. Used by automated verification (PRD §10.2) to prove
   * the success-checker is sound; never shown to the player.
   */
  reference?: string;
  /**
   * A free-play sandbox: no objective, no pass/fail. Conventionally the last
   * entry in a level — the player has finished the challenges and can now run
   * any code they like. Its `lesson` doubles as the "why the next era" bridge.
   * Sandbox challenges have no `success`/`reference` and are skipped by the
   * automated verifier.
   */
  sandbox?: boolean;
}
