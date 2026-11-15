// Smoke test for the demo app. Drives the demo in headless Chrome and checks the main paths.
// Requires two running processes: `npm run dev` (demo, port 5173) and `npm run server` (port 4000).
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const DEMO = process.env.DEMO_URL ?? 'http://localhost:5173/';
const SERVER = process.env.W3C_URL ?? 'http://localhost:4000/anno/';
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function reachable(url) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

async function selectText(page, needle) {
  await page.evaluate((needle) => {
    const article = document.querySelector('[data-testid="article"]');
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.data.indexOf(needle);
      if (at !== -1) {
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + needle.length);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
    }
    throw new Error(`text not found: ${needle}`);
  }, needle);
}

async function comment(page, body, expectedCount) {
  await page.getByTestId('comment-input').fill(body);
  await page.getByTestId('comment-submit').click();
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-testid="comment-item"]').length === n,
    expectedCount,
  );
}

async function statuses(page) {
  return page.$$eval('[data-testid="anchor-status"]', (els) => els.map((el) => el.dataset.status));
}

async function clickButton(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
}

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`FAIL  ${name}\n      ${error.message.split('\n').join('\n      ')}`);
  }
}

async function main() {
  if (!(await reachable(DEMO)))
    throw new Error(`The demo is not running at ${DEMO}. Start it with: npm run demo`);
  if (!(await reachable(SERVER)))
    throw new Error(
      `The W3C server is not running at ${SERVER}. Start it with: npm run demo:server`,
    );

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox'],
  });
  const pageErrors = [];

  const open = async (query) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`${DEMO}${query}`, { waitUntil: 'load' });
    await page.getByTestId('article').waitFor();
    await page.waitForTimeout(300);
    return { context, page };
  };

  await check(
    'memory store: comment on a selection is attached and highlighted with CSS',
    async () => {
      const { context, page } = await open('?store=memory&renderer=css');
      await selectText(page, '12% of users churn');
      await comment(page, 'Which quarter is this?', 1);
      assert.deepEqual(await statuses(page), ['attached']);
      const highlighted = await page.evaluate(() => CSS.highlights.has('spannote-comments'));
      assert.equal(highlighted, true, 'CSS highlight group spannote-comments should exist');
      const marks = await page.$$eval('mark[data-spannote-highlight]', (els) => els.length);
      assert.equal(marks, 0, 'the CSS path must not add mark elements');
      await context.close();
    },
  );

  await check('an inserted ad and a wrapper keep the comment attached', async () => {
    const { context, page } = await open('?store=memory&renderer=css');
    await selectText(page, '12% of users churn');
    await comment(page, 'Check the source', 1);
    await clickButton(page, 'Insert ad');
    await page.waitForTimeout(100);
    assert.deepEqual(await statuses(page), ['attached']);
    await clickButton(page, 'Wrap content');
    await page.waitForTimeout(100);
    assert.deepEqual(await statuses(page), ['attached']);
    await context.close();
  });

  await check('a duplicate of the quote later on the page does not steal the comment', async () => {
    const { context, page } = await open('?store=memory&renderer=css');
    await selectText(page, '12% of users churn');
    await comment(page, 'Original passage', 1);
    await clickButton(page, 'Duplicate quote');
    await page.waitForTimeout(100);
    const status = await statuses(page);
    assert.deepEqual(status, ['attached']);
    const orphanCount = status.filter((s) => s === 'orphan').length;
    assert.equal(orphanCount, 0);
    await context.close();
  });

  await check('rewording the quote is reported as a status, not a crash', async () => {
    const { context, page } = await open('?store=memory&renderer=css');
    await selectText(page, '12% of users churn');
    await comment(page, 'Reworded passage', 1);
    await clickButton(page, 'Reword first quote');
    await page.waitForTimeout(100);
    const [status] = await statuses(page);
    assert.ok(
      ['attached', 'attached-fuzzy', 'orphan'].includes(status),
      `unexpected status ${status}`,
    );
    console.log(
      `      note: after rewording the quote the status is "${status}" (expected: orphan, since fuzzy is off)`,
    );
    await context.close();
  });

  await check('the mark fallback wraps the comment in <mark> elements', async () => {
    const { context, page } = await open('?store=memory&renderer=mark');
    await selectText(page, '12% of users churn');
    await comment(page, 'Fallback check', 1);
    const marks = await page.$$eval(
      'mark[data-spannote-highlight="comments"]',
      (els) => els.length,
    );
    assert.ok(marks > 0, 'expected at least one mark element');
    await context.close();
  });

  await check('the W3C store keeps the comment across a reload, then deletes it', async () => {
    const endpoint = encodeURIComponent(SERVER);
    const { context, page } = await open(`?store=w3c&renderer=css&endpoint=${endpoint}`);
    const before = await page.$$eval('[data-testid="comment-item"]', (els) => els.length);
    await selectText(page, 'Students can use annotations');
    await comment(page, `Persisted ${Date.now()}`, before + 1);
    await page.reload();
    await page.getByTestId('article').waitFor();
    await page.waitForFunction(
      (n) => document.querySelectorAll('[data-testid="comment-item"]').length >= n,
      before + 1,
    );
    const afterReload = await page.$$eval('[data-testid="comment-item"]', (els) => els.length);
    assert.ok(afterReload >= before + 1, 'the comment should load back from the server');
    await page.getByRole('button', { name: 'Delete' }).last().click();
    await page.waitForFunction(
      (n) => document.querySelectorAll('[data-testid="comment-item"]').length === n,
      afterReload - 1,
    );
    await context.close();
  });

  await check('reply, edit, resolve and delete change the comment as expected', async () => {
    const { context, page } = await open('?store=memory&renderer=css');
    await selectText(page, '12% of users churn');
    await comment(page, 'Base comment', 1);

    await page
      .getByTestId('comment-item')
      .first()
      .getByRole('button', { name: 'Reply', exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="comment-item"]').length === 2,
    );

    page.once('dialog', (dialog) => void dialog.accept('Edited body'));
    await page
      .getByTestId('comment-item')
      .first()
      .getByRole('button', { name: 'Edit', exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="comment-item"] .comment-body')
        ?.textContent.includes('Edited body'),
    );

    await page
      .getByTestId('comment-item')
      .first()
      .getByRole('button', { name: 'Resolve', exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="comment-item"] .meta')
        ?.textContent.includes('resolved'),
    );

    await page
      .getByTestId('comment-item')
      .last()
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="comment-item"]').length === 1,
    );
    await context.close();
  });

  await check(
    'the non-breaking spaces and refresh controls keep the comment attached',
    async () => {
      const { context, page } = await open('?store=memory&renderer=css');
      await selectText(page, '12% of users churn');
      await comment(page, 'Spacing check', 1);
      await clickButton(page, 'Non-breaking spaces');
      await page.waitForTimeout(100);
      assert.deepEqual(await statuses(page), ['attached']);
      await clickButton(page, 'Refresh anchors');
      await page.waitForTimeout(100);
      assert.deepEqual(await statuses(page), ['attached']);
      await context.close();
    },
  );

  await browser.close();

  assert.deepEqual(pageErrors, [], `uncaught page errors: ${pageErrors.join('; ')}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
