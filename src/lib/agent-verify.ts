// ============================================================================
// Action verifier (Phase 3 of the spec)
//
// Runs AFTER every action executes. Compares the pre-action and post-action
// page state and decides whether the action produced a meaningful, verifiable
// outcome.
//
// Critical rule for EXTRACT: an extraction is only verified if the extracted
// text is non-empty AND matches the intent's success pattern (e.g. a price
// regex). Extracting arbitrary page text and declaring "done" is NOT
// verified success — this is the gate that prevents false-positive
// completions when the agent has hit a bot-check page and just reads the
// (now mostly empty) page text.
// ============================================================================

import type { PageState, TaskIntent } from './dom-extract'
import type { AgentAction } from './agent-validate'

export interface VerificationResult {
  verified: boolean
  reason: string
  // Specific deltas observed (for the audit trail)
  deltas: {
    urlChanged?: boolean
    urlFrom?: string
    urlTo?: string
    elementCountDelta?: number
    extractedTextLength?: number
    extractedTextMatchesPattern?: boolean
    patternTested?: string
  }
}

// ---------------------------------------------------------------------------
// Per-action-type verifiers
// ---------------------------------------------------------------------------

function verifyNavigate(
  action: AgentAction,
  pre: PageState,
  post: PageState
): VerificationResult {
  const urlChanged = pre.url !== post.url
  const urlMatch =
    action.url &&
    post.url &&
    (post.url === action.url ||
      post.url.startsWith(action.url) ||
      action.url.startsWith(post.url.replace(/\/$/, '')))

  if (urlChanged && urlMatch) {
    return {
      verified: true,
      reason: `Navigation succeeded: ${pre.url} → ${post.url}`,
      deltas: { urlChanged: true, urlFrom: pre.url, urlTo: post.url },
    }
  }
  if (urlChanged && !urlMatch) {
    return {
      verified: true,
      reason: `Navigation changed URL but not to the intended target: ${pre.url} → ${post.url}`,
      deltas: { urlChanged: true, urlFrom: pre.url, urlTo: post.url },
    }
  }
  return {
    verified: false,
    reason: `Navigation did not change URL (still on ${pre.url})`,
    deltas: { urlChanged: false, urlFrom: pre.url, urlTo: post.url },
  }
}

function verifyClick(
  action: AgentAction,
  pre: PageState,
  post: PageState
): VerificationResult {
  const urlChanged = pre.url !== post.url
  const elementCountDelta = post.elements.length - pre.elements.length

  // Click is verified if either the URL changed OR the page content changed
  // significantly (different elements, or different snapshot text).
  const snapshotChanged = pre.snapshotText !== post.snapshotText

  if (urlChanged || snapshotChanged || Math.abs(elementCountDelta) > 0) {
    return {
      verified: true,
      reason: urlChanged
        ? `Click triggered navigation: ${pre.url} → ${post.url}`
        : `Click changed page content (element delta: ${elementCountDelta})`,
      deltas: {
        urlChanged,
        urlFrom: pre.url,
        urlTo: post.url,
        elementCountDelta,
      },
    }
  }

  return {
    verified: false,
    reason: `Click did not produce any observable page change`,
    deltas: { urlChanged: false, elementCountDelta: 0 },
  }
}

function verifyType(
  action: AgentAction,
  pre: PageState,
  post: PageState
): VerificationResult {
  // Best signal: snapshot text changed
  const snapshotChanged = pre.snapshotText !== post.snapshotText
  if (snapshotChanged) {
    return {
      verified: true,
      reason: `Typing "${action.text}" produced a visible page change`,
      deltas: { elementCountDelta: post.elements.length - pre.elements.length },
    }
  }
  // No observable change — typing might not have hit the field, or the field
  // value doesn't appear in the snapshot
  return {
    verified: false,
    reason: `Typing produced no observable page change (snapshot unchanged)`,
    deltas: { elementCountDelta: 0 },
  }
}

function verifyPress(
  action: AgentAction,
  pre: PageState,
  post: PageState
): VerificationResult {
  // Similar to click — press Enter etc usually triggers navigation or form
  const urlChanged = pre.url !== post.url
  const snapshotChanged = pre.snapshotText !== post.snapshotText
  if (urlChanged || snapshotChanged) {
    return {
      verified: true,
      reason: urlChanged
        ? `Key ${action.key} triggered navigation: ${pre.url} → ${post.url}`
        : `Key ${action.key} produced a visible page change`,
      deltas: {
        urlChanged,
        urlFrom: pre.url,
        urlTo: post.url,
        elementCountDelta: post.elements.length - pre.elements.length,
      },
    }
  }
  return {
    verified: false,
    reason: `Key ${action.key} produced no observable page change`,
    deltas: {},
  }
}

