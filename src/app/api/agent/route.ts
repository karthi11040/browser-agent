import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  runAgent,
  type AgentMode,
  type AgentStep,
  type AgentSource,
} from '@/lib/agent'

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

      try {
        for await (const ev of runAgent(prompt, mode)) {
          switch (ev.type) {
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
            case 'final':
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
                  status: 'completed',
                  result: ev.content,
                  sourcesJson: JSON.stringify(ev.sources),
                  stepsJson: JSON.stringify(steps),
                  updatedAt: new Date(),
                },
              })
              break
            case 'error':
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
