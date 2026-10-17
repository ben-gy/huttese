/**
 * A black-box "learner" for end-to-end tests. It reads only what is on screen – visible text, the drawn glyph
 * shapes and the audio that was actually spoken – and works out the right answer from the course data.
 * Passing a lesson therefore proves that what the UI shows, says and marks correct all agree with the course.
 */
import { expect, type Page } from '@playwright/test';
import { WORDS, PHRASES } from '../src/data/course';
import { GLYPHS, tokenize } from '../src/lib/script';
import { firstMeaning, buildTokens } from '../src/lib/engine';

type Entry = { id: string; hut: string; en: string; pron: string; ipa: string; enBuild?: string; kind: 'word' | 'phrase' };
const ENTRIES: Entry[] = [...WORDS.map((w) => ({ ...w, kind: 'word' as const })), ...PHRASES.map((p) => ({ ...p, kind: 'phrase' as const }))];
const GLYPH_BY_PATH = new Map(GLYPHS.map((g) => [g.path, g]));

const clean = (s: string) => s.replace(/[“”]/g, '').replace(/[🔊🐌]/gu, '').replace(/\s+/g, ' ').trim();
const spokenForm = (pron: string) => pron.toLowerCase().replace(/-/g, ' ').replace(/[“”"()]/g, '');

function one<T>(list: T[], what: string): T {
  expect(list, `expected exactly one match for ${what}`).toHaveLength(1);
  return list[0];
}

const byHut = (hut: string) => one(ENTRIES.filter((e) => e.hut === hut), `hut "${hut}"`);
const byGlyphPath = (d: string) => {
  const g = GLYPH_BY_PATH.get(d);
  expect(g, `unknown glyph path ${d}`).toBeTruthy();
  return g!;
};

/** Install before navigation: records every utterance passed to speechSynthesis. */
export async function captureSpeech(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken: { text: string; rate: number }[] };
    w.__spoken = [];
    if ('speechSynthesis' in window) {
      speechSynthesis.speak = (u: SpeechSynthesisUtterance) => void w.__spoken.push({ text: u.text, rate: u.rate });
      speechSynthesis.cancel = () => {};
    }
  });
}

export async function lastSpoken(page: Page): Promise<{ text: string; rate: number } | undefined> {
  return page.evaluate(() => (window as unknown as { __spoken: { text: string; rate: number }[] }).__spoken.at(-1));
}

/** Decode a rendered Hutt-script SVG back into latin text via its glyph paths. */
async function readScript(page: Page, svgSelector: string): Promise<string> {
  const paths = await page.locator(`${svgSelector} path[transform]`).evaluateAll((els) => els.map((e) => e.getAttribute('d')!));
  return paths.map((d) => byGlyphPath(d).key).join('');
}
const squash = (hut: string) => tokenize(hut).filter((t) => t !== ' ').join('');

export interface LessonResult {
  types: string[];
  intros: number;
  endText: string;
}

export interface SolveOptions {
  /** Deliberately answer these graded steps (0-based) wrongly. */
  wrongAt?: number[];
  /** Called after each exercise renders (e.g. to take screenshots). */
  onStep?: (kind: string) => Promise<void>;
  /** Override what gets typed in "Write this in Huttese" (receives the correct answer). */
  typing?: (hut: string) => string;
  /** Called after a typed answer has been checked, with the feedback text. */
  onTyped?: (typed: string, feedback: string) => Promise<void>;
}

/** Play the lesson currently open in `page` to its end screen. */
export async function solveLesson(page: Page, opts: SolveOptions = {}): Promise<LessonResult> {
  const types: string[] = [];
  let intros = 0;
  let graded = 0;
  const action = page.locator('[data-action]');
  const stage = page.locator('[data-stage]');

  for (let step = 0; step < 120; step++) {
    await expect(stage.locator('h2, .intro').first()).toBeVisible();
    if (await stage.locator('.end').count()) {
      return { types, intros, endText: clean(await stage.locator('.end').innerText()) };
    }
    // No horizontal scrolling at any viewport.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(0);

    const kind = await identify(page);
    types.push(kind);
    await opts.onStep?.(kind);

    if (kind === 'intro-word' || kind === 'intro-glyph') {
      await checkIntro(page, kind);
      intros++;
      await action.click();
      continue;
    }

    const wrong = kind !== 'match' && (opts.wrongAt?.includes(graded) ?? false);
    const expected = await answer(page, kind, wrong, opts);
    graded++;

    if (kind !== 'match') {
      await expect(action).toBeEnabled();
      await action.click();
    }
    const footer = page.locator('[data-footer]');
    await expect(footer).toHaveAttribute('data-state', wrong ? 'wrong' : 'right');
    if (wrong && expected) await expect(page.locator('[data-feedback]')).toContainText(expected);
    if (kind === 'type' && opts.onTyped) await opts.onTyped(await page.locator('[data-stage] input').inputValue(), await page.locator('[data-feedback]').innerText());
    await action.click();
  }
  throw new Error('lesson did not finish within 120 steps');
}

