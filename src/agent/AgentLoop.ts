import type { Page } from 'playwright';
import { BrowserManager } from '../browser/BrowserManager.js';
import { SnapshotEngine, type SnapshotResult } from '../browser/SnapshotEngine.js';
import { ActionExecutor, type ExecutionResult } from '../browser/ActionExecutor.js';
import { OpenRouterClient } from '../llm/OpenRouterClient.js';
import { PromptBuilder } from '../llm/PromptBuilder.js';
import { SecurityPolicy } from '../security/SecurityPolicy.js';
import { RecoveryManager } from './RecoveryManager.js';

export interface AgentStepRecord {
  stepNumber: number;
  toolName: string;
  args: Record<string, any>;
  thought?: string;
  output: string;
  ok: boolean;
  error?: string;
  screenshotPath?: string;
  timestamp: number;
}

export interface AgentRunOptions {
  goal: string;
  initialUrl?: string;
  maxSteps?: number;
  takeScreenshots?: boolean;
  onStep?: (step: AgentStepRecord) => void;
  onFrame?: (frame: { screenshotPath: string; url: string; title: string }) => void;
}

export interface AgentRunResult {
  success: boolean;
  goal: string;
  steps: AgentStepRecord[];
  finalAnswer?: string;
  summary?: string;
  error?: string;
  totalTokens: number;
  durationMs: number;
}

export class AgentLoop {
  private browserManager: BrowserManager;
  private openRouterClient: OpenRouterClient;
  private securityPolicy: SecurityPolicy;
  private snapshotEngine: SnapshotEngine;
  private recoveryManager: RecoveryManager;

  constructor(
    browserManager: BrowserManager,
    openRouterClient: OpenRouterClient,
    securityPolicy?: SecurityPolicy
  ) {
    this.browserManager = browserManager;
    this.openRouterClient = openRouterClient;
    this.securityPolicy = securityPolicy || new SecurityPolicy();
    this.snapshotEngine = new SnapshotEngine();
    this.recoveryManager = new RecoveryManager(4);
  }

  /**
   * Executes the full autonomous agent loop.
   */
  public async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const startTime = Date.now();
    const maxSteps = options.maxSteps ?? 25;
    const steps: AgentStepRecord[] = [];
    const actionHistory: string[] = [];
    let totalTokens = 0;
    let finalAnswer: string | undefined;
    let taskSummary: string | undefined;
    let lastError: string | undefined;

    // 1. Prompt Learning & Strategy Formulation Phase
    const promptAnalysis = await this.openRouterClient.analyzePrompt(options.goal);

    const learnStepRecord: AgentStepRecord = {
      stepNumber: 1,
      toolName: 'learn_prompt',
      args: {
        understanding: promptAnalysis.understanding,
        parameters: promptAnalysis.parameters,
        strategy: promptAnalysis.strategy,
      },
      thought: `🧠 Prompt Learned: ${promptAnalysis.understanding}`,
      output: `📋 Execution Strategy Plan:\n${promptAnalysis.strategy.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n📌 Parameters: ${JSON.stringify(promptAnalysis.parameters)}`,
      ok: true,
      timestamp: Date.now(),
    };

    steps.push(learnStepRecord);
    actionHistory.push(`Prompt Learned: ${promptAnalysis.understanding} | Plan: ${promptAnalysis.strategy.join(' -> ')}`);
    options.onStep?.(learnStepRecord);

    const page = await this.browserManager.getPage();
    const executor = new ActionExecutor(page, this.snapshotEngine, this.securityPolicy);

    // Initial navigation
    const targetUrl = options.initialUrl || promptAnalysis.suggestedUrl || 'https://www.google.com';
    const navResult = await executor.navigate(targetUrl);
    const navStepRecord: AgentStepRecord = {
      stepNumber: steps.length + 1,
      toolName: 'browser_navigate',
      args: { url: targetUrl },
      thought: `Navigating to starting URL for task: ${targetUrl}`,
      output: navResult.output || navResult.error || '',
      ok: navResult.ok,
      error: navResult.error,
      timestamp: Date.now(),
    };

    if (options.takeScreenshots) {
      navStepRecord.screenshotPath = await this.browserManager.captureScreenshot(`step-${navStepRecord.stepNumber}`).catch(() => undefined);
      if (navStepRecord.screenshotPath && options.onFrame) {
        const url = page.url();
        const title = await page.title().catch(() => '');
        options.onFrame({ screenshotPath: navStepRecord.screenshotPath, url, title });
      }
    }

    steps.push(navStepRecord);
    actionHistory.push(`Navigate to ${targetUrl} -> ${navResult.ok ? 'Success' : 'Failed'}`);
    options.onStep?.(navStepRecord);

