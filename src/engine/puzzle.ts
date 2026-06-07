/**
 * The ENIAC plugboard puzzle model (PRD §5.2: "software was physical wiring").
 *
 * ENIAC (1945) had no stored program — you "programmed" it by plugging patch
 * cables between units and setting switches. We capture that idea as a small
 * dataflow puzzle: constant SOURCES feed ACCUMULATORS (which add their inputs),
 * which feed the OUTPUT. The player patches cables to make OUTPUT hit a target.
 * It is deliberately NOT an assembly machine — it's a different kind of level.
 */

export interface PuzzleSource {
  id: string;
  label: string;
  value: number;
}

export interface PuzzleAccumulator {
  id: string;
  label: string;
}

/** A patch cable from an output port to an input port. */
export interface Cable {
  /** Source id or accumulator id (their single output). */
  from: string;
  /** "<accId>:in0" | "<accId>:in1" | "OUT". */
  to: string;
}

export interface PuzzleChallenge {
  id: string;
  title: string;
  lesson: string;
  prompt: string;
  hints: string[];
  successText?: string;
  /** Value the OUTPUT must reach. */
  target: number;
  sources: PuzzleSource[];
  accumulators: PuzzleAccumulator[];
  /** Mark as a free-play sandbox (no target / no pass-fail). */
  sandbox?: boolean;
  bridge?: string;
}

export const OUTPUT_PORT = "OUT";

/**
 * Evaluate the wiring. Each accumulator outputs the sum of the values arriving
 * at its two inputs; OUTPUT is the sum of everything wired into it. Acyclic by
 * construction (sources -> accumulators -> output); a visited-guard keeps any
 * accidental cycle from looping forever.
 */
export function evaluatePlugboard(
  puzzle: PuzzleChallenge,
  cables: Cable[]
): { output: number; accumulators: Record<string, number> } {
  const sourceVal = new Map(puzzle.sources.map((s) => [s.id, s.value]));
  const accIds = new Set(puzzle.accumulators.map((a) => a.id));
  const memo = new Map<string, number>();

  const valueOf = (portId: string, seen: Set<string>): number => {
    if (sourceVal.has(portId)) return sourceVal.get(portId)!;
    if (!accIds.has(portId)) return 0;
    if (memo.has(portId)) return memo.get(portId)!;
    if (seen.has(portId)) return 0; // cycle guard
    seen.add(portId);
    let sum = 0;
    for (const c of cables) {
      if (c.to === `${portId}:in0` || c.to === `${portId}:in1`) {
        sum += valueOf(c.from, seen);
      }
    }
    memo.set(portId, sum);
    return sum;
  };

  const accumulators: Record<string, number> = {};
  for (const a of puzzle.accumulators) accumulators[a.id] = valueOf(a.id, new Set());

  let output = 0;
  for (const c of cables) {
    if (c.to === OUTPUT_PORT) output += valueOf(c.from, new Set());
  }
  return { output, accumulators };
}

export function isSolved(puzzle: PuzzleChallenge, cables: Cable[]): boolean {
  if (puzzle.sandbox) return false;
  return evaluatePlugboard(puzzle, cables).output === puzzle.target;
}
