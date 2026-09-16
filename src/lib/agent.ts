import { getZAI } from './zai'
import {
  createBrowserSession,
  navigate as browserNavigate,
  snapshotInteractive,
  snapshotText,
  screenshot as browserScreenshot,
  clickByRef,
  clickByText,
  clickByRole,
  typeIntoField,
  pressKey,
  waitMs,
  getUrl,
  closeSession,
  type BrowserSession,
} from './browser-client'

// ============================================================================
// Types
// ============================================================================

export type AgentMode = 'general' | 'research' | 'code' | 'summarize' | 'browser'

export interface AgentSource {
  title: string
  url: string
  snippet?: string
}

export interface AgentStep {
  id: string
  action:
    | 'plan'
    | 'search'
    | 'read'
    | 'think'
    | 'compose'
    | 'navigate'
    | 'click'
    | 'type'
    | 'press'
    | 'extract'
    | 'reflect'
  intent: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  detail?: string
  output?: string
  sources?: AgentSource[]
  screenshotPath?: string
  pageUrl?: string
  startedAt?: number
  endedAt?: number
}

export type AgentEvent =
  | { type: 'step_start'; step: AgentStep }
  | { type: 'step_progress'; stepId: string; message: string }
  | { type: 'step_complete'; stepId: string; step: AgentStep }
  | { type: 'step_error'; stepId: string; error: string }
  | { type: 'screenshot'; stepId: string; webPath: string; pageUrl?: string }
  | { type: 'final'; content: string; sources: AgentSource[] }
  | { type: 'done'; runId: string }
  | { type: 'error'; error: string }

// ============================================================================
// Mode presets
// ============================================================================

const MODE_PRESETS: Record<AgentMode, { label: string; preamble: string }> = {
  general: {
    label: 'General',
    preamble:
      'You are a versatile autonomous agent. Use tools (web search, page reader) when you need fresh information, otherwise rely on reasoning.',
  },
  research: {
    label: 'Research',
    preamble:
      'You are a research agent. Prioritize web search and reading authoritative pages. Cite sources inline as [1], [2]. Verify claims across at least two sources when possible.',
  },
  code: {
    label: 'Code',
    preamble:
      'You are a coding agent. Prefer reasoning. Only use web search when the user references a library, version, or API you may not know. Output final answer as markdown with code blocks.',
  },
  summarize: {
    label: 'Summarize',
    preamble:
      'You are a summarization agent. If the user provides a URL, read it first. If they provide long text, reason over it. Produce a structured markdown summary with headings, key points, and a takeaway.',
  },
  browser: {
    label: 'Browser',
    preamble:
      'You are an autonomous browser agent. You drive a real headless Chrome via the available actions (navigate, click, type, press, extract). After each action you receive an updated snapshot of interactive elements. Decide your next action step-by-step until the task is done, then call done with the final markdown answer.',
  },
}

export function getModePreset(mode: AgentMode) {
  return MODE_PRESETS[mode] ?? MODE_PRESSETS.general ?? MODE_PRESETS.general
}

export function listModes() {
  return (Object.keys(MODE_PRESETS) as AgentMode[]).map((k) => ({
    key: k,
    ...MODE_PRESETS[k],
  }))
}

// ============================================================================
// Planner — ask the LLM to produce a strict JSON plan
// ============================================================================

interface PlannerStepRaw {
  action: 'search' | 'read' | 'think'
  intent: string
  params: { query?: string; url?: string; instruction?: string }
}

interface PlannerOutput {
  steps: PlannerStepRaw[]
}

const PLANNER_SYSTEM = `You are an autonomous task planner. The user will give you a task. You must produce a strict JSON plan of AT MOST 4 steps to accomplish it.

Each step MUST be one of:
- { "action": "search", "intent": "<why this search is needed>", "params": { "query": "<search query string>" } }
- { "action": "read",   "intent": "<why this URL matters>",      "params": { "url": "<absolute URL>" } }
- { "action": "think",  "intent": "<what reasoning is needed>", "params": { "instruction": "<what the LLM should reason about>" } }

Rules:
- Only output JSON. No prose, no code fences.
- Schema: { "steps": PlannerStepRaw[] }
- If the task needs no external data, return exactly ONE "think" step.
- If the task references a URL, the FIRST step MUST be "read" for that URL.
- Otherwise prefer 1-2 "search" steps then 1 "think" step for synthesis.
- Never include a step with action "plan" or "compose" — those are reserved.
- Queries and instructions must be in the same language as the user's task.`

