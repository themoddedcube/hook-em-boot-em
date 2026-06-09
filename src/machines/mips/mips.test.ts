import { describe, it, expect } from "vitest";
import { createMips } from "./index";

function run(src: string) {
  const m = createMips();
  let out = "";
  m.onOutput((t) => (out += t));
  const { bytes, origin, errors } = m.assemble(src);
  expect(errors).toEqual([]);
  m.load(bytes, origin);
  m.run();
  return { state: m.getState(), out };
}

describe("MIPS semantics", () => {
  it("ADDI / ADD into $v0 (5 + 7 = 12)", () => {
    const { state } = run(
      [
        ".text",
        "addi $t0, $zero, 5",
        "addi $t1, $zero, 7",
        "add  $v0, $t0, $t1",
        "li   $v0, 1",  // syscall code: print int (but uses $a0)
        "add  $a0, $t0, $t1",
        "syscall",
        "li   $v0, 10",
        "syscall",
      ].join("\n")
    );
    expect(state.registers.$a0).toBe(12);
    expect(state.halted).toBe(true);
  });

  it("countdown loop with addi + bne (sum 5..1 = 15 in $t1)", () => {
    const { state } = run(
      [
        ".text",
        "addi $t0, $zero, 5",   // counter
        "addi $t1, $zero, 0",   // sum
        "loop:",
        "add  $t1, $t1, $t0",
        "addi $t0, $t0, -1",
        "bne  $t0, $zero, loop",
        "li   $v0, 10",
        "syscall",
      ].join("\n")
    );
    expect(state.registers.$t1).toBe(15);
  });

  it("lw / sw against a .data word", () => {
    const { state } = run(
      [
        ".data",
        "x: .word 42",
        ".text",
        "la   $t0, x",
        "lw   $t1, 0($t0)",
        "li   $v0, 10",
        "syscall",
      ].join("\n")
    );
    expect(state.registers.$t1).toBe(42);
  });

  it("prints a .asciiz string with syscall 4 ('HELLO')", () => {
    const { out } = run(
      [
        ".data",
        'msg: .asciiz "HELLO"',
        ".text",
        "la   $a0, msg",
        "li   $v0, 4",
        "syscall",
        "li   $v0, 10",
        "syscall",
      ].join("\n")
    );
    expect(out).toBe("HELLO");
  });

  it("sums a 5-element .word array (= 45)", () => {
    const { state } = run(
      [
        ".data",
        "arr: .word 10, 20, 3, 7, 5",
        ".text",
        "la   $t0, arr",        // pointer
        "addi $t1, $zero, 5",    // count
        "addi $t2, $zero, 0",    // sum
        "loop:",
        "lw   $t3, 0($t0)",
        "add  $t2, $t2, $t3",
        "addi $t0, $t0, 4",
        "addi $t1, $t1, -1",
        "bne  $t1, $zero, loop",
        "li   $v0, 10",
        "syscall",
      ].join("\n")
    );
    expect(state.registers.$t2).toBe(45);
  });

  it("jal / jr forms a callable subroutine", () => {
    // $v0 doubles as the syscall selector, so we stash the routine's result
    // into $t0 before the exit syscall (which sets $v0 = 10).
    const { state } = run(
      [
        ".text",
        "jal  fill5",
        "move $t0, $v0",
        "li   $v0, 10",
        "syscall",
        "fill5:",
        "addi $v0, $zero, 5",
        "jr   $ra",
      ].join("\n")
    );
    expect(state.registers.$t0).toBe(5);
  });
});
