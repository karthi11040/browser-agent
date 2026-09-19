import type { Page, Locator } from 'playwright';

export interface ElementInfo {
  ref: string;
  version: number;
  role: string;
  name: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  checked?: boolean;
  focused?: boolean;
  type?: string;
  tagName: string;
  rect: { x: number; y: number; width: number; height: number };
}

export interface SnapshotResult {
  version: number;
  url: string;
  title: string;
  treeText: string;
  elements: Map<string, ElementInfo>;
  elementCount: number;
  timestamp: number;
}

export class SnapshotEngine {
  private currentVersion: number = 0;
  private latestSnapshot: SnapshotResult | null = null;

  /**
   * Captures an accessibility-oriented semantic snapshot of the page.
   * Tags interactive and semantic elements with versioned `data-agent-ref` attributes.
   */
  public async takeSnapshot(page: Page): Promise<SnapshotResult> {
    this.currentVersion += 1;
    // Ensure esbuild helper __name is present in browser scope if transpiled by tsx/esbuild
    await page.evaluate('window.__name = window.__name || function(target) { return target; };').catch(() => {});

    const version = this.currentVersion;

    // Run DOM extraction in browser page
    const rawData = await page.evaluate((currentVer: number) => {
      // @ts-ignore
      var __name = window.__name || function(target: any) { return target; };
      // Remove any prior agent refs
      const prevTagged = document.querySelectorAll('[data-agent-ref]');
      prevTagged.forEach((el) => el.removeAttribute('data-agent-ref'));

      let elementIdCounter = 1;
      const extracted: Array<{
        ref: string;
        role: string;
        name: string;
        value?: string;
        placeholder?: string;
        disabled?: boolean;
        checked?: boolean;
        focused?: boolean;
        type?: string;
        tagName: string;
        rect: { x: number; y: number; width: number; height: number };
      }> = [];

      function isVisible(el: HTMLElement): boolean {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false;
        }
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function getAccessibleName(el: HTMLElement): string {
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

        const ariaLabelledby = el.getAttribute('aria-labelledby');
        if (ariaLabelledby) {
          const labellingEl = document.getElementById(ariaLabelledby);
          if (labellingEl && labellingEl.textContent) return labellingEl.textContent.trim();
        }

        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          if (el.placeholder && el.placeholder.trim()) return el.placeholder.trim();
        }

        const title = el.getAttribute('title');
        if (title && title.trim()) return title.trim();

        const alt = el.getAttribute('alt');
        if (alt && alt.trim()) return alt.trim();

        // Use direct visible text content (truncated to reasonable length)
        const text = el.innerText || el.textContent || '';
        return text.replace(/\s+/g, ' ').trim().slice(0, 100);
      }

      function getRole(el: HTMLElement): string {
        const explicitRole = el.getAttribute('role');
        if (explicitRole) return explicitRole.toLowerCase();

        const tag = el.tagName.toLowerCase();
        if (tag === 'button') return 'button';
        if (tag === 'a' && el.hasAttribute('href')) return 'link';
        if (tag === 'select') return 'combobox';
        if (tag === 'textarea') return 'textbox';
        if (tag === 'input') {
          const type = (el.getAttribute('type') || 'text').toLowerCase();
          if (['button', 'submit', 'reset'].includes(type)) return 'button';
          if (['checkbox'].includes(type)) return 'checkbox';
          if (['radio'].includes(type)) return 'radio';
          return 'textbox';
        }
        if (/^h[1-6]$/.test(tag)) return 'heading';
        if (tag === 'img') return 'img';
        if (tag === 'dialog') return 'dialog';
        return 'generic';
      }

      // Query candidate interactive and semantic elements
      const selector = [
        'button',
        'a[href]',
        'input',
        'textarea',
        'select',
        '[role="button"]',
        '[role="link"]',
        '[role="checkbox"]',
        '[role="radio"]',
        '[role="combobox"]',
        '[role="tab"]',
        '[role="menuitem"]',
        '[role="dialog"]',
        '[tabindex]:not([tabindex="-1"])',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'summary',
      ].join(',');

      const candidateElements = Array.from(document.querySelectorAll<HTMLElement>(selector));

      for (const el of candidateElements) {
        if (!isVisible(el)) continue;

        const role = getRole(el);
        const name = getAccessibleName(el);

        // Omit generic elements without names
        if (role === 'generic' && !name) continue;

        const ref = `v${currentVer}:e${elementIdCounter++}`;
        el.setAttribute('data-agent-ref', ref);

        const rect = el.getBoundingClientRect();
        const info: any = {
          ref,
          role,
          name,
          tagName: el.tagName.toLowerCase(),
          rect: {
            x: Math.round(rect.x + window.scrollX),
            y: Math.round(rect.y + window.scrollY),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };

        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          if (el.value) info.value = el.value.slice(0, 100);
          if (el.placeholder) info.placeholder = el.placeholder;
          if (el.disabled) info.disabled = true;
          if (el instanceof HTMLInputElement && el.checked) info.checked = true;
          info.type = el.type;
        } else if (el instanceof HTMLSelectElement) {
          info.value = el.value;
          if (el.disabled) info.disabled = true;
        }

        if (document.activeElement === el) {
          info.focused = true;
        }

        extracted.push(info);
      }

      return {
        url: window.location.href,
        title: document.title || '',
        elements: extracted,
      };
    }, version);