    if (!navResult.ok) {
      return {
        success: false,
        goal: options.goal,
        steps,
        error: `Failed to navigate to target URL: ${navResult.error}`,
        totalTokens: 0,
        durationMs: Date.now() - startTime,
      };
    }

    const systemPrompt = PromptBuilder.buildSystemPrompt(promptAnalysis.strategy.join('\n'));

    // Main autonomous decision-action cycle
    while (steps.length < maxSteps) {
      const currentStepNum = steps.length + 1;

      // 1. Capture fresh semantic accessibility snapshot
      const snapshot: SnapshotResult = await this.snapshotEngine.takeSnapshot(page);

      // 2. Build prompt context
      const userPrompt = PromptBuilder.buildUserStepPrompt(
        options.goal,
        snapshot.treeText,
        actionHistory,
        lastError
      );

      // 3. Ask OpenRouter for next action
      let prediction;
      try {
        prediction = await this.openRouterClient.predictNextAction(
          systemPrompt,
          userPrompt,
          actionHistory
        );
      } catch (err: any) {
        return {
          success: false,
          goal: options.goal,
          steps,
          error: `OpenRouter model inference failed: ${err?.message || err}`,
          totalTokens,
          durationMs: Date.now() - startTime,
        };
      }

      if (prediction.usage?.totalTokens) {
        totalTokens += prediction.usage.totalTokens;
      }

      const { toolName, args, thought } = prediction;

      // 4. Check for repetitive action loop or completion prompt hint
      const repetition = this.recoveryManager.recordAction(toolName, args);
      if (repetition.hint) {
        lastError = repetition.hint;
      } else if (repetition.isRepeating) {
        lastError = `Loop detected: action ${toolName} with identical args was repeated multiple times. Choose a different step or call browser_done.`;
      }

      // 5. Execute action
      const executionResult: ExecutionResult = await executor.execute(toolName, args);

      // 6. Handle step recording & screenshots
      let screenshotPath: string | undefined;
      if (options.takeScreenshots || !executionResult.ok) {
        screenshotPath = await this.browserManager
          .captureScreenshot(`step-${currentStepNum}`)
          .catch(() => undefined);

        if (screenshotPath && options.onFrame) {
          const url = page.url();
          const title = await page.title().catch(() => '');
          options.onFrame({ screenshotPath, url, title });
        }
      }

      const stepRecord: AgentStepRecord = {
        stepNumber: currentStepNum,
        toolName,
        args,
        thought,
        output: executionResult.output || executionResult.error || '',
        ok: executionResult.ok,
        error: executionResult.error,
        screenshotPath,
        timestamp: Date.now(),
      };

      steps.push(stepRecord);
      options.onStep?.(stepRecord);

      // 7. Evaluate success or failure
      if (executionResult.ok) {
        this.recoveryManager.recordSuccess();
        lastError = undefined;

        const summaryText = executionResult.output || `${toolName} succeeded`;
        actionHistory.push(`${toolName} (${JSON.stringify(args)}) -> ${summaryText}`);

        // Check if agent completed the mission
        if (toolName === 'browser_done') {
          finalAnswer = args.finalAnswer || args.summary || executionResult.output;
          taskSummary = args.summary || 'Task completed successfully.';
          return {
            success: true,
            goal: options.goal,
            steps,
            finalAnswer,
            summary: taskSummary,
            totalTokens,
            durationMs: Date.now() - startTime,
          };
        }
      } else {
        const errorMsg = executionResult.error || 'Action failed with unspecified error.';
        lastError = errorMsg;
        actionHistory.push(`${toolName} (${JSON.stringify(args)}) -> FAILED: ${errorMsg}`);

        const recoveryAdvice = this.recoveryManager.recordFailure(errorMsg);
        if (recoveryAdvice.shouldAbort) {
          return {
            success: false,
            goal: options.goal,
            steps,
            error: recoveryAdvice.reason || 'Terminated due to consecutive failures.',
            totalTokens,
            durationMs: Date.now() - startTime,
          };
        }

        if (recoveryAdvice.promptHint) {
          lastError = `${errorMsg}\n[ADVICE: ${recoveryAdvice.promptHint}]`;
        }
      }
    }

    return {
      success: false,
      goal: options.goal,
      steps,
      error: `Agent reached maximum step limit (${maxSteps}) without calling browser_done.`,
      totalTokens,
      durationMs: Date.now() - startTime,
    };
  }

  public getSnapshotEngine(): SnapshotEngine {
    return this.snapshotEngine;
  }
}
