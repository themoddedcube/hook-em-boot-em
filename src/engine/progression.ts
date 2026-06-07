/**
 * Progression + persistence (PRD §6.6, §7.1).
 *
 * Tracks which challenges are completed and the player's last code per
 * challenge, persisted to localStorage so progress survives a reload. The
 * unlock rule is intentionally simple and data-driven: challenges within a
 * level unlock in order; the first challenge is always available.
 */

const STORAGE_KEY = "hookem-bootem.save.v1";

export interface SaveData {
  /** Set of completed challenge keys, "<levelId>/<challengeId>". */
  completed: Record<string, true>;
  /** Last edited source per challenge key. */
  code: Record<string, string>;
  /** Last level/challenge the player was on, for resume. */
  last?: { levelId: string; challengeId: string };
}

const empty = (): SaveData => ({ completed: {}, code: {} });

export const challengeKey = (levelId: string, challengeId: string) =>
  `${levelId}/${challengeId}`;

export function loadSave(): SaveData {
  if (typeof localStorage === "undefined") return empty();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      completed: parsed.completed ?? {},
      code: parsed.code ?? {},
      last: parsed.last,
    };
  } catch {
    return empty();
  }
}

export function writeSave(data: SaveData): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full / disabled — progress simply won't persist this session.
  }
}

/**
 * Given the completed set and an ordered challenge id list, decide whether a
 * challenge at `index` is unlocked: the first is always open; later ones open
 * once the previous one is completed.
 */
export function isUnlocked(
  completed: Record<string, true>,
  levelId: string,
  orderedIds: string[],
  index: number
): boolean {
  if (index <= 0) return true;
  const prev = orderedIds[index - 1];
  return !!completed[challengeKey(levelId, prev)];
}
