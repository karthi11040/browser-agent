// ============================================================================
// Recovery state machine (Phase 3 of the spec)
//
// States:
//   NORMAL        — happy path, agent is acting on a real page
//   BLOCKED       — bot-check / interstitial detected after a NAVIGATE
//   RECOVERING    — trying alternate DOMAIN_SEEDS before escalating
//   ESCALATED     — out of seeds, agent is waiting for human input
//   DONE          — task complete with verified results
//   FAILED        — task cannot complete (exhausted retries or hard error)
//
// Transitions (driven by the orchestrator):
//   NORMAL → BLOCKED          on isBlockedPage() returning true
//   BLOCKED → RECOVERING      when DOMAIN_SEEDS has more entries to try
//   RECOVERING → NORMAL       on successful non-blocked navigation
//   RECOVERING → ESCALATED    when DOMAIN_SEEDS exhausted
//   NORMAL → DONE             on a verified DONE action
//   any → FAILED              on hard error or step-cap exceeded
//
// The state machine is BOUNDED: per-failure-type retry counters prevent
// infinite loops. A hard wall-clock timeout applies independent of step
// count, so the agent can never run forever.
// ============================================================================

import type { TaskIntent } from './dom-extract'

export type RecoveryState =
  | 'NORMAL'
  | 'BLOCKED'
  | 'RECOVERING'
  | 'ESCALATED'
  | 'DONE'
  | 'FAILED'

export interface RecoveryTransition {
  from: RecoveryState
  to: RecoveryState
  reason: string
  at: number
}

export interface RecoverySnapshot {
  state: RecoveryState
  // Which DOMAIN_SEED we're currently trying (index into the seed list)
  seedIdx: number
  // How many times we've been blocked (total, for audit)
  blockedCount: number
  // How many times we've recovered
  recoveredCount: number
  // Bounded retries per failure type
  retries: {
    blocked: number
    staleTarget: number
    actionFailure: number
    consecutiveFailures: number
  }
  // Transition history (audit trail)
  transitions: RecoveryTransition[]
}

export const MAX_BLOCKED_RETRIES = 3
export const MAX_CONSECUTIVE_FAILURES = 3
export const MAX_STEPS_PER_RUN = 24
export const WALL_CLOCK_TIMEOUT_MS = 90_000 // 90 seconds per run

export function createRecoverySnapshot(): RecoverySnapshot {
  return {
    state: 'NORMAL',
    seedIdx: 0,
    blockedCount: 0,
    recoveredCount: 0,
    retries: { blocked: 0, staleTarget: 0, actionFailure: 0, consecutiveFailures: 0 },
    transitions: [],
  }
}

function record(
  snap: RecoverySnapshot,
  to: RecoveryState,
  reason: string
): void {
  const from = snap.state
  snap.state = to
  snap.transitions.push({ from, to, reason, at: Date.now() })
}

// Default DOMAIN_SEEDS — fallback URLs the agent can try if the user's
// intended seed gets blocked. Kept short for the demo; in production these
// would be domain-specific (e.g. for travel: redbus, makemytrip, rome2rio).
const DEFAULT_DOMAIN_SEEDS: ReadonlyArray<{ domain: string; url: string }> = [
  { domain: 'wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
  { domain: 'hn', url: 'https://news.ycombinator.com' },
  { domain: 'example', url: 'https://example.com' },
]

export function getDomainSeeds(intent: TaskIntent): string[] {
  // For now, the user's seedUrl (if any) is tried first; then defaults.
  const seeds: string[] = []
  if (intent.seedUrl) seeds.push(intent.seedUrl)
  for (const s of DEFAULT_DOMAIN_SEEDS) {
    if (!seeds.includes(s.url)) seeds.push(s.url)
  }
  return seeds
}

// Transition: BLOCKED → RECOVERING (try next seed)
export function onBlocked(snap: RecoverySnapshot, reason: string): {
  state: RecoveryState
  nextSeed?: string
  exhausted: boolean
} {
  snap.blockedCount += 1
  snap.retries.blocked += 1

  const seeds = getDomainSeeds({
    domain: 'general',
    keyTerms: [],
    seedUrl: undefined,
  })
  const nextIdx = snap.seedIdx + 1
  if (nextIdx < seeds.length) {
    snap.seedIdx = nextIdx
    record(snap, 'RECOVERING', `blocked, switching to seed #${nextIdx}: ${reason}`)
    return { state: 'RECOVERING', nextSeed: seeds[nextIdx], exhausted: false }
  }
  record(snap, 'ESCALATED', `all seeds exhausted after ${snap.blockedCount} blocks`)
  return { state: 'ESCALATED', exhausted: true }
}

// Transition: RECOVERING → NORMAL (navigation succeeded)
export function onRecoverySucceeded(snap: RecoverySnapshot): void {
  snap.recoveredCount += 1
  snap.retries.blocked = 0
  record(snap, 'NORMAL', 'recovered after BLOCKED — new seed loaded successfully')
}

// Transition: NORMAL → BLOCKED (blocked again despite recovery)
export function onBlockedAgain(snap: RecoverySnapshot, reason: string): void {
  snap.blockedCount += 1
  record(snap, 'BLOCKED', reason)
}

// Transition: action failed (target not found, click missed, etc.)
export function onActionFailure(snap: RecoverySnapshot, reason: string): {
  state: RecoveryState
  exhausted: boolean
} {
  snap.retries.actionFailure += 1
  snap.retries.consecutiveFailures += 1

  if (snap.retries.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    record(snap, 'FAILED', `${MAX_CONSECUTIVE_FAILURES} consecutive failures: ${reason}`)
    return { state: 'FAILED', exhausted: true }
  }
  // Stay in current state, just record
  return { state: snap.state, exhausted: false }
}

// Transition: action succeeded (resets consecutive failure counter)
export function onActionSuccess(snap: RecoverySnapshot): void {
  snap.retries.consecutiveFailures = 0
}

// Transition: DONE
export function onDone(snap: RecoverySnapshot, reason: string): void {
  record(snap, 'DONE', reason)
}

// Transition: FAILED
export function onFailed(snap: RecoverySnapshot, reason: string): void {
  record(snap, 'FAILED', reason)
}

// Is the run out of time?
export function isTimedOut(startedAt: number, now: number = Date.now()): boolean {
  return now - startedAt > WALL_CLOCK_TIMEOUT_MS
}

// Is the run out of steps?
export function isStepCapped(stepCount: number): boolean {
  return stepCount >= MAX_STEPS_PER_RUN
}

// Public: is the run in a terminal state?
export function isTerminal(snap: RecoverySnapshot): boolean {
  return snap.state === 'DONE' || snap.state === 'FAILED' || snap.state === 'ESCALATED'
}
