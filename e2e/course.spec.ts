import { test, expect } from '@playwright/test';
import { ALL_LESSONS } from '../src/data/course';
import { captureSpeech, collectErrors, solveLesson } from './learner';

test('a new learner can complete the whole course in order from the home path', async ({ page }, info) => {
  test.setTimeout(15 * 60_000);
  await captureSpeech(page);
  const errors = await collectErrors(page);
  const shot = new Set<string>();
  const screenshot = async (kind: string, scheme: string) => {
    if (shot.has(kind)) return;
    shot.add(kind);
    await page.waitForTimeout(300); // let the enter animation settle
    await page.screenshot({ path: `screenshots/${info.project.name}-${scheme}/${kind}.png` });
  };

  await page.goto('/');
  await expect(page.locator('[data-welcome]')).toBeVisible();
  // The counters are filled in by a script after load, so wait for the value rather than reading it once.
  const xpOnHome = page.locator('[data-xp]:visible').first();
  await expect(xpOnHome).toHaveText('0');

  // Only the first lesson is open; the second explains why it is locked.
  const node = (id: string) => page.locator(`[data-lesson="${id}"]`);
  await expect(node(ALL_LESSONS[0].id).locator('.node')).toHaveClass(/current/);
  await node(ALL_LESSONS[1].id).locator('.node').click();
  await expect(node(ALL_LESSONS[1].id).locator('.popover')).toContainText('Complete the lessons before this one');

  const seenTypes = new Set<string>();
  let xp = 0;
  for (const [i, lesson] of ALL_LESSONS.entries()) {
    await page.goto('/');
    const n = node(lesson.id);
    await expect(n.locator('.node')).not.toHaveClass(/locked/);
    await expect(n.locator('.node')).toHaveClass(/current/);
    await n.locator('.node').click();
    // The popover must sit fully on screen and its Start button must not be covered by later nodes.
    const start = n.locator('.popover .btn');
    await start.scrollIntoViewIfNeeded();
    const box = (await n.locator('.popover').boundingBox())!;
    const vw = page.viewportSize()!.width;
    expect(box.x, 'popover left edge on screen').toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, 'popover right edge on screen').toBeLessThanOrEqual(vw);
    await start.click({ trial: true });
    await start.click();
    await expect(page).toHaveURL(new RegExp(`/lesson/${lesson.id}/?$`));

    const scheme = i % 2 ? 'dark' : 'light';
    await page.emulateMedia({ colorScheme: scheme });
    const result = await solveLesson(page, { onStep: (k) => screenshot(k, scheme) });
    result.types.forEach((t) => seenTypes.add(t));

    expect(result.endText).toMatch(/lesson complete!/i);
    expect(result.endText).toMatch(/accuracy 100%/i);
    if (i === 0) expect(result.endText).toContain('1 day streak started!');
    const gained = Number(/\+(\d+)/.exec(result.endText)![1]);
    expect(gained).toBeGreaterThan(10);
    xp += gained;

    // First run of a lesson introduces every new word/glyph exactly once.
    const fresh = (lesson.words ?? lesson.phrases ?? lesson.glyphs)!.length;
    expect(result.intros, `${lesson.id} intro cards`).toBe(fresh);

    await page.locator('[data-action]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(xpOnHome).toHaveText(String(xp));
    await expect(node(lesson.id).locator('.node')).toHaveClass(/done/);
  }

  await expect(page.locator('[data-finished]')).toBeVisible();
  await expect(page.locator('.node.locked')).toHaveCount(0);
  await expect(page.locator('[data-streak]:visible').first()).toHaveText('1');

  // Every exercise type turned up somewhere in the course.
  expect([...seenTypes].sort()).toEqual(
    [
      'intro-word', 'intro-glyph', 'hut-en', 'hut-pron', 'en-hut', 'audio-hut', 'script-en', 'glyph-latin',
      'sound-glyph', 'match', 'type', 'build-hut-en', 'build-en-hut', 'build-audio-hut', 'spell',
    ].sort(),
  );
  expect(errors).toEqual([]);
});
