export interface RecoveryState {
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
  recentActions: string[];
  lastActionSignature?: string;
  repetitionCount: number;
}

export interface RecoveryAdvice {
  shouldAbort: boolean;
  reason?: string;
  recommendedAction?: 'refresh_snapshot' | 'wait' | 'scroll' | 'none';
  promptHint?: string;
}

export class RecoveryManager {
  private state: RecoveryState;

  constructor(maxConsecutiveFailures: number = 3) {
    this.state = {
      consecutiveFailures: 0,
      maxConsecutiveFailures,
      recentActions: [],
      repetitionCount: 0,
    };
  }

  /**
   * Records an action attempt and detects repetitive loops.
   */
  public recordAction(toolName: string, args: Record<string, any>): { isRepeating: boolean; hint?: string } {
    const signature = `${toolName}:${JSON.stringify(args)}`;

    if (this.state.lastActionSignature === signature || (toolName === 'browser_snapshot' && this.state.lastActionSignature?.startsWith('browser_snapshot'))) {
      this.state.repetitionCount += 1;
    } else {
      this.state.repetitionCount = 0;
    }

    this.state.lastActionSignature = signature;
    this.state.recentActions.push(signature);
    if (this.state.recentActions.length > 10) {
      this.state.recentActions.shift();
    }

    const isRepeating = this.state.repetitionCount >= 2;
    let hint: string | undefined;
    if (toolName === 'browser_snapshot' && this.state.repetitionCount >= 1) {
      hint = 'The accessibility snapshot is already captured and the page content is visible. Call browser_done now with your final answer.';
    }

    return { isRepeating, hint };
  }

  /**
   * Called when an action succeeds. Resets failure counters.
   */
  public recordSuccess(): void {
    this.state.consecutiveFailures = 0;
  }

  /**
   * Called when an action fails. Computes recovery advice.
   */
  public recordFailure(errorMsg: string): RecoveryAdvice {
    this.state.consecutiveFailures += 1;

    if (this.state.consecutiveFailures >= this.state.maxConsecutiveFailures) {
      return {
        shouldAbort: true,
        reason: `Exceeded maximum consecutive failures (${this.state.maxConsecutiveFailures}). Last error: ${errorMsg}`,
      };
    }

    // Check for stale reference errors
    const isStaleRef = errorMsg.toLowerCase().includes('stale') || errorMsg.toLowerCase().includes('not found in current snapshot');
    if (isStaleRef) {
      return {
        shouldAbort: false,
        recommendedAction: 'refresh_snapshot',
        promptHint: 'The element reference you targeted was stale or from an earlier version. Inspect the fresh snapshot.',
      };
    }

    // Check for element not clickable / out of view
    const isObscured = errorMsg.toLowerCase().includes('clickable') || errorMsg.toLowerCase().includes('obscured');
    if (isObscured) {
      return {
        shouldAbort: false,
        recommendedAction: 'scroll',
        promptHint: 'Element may be covered or out of view. Try waiting, scrolling, or pressing Enter.',
      };
    }

    // Repetitive failure
    if (this.state.repetitionCount >= 1) {
      return {
        shouldAbort: false,
        recommendedAction: 'wait',
        promptHint: 'You have attempted the same action multiple times without success. Choose an alternative action.',
      };
    }

    return {
      shouldAbort: false,
      recommendedAction: 'none',
    };
  }

  public getConsecutiveFailures(): number {
    return this.state.consecutiveFailures;
  }

  public reset(): void {
    this.state.consecutiveFailures = 0;
    this.state.repetitionCount = 0;
    this.state.lastActionSignature = undefined;
    this.state.recentActions = [];
  }
}
