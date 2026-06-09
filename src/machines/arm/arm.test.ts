import { describe, it, expect } from "vitest";
import { createArm } from "./index";

function run(src: string) {
  const m = createArm();
  let out = "";
  m.onOutput((t) => (out += t));
  const { bytes, origin, errors } = m.assemble(src);
  expect(errors).toEqual([]);
  m.load(bytes, origin);
  m.run();
  return { state: m.getState(), out };
}

describe("ARM64 (teaching subset) semantics", () => {
  it("MOV + ADD: x0 = 5 + 7 = 12, prints", () => {
    const { out } = run(
      [
        ".text",
        "mov x0, #5",
        "mov x1, #7",
        "add x0, x0, x1",
        "mov x16, #1",   // syscall: print int
        "svc #0",
        "mov x16, #93",  // syscall: exit
        "svc #0",
      ].join("\n")
    );
    expect(out).toBe("12");
  });

  it("loops with CMP + B.NE (sum 5..1 = 15)", () => {
    const { state } = run(
      [
        ".text",
        "mov x1, #5",    // counter
        "mov x2, #0",    // sum
        "loop:",
        "add x2, x2, x1",
        "sub x1, x1, #1",
        "cmp x1, #0",
        "b.ne loop",
        "mov x0, x2",
        "mov x16, #1",
        "svc #0",
        "mov x16, #93",
        "svc #0",
      ].join("\n")
    );
    expect(state.registers.x2).toBe(15);
  });

  it("LDR / STR through a register address (load .word 42)", () => {
    const { state } = run(
      [
        ".data",
        "x: .word 42",
        ".text",
        "mov x1, #0x1000",   // address of .data section base
        "ldr x0, [x1]",
        "mov x16, #1",
        "svc #0",
        "mov x16, #93",
        "svc #0",
      ].join("\n")
    );
    expect(state.registers.x0).toBe(42);
  });

  it("prints a .asciz string with svc (HELLO)", () => {
    const { out } = run(
      [
        ".data",
        'msg: .asciz "HELLO"',
        ".text",
        "mov x0, #0x1000",   // address of msg
        "mov x16, #4",       // syscall: print string
        "svc #0",
        "mov x16, #93",
        "svc #0",
      ].join("\n")
    );
    expect(out).toBe("HELLO");
  });

  it("BL / RET forms a callable subroutine", () => {
    const { state } = run(
      [
        ".text",
        "bl fill5",
        "mov x3, x0",       // stash the result before exit
        "mov x16, #93",
        "svc #0",
        "fill5:",
        "mov x0, #5",
        "ret",
      ].join("\n")
    );
    expect(state.registers.x3).toBe(5);
  });

  it("CMP sets the Z flag on equality", () => {
    const { state } = run(
      [
        ".text",
        "mov x1, #7",
        "cmp x1, #7",
        "mov x16, #93",
        "svc #0",
      ].join("\n")
    );
    expect(state.flags.Z).toBe(true);
  });
});
