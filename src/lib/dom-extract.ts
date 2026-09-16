// ============================================================================
// DOM-first extraction (Phase 2 of the spec)
//
// Extracts visible, interactive elements from the live accessibility tree
// returned by `agent-browser snapshot --json`. Each element gets a STABLE id
// (hash of role+tag+DOM-path+truncated-text) so the same underlying element
// resolves to the same id across observations — never array index.
//
// Then ranks elements by relevance to the task intent (keyword match, role
// compatibility, clickability, price-pattern boost for the demo task family)
// and emits a compact top-K state.
// ============================================================================

import { createHash } from 'crypto'

// ---------------------------------------------------------------------------
// Types (mirror packages/types from the spec, kept here in a single module)
// ---------------------------------------------------------------------------

export interface PageElement {
  id: string // stable hash, never array index
  role: string // aria role or implicit (button, link, textbox, etc.)
  name: string // accessible name (visible text / aria-label / placeholder)
  tag?: string // HTML tag (button, a, input, select, textarea, ...)
  inputType?: string // for inputs: text, email, password, checkbox, etc.
  href?: string // for links
  placeholder?: string
  ref: string // the agent-browser ref e1, e2 — used for click/type
  // Relevance score (filled by scoreElement, not by extraction)
  score?: number
  // Why this score (filled by scoreElement)
  scoreReason?: string[]
}

export interface PageState {
  url: string
  title: string
  elements: PageElement[]
  // Original raw snapshot text (human-readable form, for LLM context)
  snapshotText: string
  // Whether the page looks blocked (computed by caller, not here)
  blocked?: boolean
  blockedReason?: string
}

export interface TaskIntent {
  // Decomposed from the user's prompt. NEVER the raw natural-language string
  // — only structured hints, so nothing downstream can reconstruct a literal
  // search-engine query from user free text.
  domain: string // 'travel' | 'commerce' | 'research' | 'general' ...
  keyTerms: string[] // extracted keywords, lowercase
  // Optional success pattern — for EXTRACT verification (Phase 3)
  successPattern?: string // regex source, e.g. '\\$?\\d+(?:\\.\\d+)?'
  successPatternLabel?: string // human description, e.g. 'price'
  // Optional seed URL hint extracted from the prompt
  seedUrl?: string
}

// ---------------------------------------------------------------------------
// Stable ID generation
// ---------------------------------------------------------------------------

function stableId(parts: string[]): string {
  const hash = createHash('sha1')
    .update(parts.join('|'))
    .digest('hex')
    .slice(0, 12)
  return `el_${hash}`
}

// ---------------------------------------------------------------------------
// Extraction from agent-browser snapshot JSON
// ---------------------------------------------------------------------------

export interface RawSnapshot {
  data?: {
    origin?: string
    refs?: Record<string, { role?: string; name?: string }>
    snapshot?: string
  }
  success?: boolean
}

function parseAgentBrowserSnapshot(raw: any): RawSnapshot {
  // agent-browser --json returns {success, data: {origin, refs, snapshot}}
  // The "refs" object maps ref IDs (e1, e2) to {role, name}.
  if (raw && typeof raw === 'object' && raw.data) {
    return raw as RawSnapshot
  }
  return { data: {} }
}

function isInteractiveRole(role: string): boolean {
  const r = role.toLowerCase()
  return [
    'button',
    'link',
    'textbox',
    'checkbox',
    'radio',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'tab',
    'option',
    'combobox',
    'listbox',
    'searchbox',
    'spinbutton',
    'slider',
    'switch',
    'toggle',
    'treeitem',
    'heading',
  ].includes(r)
}

function inferImplicitRole(role: string | undefined, name: string): string {
  // The agent-browser snapshot only includes elements with refs (interactive
  // ones). Heading is included because it's the implicit "header" of the page.
  if (role) return role.toLowerCase()
  if (!name) return 'unknown'
  return 'element'
}

function inferTag(snapshotText: string, ref: string): { tag?: string; inputType?: string } {
  // The human-readable snapshot form is "- role \"name\" [ref=...]" — we don't
  // get the HTML tag from it. In practice this isn't critical: we have role +
  // name + ref which is enough for the policy. Leave tag undefined unless we
  // see something we recognize.
  return {}
}

