import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import * as path from 'node:path';
import { SnapshotEngine } from '../src/browser/SnapshotEngine.js';

describe('SnapshotEngine', () => {
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

  it('captures semantic accessibility snapshot with versioned refs', async () => {
    const engine = new SnapshotEngine();
    const snapshot = await engine.takeSnapshot(page);

    expect(snapshot.version).toBe(1);
    expect(snapshot.title).toBe('Autonomous Agent Test Lab');
    expect(snapshot.elementCount).toBeGreaterThan(3);

    // Verify presence of buttons and inputs
    const elements = Array.from(snapshot.elements.values());
    const searchBtn = elements.find((el) => el.name === 'Perform Search');
    expect(searchBtn).toBeDefined();
    expect(searchBtn?.role).toBe('button');
    expect(searchBtn?.ref).toMatch(/^v1:e\d+$/);

    const searchInput = elements.find((el) => el.placeholder === 'Type search term...');
    expect(searchInput).toBeDefined();
    expect(searchInput?.role).toBe('textbox');

    // Verify treeText formatting
    expect(snapshot.treeText).toContain('PAGE TITLE: "Autonomous Agent Test Lab"');
    expect(snapshot.treeText).toContain('SNAPSHOT VERSION: v1');
    expect(snapshot.treeText).toContain('Perform Search');
  });

  it('resolves Playwright locators for valid refs', async () => {
    const engine = new SnapshotEngine();
    const snapshot = await engine.takeSnapshot(page);

    const firstRef = Array.from(snapshot.elements.keys())[0];
    const lookup = engine.getLocatorForRef(page, firstRef);

    expect(lookup.isStale).toBe(false);
    expect(lookup.locator).toBeDefined();
    expect(lookup.elementInfo?.ref).toBe(firstRef);
  });

  it('correctly detects stale references when snapshot version advances', async () => {
    const engine = new SnapshotEngine();
    const snapV1 = await engine.takeSnapshot(page);
    const v1Ref = Array.from(snapV1.elements.keys())[0];

    // Trigger fresh snapshot, advancing version to v2
    const snapV2 = await engine.takeSnapshot(page);
    expect(snapV2.version).toBe(2);

    // Old v1 ref should now be flagged as stale
    const staleLookup = engine.getLocatorForRef(page, v1Ref);
    expect(staleLookup.isStale).toBe(true);
    expect(staleLookup.error).toContain('not found in current snapshot');
  });
});
