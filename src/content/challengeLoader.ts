/**
 * Drop-in challenge discovery (PRD §7.1).
 *
 * Uses Vite's `import.meta.glob` to auto-discover every challenge JSON under
 * `content/challenges/<dir>/`. Adding a challenge is purely a matter of dropping
 * a new `NN-name.json` file into the right folder — no code edits, no manual
 * import list. Files are ordered by filename, so prefix them `01-`, `02-`, ...
 */

import { Challenge } from "../engine/challenge";

// Eagerly import all challenge JSON. Keys are paths like
// "/src/content/challenges/6502/01-load.json".
const modules = import.meta.glob<{ default: Challenge }>(
  "./challenges/**/*.json",
  { eager: true }
);

/** Map of directory name -> ordered challenge list. */
const byDir: Map<string, Challenge[]> = (() => {
  const grouped = new Map<string, { file: string; challenge: Challenge }[]>();
  for (const [path, mod] of Object.entries(modules)) {
    const m = path.match(/\/challenges\/([^/]+)\/([^/]+)\.json$/);
    if (!m) continue;
    const [, dir, file] = m;
    const list = grouped.get(dir) ?? [];
    list.push({ file, challenge: mod.default });
    grouped.set(dir, list);
  }
  const result = new Map<string, Challenge[]>();
  for (const [dir, list] of grouped) {
    list.sort((a, b) => a.file.localeCompare(b.file));
    result.set(
      dir,
      list.map((x) => x.challenge)
    );
  }
  return result;
})();

/** Ordered challenges for a level's challenge directory (empty if none). */
export function loadChallenges(dir: string): Challenge[] {
  return byDir.get(dir) ?? [];
}
