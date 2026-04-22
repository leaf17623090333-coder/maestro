export const HANDOFF_ID_PATTERN = /^(\d{4}-\d{2}-\d{2}-\d{3}|[a-z]+-[a-z]+-\d+)$/;

const ADJECTIVES = [
  "bold", "brave", "brisk", "calm", "chill", "clear", "cool", "crisp",
  "dapper", "eager", "fair", "fancy", "fast", "fine", "firm", "free",
  "gentle", "glad", "golden", "grand", "happy", "jolly", "keen", "kind",
  "lively", "loyal", "lucky", "merry", "mild", "misty", "neat", "noble",
  "proud", "quick", "quiet", "sharp", "shiny", "sleek", "snug", "spry",
  "steady", "sunny", "swift", "tidy", "vivid", "warm", "witty", "young",
] as const;

const NOUNS = [
  "otter", "finch", "badger", "falcon", "fox", "hawk", "heron", "lynx",
  "owl", "panda", "raven", "robin", "seal", "swan", "tiger", "whale",
  "wolf", "wren", "bear", "crane", "crow", "deer", "duck", "eagle",
  "elk", "gecko", "goose", "hare", "ibex", "jay", "koala", "lark",
  "marten", "moose", "oriole", "panther", "puma", "quail", "rabbit", "salmon",
  "sparrow", "stoat", "stork", "trout", "turtle", "weasel", "yak", "zebra",
] as const;

/**
 * Generate a human-friendly handoff id in the form `adjective-noun-N`.
 * N is the next available counter for that exact (adjective, noun) pair
 * across the provided `existingIds`, starting at 1.
 */
export function generateHandoffId(
  existingIds: readonly string[],
  _now: Date = new Date(),
): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
  const prefix = `${adj}-${noun}-`;
  let maxSeq = 0;
  for (const id of existingIds) {
    if (!id.startsWith(prefix)) continue;
    const seq = Number.parseInt(id.slice(prefix.length), 10);
    if (Number.isFinite(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  }
  return `${prefix}${maxSeq + 1}`;
}
