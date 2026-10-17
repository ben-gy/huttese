/**
 * Hutt script – an original phonetic glyph set used to write Huttese in this course.
 *
 * Each glyph lives on an 8 × 12 grid (y grows downward) and is drawn as strokes.
 * Words sit on a shared baseline, a little like carved Tatooine signage.
 * Common two-letter sounds (ch, sh, oo, ee) get their own glyph, so one glyph = one sound.
 */

export interface Glyph {
  key: string; // latin spelling this glyph stands for
  path: string; // SVG path data on the 8x12 grid
  sound: string; // plain-English description of the sound
  ipa: string;
  group: 'vowel' | 'consonant' | 'digraph' | 'mark';
  width?: number; // advance width (defaults to 8)
}

export const GLYPHS: Glyph[] = [
  // vowels
  { key: 'a', group: 'vowel', ipa: 'a', sound: '“ah” as in father', path: 'M0 5 Q4 0 8 5 M4 3 L4 12' },
  { key: 'e', group: 'vowel', ipa: 'ɛ', sound: '“eh” as in bed', path: 'M0 6 L8 6 M4 2 L4 12' },
  { key: 'i', group: 'vowel', ipa: 'i', sound: '“ee” as in machine (sometimes “i” as in win)', path: 'M6 1 L2 6 L6 7 L2 12' },
  { key: 'o', group: 'vowel', ipa: 'o', sound: '“oh” as in go (sometimes “o” as in hot)', path: 'M0 7 Q0 2 4 2 Q8 2 8 7 Q8 12 4 12 Q0 12 0 7 Z M4 6 L4 8' },
  { key: 'u', group: 'vowel', ipa: 'u', sound: '“oo” as in rule (sometimes “uh” as in bun)', path: 'M0 2 Q0 10 4 10 Q8 10 8 2 M4 10 L4 12' },
  // digraphs
  { key: 'oo', group: 'digraph', ipa: 'u', sound: '“oo” as in moon', path: 'M0 7 Q0 2 4 2 Q8 2 8 7 Q8 12 4 12 Q0 12 0 7 Z M1.5 7 L6.5 7' },
  { key: 'ee', group: 'digraph', ipa: 'i', sound: '“ee” as in see', path: 'M0 6 L8 6 M4 2 L4 12 M1 10 L7 10 M1 2 L7 2' },
  { key: 'ch', group: 'digraph', ipa: 'tʃ', sound: '“ch” as in chew', path: 'M0 3 L8 3 M2 3 L2 12 M6 3 L6 12 M2 8 L6 8' },
  { key: 'sh', group: 'digraph', ipa: 'ʃ', sound: '“sh” as in shoe', path: 'M0 3 L8 3 L0 11 L8 11 M4 0 L4 3' },
  // consonants
  { key: 'b', group: 'consonant', ipa: 'b', sound: '“b” as in bantha', path: 'M0 2 L0 12 M0 7 L6 7 L8 12' },
  { key: 'c', group: 'consonant', ipa: 'k', sound: 'hard “k”', path: 'M8 2 L2 2 L2 12 M2 7 L6 7' },
  { key: 'd', group: 'consonant', ipa: 'd', sound: '“d” as in dune', path: 'M0 12 L4 4 L8 12 M4 4 L4 0' },
  { key: 'f', group: 'consonant', ipa: 'f', sound: '“f” as in fire', path: 'M1 2 L7 8 M7 2 L1 8 M4 5 L4 12' },
  { key: 'g', group: 'consonant', ipa: 'g', sound: 'hard “g” as in go', path: 'M0 2 L8 2 L8 12 M0 7 L8 7' },
  { key: 'h', group: 'consonant', ipa: 'h', sound: '“h” as in hut', path: 'M0 2 L0 12 M8 2 L8 12 M0 2 L8 12' },
  { key: 'j', group: 'consonant', ipa: 'dʒ', sound: '“j” as in Jabba', path: 'M8 1 L8 8 Q8 12 4 12 Q0 12 0 8' },
  { key: 'k', group: 'consonant', ipa: 'k', sound: '“k” as in kick', path: 'M0 2 L4 8 L8 2 M4 8 L4 12' },
  { key: 'l', group: 'consonant', ipa: 'l', sound: '“l” as in look', path: 'M0 2 L0 12 M0 7 Q6 7 8 2' },
  { key: 'm', group: 'consonant', ipa: 'm', sound: '“m” as in moon', path: 'M0 12 L0 4 L4 8 L8 4 L8 12' },
  { key: 'n', group: 'consonant', ipa: 'n', sound: '“n” as in no', path: 'M0 12 L0 3 L8 10 L8 3' },
  { key: 'p', group: 'consonant', ipa: 'p', sound: '“p” as in pod', path: 'M0 12 L0 2 L8 2 L8 7 L0 7' },
  { key: 'q', group: 'consonant', ipa: 'k', sound: '“k” – not used in Huttese words, only for names', path: 'M0 7 L8 7 M2 2 L6 2 M2 12 L6 12 M4 2 L4 12' },
  { key: 'r', group: 'consonant', ipa: 'r', sound: 'rolled “r”', path: 'M0 2 L8 2 M5 2 Q0 7 5 12' },
  { key: 's', group: 'consonant', ipa: 's', sound: '“s” as in sand', path: 'M0 3 L8 3 L0 11 L8 11' },
  { key: 't', group: 'consonant', ipa: 't', sound: '“t” as in Tatooine', path: 'M0 12 L8 2 M0 2 L4 7' },
  { key: 'v', group: 'consonant', ipa: 'v', sound: '“v” as in vine', path: 'M0 4 L4 12 L8 4 M2 1 L6 1' },
  { key: 'w', group: 'consonant', ipa: 'w', sound: '“w” as in womp', path: 'M0 2 L2 12 L4 6 L6 12 L8 2' },
  { key: 'x', group: 'consonant', ipa: 'ʘ', sound: 'a wet lip-smack, as in ap-xmasi', path: 'M0 2 L8 12 M0 12 L8 2 M0 7 L8 7' },
  { key: 'y', group: 'consonant', ipa: 'j', sound: '“y” as in yes', path: 'M0 2 L8 2 M0 7 L8 7 M4 2 L4 12' },
  { key: 'z', group: 'consonant', ipa: 'z', sound: '“z” as in zoo', path: 'M0 12 L4 2 L8 12 Z' },
  // marks
  { key: "'", group: 'mark', ipa: 'ə', sound: 'a quick “uh” between consonants (k’wanna = kuh-WAH-nah)', path: 'M2 1 L1 5', width: 3 },
  { key: '?', group: 'mark', ipa: '', sound: 'question', path: 'M0 4 L4 1 L4 8 M4 10.5 L4 12', width: 5 },
  { key: '!', group: 'mark', ipa: '', sound: 'exclamation', path: 'M2 1 L2 8 M2 10.5 L2 12 M0 1 L4 1', width: 4 },
  { key: '.', group: 'mark', ipa: '', sound: 'full stop', path: 'M1 10.5 L1 12', width: 2 },
  { key: ',', group: 'mark', ipa: '', sound: 'pause', path: 'M2 10 L1 13', width: 3 },
];