export async function planSteps(
  userPrompt: string,
  mode: AgentMode
): Promise<PlannerStepRaw[]> {
  const zai = await getZAI()
  const preset = getModePreset(mode)

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: PLANNER_SYSTEM },
      {
        role: 'system',
        content: `Agent mode: ${mode}. Mode guidance: ${preset.preamble}`,
      },
      {
        role: 'user',
        content: `Task:\n"""\n${userPrompt}\n"""\n\nReturn the JSON plan now.`,
      },
    ],
    temperature: 0.2,
  })

  const raw: string =
    completion?.choices?.[0]?.message?.content ??
    completion?.message?.content ??
    ''

  // Extract JSON even if the LLM wraps it in stray text
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    // Fall back to a single think step
    return [
      {
        action: 'think',
        intent: 'Answer the task directly',
        params: { instruction: userPrompt },
      },
    ]
  }

  let parsed: PlannerOutput
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return [
      {
        action: 'think',
        intent: 'Answer the task directly',
        params: { instruction: userPrompt },
      },
    ]
  }

  const steps = Array.isArray(parsed.steps) ? parsed.steps : []
  const cleaned = steps
    .filter(
      (s) =>
        s &&
        typeof s === 'object' &&
        ['search', 'read', 'think'].includes(s.action)
    )
    .slice(0, 4)
    .map((s) => ({
      action: s.action,
      intent: String(s.intent ?? '').slice(0, 200),
      params: {
        query: s.params?.query ? String(s.params.query) : undefined,
        url: s.params?.url ? String(s.params.url) : undefined,
        instruction: s.params?.instruction
          ? String(s.params.instruction)
          : undefined,
      },
    })) as PlannerStepRaw[]

  if (cleaned.length === 0) {
    return [
      {
        action: 'think',
        intent: 'Answer the task directly',
        params: { instruction: userPrompt },
      },
    ]
  }

  return cleaned
}

// ============================================================================
// Step executors
// ============================================================================

let stepCounter = 0
function nextId() {
  stepCounter += 1
  return `step-${stepCounter}`
}

function truncate(text: string, n = 6000) {
  if (text.length <= n) return text
  return text.slice(0, n) + `\n…[truncated ${text.length - n} chars]`
}

export async function executeSearch(
  step: PlannerStepRaw
): Promise<{ output: string; sources: AgentSource[] }> {
  const zai = await getZAI()
  const query = step.params.query ?? step.intent
  const results = await zai.functions.invoke('web_search', {
    query,
    num: 6,
  })

  const sources: AgentSource[] = (results ?? []).map((r: any) => ({
    title: r.name ?? r.url,
    url: r.url,
    snippet: r.snippet,
  }))

  const serialized = (results ?? [])
    .slice(0, 6)
    .map((r: any, i: number) => {
      const snip = r.snippet ? `\n   snippet: ${r.snippet}` : ''
      return `[${i + 1}] ${r.name}\n   url: ${r.url}${snip}`
    })
    .join('\n\n')

  return {
    output: `Web search results for "${query}":\n\n${serialized}`,
    sources,
  }
}

export async function executeRead(
  step: PlannerStepRaw
): Promise<{ output: string; sources: AgentSource[] }> {
  const zai = await getZAI()
  const url = step.params.url ?? ''
  if (!url) {
    return { output: 'No URL provided for read step.', sources: [] }
  }
  const result = await zai.functions.invoke('page_reader', { url })

  const title = result?.data?.title ?? url
  const html = result?.data?.html ?? ''
  // Strip HTML tags to plain text
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return {
    output: `Page content for ${url} (title: ${title}):\n\n${truncate(text, 7000)}`,
    sources: [{ title, url, snippet: text.slice(0, 200) }],
  }
}

