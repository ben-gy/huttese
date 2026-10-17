import type { Exercise, Item, Lesson } from './types';
import { GLYPHS, tokenize } from './script';
import { WORDS, PHRASES, ALL_LESSONS, wordById, phraseById } from '../data/course';

// ---------- helpers ----------

export function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const pick = <T>(a: T[], n: number) => shuffle(a).slice(0, n);

export const wordItem = (id: string): Item => {
  const w = wordById(id);
  return { ...w, kind: 'word' };
};
export const phraseItem = (id: string): Item => {
  const p = phraseById(id);
  return { ...p, kind: 'phrase' };
};
export const glyphItem = (key: string): Item => {
  const g = GLYPHS.find((x) => x.key === key)!;
  return { id: 'g:' + key, hut: key, en: g.sound, pron: key.toUpperCase(), ipa: g.ipa ? `/${g.ipa}/` : '', kind: 'glyph' };
};

/** Words, phrases and glyphs introduced in lessons up to and including `lessonId`. */
export function learnedUpTo(lessonId: string) {
  const words = new Set<string>();
  const phrases = new Set<string>();
  const glyphs = new Set<string>();
  for (const l of ALL_LESSONS) {
    l.words?.forEach((w) => words.add(w));
    l.phrases?.forEach((p) => phrases.add(p));
    l.glyphs?.forEach((g) => glyphs.add(g));
    if (l.id === lessonId) break;
  }
  return { words: [...words], phrases: [...phrases], glyphs: [...glyphs] };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// ---------- meaning overlap ----------

const STOP = new Set('a an the of to as in is it and or for be with at on'.split(' '));
const SYNONYMS: Record<string, string> = {
  hello: 'greet', greetings: 'greet', greeting: 'greet', hi: 'greet',
  me: 'i', myself: 'i', mine: 'i',
  fool: 'idiot', worm: 'idiot', stupid: 'idiot',
  dung: 'fodder', crap: 'fodder',
  weapon: 'gun', blaster: 'gun',
  challenge: 'race', podrace: 'race',
  deal: 'bargain',
  punk: 'boy',
};

/** Content words of a meaning (parentheticals ignored, light stemming, synonyms folded). */
export function sense(en: string): Set<string> {
  const words = norm(en.replace(/\(.*?\)/g, ' ')).replace(/'/g, '').split(' ');
  const out = new Set<string>();
  for (let w of words) {
    if (!w || STOP.has(w)) continue;
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    out.add(SYNONYMS[w] ?? SYNONYMS[w + 's'] ?? w);
  }
  return out;
}

const overlaps = (a: Set<string>, b: Set<string>) => [...a].some((w) => b.has(w));
const sameSense = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((w) => b.has(w));

/** Pick items whose meanings don't overlap, so no question has two right answers. */
export function distinct(items: Item[], n: number, start: Item[] = []): Item[] {
  const out = start.slice();
  const senses = out.map((i) => (i.kind === 'glyph' ? new Set([i.id]) : sense(i.en)));
  for (const c of items) {
    if (out.length >= n) break;
    if (out.some((o) => o.id === c.id)) continue;
    const s = c.kind === 'glyph' ? new Set([c.id]) : sense(c.en);
    if (senses.some((x) => overlaps(x, s))) continue;
    if (out.some((o) => norm(o.hut) === norm(c.hut) || norm(o.pron) === norm(c.pron))) continue;
    out.push(c);
    senses.push(s);
  }
  return out;
}

/** Distractors: prefer the same category, never the same text or meaning. */
function distractors(item: Item, pool: Item[], n: number): Item[] {
  const cat = (i: Item) => (i.kind === 'word' ? WORDS.find((w) => w.id === i.id)?.cat : i.kind);
  const myCat = cat(item);
  const candidates = shuffle(pool.filter((p) => p.id !== item.id)).sort((a, b) => Number(cat(b) === myCat) - Number(cat(a) === myCat));
  return distinct(candidates, n + 1, [item]).slice(1);
}

const options = (item: Item, pool: Item[], n = 3, _field?: 'hut' | 'en' | 'pron') => shuffle([item, ...distractors(item, pool, n)]);

/** Other words that mean the same thing – accepted as typed answers too. */
export function equivalents(item: Item): string[] {
  const s = sense(item.en);
  return [...WORDS, ...PHRASES].filter((w) => w.id !== item.id && sameSense(sense(w.en), s)).map((w) => w.hut);
}

// ---------- answer checking ----------

function lev(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Typed-answer check. Apostrophes and punctuation are optional; small typos are forgiven. */
export function checkTyped(input: string, target: string): 'right' | 'typo' | 'wrong' {
  const strip = (s: string) => norm(s).replace(/'/g, '');
  const a = strip(input);
  const b = strip(target);
  if (!a) return 'wrong';
  if (a === b) return 'right';
  return lev(a, b) <= Math.max(1, Math.floor(b.length / 8)) ? 'typo' : 'wrong';
}

export const firstMeaning = (en: string) => en.split(' / ')[0].replace(/\(.*?\)/g, '').trim();

export const buildTokens = (s: string) => norm(s).split(' ').filter(Boolean);

// ---------- exercise generation ----------

export function generate(lesson: Lesson, opts: { firstTime: boolean; speech: boolean }): Exercise[] {
  if (lesson.kind === 'glyphs') return glyphLesson(lesson, opts);
  if (lesson.kind === 'phrases') return phraseLesson(lesson, opts);
  return wordLesson(lesson, opts);
}

function glyphLesson(lesson: Lesson, { firstTime }: { firstTime: boolean }): Exercise[] {
  const learned = learnedUpTo(lesson.id);
  const pool = learned.glyphs.map(glyphItem);
  const fresh = lesson.glyphs!.map(glyphItem);
  const ex: Exercise[] = [];

  for (const g of fresh) {
    if (firstTime) ex.push({ type: 'intro', item: g });
    ex.push({ type: 'choose', item: g, prompt: 'glyph', show: 'latin', options: options(g, pool, 3, 'hut') });
  }
  const second: Exercise[] = [];
  for (const g of fresh) {
    second.push({ type: 'choose', item: g, prompt: 'pron', show: 'glyph', options: options(g, pool, 3, 'hut') });
  }
  // Read whole words written only in glyphs learned so far.
  const known = new Set(learned.glyphs);
  const readable = WORDS.filter((w) => {
    const t = tokenize(w.hut).filter((k) => k !== ' ');
    return t.length >= 2 && t.length <= 7 && t.every((k) => known.has(k)) && t.some((k) => lesson.glyphs!.includes(k));
  });
  for (const w of pick(readable, 3)) {
    const item: Item = { ...w, kind: 'word' };
    const answer = tokenize(w.hut).filter((k) => k !== ' ');
    const extra = pick(learned.glyphs.filter((k) => !answer.includes(k)), Math.min(3, Math.max(2, 8 - answer.length)));
    second.push({ type: 'spell', item, answer, bank: shuffle([...answer, ...extra]) });
  }
  ex.push(...shuffle(second));
  const freshIds = new Set(fresh.map((f) => f.id));
  const matchItems = distinct([...fresh, ...shuffle(pool.filter((p) => !freshIds.has(p.id)))], 5);
  ex.push({ type: 'match', items: matchItems, left: 'glyph', right: 'latin' });
  return ex;
}

function wordLesson(lesson: Lesson, { firstTime, speech }: { firstTime: boolean; speech: boolean }): Exercise[] {
  const learned = learnedUpTo(lesson.id);
  const pool = learned.words.map(wordItem);
  const fresh = lesson.words!.map(wordItem);
  const review = pick(pool.filter((p) => !lesson.words!.includes(p.id)), 2);
  const ex: Exercise[] = [];

  // Phase 1 – meet each word, then recognise it.
  for (const w of fresh) {
    if (firstTime) ex.push({ type: 'intro', item: w });
    ex.push({ type: 'choose', item: w, prompt: 'hut', show: 'en', options: options(w, pool, 3, 'en') });
  }

  // Phase 2 – mixed recall in different modalities.
  const hard: Exercise[] = [];
  for (const w of [...fresh, ...review]) {
    const kinds = shuffle(['en-hut', 'script', 'pron', speech ? 'listen' : 'en-hut', 'type']).slice(0, fresh.includes(w) ? 2 : 1);
    for (const k of kinds) {
      if (k === 'en-hut') hard.push({ type: 'choose', item: w, prompt: 'en', show: 'hut', options: options(w, pool) });
      if (k === 'script') hard.push({ type: 'choose', item: w, prompt: 'script', show: 'en', options: options(w, pool, 3, 'en') });
      if (k === 'pron') hard.push({ type: 'choose', item: w, prompt: 'hut', show: 'pron', options: options(w, pool, 3, 'pron') });
      if (k === 'listen') hard.push({ type: 'choose', item: w, prompt: 'audio', show: 'hut', options: options(w, pool) });
      if (k === 'type') hard.push({ type: 'type', item: w });
    }
  }
  ex.push(...shuffle(hard).slice(0, 9));

  // Phase 3 – match pairs.
  const matchSet = distinct([...shuffle(fresh), ...shuffle(pool.filter((p) => !lesson.words!.includes(p.id)))], 5);
  if (matchSet.length >= 3) ex.push({ type: 'match', items: matchSet, left: 'hut', right: 'en' });
  return ex;
}

function phraseLesson(lesson: Lesson, { firstTime, speech }: { firstTime: boolean; speech: boolean }): Exercise[] {
  const learned = learnedUpTo(lesson.id);
  const pool = learned.phrases.map(phraseItem);
  const wordPool = learned.words.map(wordItem);
  const fresh = lesson.phrases!.map(phraseItem);
  const ex: Exercise[] = [];

  const hutBank = (p: Item, n = 3) => {
    const answer = buildTokens(p.hut);
    const extras = shuffle([...wordPool, ...pool].flatMap((i) => buildTokens(i.hut))).filter((t) => !answer.includes(t));
    return { answer, bank: shuffle([...answer, ...[...new Set(extras)].slice(0, n)]) };
  };
  const enBank = (p: Item, n = 3) => {
    const answer = buildTokens(p.enBuild ?? firstMeaning(p.en));
    const extras = shuffle([...pool, ...wordPool].flatMap((i) => buildTokens(i.enBuild ?? firstMeaning(i.en)))).filter(
      (t) => !answer.includes(t),
    );
    return { answer, bank: shuffle([...answer, ...[...new Set(extras)].slice(0, n)]) };
  };

  for (const p of fresh) {
    if (firstTime) ex.push({ type: 'intro', item: p });
    ex.push({ type: 'build', item: p, direction: 'hut-en', ...enBank(p) });
  }
  const more: Exercise[] = [];
  for (const p of fresh) {
    more.push({ type: 'build', item: p, direction: speech ? 'audio-hut' : 'en-hut', ...hutBank(p) });
    more.push(
      Math.random() < 0.5
        ? { type: 'choose', item: p, prompt: 'en', show: 'hut', options: options(p, pool, 2) }
        : { type: 'build', item: p, direction: 'en-hut', ...hutBank(p, 4) },
    );
  }
  ex.push(...shuffle(more));
  return ex;
}

/** Practice session built from the learner's weakest words and phrases. */
export function generateReview(weak: Item[], speech: boolean): Exercise[] {
  const words = weak.filter((i) => i.kind === 'word');
  const pool = WORDS.map((w) => wordItem(w.id));
  const ex: Exercise[] = [];
  for (const w of words.slice(0, 10)) {
    const k = pick(['en-hut', 'hut-en', 'type', 'script', speech ? 'listen' : 'type', 'pron'], 1)[0];
    if (k === 'en-hut') ex.push({ type: 'choose', item: w, prompt: 'en', show: 'hut', options: options(w, pool) });
    if (k === 'hut-en') ex.push({ type: 'choose', item: w, prompt: 'hut', show: 'en', options: options(w, pool, 3, 'en') });
    if (k === 'script') ex.push({ type: 'choose', item: w, prompt: 'script', show: 'en', options: options(w, pool, 3, 'en') });
    if (k === 'listen') ex.push({ type: 'choose', item: w, prompt: 'audio', show: 'hut', options: options(w, pool) });
    if (k === 'pron') ex.push({ type: 'choose', item: w, prompt: 'hut', show: 'pron', options: options(w, pool, 3, 'pron') });
    if (k === 'type') ex.push({ type: 'type', item: w });
  }
  const phrases = weak.filter((i) => i.kind === 'phrase').slice(0, 3);
  const ppool = PHRASES.map((p) => phraseItem(p.id));
  for (const p of phrases) {
    const answer = buildTokens(p.hut);
    const extras = shuffle(ppool.flatMap((i) => buildTokens(i.hut))).filter((t) => !answer.includes(t));
    ex.push({ type: 'build', item: p, direction: 'en-hut', answer, bank: shuffle([...answer, ...[...new Set(extras)].slice(0, 4)]) });
  }
  const m = distinct(shuffle(words), 5);
  if (m.length >= 4) ex.push({ type: 'match', items: m, left: 'hut', right: 'en' });
  return shuffle(ex);
}