async function identify(page: Page): Promise<string> {
  const s = page.locator('[data-stage]');
  if (await s.locator('.intro .intro-glyph').count()) return 'intro-glyph';
  if (await s.locator('.intro').count()) return 'intro-word';
  const h2 = clean(await s.locator('h2').innerText());
  const map: Record<string, string> = {
    'What does this mean?': 'hut-en',
    'How do you pronounce this?': 'hut-pron',
    'Select the Huttese for': 'en-hut',
    'What do you hear?': 'audio-hut',
    'Read the Hutt script': 'script-en',
    'Which letter is this glyph?': 'glyph-latin',
    'Which glyph makes this sound?': 'sound-glyph',
    'Tap the matching pairs': 'match',
    'Write this in Huttese': 'type',
    'Translate this sentence': 'build-hut-en',
    'Say it in Huttese': 'build-en-hut',
    'Tap what you hear': 'build-audio-hut',
    'Spell it in Hutt script': 'spell',
  };
  const kind = map[h2];
  expect(kind, `unrecognised exercise heading "${h2}"`).toBeTruthy();
  return kind;
}

/** Intro cards must show exactly what the course data says. */
async function checkIntro(page: Page, kind: string) {
  const s = page.locator('[data-stage]');
  if (kind === 'intro-glyph') {
    const g = byGlyphPath((await s.locator('.intro-glyph path').getAttribute('d'))!);
    await expect(s.locator('.intro-letter')).toHaveText(g.key);
    await expect(s.locator('.intro-sound')).toContainText(g.sound);
    return;
  }
  const hut = clean(await s.locator('.intro-hut').innerText());
  const e = byHut(hut);
  expect(squash(await readScript(page, '.intro-script svg'))).toBe(squash(e.hut));
  await expect(s.locator('.intro-pron .pron')).toHaveText(e.pron);
  await expect(s.locator('.intro-pron .ipa')).toHaveText(e.ipa);
  await expect(s.locator('.intro-en')).toHaveText(e.en);
  // The card reads the word aloud using its respelling.
  await expect.poll(async () => (await lastSpoken(page))?.text).toBe(spokenForm(e.pron));
}

