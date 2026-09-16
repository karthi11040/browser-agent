// ============================================================================
// Safety policy table (Phase 3 of the spec)
//
// Classifies every agent action as LOW / MEDIUM / HIGH risk. HIGH-risk
// actions (purchase, send, delete, transfer, post_comment, like, follow,
// send_message) require a signed single-use confirmation token before they
// can execute. The policy table is the single source of truth — checks are
// not scattered across the codebase.
// ============================================================================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type AgentActionType =
  | 'navigate'
  | 'click'
  | 'click_text'
  | 'click_role'
  | 'type'
  | 'press'
  | 'extract'
  | 'wait'
  | 'scroll'
  | 'back'
  | 'select'
  | 'check'
  | 'uncheck'
  // High-risk content / social actions
  | 'post_comment'
  | 'like'
  | 'follow'
  | 'send_message'
  | 'send_email'
  // High-risk commerce / destructive actions
  | 'purchase'
  | 'delete'
  | 'transfer'
  // Meta
  | 'done'
  | 'reflect'

export interface SafetyClassification {
  level: RiskLevel
  reason: string
  // True if the action itself is content/social/commerce/destructive — i.e.
  // the action TYPE is high-risk regardless of context.
  intrinsicHigh: boolean
}

// ---------------------------------------------------------------------------
// Intrinsic risk by action type — what the action IS, not where it's aimed.
// ---------------------------------------------------------------------------

const INTRINSIC_HIGH: ReadonlySet<AgentActionType> = new Set([
  'post_comment',
  'like',
  'follow',
  'send_message',
  'send_email',
  'purchase',
  'delete',
  'transfer',
])

const INTRINSIC_MEDIUM: ReadonlySet<AgentActionType> = new Set([
  'type',
  'select',
  'check',
  'uncheck',
  'press',
])

// Everything else (navigate, click, click_text, click_role, extract, wait,
// scroll, back, done, reflect) is LOW intrinsic risk.

// ---------------------------------------------------------------------------
// Contextual escalation
// ---------------------------------------------------------------------------

// Phrases in a click/type target's accessible name / role that escalate a
// normally-LOW action (click) to HIGH risk. Matched case-insensitively as a
// substring against the target's label.
const HIGH_RISK_PHRASES: ReadonlySet<string> = new Set([
  // commerce
  'buy now',
  'purchase',
  'pay',
  'checkout',
  'place order',
  'confirm order',
  'submit payment',
  'complete purchase',
  // destructive
  'delete',
  'remove',
  'cancel order',
  'cancel subscription',
  'unsubscribe',
  'revoke',
  'disconnect',
  // transfer
  'send',
  'transfer',
  'withdraw',
  // engagement / messaging
  'post comment',
  'submit comment',
  'reply',
  'like',
  'follow',
  'message',
  'dm',
  'tweet',
  'publish',
])

// Sites where ANY non-trivial action is gated (login-gated, ToS-restricted,
// or anti-bot-defended — automating them is out of scope per the spec).
const GATED_DOMAIN_PATTERNS: ReadonlyArray<RegExp> = [
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)gmail\.com$/i,
  /(^|\.)google\.com\/.*\/gmail/i,
  /mail\.google\.com$/i,
  /(^|\.)linkedin\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)snapchat\.com$/i,
  /(^|\.)whatsapp\.com$/i,
]

export function isGatedDomain(url: string): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return GATED_DOMAIN_PATTERNS.some((p) => p.test(u.hostname))
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

export interface ClassifyInput {
  actionType: AgentActionType
  // For click/type/etc: the visible text or accessible name of the target
  targetLabel?: string
  // Current page URL — used to detect gated domains
  pageUrl?: string
  // Proposed text input (for type actions) — checked for HIGH-risk keywords
  textValue?: string
}

export function classifyAction(input: ClassifyInput): SafetyClassification {
  const { actionType, targetLabel, pageUrl, textValue } = input

  // Commerce / destructive / engagement actions are intrinsically HIGH
  if (INTRINSIC_HIGH.has(actionType)) {
    return {
      level: 'HIGH',
      reason: `${actionType} is intrinsically high-risk — requires explicit confirmation`,
      intrinsicHigh: true,
    }
  }

  // Gated domains: any action with a target label is HIGH
  if (pageUrl && isGatedDomain(pageUrl) && (actionType === 'click' || actionType === 'type' || actionType === 'press')) {
    return {
      level: 'HIGH',
      reason: `Action targets a gated domain (${pageUrl}) — login-gated sites require manual operation per project safety policy`,
      intrinsicHigh: false,
    }
  }

  // Contextual escalation based on target label
  const label = (targetLabel ?? '').toLowerCase()
  const textLower = (textValue ?? '').toLowerCase()

  for (const phrase of HIGH_RISK_PHRASES) {
    if (label.includes(phrase) || textLower.includes(phrase)) {
      // Don't escalate the word "send" if it's part of an email field label like "sender name"
      // (heuristic — not perfect, but catches the common case of "send" as a button)
      if (phrase === 'send' && label.includes('sender')) continue
      return {
        level: 'HIGH',
        reason: `Target label or text value contains high-risk phrase: "${phrase}"`,
        intrinsicHigh: false,
      }
    }
  }

  // Medium actions (type, select, check, press) — moderate risk
  if (INTRINSIC_MEDIUM.has(actionType)) {
    return {
      level: 'MEDIUM',
      reason: `${actionType} is a form-modifying action — moderate risk`,
      intrinsicHigh: false,
    }
  }

  return {
    level: 'LOW',
    reason: `${actionType} is read-only / navigational`,
    intrinsicHigh: false,
  }
}

// Convenience: returns true if a HIGH-risk action needs a confirmation token
export function requiresConfirmation(input: ClassifyInput): boolean {
  return classifyAction(input).level === 'HIGH'
}

// List all HIGH-risk phrases (exposed for documentation / UI)
export function listHighRiskPhrases(): string[] {
  return Array.from(HIGH_RISK_PHRASES).sort()
}

// List all gated domains (exposed for documentation / UI)
export function listGatedDomains(): string[] {
  return [
    'facebook.com',
    'instagram.com',
    'twitter.com / x.com',
    'gmail.com / mail.google.com',
    'linkedin.com',
    'tiktok.com',
    'snapchat.com',
    'whatsapp.com',
  ]
}
