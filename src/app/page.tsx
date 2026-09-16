'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  Send,
  Sparkles,
  Globe,
  BookOpen,
  Brain,
  ListChecks,
  FileText,
  Trash2,
  History,
  Loader2,
  CheckCircle2,
  XCircle,
  Terminal,
  ChevronRight,
  Copy,
  ExternalLink,
  Wand2,
  RefreshCw,
  MousePointer2,
  Keyboard,
  Hand,
  MonitorPlay,
  ShieldAlert,
  Camera,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types — mirror the server-side agent library
// ---------------------------------------------------------------------------

type AgentMode = 'general' | 'research' | 'code' | 'summarize'

interface AgentSource {
  title: string
  url: string
  snippet?: string
}

interface AgentStep {
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

interface AgentEvent {
  type:
    | 'run_started'
    | 'step_start'
    | 'step_progress'
    | 'step_complete'
    | 'step_error'
    | 'screenshot'
    | 'final'
    | 'done'
    | 'error'
  runId?: string
  prompt?: string
  mode?: string
  stepId?: string
  step?: AgentStep
  message?: string
  content?: string
  sources?: AgentSource[]
  webPath?: string
  pageUrl?: string
  error?: string
}

const MODES: { key: AgentMode; label: string; desc: string; icon: any }[] = [
  { key: 'general', label: 'General', desc: 'Balanced reasoning + web', icon: Sparkles },
  { key: 'research', label: 'Research', desc: 'Web-heavy, cited', icon: Globe },
  { key: 'code', label: 'Code', desc: 'Reasoning, code-blocks', icon: Terminal },
  { key: 'summarize', label: 'Summarize', desc: 'Distill long input', icon: FileText },
  { key: 'browser', label: 'Browser', desc: 'Drives real Chrome', icon: MonitorPlay },
]

const SAMPLE_PROMPTS = [
  'Compare the latest features of Next.js 16 vs Remix 2025 for production apps.',
  'Find the current price of Bitcoin and explain 3 factors driving it this week.',
  'Summarize https://en.wikipedia.org/wiki/Reinforcement_learning in 5 bullet points.',
  'Write a Python script that scrapes the titles of the top 10 HN stories.',
]

const BROWSER_SAMPLE_PROMPTS = [
  'Go to https://news.ycombinator.com and list the top 5 story titles.',
  'Search Wikipedia for "large language model" and return the first paragraph.',
  'Visit https://httpbin.org/forms/post and fill the form with sample data, then submit it.',
  'Open https://example.com and tell me what the page is about in 2 sentences.',
]

// ---------------------------------------------------------------------------
// Step icon helper
// ---------------------------------------------------------------------------

const stepIcon = (action: AgentStep['action']) => {
  switch (action) {
    case 'plan':
      return ListChecks
    case 'search':
      return Globe
    case 'read':
      return BookOpen
    case 'think':
      return Brain
    case 'compose':
      return Wand2
    case 'navigate':
      return Globe
    case 'click':
      return MousePointer2
    case 'type':
      return Keyboard
    case 'press':
      return Hand
    case 'extract':
      return FileText
    case 'reflect':
      return Brain
    default:
      return Sparkles
  }
}

const fmtDuration = (ms?: number) => (ms && ms > 0 ? `${(ms / 1000).toFixed(1)}s` : '')

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Home() {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<AgentMode>('general')
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [progressMsg, setProgressMsg] = useState<string>('')
  const [finalContent, setFinalContent] = useState<string>('')
  const [sources, setSources] = useState<AgentSource[]>([])
  const [error, setError] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [liveScreenshot, setLiveScreenshot] = useState<{
    webPath: string
    pageUrl?: string
    stepId?: string
  } | null>(null)

  // History sidebar
  const [history, setHistory] = useState<
    {
      id: string
      prompt: string
      mode: string
      status: string
      createdAt: string
    }[]
  >([])
  const [historyOpenMobile, setHistoryOpenMobile] = useState(false)

  const resultRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ----- Load history on mount -----
  useEffect(() => {
    refreshHistory()
  }, [])

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history?limit=20')
      if (res.ok) {
        const data = await res.json()
        setHistory(data.runs ?? [])
      }
    } catch {
      /* ignore */
    }
  }, [])

  const resetForNewRun = useCallback(() => {
    setSteps([])
    setProgressMsg('')
    setFinalContent('')
    setSources([])
    setError(null)
    setRunId(null)
    setLiveScreenshot(null)
  }, [])

  // ----- Run the agent -----
  const runAgent = useCallback(async () => {
    if (!prompt.trim() || running) return
    resetForNewRun()
    setRunning(true)
    setProgressMsg('Planning…')

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), mode }),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => 'Request failed')
        setError(txt || `HTTP ${res.status}`)
        setRunning(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        // SSE events separated by double newline
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)
          let ev: AgentEvent
          try {
            ev = JSON.parse(jsonStr)
          } catch {
            continue
          }
          handleEvent(ev)
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err?.message ?? 'Network error')
      }
    } finally {
      setRunning(false)
      abortRef.current = null
      refreshHistory()
    }
  }, [prompt, mode, running, resetForNewRun, refreshHistory])

  // ----- Event handler -----
  const handleEvent = useCallback((ev: AgentEvent) => {
    switch (ev.type) {
      case 'run_started':
        if (ev.runId) setRunId(ev.runId)
        break
      case 'step_start':
        if (ev.step) {
          setSteps((s) => [...s, ev.step!])
          setProgressMsg(ev.step?.intent ?? '')
        }
        break
      case 'step_progress':
        if (ev.message) setProgressMsg(ev.message)
        break
      case 'step_complete':
        if (ev.step) {
          setSteps((s) =>
            s.map((st) => (st.id === ev.step!.id ? ev.step! : st))
          )
        }
        break
      case 'step_error':
        if (ev.stepId) {
          setSteps((s) =>
            s.map((st) =>
              st.id === ev.stepId
                ? { ...st, status: 'failed', detail: ev.error }
                : st
            )
          )
        }
        break
      case 'screenshot':
        if (ev.webPath) {
          setLiveScreenshot({
            webPath: ev.webPath,
            pageUrl: ev.pageUrl,
            stepId: ev.stepId,
          })
          if (ev.stepId) {
            setSteps((s) =>
              s.map((st) =>
                st.id === ev.stepId
                  ? {
                      ...st,
                      screenshotPath: ev.webPath,
                      pageUrl: ev.pageUrl,
                    }
                  : st
              )
            )
          }
        }
        break
      case 'final':
        if (ev.content) setFinalContent(ev.content)
        if (ev.sources) setSources(ev.sources)
        setProgressMsg('')
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
        break
      case 'error':
        setError(ev.error ?? 'Unknown error')
        break
      case 'done':
        break
    }
  }, [])

  // ----- Load a past run -----
  const loadHistoryRun = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/history/${id}`)
      if (!res.ok) return
      const data = await res.json()
      const run = data.run
      resetForNewRun()
      setPrompt(run.prompt)
      setMode(run.mode as AgentMode)
      const restoredSteps: AgentStep[] = run.steps ?? []
      setSteps(restoredSteps)
      setFinalContent(run.result ?? '')
      setSources(run.sources ?? [])
      setRunId(run.id)
      // Restore the latest screenshot for the live preview
      const lastShot = restoredSteps
        .slice()
        .reverse()
        .find((s: AgentStep) => s.screenshotPath)
      if (lastShot) {
        setLiveScreenshot({
          webPath: lastShot.screenshotPath!,
          pageUrl: lastShot.pageUrl,
          stepId: lastShot.id,
        })
      }
      if (run.status === 'failed') setError(run.error ?? 'Run failed')
      setHistoryOpenMobile(false)
    } catch {
      /* ignore */
    }
  }, [resetForNewRun])

  const deleteHistoryRun = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await fetch(`/api/history/${id}`, { method: 'DELETE' })
        setHistory((h) => h.filter((r) => r.id !== id))
        if (runId === id) resetForNewRun()
      } catch {
        /* ignore */
      }
    },
    [runId, resetForNewRun]
  )

  const copyResult = useCallback(() => {
    if (finalContent) navigator.clipboard.writeText(finalContent)
  }, [finalContent])

  const stopRun = useCallback(() => {
    abortRef.current?.abort()
    setRunning(false)
  }, [])

  // ----- Render -----
  const hasSteps = steps.length > 0
  const hasResult = finalContent.length > 0
  const runningStep = steps.find((s) => s.status === 'running')

  return (
    <div className="min-h-screen flex flex-col agent-bg text-foreground">
      {/* Top grid decoration */}
      <div className="absolute inset-0 pointer-events-none agent-grid" />

      {/* Header */}
      <header className="relative z-10 border-b border-border/60 backdrop-blur-md bg-background/70">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg agent-accent-bg flex items-center justify-center border border-[var(--agent-accent)]/30">
              <Wand2 className="w-5 h-5 agent-accent" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">Agent Forge</div>
              <div className="text-xs text-muted-foreground">
                Web automation agent
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setHistoryOpenMobile((v) => !v)}
            >
              <History className="w-4 h-4 mr-1" /> History
            </Button>
            {running ? (
              <Badge
                variant="outline"
                className="agent-running border-[var(--agent-running)]/40"
              >
                <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running
              </Badge>
            ) : hasResult ? (
              <Badge
                variant="outline"
                className="agent-accent border-[var(--agent-accent)]/40"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Idle
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="relative z-10 flex-1 mx-auto max-w-7xl w-full px-4 md:px-6 py-5 flex gap-5">
        {/* Sidebar — history */}
        <aside
          className={cn(
            'hidden lg:flex flex-col w-72 shrink-0',
            historyOpenMobile && 'flex'
          )}
        >
          <Card className="flex-1 flex flex-col p-0 overflow-hidden bg-card/80 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">Run history</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={refreshHistory}
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
            <ScrollArea className="flex-1 max-h-[calc(100vh-180px)]">
              <div className="p-2 space-y-1">
                {history.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-4 text-center">
                    No runs yet. Your past prompts will appear here.
                  </div>
                ) : (
                  history.map((run) => (
                    <div
                      key={run.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => loadHistoryRun(run.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          loadHistoryRun(run.id)
                        }
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md hover:bg-accent/60 transition-colors group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        runId === run.id && 'bg-accent/80'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full shrink-0',
                            run.status === 'completed'
                              ? 'agent-accent bg-[var(--agent-accent)]'
                              : run.status === 'failed'
                                ? 'agent-failed bg-[var(--agent-failed)]'
                                : 'bg-muted-foreground'
                          )}
                        />
                        <span className="text-xs text-muted-foreground">
                          {new Date(run.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="ml-auto" />
                        <button
                          onClick={(e) => deleteHistoryRun(run.id, e)}
                          className="opacity-0 group-hover:opacity-100 hover:text-[var(--agent-failed)]"
                          title="Delete"
                          aria-label="Delete this run"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-sm line-clamp-2 mt-1">
                        {run.prompt}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {run.mode}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </aside>

        {/* Main column */}
        <main className="flex-1 flex flex-col gap-5 min-w-0">
          {/* Prompt composer */}
          <Card className="p-4 md:p-5 bg-card/80 backdrop-blur border-[var(--agent-accent)]/15">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 agent-accent" />
              <h2 className="font-medium">What should the agent do?</h2>
            </div>

            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Find the latest release notes for Next.js 16 and summarize the 3 biggest changes…"
              className="min-h-[110px] resize-y font-medium text-base"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  runAgent()
                }
              }}
            />

            {/* Mode chips */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {MODES.map((m) => {
                const Icon = m.icon
                const active = mode === m.key
                return (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all',
                      active
                        ? 'agent-accent-bg border-[var(--agent-accent)]/40 text-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {m.label}
                  </button>
                )
              })}
            </div>

            {/* Sample prompts */}
            {!hasSteps && !hasResult && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-2">
                  {mode === 'browser'
                    ? 'Try a browser-mode prompt (drives a real headless Chrome):'
                    : 'Try a sample prompt:'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(mode === 'browser' ? BROWSER_SAMPLE_PROMPTS : SAMPLE_PROMPTS).map(
                    (p) => (
                      <button
                        key={p}
                        onClick={() => setPrompt(p)}
                        className="text-left text-xs px-3 py-2 rounded-md border border-border hover:bg-accent/50 hover:border-foreground/20 text-muted-foreground hover:text-foreground transition-colors max-w-[300px] truncate"
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Browser-mode disclaimer */}
            {mode === 'browser' && !hasSteps && !hasResult && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1.5 text-muted-foreground">
                    <div className="font-medium text-amber-600 dark:text-amber-500">
                      What Browser mode can & can't do
                    </div>
                    <p>
                      <strong className="text-foreground">Can:</strong> drive a
                      real headless Chrome to navigate, click, type, and extract
                      text on <em>public</em> sites — with a live screenshot at
                      every step.
                    </p>
                    <p>
                      <strong className="text-foreground">Won't auto-login</strong>{' '}
                      to Facebook, Instagram, Gmail, Twitter/X, or any other
                      gated service — automating those logins violates their
                      Terms of Service and would put your credentials at risk.
                      If you paste a URL that requires login, the agent will
                      hit the login wall and explain what happened.
                    </p>
                    <p>
                      <strong className="text-foreground">Won't complete</strong>{' '}
                      real-world commerce (ticket booking, payments, bulk email)
                      end-to-end — it can demonstrate the search + form-fill
                      flow up to the payment step, but the final submission is
                      yours to confirm.
                    </p>
                    <p className="text-[11px] opacity-80">
                      Tip: the agent runs headless (no visible browser window).
                      Watch the Live Browser Preview panel below to see exactly
                      what it sees.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Run button */}
            <div className="mt-4 flex items-center gap-2">
              {running ? (
                <Button onClick={stopRun} variant="destructive">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Stop agent
                </Button>
              ) : (
                <Button
                  onClick={runAgent}
                  disabled={!prompt.trim()}
                  className="agent-accent-bg border border-[var(--agent-accent)]/40 text-foreground hover:brightness-110"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Run agent
                  <span className="ml-2 text-[10px] opacity-70 hidden sm:inline">
                    ⌘/Ctrl + ↵
                  </span>
                </Button>
              )}
              {(hasSteps || hasResult) && !running && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetForNewRun}
                >
                  Clear
                </Button>
              )}
              {progressMsg && running && (
                <span className="text-xs text-muted-foreground ml-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--agent-running)] agent-pulse" />
                  {progressMsg}
                </span>
              )}
            </div>
          </Card>

          {/* Error banner */}
          {error && (
            <Card className="p-4 border-[var(--agent-failed)]/40 bg-[var(--agent-failed)]/5">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 agent-failed mt-0.5" />
                <div>
                  <div className="font-medium agent-failed text-sm">
                    Agent error
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {error}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Two-column: steps + (live browser preview OR result) */}
          {(hasSteps || hasResult || running) && (
            <div
              className={
                mode === 'browser'
                  ? 'grid grid-cols-1 xl:grid-cols-3 gap-5'
                  : 'grid grid-cols-1 xl:grid-cols-2 gap-5'
              }
            >
              {/* Steps timeline */}
              <Card className="p-4 md:p-5 bg-card/80 backdrop-blur">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-4 h-4 agent-accent" />
                    <h3 className="font-medium text-sm">Agent timeline</h3>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {steps.length} step{steps.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                <div className="space-y-2 max-h-[60vh] overflow-y-auto agent-scroll pr-1">
                  <AnimatePresence initial={false}>
                    {steps.map((step, idx) => {
                      const Icon = stepIcon(step.action)
                      const isLast = idx === steps.length - 1
                      return (
                        <motion.div
                          key={step.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="relative pl-8"
                        >
                          {/* vertical line */}
                          {!isLast && (
                            <span className="absolute left-3 top-7 bottom-[-12px] w-px bg-border" />
                          )}
                          {/* dot */}
                          <span
                            className={cn(
                              'absolute left-[7px] top-1.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center bg-background',
                              step.status === 'running' &&
                                'border-[var(--agent-running)] agent-pulse',
                              step.status === 'completed' &&
                                'border-[var(--agent-accent)]',
                              step.status === 'failed' &&
                                'border-[var(--agent-failed)]',
                              step.status === 'pending' &&
                                'border-muted-foreground/40'
                            )}
                          >
                            {step.status === 'completed' && (
                              <CheckCircle2 className="w-2.5 h-2.5 agent-accent" />
                            )}
                            {step.status === 'failed' && (
                              <XCircle className="w-2.5 h-2.5 agent-failed" />
                            )}
                            {step.status === 'running' && (
                              <Loader2 className="w-2.5 h-2.5 agent-running animate-spin" />
                            )}
                          </span>
                          {/* card body */}
                          <div className="rounded-lg border bg-card/50 p-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 uppercase tracking-wide"
                              >
                                {step.action}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Step {idx + 1}
                              </span>
                              <span className="ml-auto text-[10px] text-muted-foreground">
                                {step.status === 'completed' &&
                                  fmtDuration(
                                    (step.endedAt ?? 0) - (step.startedAt ?? 0)
                                  )}
                              </span>
                            </div>
                            <div className="text-sm mt-1.5 leading-snug">
                              {step.intent}
                            </div>
                            {step.detail && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {step.detail}
                              </div>
                            )}
                            {step.pageUrl && (
                              <a
                                href={step.pageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-2 text-[10px] px-1.5 py-0.5 rounded agent-accent-bg border border-[var(--agent-accent)]/20 max-w-full truncate hover:brightness-110"
                                title={step.pageUrl}
                              >
                                <Globe className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{step.pageUrl}</span>
                              </a>
                            )}
                            {step.screenshotPath && (
                              <a
                                href={step.screenshotPath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 block rounded overflow-hidden border border-border hover:border-foreground/30 transition-colors"
                                title="View full-size screenshot"
                              >
                                <img
                                  src={step.screenshotPath}
                                  alt={`Screenshot after step ${idx + 1}`}
                                  className="w-full h-auto block"
                                  loading="lazy"
                                />
                              </a>
                            )}
                            {step.output && (
                              <details className="mt-2">
                                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                  Show output
                                </summary>
                                <pre className="text-xs mt-2 p-2 rounded bg-muted/40 overflow-x-auto max-h-48 agent-scroll whitespace-pre-wrap break-words">
                                  {step.output}
                                </pre>
                              </details>
                            )}
                            {step.sources && step.sources.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {step.sources.slice(0, 4).map((s, i) => (
                                  <a
                                    key={i}
                                    href={s.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] px-1.5 py-0.5 rounded agent-accent-bg border border-[var(--agent-accent)]/20 hover:brightness-110 flex items-center gap-1 max-w-[180px] truncate"
                                    title={s.url}
                                  >
                                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                    <span className="truncate">{s.title}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>

                  {running && !runningStep && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2 pl-8">
                      <Loader2 className="w-3 h-3 animate-spin" /> Preparing…
                    </div>
                  )}
                </div>
              </Card>

              {/* Live Browser Preview (browser mode only) */}
              {mode === 'browser' && (
                <Card className="p-4 md:p-5 bg-card/80 backdrop-blur border-[var(--agent-accent)]/20 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MonitorPlay className="w-4 h-4 agent-accent" />
                      <h3 className="font-medium text-sm">
                        Live browser preview
                      </h3>
                    </div>
                    {running && (
                      <Badge
                        variant="outline"
                        className="agent-running border-[var(--agent-running)]/40"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--agent-running)] agent-pulse mr-1" />
                        Live
                      </Badge>
                    )}
                  </div>

                  {liveScreenshot ? (
                    <div className="space-y-2">
                      <div className="rounded-md overflow-hidden border bg-black/30">
                        <img
                          src={liveScreenshot.webPath}
                          alt="Latest browser screenshot"
                          className="w-full h-auto block"
                        />
                      </div>
                      {liveScreenshot.pageUrl && (
                        <a
                          href={liveScreenshot.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground max-w-full truncate"
                          title={liveScreenshot.pageUrl}
                        >
                          <Globe className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {liveScreenshot.pageUrl}
                          </span>
                        </a>
                      )}
                      <div className="text-[11px] text-muted-foreground">
                        {running
                          ? 'Agent is driving the page — screenshot updates after each action.'
                          : 'Final screenshot from the agent run.'}
                      </div>
                    </div>
                  ) : running ? (
                    <div className="aspect-[4/3] rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin agent-running" />
                        Launching headless Chrome…
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[4/3] rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Camera className="w-5 h-5" />
                        Screenshots will appear here as the agent acts.
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Result */}
              <Card
                ref={resultRef}
                className={
                  mode === 'browser'
                    ? 'xl:col-span-1 p-4 md:p-5 bg-card/80 backdrop-blur'
                    : 'p-4 md:p-5 bg-card/80 backdrop-blur'
                }
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 agent-accent" />
                    <h3 className="font-medium text-sm">Result</h3>
                  </div>
                  {hasResult && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyResult}
                      className="h-7"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                    </Button>
                  )}
                </div>

                {hasResult ? (
                  <div className="agent-prose max-h-[60vh] overflow-y-auto agent-scroll pr-1">
                    <ReactMarkdown
                      components={{
                        code({ node, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '')
                          const isInline = !className
                          if (isInline || !match) {
                            return (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            )
                          }
                          return (
                            <SyntaxHighlighter
                              style={oneDark as any}
                              language={match[1]}
                              PreTag="div"
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          )
                        },
                      }}
                    >
                      {finalContent}
                    </ReactMarkdown>
                    {sources.length > 0 && (
                      <div className="mt-4 border-t pt-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          Sources
                        </div>
                        <ol className="space-y-1.5 text-xs">
                          {sources.map((s, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="agent-accent font-medium">
                                [{i + 1}]
                              </span>
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                {s.title}{' '}
                                <ExternalLink className="inline w-2.5 h-2.5" />
                              </a>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ) : running ? (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto agent-scroll">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin agent-running" />
                      {progressMsg || 'Thinking…'}
                    </div>
                    <div className="space-y-2">
                      <SkeletonLine />
                      <SkeletonLine w="90%" />
                      <SkeletonLine w="75%" />
                      <SkeletonLine w="85%" />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    The agent's final answer will appear here.
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Empty hero */}
          {!hasSteps && !hasResult && !running && !error && (
            <Card className="p-8 md:p-12 bg-card/80 backdrop-blur border-dashed">
              <div className="max-w-2xl mx-auto text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl agent-accent-bg border border-[var(--agent-accent)]/30 flex items-center justify-center mb-4">
                  <Wand2 className="w-7 h-7 agent-accent" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Give a prompt. Get a structured answer.
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Agent Forge plans the work, searches the web, reads pages,
                  reasons, and composes a markdown answer — all streamed live
                  to this page.
                </p>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                  <Capability
                    icon={ListChecks}
                    title="Plans the steps"
                    body="An LLM decomposes your prompt into a strict JSON plan."
                  />
                  <Capability
                    icon={Globe}
                    title="Searches the web"
                    body="Uses web_search + page_reader to gather fresh data."
                  />
                  <Capability
                    icon={Brain}
                    title="Reasons over inputs"
                    body="Intermediate think steps synthesize findings."
                  />
                  <Capability
                    icon={FileText}
                    title="Composes the answer"
                    body="Final markdown answer with inline source citations."
                  />
                </div>
              </div>
            </Card>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="relative z-10 mt-auto border-t border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 text-xs text-muted-foreground flex flex-col sm:flex-row items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="w-3 h-3 agent-accent" />
            <span>Agent Forge — autonomous web agent powered by Z.ai</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Mode: <span className="agent-accent">{mode}</span></span>
            <ChevronRight className="w-3 h-3" />
            <span>{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function SkeletonLine({ w = '100%' }: { w?: string }) {
  return (
    <div className="h-3 rounded bg-muted/60 agent-pulse" style={{ width: w }} />
  )
}

function Capability({
  icon: Icon,
  title,
  body,
}: {
  icon: any
  title: string
  body: string
}) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-card/40">
      <div className="w-8 h-8 shrink-0 rounded-md agent-accent-bg flex items-center justify-center">
        <Icon className="w-4 h-4 agent-accent" />
      </div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{body}</div>
      </div>
    </div>
  )
}
