/**
 * Challenge runner + success-checker (PRD §6.4, §10.2).
 *
 * Assembles the player's source on the given machine, runs it, and evaluates
 * the declarative `SuccessCheck` against the resulting generic `MachineState`.
 * Knows nothing about any specific machine — only the `Machine` interface and
 * the `MachineState` shape.
 */

import { Challenge, SuccessCheck } from "./challenge";
import { AsmError, Machine, MachineState } from "./machineInterface";

export interface RunResult {
  /** Assembler diagnostics; non-empty `error`-severity means it didn't run. */
  errors: AsmError[];
  /** True if assembly produced no errors and the program executed. */
  ran: boolean;
  /** Final machine state (only meaningful when `ran`). */
  state?: MachineState;
  /** Captured console/teletype output. */
  output: string;
  /** Whether the success check passed. */
  passed: boolean;
  /** Human-readable reasons the check failed (empty when passed). */
  failures: string[];
}

const hex = (n: number, width = 2) =>
  "$" + ((n ?? 0) & 0xffff).toString(16).toUpperCase().padStart(width, "0");

/** Evaluate a SuccessCheck against a final state + output; collect failures. */
export function evaluateCheck(
  check: SuccessCheck,
  state: MachineState,
  output: string
): string[] {
  const failures: string[] = [];

  if (check.registers) {
    for (const [name, want] of Object.entries(check.registers)) {
      const got = state.registers[name];
      if (got !== want) {
        failures.push(
          `Register ${name} should be ${hex(want)} but is ${
            got === undefined ? "absent" : hex(got)
          }.`
        );
      }
    }
  }

  if (check.flags) {
    for (const [name, want] of Object.entries(check.flags)) {
      const got = state.flags[name];
      if (got !== want) {
        failures.push(`Flag ${name} should be ${want ? "set" : "clear"}.`);
      }
    }
  }

  if (check.memoryEquals) {
    for (const { addr, value, label } of check.memoryEquals) {
      const got = state.memory[addr];
      if (got !== value) {
        failures.push(
          `${label ?? `Memory ${hex(addr, 4)}`} should be ${hex(value)} but is ${hex(
            got ?? 0
          )}.`
        );
      }
    }
  }

  if (check.memoryBytes) {
    const { start, bytes, label } = check.memoryBytes;
    for (let i = 0; i < bytes.length; i++) {
      if (state.memory[start + i] !== bytes[i]) {
        failures.push(
          `${label ?? `Memory at ${hex(start, 4)}`} does not match the expected ${
            bytes.length
          }-byte pattern (byte ${i} is ${hex(state.memory[start + i] ?? 0)}, expected ${hex(
            bytes[i]
          )}).`
        );
        break;
      }
    }
  }

  if (check.rangeAllEqual) {
    const { start, length, value, label } = check.rangeAllEqual;
    for (let i = 0; i < length; i++) {
      if (state.memory[start + i] !== value) {
        failures.push(
          `${label ?? `Memory ${hex(start, 4)}..${hex(start + length - 1, 4)}`} should all be ${hex(
            value
          )} (byte ${hex(start + i, 4)} is ${hex(state.memory[start + i] ?? 0)}).`
        );
        break;
      }
    }
  }

  if (check.rangeAllNonZero) {
    const { start, length, label } = check.rangeAllNonZero;
    for (let i = 0; i < length; i++) {
      if (!state.memory[start + i]) {
        failures.push(
          `${label ?? `Memory ${hex(start, 4)}..${hex(start + length - 1, 4)}`} must be fully painted — ${hex(
            start + i,
            4
          )} is still empty.`
        );
        break;
      }
    }
  }

  if (check.output) {
    if (check.output.equals !== undefined && output !== check.output.equals) {
      failures.push(`Output should be exactly "${check.output.equals}".`);
    }
    if (
      check.output.contains !== undefined &&
      !output.includes(check.output.contains)
    ) {
      failures.push(`Output should contain "${check.output.contains}".`);
    }
  }

  if (check.halted !== undefined && state.halted !== check.halted) {
    failures.push(
      check.halted
        ? "Program should end (add a BRK)."
        : "Program should not have halted."
    );
  }

  return failures;
}

/** Assemble + run `source` on a fresh-state `machine`, then check success. */
export function runChallenge(
  machine: Machine,
  challenge: Challenge,
  source: string
): RunResult {
  let output = "";
  const off = machine.onOutput((t) => {
    output += t;
  });

  try {
    const asm = machine.assemble(source);
    const hasErrors = asm.errors.some((e) => e.severity !== "warning");
    if (hasErrors) {
      return {
        errors: asm.errors,
        ran: false,
        output,
        passed: false,
        failures: ["Fix the assembler errors before running."],
      };
    }

    machine.load(asm.bytes, asm.origin);
    machine.run(challenge.maxSteps);
    const state = machine.getState();
    const failures = evaluateCheck(challenge.success, state, output);

    return {
      errors: asm.errors,
      ran: true,
      state,
      output,
      passed: failures.length === 0,
      failures,
    };
  } finally {
    off();
  }
}
