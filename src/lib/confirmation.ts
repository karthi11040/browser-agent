// ============================================================================
// Confirmation tokens (Phase 3 of the spec)
//
// HIGH-risk actions (purchase, send, delete, transfer, post_comment, like,
// follow, send_message) require explicit user approval before they execute.
// When the agent wants to perform one, it halts the run and requests a
// confirmation. The user approves (or rejects) via the UI, which posts back
// a SIGNED SINGLE-USE token. The orchestrator resumes only if the token is
// valid, unexpired, unused, and scoped to the exact (runId, stepId, action).
// ============================================================================

import { createHmac, randomBytes } from 'crypto'
import { db } from './db'

// Secret used to sign tokens. In production this would come from a secret
// manager. For the sandbox, derive from a stable env var or a generated
// per-process secret.
const SECRET =
  process.env.CONFIRMATION_TOKEN_SECRET ??
  // Stable per-process fallback (NOT cryptographically strong across
  // restarts — the env var should be set for production)
  'dom-agent-confirmation-secret-v1-' + (process.env.USER ?? 'sandbox')

const TOKEN_TTL_MS = 5 * 60 * 1000 // 5 minutes

export interface PendingConfirmation {
  runId: string
  stepId: string
  action: object // the proposed action that needs approval
  riskReason: string
  // What the user is being asked to confirm — human-readable description
  summary: string
  token: string // the opaque token the UI posts back
  // Absolute URL of the page where the action would be performed
  pageUrl?: string
}

function sign(runId: string, stepId: string, actionJson: string, nonce: string): string {
  return createHmac('sha256', SECRET)
    .update(`${runId}|${stepId}|${actionJson}|${nonce}`)
    .digest('hex')
}

export async function issueConfirmation(input: {
  runId: string
  stepId: string
  action: object
  riskReason: string
  summary: string
  pageUrl?: string
}): Promise<PendingConfirmation> {
  const nonce = randomBytes(16).toString('hex')
  const actionJson = JSON.stringify(input.action)
  const signature = sign(input.runId, input.stepId, actionJson, nonce)

  // Persist so we can verify single-use + check expiry
  await db.confirmationToken.create({
    data: {
      runId: input.runId,
      stepId: input.stepId,
      action: actionJson,
      intent: input.riskReason,
      signature,
      nonce,
      status: 'pending',
    },
  })

  // The token the UI sees is `${runId}.${stepId}.${nonce}` — the signature
  // stays server-side. The UI just hands back the opaque token.
  const token = `${input.runId}.${input.stepId}.${nonce}`

  return {
    runId: input.runId,
    stepId: input.stepId,
    action: input.action,
    riskReason: input.riskReason,
    summary: input.summary,
    token,
    pageUrl: input.pageUrl,
  }
}

export interface VerifyResult {
  ok: boolean
  reason: string
  action?: object
}

export async function verifyAndConsumeConfirmation(
  token: string,
  decision: 'approved' | 'rejected'
): Promise<VerifyResult> {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return { ok: false, reason: 'malformed token' }
  }
  const [runId, stepId, nonce] = parts

  const record = await db.confirmationToken.findUnique({
    where: { runId_stepId: { runId, stepId } },
  })
  if (!record) {
    return { ok: false, reason: 'no pending confirmation for this run+step' }
  }
  if (record.status !== 'pending') {
    return {
      ok: false,
      reason: `token already ${record.status} (single-use enforced)`,
    }
  }

  // TTL check
  const age = Date.now() - record.createdAt.getTime()
  if (age > TOKEN_TTL_MS) {
    await db.confirmationToken.update({
      where: { id: record.id },
      data: { status: 'expired', resolvedAt: new Date() },
    })
    return { ok: false, reason: 'token expired' }
  }

  // Signature check
  const expectedSig = sign(runId, stepId, record.action, nonce)
  if (expectedSig !== record.signature) {
    return { ok: false, reason: 'invalid signature' }
  }

  // Mark consumed
  await db.confirmationToken.update({
    where: { id: record.id },
    data: {
      status: decision,
      resolvedAt: new Date(),
    },
  })

  if (decision === 'rejected') {
    return { ok: true, reason: 'user rejected — run will stop', action: undefined }
  }

  let action: object
  try {
    action = JSON.parse(record.action)
  } catch {
    return { ok: false, reason: 'stored action JSON was malformed' }
  }

  return { ok: true, reason: 'confirmed', action }
}

// Get a pending confirmation (without consuming it) for the UI to display
export async function getPendingConfirmation(
  runId: string,
  stepId: string
): Promise<PendingConfirmation | null> {
  const record = await db.confirmationToken.findUnique({
    where: { runId_stepId: { runId, stepId } },
  })
  if (!record || record.status !== 'pending') return null
  const age = Date.now() - record.createdAt.getTime()
  if (age > TOKEN_TTL_MS) return null

  let action: object
  try {
    action = JSON.parse(record.action)
  } catch {
    return null
  }

  return {
    runId: record.runId,
    stepId: record.stepId,
    action,
    riskReason: record.intent ?? '',
    summary: `High-risk action on run ${record.runId}`,
    token: `${record.runId}.${record.stepId}.${record.nonce}`,
  }
}

// List all pending confirmations for a run (used by the UI to render the modal)
export async function listPendingForRun(runId: string): Promise<PendingConfirmation[]> {
  const records = await db.confirmationToken.findMany({
    where: { runId, status: 'pending' },
  })
  const now = Date.now()
  return records
    .filter((r) => now - r.createdAt.getTime() <= TOKEN_TTL_MS)
    .map((r) => {
      let action: object
      try {
        action = JSON.parse(r.action)
      } catch {
        action = { raw: r.action }
      }
      return {
        runId: r.runId,
        stepId: r.stepId,
        action,
        riskReason: r.intent ?? '',
        summary: `High-risk action on run ${r.runId}`,
        token: `${r.runId}.${r.stepId}.${r.nonce}`,
      }
    })
}
