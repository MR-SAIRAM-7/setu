/**
 * Chunking (§23.1). Do not skip this — it determines retrieval quality more
 * than the embedding model does.
 *
 * The single highest-leverage trick here is step 4: prepending the heading path
 * to every chunk. It improves retrieval more than any embedding-model upgrade.
 */

export interface Chunk {
  ord: number;
  text: string;
  headingPath: string;
  tokenCount: number;
}

export interface ChunkOptions {
  /** target characters per chunk */
  target: number;
  /** characters of overlap so a sentence never falls between two chunks */
  overlap: number;
}

export const DEFAULT_CHUNK: ChunkOptions = { target: 900, overlap: 150 };

const HEADING = /^(#{1,6})\s+(.+)$|^([A-Z][^.!?\n]{3,70})$/;

export function chunk(text: string, opts: Partial<ChunkOptions> = {}): Chunk[] {
  const { target, overlap } = { ...DEFAULT_CHUNK, ...opts };
  if (!text.trim()) return [];

  /* 1. Split on structural boundaries first: headings, then paragraphs. */
  const lines = text.split(/\r?\n/);
  const segments: Array<{ path: string[]; text: string }> = [];
  let path: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const t = buffer.join('\n').trim();
    if (t) segments.push({ path: [...path], text: t });
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const m = line.trim().match(HEADING);
    const isMarkdownHeading = !!m?.[1];
    const isBareHeading = !!m?.[3] && line.trim().length < 70 && buffer.length > 0;

    if (isMarkdownHeading || isBareHeading) {
      flush();
      const level = m?.[1]?.length ?? 2;
      const title = (m?.[2] ?? m?.[3] ?? '').trim();
      path = path.slice(0, Math.max(0, level - 1));
      path.push(title);
      continue;
    }
    if (!line.trim()) {
      if (buffer.length) buffer.push('');
      continue;
    }
    buffer.push(line);
  }
  flush();

  /* 2. Merge small pieces up to `target`, 3. overlapping by `overlap`. */
  const chunks: Chunk[] = [];
  let ord = 0;

  for (const seg of segments) {
    const headingPath = seg.path.join(' > ');
    const paragraphs = seg.text.split(/\n{2,}/).filter((p) => p.trim());

    let current = '';
    const push = () => {
      const body = current.trim();
      if (!body) return;
      chunks.push({
        ord: ord++,
        text: body,
        headingPath,
        tokenCount: estimateTokens(body),
      });
    };

    for (const p of paragraphs) {
      if (current.length + p.length + 2 <= target) {
        current = current ? `${current}\n\n${p}` : p;
        continue;
      }
      if (current) {
        push();
        // 3. Carry `overlap` characters forward, cut at a sentence boundary.
        current = tailAtSentence(current, overlap);
        current = current ? `${current}\n\n${p}` : p;
      } else {
        // A single paragraph longer than target — hard-split it.
        for (const piece of hardSplit(p, target, overlap)) {
          chunks.push({ ord: ord++, text: piece, headingPath, tokenCount: estimateTokens(piece) });
        }
        current = '';
      }
    }
    push();
  }

  return chunks;
}

/** 4. What actually goes to the embedding model. */
export function embeddableText(c: Chunk): string {
  return c.headingPath ? `${c.headingPath}\n\n${c.text}` : c.text;
}

function tailAtSentence(s: string, chars: number): string {
  if (chars <= 0 || s.length <= chars) return s;
  const tail = s.slice(-chars);
  const stop = tail.search(/[.!?]\s/);
  return stop >= 0 ? tail.slice(stop + 2) : tail;
}

function hardSplit(s: string, target: number, overlap: number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const slice = s.slice(i, i + target);
    out.push(slice);
    i += Math.max(1, target - overlap);
  }
  return out;
}

/** ~4 characters per token for English. Good enough for budgeting. */
export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}