export async function executeThink(
  step: PlannerStepRaw,
  context: string
): Promise<{ output: string }> {
  const zai = await getZAI()
  const instruction = step.params.instruction ?? step.intent
  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content:
          'You are a focused reasoning step inside an autonomous agent. Produce concise, factual intermediate analysis (max 200 words). No headings.',
      },
      {
        role: 'user',
        content: `Instruction: ${instruction}\n\nContext so far:\n${truncate(
          context,
          6000
        )}`,
      },
    ],
    temperature: 0.3,
  })

  const text =
    completion?.choices?.[0]?.message?.content ??
    completion?.message?.content ??
    ''
  return { output: text || '(no output)' }
}

// ============================================================================
// Composer — produce the final markdown answer
// ============================================================================

const COMPOSER_SYSTEM = `You are the final composer of an autonomous agent. You receive the user's original task and intermediate step outputs. Synthesize a single, well-structured Markdown answer.

Rules:
- Use clear Markdown: a top-level title, short intro, sections with ## headings, bullet points where useful.
- Cite sources inline as [1], [2], etc., matching the source list at the end.
- If the task asks for code, wrap it in fenced code blocks with the correct language tag.
- If the task asks for a list or table, produce one.
- Stay on-topic. Do not invent facts beyond what was gathered or your general knowledge.
- Match the user's language.`

