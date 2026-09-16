import { NextRequest, NextResponse } from 'next/server'
import { listPendingForRun, verifyAndConsumeConfirmation } from '@/lib/confirmation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/confirm?runId=<id>
// Returns the pending confirmation(s) for a run, so the UI can render the
// modal even if the SSE stream was missed.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const runId = url.searchParams.get('runId')
  if (!runId) {
    return NextResponse.json(
      { ok: false, error: 'runId query param required' },
      { status: 400 }
    )
  }
  const pending = await listPendingForRun(runId)
  return NextResponse.json({ ok: true, pending })
}

// POST /api/confirm
// Body: { token: string, decision: 'approved' | 'rejected' }
// Verifies the signed single-use token, marks it consumed, and returns the
// resolved action so the orchestrator (on resume) can re-run it with
// confirmed=true. For this iteration, the original run terminates in
// 'waiting_for_confirmation' status — the confirmation result is recorded
// and surfaced to the UI; the action itself is NOT auto-resumed.
export async function POST(req: NextRequest) {
  let body: { token?: string; decision?: 'approved' | 'rejected' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const token = (body.token ?? '').trim()
  const decision = body.decision ?? 'rejected'

  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'token is required' },
      { status: 400 }
    )
  }

  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json(
      { ok: false, error: 'decision must be "approved" or "rejected"' },
      { status: 400 }
    )
  }

  const result = await verifyAndConsumeConfirmation(token, decision)

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.reason },
      { status: 403 }
    )
  }

  return NextResponse.json({
    ok: true,
    reason: result.reason,
    action: result.action,
    decision,
  })
}