export function extractPageElements(snapshot: RawSnapshot): PageState {
  const data = snapshot.data ?? {}
  const refs = data.refs ?? {}
  const elements: PageElement[] = []

  for (const [refId, info] of Object.entries(refs)) {
    const role = ((info as any).role ?? '').toString().toLowerCase()
    const name = ((info as any).name ?? '').toString()
    const tagInfo = inferTag(data.snapshot ?? '', refId)

    // Filter: keep interactive roles only
    if (!isInteractiveRole(role)) continue

    const id = stableId([role, tagInfo.tag ?? '', name.slice(0, 80), refId])

    elements.push({
      id,
      role,
      name,
      ref: refId,
      tag: tagInfo.tag,
      inputType: tagInfo.inputType,
      placeholder: tagInfo.tag === 'input' && !name ? '(input)' : undefined,
    })
  }

  return {
    url: typeof data.origin === 'string' ? data.origin : '',
    title: '', // not directly in snapshot; caller can enrich
    elements,
    snapshotText: typeof data.snapshot === 'string' ? data.snapshot : '',
  }
}

// ---------------------------------------------------------------------------
// Intent decomposition
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'with', 'at', 'by',
  'from', 'as', 'into', 'about', 'than', 'then', 'so', 'if', 'this',
  'that', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we', 'us',
  'our', 'you', 'your', 'he', 'she', 'they', 'them', 'what', 'which',
  'who', 'when', 'where', 'why', 'how', 'do', 'does', 'did', 'can',
  'could', 'should', 'would', 'will', 'just', 'tell', 'show', 'give',
  'list', 'find', 'get', 'make', 'go', 'open', 'visit',
])

const DOMAIN_HINTS: Array<{ keywords: string[]; domain: string }> = [
  { keywords: ['bus', 'flight', 'train', 'ticket', 'price', 'cheapest', 'fare', 'route'], domain: 'travel' },
  { keywords: ['buy', 'shop', 'product', 'cart', 'checkout', 'amazon', 'ebay'], domain: 'commerce' },
  { keywords: ['research', 'summarize', 'summary', 'wikipedia', 'article', 'read'], domain: 'research' },
  { keywords: ['comment', 'like', 'follow', 'post', 'message'], domain: 'social' },
  { keywords: ['form', 'fill', 'submit', 'register', 'signup', 'login'], domain: 'forms' },
]

const SUCCESS_PATTERNS: Array<{ pattern: string; label: string; keywords: string[] }> = [
  // Price: $123, ₹456, €78, 99.99, 1,234
  {
    pattern: String.raw`(?:[$₹€£¥]\s?\d{1,3}(?:[,.]\d{3})*(?:\.\d+)?)|(?:\d{1,3}(?:[,.]\d{3})*\.\d{2}\s?(?:USD|INR|EUR|GBP|JPY|AUD|CAD))`,
    label: 'price',
    keywords: ['price', 'cost', 'cheapest', 'fare', 'fee', 'cheap', 'expensive'],
  },
  // Date: tomorrow, today, Sep 16, 2026, etc.
  {
    pattern: String.raw`(?:tomorrow|today|yesterday|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2})`,
    label: 'date',
    keywords: ['when', 'date', 'tomorrow', 'today'],
  },
  // Title / heading — any non-empty text after a heading role
  { pattern: String.raw`^.+$`, label: 'any-non-empty', keywords: ['title', 'name', 'about'] },
]

export function decomposeIntent(prompt: string): TaskIntent {
  const text = prompt.toLowerCase()
  const tokens = text.split(/[^a-z0-9]+/i).filter(Boolean)
  const keyTerms = tokens.filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
  const uniqueKeyTerms = Array.from(new Set(keyTerms)).slice(0, 12)

  // Detect domain
  let domain = 'general'
  let bestScore = 0
  for (const hint of DOMAIN_HINTS) {
    const score = hint.keywords.filter((k) => text.includes(k)).length
    if (score > bestScore) {
      bestScore = score
      domain = hint.domain
    }
  }

  // Detect success pattern (if any)
  let successPattern: string | undefined
  let successPatternLabel: string | undefined
  for (const sp of SUCCESS_PATTERNS) {
    if (sp.keywords.some((k) => text.includes(k))) {
      successPattern = sp.pattern
      successPatternLabel = sp.label
      break
    }
  }

  // Extract a seed URL if the prompt mentions one
  const urlMatch = prompt.match(/https?:\/\/[^\s)"']+/i)
  const seedUrl = urlMatch ? urlMatch[0] : undefined

  return {
    domain,
    keyTerms: uniqueKeyTerms,
    successPattern,
    successPatternLabel,
    seedUrl,
  }
}

// ---------------------------------------------------------------------------
// Relevance scorer
// ---------------------------------------------------------------------------

function tokenizeLabel(label: string): string[] {
  return label
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2)
}

