/**
 * Trunca un testo a un numero massimo di parole.
 * Se il testo ha più parole di `maxWords`, restituisce le prime `maxWords` parole + "…"
 */
export function truncateWords(text: string, maxWords: number): string {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "…";
}
