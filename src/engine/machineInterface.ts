/**
 * The uniform Machine contract (PRD §6, §7).
 *
 * This interface is THE seam of the whole project. The challenge engine, the
 * register inspector, the console, the editor, and the progression system all
 * speak only this language — they never know which historical machine they are
 * driving. Every era (6502, 8080/Altair, PDP-8, SSEM, LC-3, ...) ships a folder
 * under `src/machines/<name>/` whose `index.ts` exports a factory producing one
 * of these. Adding a machine must require zero edits to the engine or UI.
 *
 * Anything a machine needs that is not expressible here is a signal that the
 * interface should evolve *generically* — never special-case a machine upstream.
 */

/** An assembler diagnostic (error or warning) with a 1-based line number. */
export interface AsmError {
  line: number;
  message: string;
  severity?: "error" | "warning";
}

export interface AssembleResult {
  /** Machine code, ready to `load()`. Empty when `errors` contains errors. */
  bytes: Uint8Array;
  /** Address the bytes were assembled to load at (origin). */
  origin: number;
  errors: AsmError[];
}

/**
 * A generic, machine-agnostic snapshot of CPU + memory state. The challenge
 * success-checks and the inspector are written against THIS shape, not against
 * any machine's internals.
 *
 *  - `registers`: named 8/16-bit registers (A, X, Y, PC, SP for the 6502;
 *    A, B, C, ... for the 8080; R0..R7 for LC-3). Display order follows the
 *    `registerOrder` descriptor.
 *  - `flags`: named status bits (e.g. N, V, Z, C). Boolean by convention.
 *  - `memory`: the full addressable memory image (read-only snapshot).
 *  - `cycles`: cumulative cycle/step count since the last reset.
 *  - `halted`: machine has stopped (BRK / HLT / trap / ran off the program).
 */
export interface MachineState {
  registers: Record<string, number>;
  flags: Record<string, boolean>;
  memory: Uint8Array;
  cycles: number;
  halted: boolean;
}

/** A pixel-display / lamp update pushed to the scene & UI. */
export interface DisplayUpdate {
  /** Logical pixel width of the display. */
  width: number;
  /** Logical pixel height of the display. */
  height: number;
  /**
   * RGBA bytes, length = width * height * 4, row-major from top-left.
   * Machines without a raster display (front-panel lamps only) may omit this.
   */
  rgba?: Uint8Array;
}

/** Static, declarative description of a machine for the UI to render itself. */
export interface MachineDescriptor {
  /** Stable id, matches the level/machine folder name (e.g. "mos6502"). */
  id: string;
  /** Human label (e.g. "MOS 6502"). */
  name: string;
  /** Register names in the order the inspector should show them. */
  registerOrder: string[];
  /** Which registers are 16-bit (rendered as 4 hex digits vs 2). */
  wideRegisters?: string[];
  /**
   * Optional explicit bit-width per register (e.g. 32 for the SSEM
   * accumulator). Overrides `wideRegisters`; drives how many hex digits the
   * inspector shows and how negatives are masked. Defaults to 8 (or 16 for
   * names in `wideRegisters`).
   */
  registerBits?: Record<string, number>;
  /** Flag names in display order (left = most significant by convention). */
  flagOrder: string[];
  /** Default origin/load address for freshly assembled programs. */
  defaultOrigin: number;
  /** Total addressable memory size in bytes. */
  memorySize: number;
  /** Optional display geometry, if the machine has a raster screen. */
  display?: { width: number; height: number };
  /**
   * If true (and there is no raster `display`), the machine's 3D screen renders
   * its console/teletype output as a live text terminal. Used by the LC-3, whose
   * "display" is character output (OUT/PUTS), not pixels.
   */
  terminal?: boolean;
}

export type DisplayCallback = (update: DisplayUpdate) => void;
export type OutputCallback = (text: string) => void;

export interface Machine {
  /** Static descriptor used by the UI to render register/flag panels, etc. */
  readonly descriptor: MachineDescriptor;

  /** Assemble source text into bytes (+ diagnostics). Pure; no side effects. */
  assemble(src: string): AssembleResult;

  /** Load machine code at the given address (defaults to descriptor.defaultOrigin). */
  load(bytes: Uint8Array, origin?: number): void;

  /** Execute a single instruction. */
  step(): void;

  /**
   * Run until halt or a safety budget is exhausted.
   * @param maxSteps safety cap to prevent infinite loops (default machine-defined).
   */
  run(maxSteps?: number): void;

  /** Reset CPU + memory to power-on state. Clears loaded program. */
  reset(): void;

  /** Generic snapshot for the inspector and challenge success-checks. */
  getState(): MachineState;

  /** Subscribe to raster/lamp updates. Returns an unsubscribe fn. */
  onDisplayUpdate(cb: DisplayCallback): () => void;

  /** Subscribe to character/teletype output. Returns an unsubscribe fn. */
  onOutput(cb: OutputCallback): () => void;
}

/** A level's machine is produced by a zero-arg factory (PRD §7.1 registry). */
export type MachineFactory = () => Machine;