function scoreElement(el: PageElement, intent: TaskIntent): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  const labelTokens = tokenizeLabel(el.name)
  if (labelTokens.length === 0 && el.role !== 'heading') {
    // No label, no relevance signal
    return { score: 0, reasons: ['no label'] }
  }

  // 1. Keyword-term match (most important)
  let keywordHits = 0
  for (const term of intent.keyTerms) {
    if (el.name.toLowerCase().includes(term)) {
      keywordHits += 1
      score += 10
    }
    const matchedTokens = labelTokens.filter((t) => t === term || t.includes(term) || term.includes(t))
    keywordHits += matchedTokens.length
    score += matchedTokens.length * 3
  }
  if (keywordHits > 0) reasons.push(`+${keywordHits} keyword hits`)

  // 2. Role compatibility
  const roleBoosts: Record<string, number> = {
    link: 2,
    button: 2,
    textbox: 1.5,
    combobox: 1.5,
    listbox: 1,
    option: 1,
    heading: 1.5, // headings often describe sections
  }
  if (roleBoosts[el.role]) {
    score += roleBoosts[el.role]
    reasons.push(`+${roleBoosts[el.role]} role ${el.role}`)
  }

  // 3. Price-pattern boost (for the demo task family — price comparisons)
  if (intent.successPatternLabel === 'price') {
    if (/\d+(?:[.,]\d+)?/.test(el.name) || /price|cost|fare|fee|\$|₹|€/i.test(el.name)) {
      score += 8
      reasons.push('+8 price-pattern match')
    }
  }

  // 4. Clickability — interactive roles get a small bonus
  if (['button', 'link', 'menuitem', 'tab', 'option'].includes(el.role)) {
    score += 1
    reasons.push('+1 clickability')
  }

  return { score, reasons }
}

// ---------------------------------------------------------------------------
// Compact state — top-K elements by score, with original ordering preserved
// ---------------------------------------------------------------------------

export interface CompactState {
  url: string
  title: string
  // Top-K elements sorted by relevance score (desc), then by original order
  topElements: PageElement[]
  // Count of all visible interactive elements (for the LLM to know)
  totalElements: number
  // Full human-readable snapshot text (truncated) for context
  snapshotText: string
}

export function compactState(
  state: PageState,
  intent: TaskIntent,
  topK = 25
): CompactState {
  const scored = state.elements.map((el) => {
    const { score, reasons } = scoreElement(el, intent)
    return { el, score, reasons }
  })

  // Sort by score desc, then by name asc for stable ordering
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.el.name.localeCompare(b.el.name)
  })

  const top = scored.slice(0, topK).map(({ el, score, reasons }) => ({
    ...el,
    score,
    scoreReason: reasons,
  }))

  return {
    url: state.url,
    title: state.title,
    topElements: top,
    totalElements: state.elements.length,
    snapshotText: state.snapshotText,
  }
}

// ---------------------------------------------------------------------------
// Helper used by the verifier / validator — find a single element by id or ref
// ---------------------------------------------------------------------------

export function findElement(
  state: PageState,
  predicate: { id?: string; ref?: string; role?: string; name?: string }
): PageElement | undefined {
  return state.elements.find((el) => {
    if (predicate.id && el.id === predicate.id) return true
    if (predicate.ref && el.ref === predicate.ref) return true
    if (
      predicate.role &&
      predicate.name &&
      el.role === predicate.role.toLowerCase() &&
      el.name.toLowerCase().includes(predicate.name.toLowerCase())
    )
      return true
    return false
  })
}
