/**
 * Level descriptor (PRD §7.1).
 *
 * A level is the unit of content the shell renders. Crucially, a level is
 * *data*: adding one means adding a `machines/<name>/` folder, challenge JSON,
 * an optional GLB, and a single entry in `src/content/levels.ts` — with zero
 * edits to the engine, UI, or shell.
 */

import { MachineFactory } from "./machineInterface";

/**
 * Most levels are assembly machines, but the chronological bookends are not:
 * ENIAC is a wiring "puzzle" and TACC is a non-playable "finale". The kind tells
 * the shell which experience to render; the era timeline + progression stay
 * generic across all kinds.
 */
export type LevelKind = "assembly" | "puzzle" | "finale";

export interface Level {
  /** Stable id; matches the machine folder + challenge subdirectory name. */
  id: string;
  /** Display title (e.g. "MOS 6502"). */
  title: string;
  /** Era year, used for chronological ordering + the timeline UI. */
  year: number;
  /** Experience type. Defaults to "assembly". */
  kind?: LevelKind;
  /** Produces a fresh Machine (assembly levels only). */
  machineFactory?: MachineFactory;
  /** Subdirectory under content/challenges/ holding this level's JSON. */
  challengeDir?: string;
  /** Subdirectory under content/puzzles/ (puzzle levels only). */
  puzzleDir?: string;
  /** Optional GLB model path (under /assets/models/). */
  modelPath?: string;
  /** One- or two-sentence framing blurb for the level card. */
  blurb: string;
  /**
   * Real-world physical facts about the machine, shown as a "spec card" so the
   * player feels the scale of each era (a room-sized one-off → a wardrobe → a
   * fingernail-sized chip). This contrast is core to the game's pedagogy.
   */
  specs?: MachineSpecs;
  /**
   * The "why humanity needed the next stage" bridge — shown at the end of the
   * level (on its sandbox screen). Explains the limitation of THIS machine that
   * the NEXT era resolves, tying the chronological arc together.
   */
  bridge?: string;
}

export interface MachineSpecs {
  /** Physical footprint, e.g. "5.2 m × 0.6 m × 0.6 m". */
  size: string;
  /** A vivid everyday comparison, e.g. "the size of a small wardrobe". */
  sizeCompare?: string;
  weight?: string;
  memory?: string;
  speed?: string;
  /** Price when new, ideally with an inflation-adjusted note. */
  price?: string;
  /** Anything else memorable (power draw, unit sales, etc.). */
  note?: string;
}
