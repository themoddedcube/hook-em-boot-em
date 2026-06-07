/**
 * Drop-in puzzle discovery for non-assembly levels (mirrors challengeLoader).
 * Puzzles live under content/puzzles/<dir>/NN-name.json and load in filename
 * order via import.meta.glob.
 */

import { PuzzleChallenge } from "../engine/puzzle";

const modules = import.meta.glob<{ default: PuzzleChallenge }>(
  "./puzzles/**/*.json",
  { eager: true }
);

const byDir: Map<string, PuzzleChallenge[]> = (() => {
  const grouped = new Map<string, { file: string; puzzle: PuzzleChallenge }[]>();
  for (const [path, mod] of Object.entries(modules)) {
    const m = path.match(/\/puzzles\/([^/]+)\/([^/]+)\.json$/);
    if (!m) continue;
    const [, dir, file] = m;
    const list = grouped.get(dir) ?? [];
    list.push({ file, puzzle: mod.default });
    grouped.set(dir, list);
  }
  const result = new Map<string, PuzzleChallenge[]>();
  for (const [dir, list] of grouped) {
    list.sort((a, b) => a.file.localeCompare(b.file));
    result.set(dir, list.map((x) => x.puzzle));
  }
  return result;
})();

export function loadPuzzles(dir: string): PuzzleChallenge[] {
  return byDir.get(dir) ?? [];
}
