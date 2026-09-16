import { getZAI } from './zai'

// ============================================================================
// Types
// ============================================================================

export type AgentMode = 'general' | 'research' | 'code' | 'summarize'

export interface AgentSource {
  title: string
  url: string
  snippet?: string
}

export interface AgentStep {
  id: string
  action: 'plan' | 'search' | 'read' | 'think' | 'compose'
  intent: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  detail?: string
  output?: string
  sources?: AgentSource[]
  startedAt?: number
  endedAt?: number
}

export type AgentEvent =
  | { type: 'step_start'; step: AgentStep }
  | { type: 'step_progress'; stepId: string; message: string }
  | { type: 'step_complete'; stepId: string; step: AgentStep }
  | { type: 'step_error'; stepId: string; error: string }
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
// Orchestrator — yields events as the agent runs
// ============================================================================

export async function* runAgent(
  userPrompt: string,
  mode: AgentMode
): AsyncGenerator<AgentEvent> {
  const steps: AgentStep[] = []
  const sources: AgentSource[] = []
  const stepOutputs: string[] = []

  // ---- Plan step ----
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
