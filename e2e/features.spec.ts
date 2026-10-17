import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { WORDS, PHRASES, ALL_LESSONS } from '../src/data/course';
import { GLYPHS, tokenize } from '../src/lib/script';
import { captureSpeech, collectErrors, solveLesson } from './learner';

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('huttese:v1') ?? 'null'));
const isoDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
async function seed(page: Page, progress: object) {
  await page.goto('/404');
  await page.evaluate((p) => localStorage.setItem('huttese:v1', JSON.stringify(p)), progress);
}
const base = { xp: 0, dailyGoal: 30, days: {}, lessons: {}, words: {}, settings: { sound: true, speech: true, latin: true } };

test.beforeEach(async ({ page }) => {
  await captureSpeech(page);
});

test('every page loads cleanly: no errors, no sideways scroll, every control labelled', async ({ page }) => {
  const errors = await collectErrors(page);
  for (const path of ['/', '/practice', '/script', '/dictionary', '/settings', '/no-such-page', '/lesson/greetings', '/lesson/script-vowels']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    const unlabelled = await page.locator('button:visible, a:visible, input:visible, textarea:visible').evaluateAll((els) =>
      els
        .filter((e) => {
          const name = (e.getAttribute('aria-label') ?? (e as HTMLElement).innerText ?? '').trim();
          const labelled = e.id && document.querySelector(`label[for="${e.id}"]`);
          return !name && !labelled && !(e as HTMLInputElement).placeholder;
        })
        .map((e) => e.outerHTML.slice(0, 80)),
    );
    expect(unlabelled, `${path} has unlabelled controls`).toEqual([]);
  }
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: "Koona t'chuta?" })).toBeVisible();
  expect(errors).toEqual([]);
});

test('practice is empty for a new learner, then reviews learned words', async ({ page }) => {
  await page.goto('/practice');
  await expect(page.getByText('Nothing to practise yet')).toBeVisible();

  const done = { done: 1, best: 1, last: new Date().toISOString() };
  await seed(page, { ...base, xp: 40, lessons: { 'script-vowels': done, greetings: done, 'script-stops': done, 'yes-no': done } });
  await page.goto('/practice');
  const result = await solveLesson(page);
  expect(result.endText).toMatch(/practice complete!/i);
  expect(result.intros).toBe(0);
  // Practice only uses words from finished lessons.
  const learned = new Set(['bo shuda', "h'chu apenkee", 'achuta', 'chowbaso', 'mee jewz ku', 'tagwa', 'nobata', 'nagoola', 'chut chut', 'inkabunga!']);
  const p = await stored(page);
  for (const id of Object.keys(p.words)) expect(learned.has(WORDS.find((w) => w.id === id)!.hut), id).toBe(true);
});

test('streak counts consecutive days and the week strip shows them', async ({ page }, info) => {
  await seed(page, { ...base, xp: 50, days: { [isoDay(-2)]: 20, [isoDay(-1)]: 30 } });
  await page.goto('/');
  await expect(page.locator('[data-welcome]')).toBeHidden(); // only first-timers get the welcome
  await expect(page.locator('[data-streak]:visible').first()).toHaveText('2');
  await page.goto('/lesson/script-vowels');
  const r = await solveLesson(page);
  expect(r.endText).toContain('3 day streak!');
  await page.goto('/');
  await expect(page.locator('[data-streak]:visible').first()).toHaveText('3');
  if (info.project.name === 'desktop') await expect(page.locator('[data-week] i.on')).toHaveCount(3);
});

test('settings: hide latin letters, theme, daily goal', async ({ page }, info) => {
  await page.goto('/settings');
  await page.getByRole('checkbox', { name: 'Show latin letters' }).uncheck();
  await page.goto('/lesson/greetings');
  await expect(page.locator('.intro-script svg')).toBeVisible();
  await page.locator('[data-action]').click();
  await expect(page.locator('.prompt-card .latin-sub')).toBeHidden(); // must read the glyphs

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/dictionary');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(23, 21, 15)');

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Serious 50' }).click();
  await expect(page.getByRole('button', { name: 'Serious 50' })).toHaveAttribute('aria-pressed', 'true');
  if (info.project.name === 'desktop') {
    await page.goto('/');
    await expect(page.locator('[data-goal]')).toHaveText('50');
  }
  expect((await stored(page)).settings).toMatchObject({ latin: false, theme: 'dark' });
});

test('settings: export, reset and import progress', async ({ page }, info) => {
  await seed(page, { ...base, xp: 123, lessons: { 'script-vowels': { done: 2, best: 1, last: '' } } });
  await page.goto('/settings');
  await expect(page.locator('[data-summary]')).toContainText('123 XP');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const file = info.outputPath('backup.json');
  await (await download).saveAs(file);
  expect(JSON.parse(readFileSync(file, 'utf8')).xp).toBe(123);

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Reset progress' }).click();
  await expect(page.locator('[data-summary]')).toContainText('0 XP');
  expect(await stored(page)).toBeNull();

  await page.locator('[data-import]').setInputFiles(file);
  await expect(page.locator('[data-msg]')).toHaveText('Backup restored.');
  await expect(page.locator('[data-summary]')).toContainText('123 XP');
  await expect(page.locator('[data-summary]')).toContainText(`1 of ${ALL_LESSONS.length} lessons`);

  await page.locator('[data-import]').setInputFiles({ name: 'junk.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":1}') });
  await expect(page.locator('[data-msg]')).toContainText('isn’t a Huttese backup');
});

test('dictionary lists every entry, searches, filters and speaks', async ({ page }) => {
  await page.goto('/dictionary');
  const entries = page.locator('[data-entry]:visible');
  await expect(entries).toHaveCount(WORDS.length + PHRASES.length);

  await page.getByRole('searchbox').fill('poodoo');
  const expected = [...WORDS, ...PHRASES].filter((e) => `${e.hut} ${e.en}`.toLowerCase().includes('poodoo')).length;
  await expect(entries).toHaveCount(expected);

  await page.getByRole('searchbox').fill('');
  await page.getByRole('button', { name: 'numbers', exact: true }).click();
  await expect(entries).toHaveCount(WORDS.filter((w) => w.cat === 'numbers').length);

  const first = entries.first();
  const hut = await first.locator('.e-hut').innerText();
  const word = WORDS.find((w) => w.hut === hut)!;
  await expect(first.locator('.e-pron')).toHaveText(word.pron);
  await first.getByRole('button').click();
  await expect.poll(() => page.evaluate(() => (window as any).__spoken.at(-1)?.text)).toBe(word.pron.toLowerCase().replace(/-/g, ' '));

  await page.getByRole('searchbox').fill('xyzzy');
  await expect(page.getByText('No matches. Poodoo.')).toBeVisible();
});

test('script page shows every glyph and transliterates as you type', async ({ page }) => {
  await page.goto('/script');
  await expect(page.locator('.glyph-card')).toHaveCount(GLYPHS.length);
  await page.getByLabel('Transliterator').fill("koona t'chuta?");
  const glyphs = page.locator('[data-out] svg path[transform]');
  await expect(glyphs).toHaveCount(tokenize("koona t'chuta?").filter((t) => t !== ' ').length);
});
