import { describe, it, expect } from "vitest";
import { createTemplateVM } from "./index";
import { runChallenge } from "../../engine/challengeRunner";
import { loadChallenges } from "../../content/challengeLoader";

/**
 * PRD §10.6 replicability check: a copied `_template` level — a machine factory
 * plus example challenge JSON — runs through the *generic* engine with zero
 * special-casing. If this passes, the drop-in path holds for any new era.
 */
describe("_template level (drop-in replicability)", () => {
  it("implements the Machine interface end-to-end", () => {
    const m = createTemplateVM();
    const { bytes, errors } = m.assemble("SET 40\nADD 2\nOUT\nHLT\n");
    expect(errors).toEqual([]);
    let out = "";
    m.onOutput((t) => (out += t));
    m.load(bytes);
    m.run();
    const state = m.getState();
    expect(state.registers.A).toBe(42);
    expect(state.halted).toBe(true);
    expect(out.trim()).toBe("42");
  });

  it("runs its example challenge through the generic challenge runner", () => {
    const challenges = loadChallenges("_template");
    expect(challenges.length).toBeGreaterThan(0);
    const challenge = challenges[0];
    const result = runChallenge(createTemplateVM(), challenge, challenge.reference!);
    expect(result.errors).toEqual([]);
    expect(result.passed).toBe(true);
  });
});
