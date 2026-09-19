import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { BrowserManager } from '../src/browser/BrowserManager.js';
import { OpenRouterClient } from '../src/llm/OpenRouterClient.js';
import { SecurityPolicy } from '../src/security/SecurityPolicy.js';
import { AgentLoop } from '../src/agent/AgentLoop.js';

describe('AgentLoop Integration', () => {
  const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/test-page.html');
  const fixtureUrl = `file://${fixturePath.replace(/\\/g, '/')}`;

  it('autonomously completes multi-step web task using snapshots and ref clicks', async () => {
    const browserManager = new BrowserManager({ headless: true });
    const securityPolicy = new SecurityPolicy({ allowFileProtocol: true });
    const openRouterClient = new OpenRouterClient();

    let stepCount = 0;

    // Simulated LLM reasoning over real accessibility snapshots
    openRouterClient.setMockHandler(async (promptText: string) => {
      stepCount += 1;

      // Parse current snapshot from prompt
      if (stepCount === 1) {
        // Find search input ref
        const inputMatch = promptText.match(/textbox[\s\S]*?\[ref=(v\d+:e\d+)/);
        const ref = inputMatch ? inputMatch[1] : 'v1:e2';
        return {
          thought: 'I will enter "Playwright Agent" into the search field.',
          toolName: 'browser_type',
          args: { ref, text: 'Playwright Agent' },
        };
      }

      if (stepCount === 2) {
        // Find search button ref
        const btnMatch = promptText.match(/button "Perform Search" \[ref=(v\d+:e\d+)/);
        const ref = btnMatch ? btnMatch[1] : 'v2:e1';
        return {
          thought: 'I will click the Perform Search button.',
          toolName: 'browser_click',
          args: { ref, element: 'Perform Search button' },
        };
      }

      // Step 3: Goal accomplished, finish task
      return {
        thought: 'Search results are visible. Task is complete.',
        toolName: 'browser_done',
        args: {
          summary: 'Successfully searched for Playwright Agent and retrieved results.',
          finalAnswer: 'Found search results for: Playwright Agent.',
          sources: [fixtureUrl],
        },
      };
    });

    const agent = new AgentLoop(browserManager, openRouterClient, securityPolicy);

    try {
      const result = await agent.run({
        goal: 'Search for Playwright Agent and report the results',
        initialUrl: fixtureUrl,
        maxSteps: 5,
      });

      expect(result.success).toBe(true);
      expect(result.steps.length).toBe(5); // 1 prompt learn + 1 initial navigation + 3 autonomous steps
      expect(result.finalAnswer).toContain('Playwright Agent');
      expect(result.summary).toContain('Successfully searched');
    } finally {
      await browserManager.close();
    }
  }, 30000);
});
