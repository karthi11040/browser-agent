import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  runAgent,
  type AgentMode,
  type AgentStep,
  type AgentSource,
} from '@/lib/agent'
import type { RecoveryState } from '@/lib/recovery'
import type { PendingConfirmation } from '@/lib/confirmation'
import {
  attachToSession,
  liveFrame,
  getUrl,
  cleanupLiveFrames,
} from '@/lib/browser-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface AgentRunBody {
  prompt?: string
  mode?: AgentMode
}

function ssePack(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  let body: AgentRunBody
  try {
    body = (await req.json()) as AgentRunBody
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const prompt = (body.prompt ?? '').trim()
  const mode = (body.mode ?? 'general') as AgentMode
  if (!prompt) {
    return new Response(
      JSON.stringify({ error: 'prompt is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
  if (prompt.length > 8000) {
    return new Response(
      JSON.stringify({ error: 'prompt too long (max 8000 chars)' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Create the run record
  const run = await db.agentRun.create({
    data: {
      prompt,
      mode,
      status: 'running',
    },
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(ssePack(obj)))
      }

      send({ type: 'run_started', runId: run.id, prompt, mode })

      const steps: AgentStep[] = []
      const sources: AgentSource[] = []
      let waitingForConfirmation = false

      // ----- Live-frame poller (browser mode only) -----
      // Runs in parallel with the agent generator. Every ~2.5s (when not
      // already mid-screenshot) it takes a fresh screenshot of the headless
      // browser and streams it to the client as a `live_frame` event — this
      // is what makes the Live Browser Preview panel feel like a continuous
      // feed rather than per-action snapshots.
      //
      // IMPORTANT: the interval is conservative (~0.4 fps) because each
      // `agent-browser` CLI invocation spawns a child process that connects
      // to the persistent Chrome via CDP — too many concurrent spawns hit
      // the system's pthread limit (we saw "Resource temporarily
      // unavailable" with a tighter interval). The poller also skips ticks
      // while the previous frame is still being captured, so we never have
      // more than one live-frame screenshot in-flight at a time.
      let livePoller: { stop: () => void } | null = null
      const startLivePoller = (sessionId: string) => {
        const session = attachToSession(sessionId, run.id)
        let stopped = false
        let inFlight = false
        let frameIdx = 0
        const POLL_INTERVAL_MS = 1200
        const INITIAL_DELAY_MS = 500

        const tick = async () => {
          if (stopped) return
          if (inFlight) {
            // Previous frame still being captured — try again shortly
            setTimeout(tick, 300)
            return
          }
          inFlight = true
          try {
            frameIdx += 1
            const r = liveFrame(session, frameIdx)
            if (r.ok && r.webPath) {
              let pageUrl: string | undefined
              try {
                const urlInfo = getUrl(session)
                if (urlInfo.ok && urlInfo.url) pageUrl = urlInfo.url
              } catch {
                /* ignore */
              }
              send({
                type: 'live_frame',
                webPath: r.webPath,
                pageUrl,
                ts: Date.now(),
                frameIdx,
              })
            }
          } catch {
            /* ignore — agent-browser may queue or error if the session is busy */
          } finally {
            inFlight = false
            if (!stopped) {
              setTimeout(tick, POLL_INTERVAL_MS)
            }
          }
        }
        // Kick off the first tick soon so we capture the very first page state
        setTimeout(tick, INITIAL_DELAY_MS)

        livePoller = {
          stop: () => {
            stopped = true
          },
        }
      }
      const stopLivePoller = () => {
        if (livePoller) {
          livePoller.stop()
          livePoller = null
        }
        // Clean up the frame PNGs to free disk
        try {
          cleanupLiveFrames(run.id)
        } catch {}
      }

      try {
        for await (const ev of runAgent(prompt, mode, run.id)) {
          switch (ev.type) {
            case 'session_started':
              // Browser session is up — start streaming live frames
              if (mode === 'browser') {
                startLivePoller(ev.sessionId)
              }
              send(ev)
              break
            case 'step_start':
              steps.push(ev.step)
              send({ type: 'step_start', step: ev.step })
              break
            case 'step_progress':
              send(ev)
              break
            case 'step_complete': {
              const idx = steps.findIndex((s) => s.id === ev.stepId)
              if (idx >= 0) {
                steps[idx] = ev.step
              }
              send({ type: 'step_complete', step: ev.step })
              break
            }
            case 'step_error':
              send(ev)
              break
            case 'screenshot':
              // Update the matching step with screenshotPath + pageUrl
              if (ev.stepId) {
                const idx = steps.findIndex((s) => s.id === ev.stepId)
                if (idx >= 0) {
                  steps[idx] = {
                    ...steps[idx],
                    screenshotPath: ev.webPath,
                    pageUrl: ev.pageUrl,
                  }
                }
              }
              send(ev)
              break
            case 'live_frame':
              // Frames come from the parallel poller — forward as-is
              send(ev)
              break
            case 'validation':
              if (ev.stepId) {
                const idx = steps.findIndex((s) => s.id === ev.stepId)
                if (idx >= 0) {
                  steps[idx] = {
                    ...steps[idx],
                    validation: ev.validation,
                  }
                }
              }
              send(ev)
              break
            case 'verification':
              if (ev.stepId) {
                const idx = steps.findIndex((s) => s.id === ev.stepId)
                if (idx >= 0) {
                  steps[idx] = {
                    ...steps[idx],
                    verification: ev.verification,
                  }
                }
              }
              send(ev)
              break
            case 'recovery_state':
              send(ev)
              break
            case 'confirmation_request':
              waitingForConfirmation = true
              stopLivePoller()
              send({
                type: 'confirmation_request',
                pending: ev.pending as PendingConfirmation,
                runId: ev.runId,
              })
              break
            case 'final':
              stopLivePoller()
              for (const s of ev.sources) {
                if (!sources.some((x) => x.url === s.url)) sources.push(s)
              }
              send({
                type: 'final',
                content: ev.content,
                sources: ev.sources,
              })
              await db.agentRun.update({
                where: { id: run.id },
                data: {
                  status: waitingForConfirmation
                    ? 'waiting_for_confirmation'
                    : 'completed',
                  result: ev.content,
                  sourcesJson: JSON.stringify(ev.sources),
                  stepsJson: JSON.stringify(steps),
                  updatedAt: new Date(),
                },
              })
              break
            case 'error':
              stopLivePoller()
              send(ev)
              await db.agentRun.update({
                where: { id: run.id },
                data: {
                  status: 'failed',
                  error: ev.error,
                  stepsJson: JSON.stringify(steps),
                  updatedAt: new Date(),
                },
              })
              break
            case 'done':
              send(ev)
              break
          }
        }
      } catch (err: any) {
        stopLivePoller()
        const message = err?.message ?? 'agent crashed'
        send({ type: 'error', error: message })
        await db.agentRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            error: message,
            stepsJson: JSON.stringify(steps),
            updatedAt: new Date(),
          },
        })
      } finally {
        stopLivePoller()
        send({ type: 'done', runId: run.id })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
