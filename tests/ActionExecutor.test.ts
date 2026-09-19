import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import * as path from 'node:path';
import { SnapshotEngine } from '../src/browser/SnapshotEngine.js';
import { ActionExecutor } from '../src/browser/ActionExecutor.js';
import { SecurityPolicy } from '../src/security/SecurityPolicy.js';

describe('ActionExecutor', () => {
  let browser: Browser;
  let page: Page;
  const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/test-page.html');
  const fixtureUrl = `file://${fixturePath.replace(/\\/g, '/')}`;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    await page.goto(fixtureUrl);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('types text into input and clicks button using bounding-box center coordinates', async () => {
    const engine = new SnapshotEngine();
    const security = new SecurityPolicy();
    const executor = new ActionExecutor(page, engine, security);

    const snapshot = await engine.takeSnapshot(page);
    const elements = Array.from(snapshot.elements.values());

    const searchInput = elements.find((el) => el.placeholder === 'Type search term...');
    const searchBtn = elements.find((el) => el.name === 'Perform Search');

    expect(searchInput).toBeDefined();
    expect(searchBtn).toBeDefined();

    // Type text into search input
    const typeResult = await executor.type(searchInput!.ref, 'Deep Learning');
    expect(typeResult.ok).toBe(true);

    // Verify input value in page
    const actualValue = await page.inputValue('#search-input');
    expect(actualValue).toBe('Deep Learning');

    // Click search button via bounding box center coordinate
    const clickResult = await executor.click(searchBtn!.ref);
    expect(clickResult.ok).toBe(true);

    // Verify dynamic result element appeared
    const resultText = await page.textContent('#results-text');
    expect(resultText).toContain('Search results for: Deep Learning');
  });

  it('handles batch form filling with browser_fill_form', async () => {
    const engine = new SnapshotEngine();
    const security = new SecurityPolicy();
    const executor = new ActionExecutor(page, engine, security);

    const snapshot = await engine.takeSnapshot(page);
    const elements = Array.from(snapshot.elements.values());

    const usernameInput = elements.find((el) => el.placeholder === 'Enter username');
    expect(usernameInput).toBeDefined();

    const fillResult = await executor.fillForm([
      { ref: usernameInput!.ref, value: 'agent_tester' },
    ]);

    expect(fillResult.ok).toBe(true);
    const val = await page.inputValue('#username');
    expect(val).toBe('agent_tester');
  });

  it('rejects stale reference gracefully with clear diagnostic error', async () => {
    const engine = new SnapshotEngine();
    const security = new SecurityPolicy();
    const executor = new ActionExecutor(page, engine, security);

    await engine.takeSnapshot(page);
    const staleResult = await executor.click('v999:e999');

    expect(staleResult.ok).toBe(false);
    expect(staleResult.error).toContain('not found in current snapshot');
  });
});