export async function composeFinal({
  userPrompt,
  mode,
  stepOutputs,
  sources,
}: {
  userPrompt: string
  mode: AgentMode
  stepOutputs: string
  sources: AgentSource[]
}): Promise<string> {
  const zai = await getZAI()
  const preset = getModePreset(mode)

  const sourceBlock =
    sources.length === 0
      ? '(no external sources)'
      : sources
          .map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`)
          .join('\n')

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: COMPOSER_SYSTEM },
      { role: 'system', content: `Mode guidance: ${preset.preamble}` },
      {
        role: 'user',
        content: `Original task:\n"""\n${userPrompt}\n"""\n\nIntermediate step outputs:\n${stepOutputs}\n\nSources:\n${sourceBlock}\n\nWrite the final Markdown answer now.`,
      },
    ],
    temperature: 0.4,
  })

  const text =
    completion?.choices?.[0]?.message?.content ??
    completion?.message?.content ??
    ''

  return text || '(empty response)'
}

// ============================================================================
// Browser-mode orchestrator — interactive LLM loop with real Chrome
// ============================================================================

const BROWSER_AGENT_SYSTEM = `You are an autonomous browser agent driving a real headless Chrome browser.

You receive the user's task and the CURRENT page state (URL, title, and a list of interactive elements with refs like @e1, @e2). You must decide ONE next action.

Available actions (return strict JSON only, no prose, no code fence):
- { "action": "navigate", "url": "<absolute URL>" }
- { "action": "click",   "ref": "@e1" }                          // by ref from current snapshot
- { "action": "click_text", "text": "<visible text>" }           // click by visible text
- { "action": "click_role", "role": "<role>", "name": "<name>" } // e.g. role=button name="Search"
- { "action": "type",    "ref": "@e1", "text": "<text>" }
- { "action": "press",   "key": "Enter" }                        // or "Tab","Escape","Control+a", etc.
- { "action": "extract", "why": "<why you want to read this page>" } // returns visible text
- { "action": "wait",    "ms": 1500 }                            // wait for page to settle
- { "action": "done",    "answer": "<final markdown answer>" }   // task complete

Rules:
- ALWAYS return exactly ONE action object as JSON.
- If you don't know what's on the page yet, the FIRST action should be "navigate" to a sensible URL.
- Only use "done" when the user's task is fully completed.
- Stay within 12 actions max. Prefer fewer steps.
- Never attempt login to social media / email providers (Facebook, Instagram, Gmail, Twitter/X, etc.) — refuse those tasks politely with a "done" action explaining the limitation.
- For real-world commerce (booking, payment) demonstrate the flow but stop before the final payment step.
- Match the user's language for the final answer.`

interface BrowserAction {
  action:
    | 'navigate'
    | 'click'
    | 'click_text'
    | 'click_role'
    | 'type'
    | 'press'
    | 'extract'
    | 'wait'
    | 'done'
  url?: string
  ref?: string
  text?: string
  role?: string
  name?: string
  key?: string
  why?: string
  ms?: number
  answer?: string
}

function snapshotToBrief(snap: any): {
  url: string
  title: string
  elements: string[]
  snapshotText: string
} {
  // agent-browser --json returns:
  // { success, data: { origin, refs: { e1: { role, name }, ... }, snapshot: "<text>" } }
  const data = snap?.data ?? {}
  const refs = data.refs ?? {}
  const elements: string[] = []
  for (const [refId, info] of Object.entries(refs)) {
    const role = (info as any)?.role ?? 'element'
    const name = ((info as any)?.name ?? '').toString().slice(0, 80)
    elements.push(`@${refId} ${role}${name ? ` "${name}"` : ''}`)
  }
  return {
    url: typeof data.origin === 'string' ? data.origin : '',
    title: '',
    elements: elements.slice(0, 50),
    snapshotText: typeof data.snapshot === 'string' ? data.snapshot : '',
  }
}

async function decideBrowserAction(
  userPrompt: string,
  history: string,
  pageBrief: {
    url: string
    title: string
    elements: string[]
    snapshotText: string
  },
  extractedText?: string
): Promise<BrowserAction> {
  const zai = await getZAI()
  const pageBlock = `CURRENT PAGE
URL: ${pageBrief.url || '(about:blank)'}
Title: ${pageBrief.title || '(none)'}
Interactive elements (use these refs in click/type actions):
${pageBrief.elements.length > 0 ? pageBrief.elements.join('\n') : '(none captured)'}

Full accessibility tree (for context):
${pageBrief.snapshotText ? truncate(pageBrief.snapshotText, 2000) : '(empty)'}`

  const extractedBlock = extractedText
    ? `\n\nVISIBLE TEXT (truncated):\n${truncate(extractedText, 4000)}`
    : ''

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: BROWSER_AGENT_SYSTEM },
      { role: 'system', content: `Mode guidance: ${MODE_PRESETS.browser.preamble}` },
      {
        role: 'user',
        content: `USER TASK:\n"""\n${userPrompt}\n"""\n\nACTIONS TAKEN SO FAR:\n${history || '(none — this is the first action)'}\n\n${pageBlock}${extractedBlock}\n\nDecide your next action. Return JSON only.`,
      },
    ],
    temperature: 0.2,
  })

  const raw: string =
    completion?.choices?.[0]?.message?.content ??
    completion?.message?.content ??
    ''

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { action: 'done', answer: `(agent could not parse its next action; raw: ${raw.slice(0, 200)})` }
  }
  try {
    return JSON.parse(jsonMatch[0]) as BrowserAction
  } catch {
    return { action: 'done', answer: `(agent returned malformed action; raw: ${raw.slice(0, 200)})` }
  }
}

