import { test, expect, type Page } from '@playwright/test';
import { captureSpeech, collectErrors, solveLesson } from './learner';

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('huttese:v1') ?? 'null'));

test.beforeEach(async ({ page }) => {
  await captureSpeech(page);
});

test('a wrong answer costs a heart, shows the right answer and comes back later', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/lesson/greetings');
  const result = await solveLesson(page, { wrongAt: [0, 4] });
  expect(result.endText).toMatch(/lesson complete!/i);
  expect(result.endText).not.toMatch(/accuracy 100%/i);
  await expect(page.locator('[data-hearts]')).toHaveText('3');

  const p = await stored(page);
  expect(p.lessons.greetings.done).toBe(1);
  expect(p.lessons.greetings.best).toBeLessThan(1);
  const wrongs = Object.values(p.words as Record<string, { wrong: number }>).reduce((n, w) => n + w.wrong, 0);
  expect(wrongs).toBe(2);
  expect(errors).toEqual([]);
});

test('running out of hearts ends the lesson without saving, and Try again restarts it', async ({ page }) => {
  await page.goto('/lesson/greetings');
  const result = await solveLesson(page, { wrongAt: [0, 1, 2, 3, 4] });
  expect(result.endText).toContain('Out of hearts');
  await expect(page.locator('[data-hearts]')).toHaveText('0');
  expect(await stored(page)).toBeNull();

  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('[data-hearts]')).toHaveText('5');
  await expect(page.locator('.intro .tag')).toHaveText(/new word/i);

  await page.getByRole('link', { name: 'Quit lesson' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('quitting part-way through saves nothing', async ({ page }) => {
  await page.goto('/lesson/script-vowels');
  await page.locator('[data-action]').click(); // past the first intro
  await page.locator('.option').first().click();
  await page.locator('[data-action]').click();
  await page.getByRole('link', { name: 'Quit lesson' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await stored(page)).toBeNull();
  await expect(page.locator('[data-xp]:visible').first()).toHaveText('0');
});

test('typed answers forgive capitals, missing apostrophes and a one-letter slip', async ({ page }) => {
  test.setTimeout(180_000);
  const seen: { typed: string; feedback: string }[] = [];
  // The exercise mix is random, so replay vocabulary lessons until a typing exercise has come up.
  for (const id of ['greetings', 'yes-no', 'pronouns', 'friends', 'numbers-1', 'money', 'food', 'insults-1']) {
    await page.goto(`/lesson/${id}`);
    await solveLesson(page, {
      typing: (hut) => {
        const plain = hut.replace(/['!?,]/g, '');
        const i = Math.floor(plain.length / 2);
        return (plain.slice(0, i) + plain.slice(i + 1)).toUpperCase(); // drop one letter
      },
      onTyped: async (typed, feedback) => void seen.push({ typed, feedback }),
    });
    if (seen.length) break;
  }
  expect(seen.length, 'a typing exercise should appear in these lessons').toBeGreaterThan(0);
  for (const s of seen) expect(s.feedback).toMatch(/Almost – watch the spelling/);
});

test('the whole lesson can be played with the keyboard', async ({ page }) => {
  await page.goto('/lesson/script-vowels');
  await page.keyboard.press('Enter'); // continue past the intro
  await expect(page.locator('.options')).toBeVisible();
  await page.keyboard.press('2');
  await expect(page.locator('.option').nth(1)).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter'); // check
  await expect(page.locator('[data-footer]')).toHaveAttribute('data-state', /right|wrong/);
  await page.keyboard.press('Enter'); // continue
  await expect(page.locator('[data-footer]')).toHaveAttribute('data-state', '');
});

test('pronunciation buttons read the respelling, and the snail plays it slowly', async ({ page }) => {
  await page.goto('/lesson/greetings');
  await expect(page.locator('.intro-hut')).toContainText('bo shuda');
  const last = () => page.evaluate(() => (window as any).__spoken.at(-1) as { text: string; rate: number });
  await page.waitForTimeout(400); // let the card's own auto-play happen first
  await page.getByRole('button', { name: 'Play pronunciation' }).click();
  await expect.poll(async () => (await last()).text).toBe('boh shoo dah');
  expect((await last()).rate).toBeCloseTo(0.85, 2);
  await page.getByRole('button', { name: 'Play slowly' }).click();
  await expect.poll(async () => (await last()).rate).toBeCloseTo(0.55, 2);
  expect((await last()).text).toBe('boh shoo dah');
});