/** Pick/enter the answer for the current exercise. Returns the answer text the feedback should show. */
async function answer(page: Page, kind: string, wrong: boolean, opts: SolveOptions = {}): Promise<string | undefined> {
  const s = page.locator('[data-stage]');
  const options = s.locator('.option');

  const clickOption = async (matches: (i: number) => Promise<boolean>) => {
    const n = await options.count();
    const hits: number[] = [];
    for (let i = 0; i < n; i++) if (await matches(i)) hits.push(i);
    expect(hits, 'exactly one option should be correct').toHaveLength(1);
    const pick = wrong ? (hits[0] + 1) % n : hits[0];
    await options.nth(pick).click();
  };
  const promptEn = async () => clean(await s.locator('.prompt-en').innerText());
  const promptHut = async () => clean(await s.locator('.prompt-card .latin-sub').innerText());
  const heard = async () => {
    await s.locator('[data-say]').first().click();
    const said = (await lastSpoken(page))!.text;
    return one(ENTRIES.filter((e) => spokenForm(e.pron) === said), `spoken "${said}"`);
  };

  switch (kind) {
    case 'hut-en': {
      const e = byHut(await promptHut());
      expect(squash(await readScript(page, '.prompt-card svg'))).toBe(squash(e.hut));
      await clickOption(async (i) => clean(await options.nth(i).locator('.opt-en').innerText()) === e.en);
      return e.en;
    }
    case 'hut-pron': {
      const e = byHut(await promptHut());
      await clickOption(async (i) => clean(await options.nth(i).locator('.opt-pron').innerText()) === e.pron);
      return e.pron;
    }
    case 'script-en': {
      const latin = await readScript(page, '.prompt-card svg');
      const e = one(ENTRIES.filter((x) => squash(x.hut) === latin), `script "${latin}"`);
      await clickOption(async (i) => clean(await options.nth(i).locator('.opt-en').innerText()) === e.en);
      return e.en;
    }
    case 'en-hut': {
      const en = await promptEn();
      const candidates = ENTRIES.filter((e) => e.en === en || (e.kind === 'phrase' && firstMeaning(e.en) === en));
      expect(candidates.length, `no entry means "${en}"`).toBeGreaterThan(0);
      const huts = new Set(candidates.map((c) => c.hut));
      let picked = '';
      await clickOption(async (i) => {
        const t = clean(await options.nth(i).locator('.opt-hut').innerText());
        if (huts.has(t)) picked = t;
        return huts.has(t);
      });
      return picked;
    }
    case 'audio-hut': {
      const e = await heard();
      await clickOption(async (i) => clean(await options.nth(i).locator('.opt-hut').innerText()) === e.hut);
      return e.hut;
    }
    case 'glyph-latin': {
      const g = byGlyphPath((await s.locator('.prompt-card .hutt-glyph path').getAttribute('d'))!);
      await clickOption(async (i) => clean(await options.nth(i).locator('.opt-latin').innerText()) === g.key);
      return g.key.toUpperCase();
    }
    case 'sound-glyph': {
      const key = (await promptEn()).split(' – ')[0].toLowerCase();
      const g = one(GLYPHS.filter((x) => x.key === key), `glyph "${key}"`);
      await expect(s.locator('.prompt-en')).toContainText(g.sound);
      await clickOption(async (i) => (await options.nth(i).locator('path').getAttribute('d')) === g.path);
      return g.key.toUpperCase();
    }
    case 'match': {
      const left = s.locator('.tile[data-side=l]');
      const right = s.locator('.tile[data-side=r]');
      const n = await left.count();
      expect(await right.count()).toBe(n);
      for (let i = 0; i < n; i++) {
        const tile = left.nth(i);
        const isGlyph = (await tile.locator('svg').count()) > 0;
        const target = isGlyph
          ? byGlyphPath((await tile.locator('path').first().getAttribute('d'))!).key
          : firstMeaning(byHut(clean(await tile.innerText())).en);
        const rights = [];
        for (let j = 0; j < n; j++) if (clean(await right.nth(j).innerText()) === target) rights.push(j);
        expect(rights, `one right-hand tile should match "${target}"`).toHaveLength(1);
        await tile.click();
        await right.nth(rights[0]).click();
      }
      return undefined;
    }
    case 'type': {
      const en = await promptEn();
      const e = one(ENTRIES.filter((x) => x.en === en), `meaning "${en}"`);
      // Learners type casually: capitals and missing apostrophes/punctuation must be accepted.
      const typed = wrong ? 'zzzz' : opts.typing ? opts.typing(e.hut) : e.hut.toUpperCase().replace(/['!?,]/g, '');
      await s.locator('input').fill(typed);
      await expect(s.locator('.type-preview svg')).toBeVisible();
      return e.hut;
    }
    case 'build-hut-en':
    case 'build-en-hut':
    case 'build-audio-hut': {
      let e: Entry;
      if (kind === 'build-hut-en') e = byHut(await promptHut());
      else if (kind === 'build-audio-hut') e = await heard();
      else {
        const en = await promptEn();
        e = one(ENTRIES.filter((x) => x.kind === 'phrase' && (x.enBuild ?? firstMeaning(x.en)) === en), `phrase meaning "${en}"`);
      }
      const tokens = kind === 'build-hut-en' ? buildTokens(e.enBuild ?? firstMeaning(e.en)) : buildTokens(e.hut);
      const order = wrong ? [...tokens].reverse() : tokens;
      for (const t of order) await s.locator('.bank .chip:not(.used)', { hasText: new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().click();
      await expect(s.locator('.answer-line .chip')).toHaveCount(tokens.length);
      return kind === 'build-hut-en' ? e.enBuild ?? firstMeaning(e.en) : e.hut;
    }
    case 'spell': {
      // The prompt is "<hut> <span class=ipa>respelling</span>": read just the Huttese part.
      const hut = clean(await s.locator('.prompt-en').evaluate((el) => el.firstChild!.textContent!));
      const e = byHut(hut);
      const keys = tokenize(e.hut).filter((k) => k !== ' ');
      const chips = s.locator('.bank .chip');
      const n = await chips.count();
      const paths: string[] = [];
      for (let i = 0; i < n; i++) paths.push((await chips.nth(i).locator('path').getAttribute('d'))!);
      const used = new Set<number>();
      const order = wrong ? keys.slice(0, 1) : keys; // a wrong attempt stops after the first glyph
      for (const k of order) {
        const idx = paths.findIndex((p, i) => !used.has(i) && byGlyphPath(p).key === k);
        expect(idx, `glyph ${k} should be in the bank`).toBeGreaterThanOrEqual(0);
        used.add(idx);
        await chips.nth(idx).click();
      }
      return e.hut;
    }
  }
  throw new Error(`no solver for ${kind}`);
}

export async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // The 404 page is meant to answer 404; anything else failing to load is a real error.
    if (m.type() === 'error' && !/\/no-such-page\/?$/.test(m.location().url)) errors.push(`console: ${m.text()} (${m.location().url})`);
  });
  return errors;
}