async function* runBrowserAgent(
  userPrompt: string,
  steps: AgentStep[],
  sources: AgentSource[],
  stepOutputs: string[]
): AsyncGenerator<AgentEvent> {
  const runId = `br-${Date.now()}`
  let session: BrowserSession
  try {
    session = createBrowserSession(runId)
  } catch (err: any) {
    yield { type: 'error', error: `Browser session init failed: ${err?.message ?? err}` }
    return
  }

  const MAX_ACTIONS = 12
  let history = ''
  let finalContent = ''

  for (let i = 0; i < MAX_ACTIONS; i += 1) {
    // Get current page state
    let pageBrief: {
      url: string
      title: string
      elements: string[]
      snapshotText: string
    } = {
      url: '',
      title: '',
      elements: [],
      snapshotText: '',
    }
    let extractedText: string | undefined
    if (i > 0) {
      const snap = snapshotInteractive(session)
      if (snap.ok && snap.snapshot) {
        pageBrief = snapshotToBrief(snap.snapshot)
      }
    }

    // Ask LLM for next action
    const decideStep: AgentStep = {
      id: nextId(),
      action: 'reflect',
      intent: `Decide action #${i + 1}`,
      status: 'running',
      startedAt: Date.now(),
    }
    steps.push(decideStep)
    yield { type: 'step_start', step: decideStep }
    yield { type: 'step_progress', stepId: decideStep.id, message: 'Deciding next action…' }

    let action: BrowserAction
    try {
      action = await decideBrowserAction(userPrompt, history, pageBrief, extractedText)
    } catch (err: any) {
      decideStep.status = 'failed'
      decideStep.endedAt = Date.now()
      decideStep.detail = err?.message ?? 'decide failed'
      yield { type: 'step_error', stepId: decideStep.id, error: decideStep.detail }
      yield { type: 'error', error: decideStep.detail }
      try { closeSession(session) } catch {}
      return
    }

    decideStep.status = 'completed'
    decideStep.endedAt = Date.now()
    decideStep.output = JSON.stringify(action)
    decideStep.detail = `Action: ${action.action}`
    yield { type: 'step_complete', stepId: decideStep.id, step: decideStep }

    // If done — compose final
    if (action.action === 'done') {
      finalContent = action.answer ?? '(no answer provided)'
      history += `\n${i + 1}. DONE — final answer delivered`
      break
    }

    // Execute the action as a step
    const step: AgentStep = {
      id: nextId(),
      action: action.action as any,
      intent: describeAction(action),
      status: 'running',
      startedAt: Date.now(),
    }
    steps.push(step)
    yield { type: 'step_start', step }
    yield { type: 'step_progress', stepId: step.id, message: `${action.action}…` }

    let output = ''
    let failed = false
    let errorMsg = ''
    try {
      switch (action.action) {
        case 'navigate': {
          const target = action.url ?? ''
          if (!target) throw new Error('navigate requires url')
          const r = browserNavigate(session, target)
          output = `Navigated to ${target}`
          if (!r.ok) {
            failed = true
            errorMsg = r.stderr || 'navigate failed'
          }
          break
        }
        case 'click': {
          if (!action.ref) throw new Error('click requires ref')
          const r = clickByRef(session, action.ref)
          output = `Clicked ${action.ref}`
          if (!r.ok) { failed = true; errorMsg = r.stderr || 'click failed' }
          break
        }
        case 'click_text': {
          if (!action.text) throw new Error('click_text requires text')
          const r = clickByText(session, action.text)
          output = `Clicked element with text "${action.text}"`
          if (!r.ok) { failed = true; errorMsg = r.stderr || 'click_text failed' }
          break
        }
        case 'click_role': {
          if (!action.role || !action.name) throw new Error('click_role requires role + name')
          const r = clickByRole(session, action.role, action.name)
          output = `Clicked ${action.role} "${action.name}"`
          if (!r.ok) { failed = true; errorMsg = r.stderr || 'click_role failed' }
          break
        }
        case 'type': {
          if (!action.ref || action.text === undefined) throw new Error('type requires ref + text')
          const r = typeIntoField(session, action.ref, action.text)
          output = `Typed "${action.text}" into ${action.ref}`
          if (!r.ok) { failed = true; errorMsg = r.stderr || 'type failed' }
          break
        }
        case 'press': {
          if (!action.key) throw new Error('press requires key')
          const r = pressKey(session, action.key)
          output = `Pressed ${action.key}`
          if (!r.ok) { failed = true; errorMsg = r.stderr || 'press failed' }
          break
        }
        case 'extract': {
          const r = snapshotText(session)
          output = truncate(r.text || '', 6000)
          extractedText = r.text
          if (!r.ok) { failed = true; errorMsg = r.stderr || 'extract failed' }
          break
        }
        case 'wait': {
          const ms = Number(action.ms) || 1500
          waitMs(session, ms)
          output = `Waited ${ms}ms`
          break
        }
        default:
          throw new Error(`Unknown action: ${(action as any).action}`)
      }
    } catch (err: any) {
      failed = true
      errorMsg = err?.message ?? 'action failed'
      output = errorMsg
    }

    // Take a screenshot after the action (or attempt)
    let screenshotPath: string | undefined
    let pageUrl: string | undefined
    try {
      const ss = browserScreenshot(session, steps.length)
      if (ss.ok && ss.webPath) {
        screenshotPath = ss.webPath
        step.screenshotPath = screenshotPath
        const urlInfo = getUrl(session)
        if (urlInfo.ok && urlInfo.url) {
          pageUrl = urlInfo.url
          step.pageUrl = pageUrl
        }
        yield {
          type: 'screenshot',
          stepId: step.id,
          webPath: screenshotPath,
          pageUrl,
        }
      }
    } catch {
      /* ignore screenshot failures */
    }

    // Mark sources for navigate/extract
    if (action.action === 'navigate' && action.url) {
      const src: AgentSource = { title: action.url, url: action.url }
      if (!sources.some((x) => x.url === src.url)) sources.push(src)
      step.sources = [src]
    }

    step.status = failed ? 'failed' : 'completed'
    step.endedAt = Date.now()
    step.output = output
    if (failed) step.detail = errorMsg

    history += `\n${i + 1}. ${output}${failed ? ` (FAILED: ${errorMsg})` : ''}`
    stepOutputs.push(`### ${action.action.toUpperCase()}: ${step.intent}\n${output}`)

    if (failed) {
      yield { type: 'step_error', stepId: step.id, error: errorMsg }
    } else {
      yield { type: 'step_complete', stepId: step.id, step }
    }

    // If too many consecutive failures, bail out
    if (failed) {
      const recentFail = steps.slice(-3).filter((s) => s.status === 'failed').length
      if (recentFail >= 3) {
        finalContent = `(agent stopped: 3 consecutive action failures)\n\nLast history:\n${history}`
        break
      }
    }
  }

  // Close the browser session
  try {
    closeSession(session)
  } catch {}

  // Emit final
  if (!finalContent) {
    finalContent = `(agent reached the action limit of ${MAX_ACTIONS} without calling done)\n\nHistory:\n${history}`
  }

  yield { type: 'final', content: finalContent, sources }

  // Clean up screenshots directory after a short delay (so the UI can show them)
  // Actually, leave them — they're persisted with the run via stepsJson
}

