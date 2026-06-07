import { describe, it, expect } from "vitest";
import { LEVELS } from "../content/levels";
import { loadChallenges } from "../content/challengeLoader";
import { runChallenge } from "./challengeRunner";

/**
 * PRD §10.2: each challenge passes with its reference solution and fails with an
 * empty/wrong program — proving the success-checker is sound and every shipped
 * challenge is actually solvable.
 */
describe("challenge verification (all levels)", () => {
  // Only assembly levels have a Machine + challenge JSON to verify. (ENIAC is a
  // wiring puzzle, verified in puzzle.test.ts; TACC is a finale scene.)
  const assemblyLevels = LEVELS.filter(
    (l) => (l.kind ?? "assembly") === "assembly"
  );
  for (const level of assemblyLevels) {
    // Sandbox entries have no objective/reference — exclude from verification.
    const challenges = loadChallenges(level.challengeDir!).filter(
      (c) => !c.sandbox
    );

    it(`${level.id}: has challenges`, () => {
      expect(challenges.length).toBeGreaterThan(0);
    });

    for (const challenge of challenges) {
      it(`${level.id}/${challenge.id}: reference solution passes`, () => {
        expect(
          challenge.reference,
          `challenge ${challenge.id} is missing a reference solution`
        ).toBeTruthy();
        const machine = level.machineFactory!();
        const result = runChallenge(machine, challenge, challenge.reference!);
        expect(result.errors).toEqual([]);
        expect(result.failures).toEqual([]);
        expect(result.passed).toBe(true);
      });

      it(`${level.id}/${challenge.id}: empty program fails`, () => {
        const machine = level.machineFactory!();
        const result = runChallenge(machine, challenge, "BRK\n");
        expect(result.passed).toBe(false);
      });
    }
  }
});
