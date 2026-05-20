/**
 * A single corpus item row, keyed by column config IDs.
 * Values are strings (single-valued) or string arrays (multi-valued).
 */
export type CorpusItem = Record<string, string | string[]>;
