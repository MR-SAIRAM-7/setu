/**
 * Transcript normalisation (§12.1) — .vtt / .srt / plain text → one clean string
 * plus a speaker list. Deterministic, L0.
 */

export interface NormalisedTranscript {
  title: string;
  text: string;
  speakers: string[];
  durationHint?: string;
}

const TIMECODE =
  /^\s*(?:\d+\s*$|(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s*-->\s*(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})/;

const SPEAKER = /^([A-Z][\w .'-]{1,40}?)\s*[:>]\s+/;

export function normaliseTranscript(raw: string, title = 'Transcript'): NormalisedTranscript {
  const lines = raw.split(/\r?\n/);
  const speakers = new Set<string>();
  const out: string[] = [];
  let lastSpeaker = '';

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t === 'WEBVTT' || t.startsWith('NOTE ') || t.startsWith('STYLE')) continue;
    if (TIMECODE.test(t)) continue;

    // <v Speaker Name> from WebVTT
    const vtag = t.match(/^<v\s+([^>]+)>\s*(.*)$/);
    if (vtag) {
      const name = vtag[1]?.trim() ?? '';
      const said = stripTags(vtag[2] ?? '');
      if (name) speakers.add(name);
      if (said) out.push(name && name !== lastSpeaker ? `${name}: ${said}` : said);
      lastSpeaker = name;
      continue;
    }

    const m = t.match(SPEAKER);
    if (m?.[1]) {
      const name = m[1].trim();
      speakers.add(name);
      const said = stripTags(t.slice(m[0].length));
      if (said) out.push(name !== lastSpeaker ? `${name}: ${said}` : said);
      lastSpeaker = name;
      continue;
    }

    const said = stripTags(t);
    if (said) out.push(said);
  }

  // Merge consecutive lines from the same speaker into paragraphs.
  const merged: string[] = [];
  for (const line of out) {
    const prev = merged[merged.length - 1];
    if (prev && !/^[A-Z][\w .'-]{1,40}:/.test(line) && prev.length < 600) {
      merged[merged.length - 1] = `${prev} ${line}`;
    } else {
      merged.push(line);
    }
  }

  const duration = raw.match(/(\d{2}:\d{2}:\d{2})[.,]\d{3}\s*-->/g);
  const last = duration?.[duration.length - 1];

  return {
    title,
    text: merged.join('\n'),
    speakers: [...speakers],
    ...(last ? { durationHint: last.replace(/\s*-->.*/, '') } : {}),
  };
}

function stripTags(s: string): string {
  return s
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function looksLikeTranscript(text: string): boolean {
  const head = text.slice(0, 2000);
  if (/^WEBVTT/m.test(head)) return true;
  if (/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->/.test(head)) return true;
  const speakerLines = head.split(/\r?\n/).filter((l) => SPEAKER.test(l.trim())).length;
  return speakerLines >= 4;
}
