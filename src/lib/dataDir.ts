import { existsSync } from "fs";
import { join } from "path";

/**
 * Single source of truth for the active TEI data directory.
 *
 * When `data/fake/` exists under `root`, the app operates in "fake mode" —
 * all reads, writes, and builds use only that directory. Otherwise the app
 * falls back to `data/corpus/` (real corpus mode).
 *
 * Used by build scripts, the admin API route, and the admin form page.
 */
export function getActiveTeiDir(root: string): string {
  const fakeDir = join(root, "data", "fake");
  if (existsSync(fakeDir)) {
    return fakeDir;
  }
  return join(root, "data", "corpus");
}
