/**
 * Resolves a level's declarative `modelPath` (e.g. "/assets/models/6502.glb")
 * to a Vite-served asset URL. Keeps the repo layout from PRD §7 (assets/ at the
 * root, beside src/) while letting the level registry stay pure data — adding a
 * GLB needs no code change here, just a file in assets/models/.
 */

const urls = import.meta.glob("/assets/models/*.glb", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** Returns the served URL for a registry modelPath, or null if absent. */
export function resolveModelUrl(modelPath: string | undefined): string | null {
  if (!modelPath) return null;
  // Try an exact project-root key first, then match by filename suffix.
  if (urls[modelPath]) return urls[modelPath];
  const file = modelPath.split("/").pop();
  for (const [key, url] of Object.entries(urls)) {
    if (key.endsWith("/" + file)) return url;
  }
  return null;
}
