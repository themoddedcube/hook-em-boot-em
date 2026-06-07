import { describe, it, expect } from "vitest";
import { evaluatePlugboard, isSolved, Cable } from "./puzzle";
import { loadPuzzles } from "../content/puzzleLoader";

describe("ENIAC plugboard evaluator", () => {
  it("routes a source straight to the output", () => {
    const p = loadPuzzles("eniac").find((x) => x.id === "patch-a-wire")!;
    const cables: Cable[] = [{ from: "s0", to: "OUT" }];
    expect(evaluatePlugboard(p, cables).output).toBe(42);
    expect(isSolved(p, cables)).toBe(true);
  });

  it("sums two sources through an accumulator", () => {
    const p = loadPuzzles("eniac").find((x) => x.id === "wire-an-adder")!;
    const cables: Cable[] = [
      { from: "s0", to: "a0:in0" },
      { from: "s1", to: "a0:in1" },
      { from: "a0", to: "OUT" },
    ];
    expect(evaluatePlugboard(p, cables).output).toBe(8);
    expect(isSolved(p, cables)).toBe(true);
  });

  it("chains two accumulators into the output", () => {
    const p = loadPuzzles("eniac").find((x) => x.id === "the-firing-table")!;
    const cables: Cable[] = [
      { from: "s0", to: "a0:in0" },
      { from: "s1", to: "a0:in1" },
      { from: "s2", to: "a1:in0" },
      { from: "s3", to: "a1:in1" },
      { from: "a0", to: "OUT" },
      { from: "a1", to: "OUT" },
    ];
    expect(evaluatePlugboard(p, cables).output).toBe(17);
    expect(isSolved(p, cables)).toBe(true);
  });

  it("an empty board does not solve a real puzzle", () => {
    const p = loadPuzzles("eniac").find((x) => x.id === "wire-an-adder")!;
    expect(isSolved(p, [])).toBe(false);
  });
});
