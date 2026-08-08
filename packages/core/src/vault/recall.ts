/**
 * Retrieval helpers (§23.3). The DB call itself lives on the server; these are
 * the pure pieces both sides need, and the ones worth unit-testing.
 */

export interface TimeRange {
  from: Date;
  to: Date;
}

const DAY = 86_400_000;

/**
 * Pure vector search fails on the query that matters most:
 * "What was I learning yesterday afternoon?" — that is a TEMPORAL query, not a
 * semantic one. Handle it explicitly rather than hoping cosine similarity
 * accidentally encodes time.
 */
export function parseTemporal(q: string, now = new Date()): TimeRange | null {
  const s = q.toLowerCase();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOf(now);

  const partOfDay = (base: Date): TimeRange | null => {
    if (/\bmorning\b/.test(s)) return { from: hour(base, 5), to: hour(base, 12) };
    if (/\bafternoon\b/.test(s)) return { from: hour(base, 12), to: hour(base, 17) };
    if (/\bevening\b/.test(s)) return { from: hour(base, 17), to: hour(base, 22) };
    if (/\bnight\b/.test(s)) return { from: hour(base, 22), to: hour(new Date(+base + DAY), 5) };
    return null;
  };

  if (/\byesterday\b/.test(s)) {
    const y = new Date(+today - DAY);
    return partOfDay(y) ?? { from: y, to: today };
  }
  if (/\btoday\b|\bthis morning\b|\bthis afternoon\b|\bthis evening\b/.test(s)) {
    return partOfDay(today) ?? { from: today, to: new Date(+today + DAY) };
  }
  if (/\blast week\b|\bpast week\b/.test(s)) {
    return { from: new Date(+today - 7 * DAY), to: new Date(+today + DAY) };
  }
  if (/\blast month\b|\bpast month\b/.test(s)) {
    return { from: new Date(+today - 30 * DAY), to: new Date(+today + DAY) };
  }
  const nDays = s.match(/\b(\d{1,2})\s+days?\s+ago\b/);
  if (nDays?.[1]) {
    const d = new Date(+today - Number(nDays[1]) * DAY);
    return { from: d, to: new Date(+d + DAY) };
  }
  return null;
}

/** Does the query carry a topic, or is it purely "when"? */
export function hasStrongTopic(q: string): boolean {
  const stripped = q
    .toLowerCase()
    .replace(
      /\b(what|was|were|i|did|do|reading|read|learning|learn|working|work|on|the|a|an|about|yesterday|today|morning|afternoon|evening|night|last|week|month|ago|days?|my|me)\b/g,
      ' ',
    )
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim();
  return stripped.split(/\s+/).filter((w) => w.length > 2).length >= 1;
}

export interface Ranked {
  id: string;
}

/**
 * Reciprocal Rank Fusion. Eight lines, and it reliably beats either retriever
 * alone:  score(d) = Σ 1/(k + rank_i(d))
 *
 * Verified: semantic [A,B,C] + lexical [C,A,D] ranks A > C > B > D — items
 * present in both lists are correctly promoted above items in only one.
 */
export function rrf<T extends Ranked>(lists: T[][], k = 60): T[] {
  const score = new Map<string, number>();
  const item = new Map<string, T>();

  for (const list of lists) {
    list.forEach((d, i) => {
      score.set(d.id, (score.get(d.id) ?? 0) + 1 / (k + i + 1));
      if (!item.has(d.id)) item.set(d.id, d);
    });
  }

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => item.get(id))
    .filter((x): x is T => !!x);
}

function hour(d: Date, h: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h);
}
