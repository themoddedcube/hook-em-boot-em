import { describe, it, expect } from "vitest";
import { createSsem } from "./index";

function run(src: string) {
  const m = createSsem();
  const { bytes, origin, errors } = m.assemble(src);
  expect(errors).toEqual([]);
  m.load(bytes, origin);
  m.run();
  return m.getState();
}

describe("SSEM (Manchester Baby) semantics", () => {
  it("LDN loads the negative (there is no plain load)", () => {
    // A := -(-7) = 7
    const s = run("LDN seven\nSTP\nseven: NUM -7\n");
    expect(s.registers.A).toBe(7);
    expect(s.halted).toBe(true);
  });

  it("subtracts (12 - 5 = 7), with no ADD instruction", () => {
    const s = run(
      ["LDN negA", "SUB b", "STP", "negA: NUM -12", "b: NUM 5"].join("\n")
    );
    expect(s.registers.A).toBe(7);
  });

  it("adds by negation: 6 + 9 = 15 using only SUB/LDN", () => {
    const s = run(
      [
        "LDN a", // A = -6
        "SUB b", // A = -6 - 9 = -15
        "STO t", // t = -15
        "LDN t", // A = 15
        "STP",
        "a: NUM 6",
        "b: NUM 9",
        "t: NUM 0",
      ].join("\n")
    );
    expect(s.registers.A).toBe(15);
  });

  it("loops with SUB + skip-if-negative (20 - 3·7 = -1)", () => {
    const s = run(
      [
        "LDN start", // A = 20
        "loop: SUB three", // A -= 3
        "CMP", // if A<0 skip the JMP
        "JMP loop",
        "STP",
        "start: NUM -20",
        "three: NUM 3",
      ].join("\n")
    );
    expect(s.registers.A).toBe(-1);
    expect(s.halted).toBe(true);
  });

  it("computes a remainder by repeated subtraction (20 mod 6 = 2)", () => {
    const s = run(
      [
        "loop: LDN rem", // A = -rem
        "STO t", // t = -rem
        "LDN t", // A = rem
        "STO prev", // prev = rem
        "LDN rem", // A = -rem
        "STO t", // t = -rem
        "LDN t", // A = rem
        "SUB six", // A = rem - 6
        "STO rem", // rem = rem - 6
        "CMP", // if rem < 0 skip the JMP
        "JMP loop",
        "LDN prev", // A = -prev
        "STO t",
        "LDN t", // A = prev (the last non-negative remainder)
        "STP",
        "rem: NUM 20",
        "six: NUM 6",
        "prev: NUM 0",
        "t: NUM 0",
      ].join("\n")
    );
    expect(s.registers.A).toBe(2);
    expect(s.halted).toBe(true);
  });

  it("renders the store as a 32×32 dot display", () => {
    const m = createSsem();
    let last: { width: number; height: number; rgba?: Uint8Array } | null = null;
    m.onDisplayUpdate((u) => (last = u));
    const { bytes } = m.assemble("LDN seven\nSTP\nseven: NUM -7\n");
    m.load(bytes);
    expect(last).not.toBeNull();
    expect(last!.width).toBe(32);
    expect(last!.height).toBe(32);
  });
});