function verifyExtract(
  action: AgentAction,
  pre: PageState,
  post: PageState,
  intent: TaskIntent,
  extractedText: string
): VerificationResult {
  const text = (extractedText ?? '').trim()
  const length = text.length

  if (length === 0) {
    return {
      verified: false,
      reason: 'EXTRACT returned empty text — cannot verify against intent',
      deltas: { extractedTextLength: 0, extractedTextMatchesPattern: false },
    }
  }

  // If the intent has a success pattern, the extracted text MUST match it
  if (intent.successPattern) {
    let regex: RegExp
    try {
      regex = new RegExp(intent.successPattern, 'i')
    } catch {
      // Invalid pattern — fall back to "any non-empty text" verification
      return {
        verified: true,
        reason: `EXTRACT returned ${length} chars (success pattern was invalid: ${intent.successPattern})`,
        deltas: {
          extractedTextLength: length,
          extractedTextMatchesPattern: true,
          patternTested: intent.successPattern,
        },
      }
    }
    const matches = regex.test(text)
    if (matches) {
      return {
        verified: true,
        reason: `EXTRACT returned ${length} chars matching success pattern (${intent.successPatternLabel ?? 'unlabeled'})`,
        deltas: {
          extractedTextLength: length,
          extractedTextMatchesPattern: true,
          patternTested: intent.successPattern,
        },
      }
    }
    return {
      verified: false,
      reason: `EXTRACT returned ${length} chars but did NOT match success pattern (${intent.successPatternLabel ?? intent.successPattern}). This page likely doesn't contain the structured value the task asked for — DO NOT mark as done.`,
      deltas: {
        extractedTextLength: length,
        extractedTextMatchesPattern: false,
        patternTested: intent.successPattern,
      },
    }
  }

  // No success pattern defined — accept any non-empty text as minimally verified
  return {
    verified: true,
    reason: `EXTRACT returned ${length} chars (no success pattern in intent)`,
    deltas: { extractedTextLength: length, extractedTextMatchesPattern: true },
  }
}

function verifyWait(_action: AgentAction, _pre: PageState, _post: PageState): VerificationResult {
  return {
    verified: true,
    reason: 'Wait completed (always verified — no side effects expected)',
    deltas: {},
  }
}

function verifyScroll(_action: AgentAction, _pre: PageState, _post: PageState): VerificationResult {
  return {
    verified: true,
    reason: 'Scroll executed (always verified — no observable change required)',
    deltas: {},
  }
}

function verifyBack(action: AgentAction, pre: PageState, post: PageState): VerificationResult {
  const urlChanged = pre.url !== post.url
  return {
    verified: urlChanged,
    reason: urlChanged
      ? `Back navigation succeeded: ${pre.url} → ${post.url}`
      : `Back did not change URL (already at history start?)`,
    deltas: { urlChanged, urlFrom: pre.url, urlTo: post.url },
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function verifyAction(
  action: AgentAction,
  preState: PageState,
  postState: PageState,
  intent: TaskIntent,
  // For EXTRACT, the actual text returned by the page (not just the snapshot)
  extractedText?: string
): VerificationResult {
  switch (action.type) {
    case 'navigate':
      return verifyNavigate(action, preState, postState)
    case 'click':
    case 'click_text':
    case 'click_role':
      return verifyClick(action, preState, postState)
    case 'type':
      return verifyType(action, preState, postState)
    case 'press':
      return verifyPress(action, preState, postState)
    case 'extract':
      return verifyExtract(action, preState, postState, intent, extractedText ?? '')
    case 'wait':
      return verifyWait(action, preState, postState)
    case 'scroll':
      return verifyScroll(action, preState, postState)
    case 'back':
      return verifyBack(action, preState, postState)
    case 'select':
    case 'check':
    case 'uncheck':
      // Similar to type — verify by snapshot change
      return verifyType(action, preState, postState)
    default:
      return {
        verified: true,
        reason: `${action.type} — no verifier defined, defaulting to verified=true`,
        deltas: {},
      }
  }
}