function describeAction(a: BrowserAction): string {
  switch (a.action) {
    case 'navigate': return `Navigate to ${a.url}`
    case 'click': return `Click ${a.ref}`
    case 'click_text': return `Click "${a.text}"`
    case 'click_role': return `Click ${a.role} "${a.name}"`
    case 'type': return `Type into ${a.ref}`
    case 'press': return `Press ${a.key}`
    case 'extract': return a.why ? `Extract page text (${a.why})` : 'Extract page text'
    case 'wait': return `Wait ${a.ms ?? 1500}ms`
    case 'done': return 'Done — deliver final answer'
    default: return 'Action'
  }
}

// ============================================================================
// Orchestrator — yields events as the agent runs
// ============================================================================

export async function* runAgent(
  userPrompt: string,
  mode: AgentMode
): AsyncGenerator<AgentEvent> {
  const steps: AgentStep[] = []
  const sources: AgentSource[] = []
  const stepOutputs: string[] = []

  // ---- Browser mode: interactive LLM loop with real Chrome ----
  if (mode === 'browser') {
    yield* runBrowserAgent(userPrompt, steps, sources, stepOutputs)
    ;(runAgent as any).__lastSteps = steps
    ;(runAgent as any).__lastSources = sources
    return
  }

  // ---- Plan step (other modes) ----
  const planStep: AgentStep = {
    id: nextId(),
    action: 'plan',
    intent: 'Plan the steps needed to complete the task',
    status: 'running',
    startedAt: Date.now(),
  }
  steps.push(planStep)
  yield { type: 'step_start', step: planStep }
  yield { type: 'step_progress', stepId: planStep.id, message: 'Planning…' }

  let planned: PlannerStepRaw[]
  try {
    planned = await planSteps(userPrompt, mode)
  } catch (err: any) {
    planStep.status = 'failed'
    planStep.endedAt = Date.now()
    planStep.detail = err?.message ?? 'planning failed'
    yield {
      type: 'step_error',
      stepId: planStep.id,
      error: planStep.detail,
    }
    yield { type: 'error', error: planStep.detail }
    return
  }

  planStep.status = 'completed'
  planStep.endedAt = Date.now()
  planStep.output = planned
    .map((s, i) => `${i + 1}. ${s.action}: ${s.intent}`)
    .join('\n')
  planStep.detail = `Planned ${planned.length} step(s)`
  yield { type: 'step_complete', stepId: planStep.id, step: planStep }

  // ---- Execute each planned step ----
  for (const raw of planned) {
    const step: AgentStep = {
      id: nextId(),
      action: raw.action,
      intent: raw.intent,
      status: 'running',
      startedAt: Date.now(),
    }
    steps.push(step)
    yield { type: 'step_start', step }
    yield {
      type: 'step_progress',
      stepId: step.id,
      message: `Running ${raw.action}…`,
    }

    try {
      let out: { output: string; sources?: AgentSource[] }
      const contextBlob = stepOutputs.join('\n\n---\n\n')

      if (raw.action === 'search') {
        out = await executeSearch(raw)
      } else if (raw.action === 'read') {
        out = await executeRead(raw)
      } else {
        const t = await executeThink(raw, contextBlob)
        out = { output: t.output, sources: [] }
      }

      step.status = 'completed'
      step.endedAt = Date.now()
      step.output = out.output
      if (out.sources && out.sources.length > 0) {
        step.sources = out.sources
        for (const s of out.sources) {
          if (!sources.some((x) => x.url === s.url)) sources.push(s)
        }
      }
      stepOutputs.push(`### ${raw.action.toUpperCase()}: ${raw.intent}\n${out.output}`)
      yield { type: 'step_complete', stepId: step.id, step }
    } catch (err: any) {
      step.status = 'failed'
      step.endedAt = Date.now()
      step.detail = err?.message ?? 'step failed'
      step.output = step.detail
      yield { type: 'step_error', stepId: step.id, error: step.detail }
      // Continue to next step rather than aborting the whole run
    }
  }

  // ---- Compose ----
  const composeStep: AgentStep = {
    id: nextId(),
    action: 'compose',
    intent: 'Compose the final answer',
    status: 'running',
    startedAt: Date.now(),
  }
  steps.push(composeStep)
  yield { type: 'step_start', step: composeStep }
  yield {
    type: 'step_progress',
    stepId: composeStep.id,
    message: 'Composing final answer…',
  }

  let finalContent: string
  try {
    finalContent = await composeFinal({
      userPrompt,
      mode,
      stepOutputs: stepOutputs.join('\n\n---\n\n'),
      sources,
    })
  } catch (err: any) {
    composeStep.status = 'failed'
    composeStep.endedAt = Date.now()
    composeStep.detail = err?.message ?? 'compose failed'
    yield {
      type: 'step_error',
      stepId: composeStep.id,
      error: composeStep.detail,
    }
    yield { type: 'error', error: composeStep.detail }
    return
  }

  composeStep.status = 'completed'
  composeStep.endedAt = Date.now()
  composeStep.output = truncate(finalContent, 800)
  yield { type: 'step_complete', stepId: composeStep.id, step: composeStep }

  yield { type: 'final', content: finalContent, sources }

  // Expose steps/sources for the caller via a sidecar — route handler will
  // read these after the generator returns
  ;(runAgent as any).__lastSteps = steps
  ;(runAgent as any).__lastSources = sources
}

export function getLastRunArtifacts() {
  return {
    steps: (runAgent as any).__lastSteps ?? [],
    sources: (runAgent as any).__lastSources ?? [],
  }
}