const BY_KEY = new Map(GLYPHS.map((g) => [g.key, g]));
const DIGRAPHS = GLYPHS.filter((g) => g.key.length === 2).map((g) => g.key);

export function glyph(key: string): Glyph | undefined {
  return BY_KEY.get(key);
}

/** Split text into glyph keys. ' ' marks a word gap. Unknown characters are dropped. */
export function tokenize(text: string): string[] {
  const s = text.toLowerCase().replace(/[’‘`]/g, "'").replace(/-/g, ' ');
  const out: string[] = [];
  for (let i = 0; i < s.length; ) {
    const two = s.slice(i, i + 2);
    if (DIGRAPHS.includes(two)) {
      out.push(two);
      i += 2;
      continue;
    }
    const ch = s[i];
    if (/\s/.test(ch)) {
      if (out.length && out[out.length - 1] !== ' ') out.push(' ');
    } else if (BY_KEY.has(ch)) {
      out.push(ch);
    }
    i++;
  }
  while (out[out.length - 1] === ' ') out.pop();
  return out;
}

const GAP = 3; // between glyphs
const SPACE = 7; // between words
const PAD = 2;

/** Render text in Hutt script as an inline SVG string. `size` = rendered glyph height in px. */
export function renderScript(text: string, opts: { size?: number; label?: string; className?: string } = {}): string {
  const size = opts.size ?? 28;
  const tokens = tokenize(text);
  let x = PAD;
  const strokes: string[] = [];
  const baselines: string[] = [];
  let wordStart = x;
  let inWord = false;

  const closeWord = () => {
    if (inWord) baselines.push(`M${wordStart - 1} 14.5 L${x - GAP + 1} 14.5`);
    inWord = false;
  };

  for (const t of tokens) {
    if (t === ' ') {
      closeWord();
      x += SPACE - GAP;
      continue;
    }
    const g = BY_KEY.get(t)!;
    if (!inWord && g.group !== 'mark') {
      wordStart = x;
      inWord = true;
    }
    strokes.push(`<path transform="translate(${x} 1)" d="${g.path}"/>`);
    x += (g.width ?? 8) + GAP;
  }
  closeWord();
  const w = Math.max(x - GAP + PAD, 4);
  const h = 17;
  const label = opts.label ?? text;
  return (
    `<svg class="hutt-script ${opts.className ?? ''}" viewBox="0 0 ${w} ${h}" width="${(w / h) * size * 1.2}" height="${size * 1.2}" ` +
    `role="img" aria-label="${escapeAttr(label)} in Hutt script" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter">` +
    strokes.join('') +
    (baselines.length ? `<path d="${baselines.join(' ')}" stroke-width="1"/>` : '') +
    `</svg>`
  );
}

/** Render one glyph on its own (for the alphabet chart and glyph exercises). */
export function renderGlyph(key: string, size = 48): string {
  const g = BY_KEY.get(key);
  if (!g) return '';
  const w = (g.width ?? 8) + 4;
  return (
    `<svg class="hutt-glyph" viewBox="-2 -1 ${w} 15" width="${(w / 15) * size}" height="${size}" role="img" aria-label="Hutt glyph" ` +
    `fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" stroke-linejoin="miter"><path d="${g.path}"/></svg>`
  );
}

function escapeAttr(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
