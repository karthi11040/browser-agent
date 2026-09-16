// ============================================================================
// Blocked-page / bot-check detector (Phase 3 of the spec)
//
// After every NAVIGATE, the orchestrator must check whether the page is a
// bot-detection interstitial rather than the intended target. Recognizing
// these pages is the difference between "successful completion" and a false
// positive — a CAPTCHA page that returns 200 OK is NOT a successful nav.
// ============================================================================

export interface BlockedPageCheck {
  blocked: boolean
  reason?: string
  matchedPattern?: string
}

// Regex patterns matched against page title AND visible text. Case-insensitive.
const BLOCKED_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /unusual traffic/i, label: 'google-unusual-traffic' },
  { pattern: /verify you'?re a human/i, label: 'human-verification' },
  { pattern: /verify that you are a human/i, label: 'human-verification-alt' },
  { pattern: /are you a robot/i, label: 'robot-check' },
  { pattern: /are you human/i, label: 'human-check' },
  { pattern: /\bcaptcha\b/i, label: 'captcha' },
  { pattern: /access denied/i, label: 'access-denied' },
  { pattern: /forbidden/i, label: 'forbidden' },
  { pattern: /request blocked/i, label: 'request-blocked' },
  { pattern: /please verify you are not a robot/i, label: 'robot-verification' },
  { pattern: /checking your browser/i, label: 'browser-check' },
  { pattern: /ddos protection/i, label: 'ddos-protection' },
  { pattern: /rate.?limit/i, label: 'rate-limit' },
  { pattern: /too many requests/i, label: 'too-many-requests' },
  { pattern: /temporarily (blocked|restricted|unavailable)/i, label: 'temp-blocked' },
  { pattern: /enable javascript and cookies/i, label: 'js-cookies-required' },
  { pattern: /just a moment/i, label: 'cloudflare-moment' }, // Cloudflare interstitial
]

// Page titles / URL patterns that also indicate a blocked page
const BLOCKED_URL_PATTERNS: ReadonlyArray<RegExp> = [
  /challenge\.cloudflare\.com/i,
  /\/captcha\//i,
  /recaptcha\/api/i,
  /interstitial/i,
]

// Quick exit: page text shorter than this strongly suggests no real content
const MIN_REAL_CONTENT_LEN = 20

export function isBlockedPage(input: {
  title?: string
  text?: string
  url?: string
}): BlockedPageCheck {
  const title = (input.title ?? '').toString().slice(0, 500)
  const text = (input.text ?? '').toString().slice(0, 5000)
  const url = (input.url ?? '').toString().slice(0, 1000)

  // URL-level indicators (fast path)
  for (const p of BLOCKED_URL_PATTERNS) {
    if (p.test(url)) {
      return {
        blocked: true,
        reason: `URL matched blocked-page pattern: ${p.source}`,
        matchedPattern: p.source,
      }
    }
  }

  // Title-level indicators (cheap)
  for (const { pattern, label } of BLOCKED_PATTERNS) {
    if (title && pattern.test(title)) {
      return {
        blocked: true,
        reason: `Page title matched blocked-page pattern (${label})`,
        matchedPattern: label,
      }
    }
  }

  // Body-text indicators (most expensive, last)
  for (const { pattern, label } of BLOCKED_PATTERNS) {
    if (text && pattern.test(text)) {
      // Avoid false positive: a real page can mention "captcha" in passing.
      // Heuristic — if the page text is short AND matches, it's almost
      // certainly an interstitial.
      const looksInterstitial = text.length < 500
      if (looksInterstitial) {
        return {
          blocked: true,
          reason: `Page body matched blocked-page pattern (${label}); page text is short (${text.length} chars) — likely interstitial`,
          matchedPattern: label,
        }
      }
    }
  }

  // Suspiciously empty page after a navigate — likely blocked
  if (!title && (!text || text.trim().length < MIN_REAL_CONTENT_LEN)) {
    return {
      blocked: true,
      reason: `Page rendered with empty title and minimal text (<${MIN_REAL_CONTENT_LEN} chars) — likely blocked or failed navigation`,
      matchedPattern: 'empty-page',
    }
  }

  return { blocked: false }
}