    const elementsMap = new Map<string, ElementInfo>();
    const lines: string[] = [];

    lines.push(`PAGE TITLE: "${rawData.title}"`);
    lines.push(`PAGE URL: ${rawData.url}`);
    lines.push(`SNAPSHOT VERSION: v${version}`);
    lines.push('INTERACTIVE ELEMENTS:');

    if (rawData.elements.length === 0) {
      lines.push('  (No interactive elements detected on page)');
    }

    for (const el of rawData.elements) {
      const elInfo: ElementInfo = {
        ...el,
        version,
      };
      elementsMap.set(el.ref, elInfo);

      // Build compact ARIA description line
      // e.g. - button "Search" [ref=v1:e1]
      //      - textbox "Search query" [ref=v1:e2, value=""]
      const metaParts: string[] = [`ref=${el.ref}`];
      if (el.value !== undefined) metaParts.push(`value="${el.value}"`);
      if (el.placeholder) metaParts.push(`placeholder="${el.placeholder}"`);
      if (el.disabled) metaParts.push('disabled');
      if (el.checked) metaParts.push('checked');
      if (el.focused) metaParts.push('focused');

      const namePart = el.name ? ` "${el.name}"` : '';
      lines.push(`  - ${el.role}${namePart} [${metaParts.join(', ')}]`);
    }

    const treeText = lines.join('\n');
    const result: SnapshotResult = {
      version,
      url: rawData.url,
      title: rawData.title,
      treeText,
      elements: elementsMap,
      elementCount: elementsMap.size,
      timestamp: Date.now(),
    };

    this.latestSnapshot = result;
    return result;
  }

  /**
   * Retrieves the locator for an element by its ref.
   * If ref version doesn't match current snapshot version, flags as stale.
   */
  public getLocatorForRef(
    page: Page,
    ref: string
  ): { locator?: Locator; elementInfo?: ElementInfo; isStale: boolean; error?: string } {
    if (!this.latestSnapshot) {
      return { isStale: true, error: 'No active snapshot available.' };
    }

    const elementInfo = this.latestSnapshot.elements.get(ref);
    if (!elementInfo) {
      return {
        isStale: true,
        error: `Reference "${ref}" not found in current snapshot (version v${this.latestSnapshot.version}).`,
      };
    }

    if (elementInfo.version !== this.latestSnapshot.version) {
      return {
        isStale: true,
        error: `Reference "${ref}" is from snapshot v${elementInfo.version}, but current snapshot is v${this.latestSnapshot.version}.`,
      };
    }

    const locator = page.locator(`[data-agent-ref="${ref}"]`);
    return { locator, elementInfo, isStale: false };
  }

  public getLatestSnapshot(): SnapshotResult | null {
    return this.latestSnapshot;
  }

  public getCurrentVersion(): number {
    return this.currentVersion;
  }
}
