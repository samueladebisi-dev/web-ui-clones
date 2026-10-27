// Behaviour checks for the clones, run in a headless browser.
//
//   npm run test:interactions
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const checks = {
  // HTML/CSS only, so check the layout instead: no sideways scrolling at
  // phone or desktop width, and the shop boxes go from four per row to one.
  async amazon(page) {
    const rowCount = () =>
      page.locator('.box').evaluateAll((boxes) => new Set(boxes.map((b) => b.offsetTop)).size);
    for (const [width, perRow] of [[1280, 4], [800, 2], [390, 1]]) {
      await page.setViewportSize({ width, height: 800 });
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
      if (scroll > width) throw new Error(`${width}px: page is ${scroll}px wide`);
      expect(await rowCount(), 12 / perRow, `${width}px: rows of shop boxes`);
    }
  },

  // The theme button switches to dark mode and the choice survives a reload;
  // the stories arrows scroll the strip, and the left arrow only shows once
  // there is something to scroll back to.
  async instagram(page) {
    const dark = () => page.evaluate(() => document.documentElement.classList.contains('darkTheme'));
    expect(await dark(), false, 'dark theme on first visit');
    await page.locator('.header__theme-button').first().click();
    expect(await dark(), true, 'dark theme after toggle');
    await page.reload();
    expect(await dark(), true, 'dark theme after reload');
    await page.locator('.header__theme-button').first().click();
    await page.reload();
    expect(await dark(), false, 'dark theme after toggling back and reloading');

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();
    const strip = page.locator('.stories__content');
    const left = page.locator('.stories__left-button');
    const scrollLeft = () => strip.evaluate((el) => el.scrollLeft);
    await page.waitForTimeout(300); // IntersectionObserver callbacks
    expect(await scrollLeft(), 0, 'stories start position');
    expect(await left.isVisible(), false, 'left arrow visible at start');
    await page.locator('.stories__right-button').click();
    await page.waitForTimeout(800); // smooth scrolling
    if ((await scrollLeft()) <= 0) throw new Error('right arrow did not scroll the stories');
    expect(await left.isVisible(), true, 'left arrow visible after scrolling');
    await left.click();
    await page.waitForTimeout(800);
    expect(await scrollLeft(), 0, 'stories position after scrolling back');
  },

  // Clicking a question opens its answer and turns the plus into a cross;
  // clicking again closes it. Other answers stay closed.
  async netflix(page) {
    const questions = page.locator('.FAQ__title');
    const first = questions.nth(0);
    const answer = page.locator('.FAQ__visible').nth(0);
    const height = () => answer.evaluate((el) => el.clientHeight);
    const iconAngle = () =>
      first.locator('.FAQ__icon').evaluate((el) => getComputedStyle(el).transform);

    expect(await questions.count(), 6, 'FAQ questions');
    expect(await first.getAttribute('aria-expanded'), 'false', 'initial state');
    expect(await height(), 0, 'answer height before click');

    await first.click();
    await page.waitForTimeout(700); // max-height and icon transitions
    expect(await first.getAttribute('aria-expanded'), 'true', 'state after first click');
    if ((await height()) < 20) throw new Error('answer did not open');
    if (!(await iconAngle()).startsWith('matrix(0.7')) throw new Error('icon did not rotate');
    expect(
      await page.locator('.FAQ__visible').nth(1).evaluate((el) => el.clientHeight),
      0,
      'second answer height',
    );

    await first.click();
    await page.waitForTimeout(700);
    expect(await first.getAttribute('aria-expanded'), 'false', 'state after second click');
    expect(await height(), 0, 'answer height after second click');
  },
};

function expect(actual, wanted, what) {
  if (actual !== wanted) throw new Error(`${what}: expected ${wanted}, got ${actual}`);
}

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

let failed = 0;
try {
  for (const [clone, run] of Object.entries(checks)) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${base}${clone}/`, { waitUntil: 'load' });
      await run(page);
      console.log(`ok    ${clone}`);
    } catch (err) {
      failed++;
      console.log(`FAIL  ${clone}\n        ${err.message}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

const total = Object.keys(checks).length;
console.log(`\n${total - failed}/${total} checks passed`);
process.exit(failed ? 1 : 0);
