import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const run = await db.agentRun.findUnique({ where: { id } })
  if (!run) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json({
    run: {
      id: run.id,
      prompt: run.prompt,
      mode: run.mode,
      status: run.status,
      result: run.result,
      error: run.error,
      steps: JSON.parse(run.stepsJson ?? '[]'),
      sources: JSON.parse(run.sourcesJson ?? '[]'),
      createdAt: run.createdAt,
    },
  })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  try {
    await db.agentRun.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
}
