import { execSync } from 'child_process'
import { randomUUID } from 'crypto'
import { mkdirSync, rmSync, readdirSync, unlinkSync } from 'fs'
import { join as pathJoin } from 'path'

// ---------------------------------------------------------------------------
// Browser client — wraps the `agent-browser` CLI to drive a real headless
// Chrome. Each agent run gets its own persistent session (--session flag),
// so multiple actions on the same run share one browser context.
// ---------------------------------------------------------------------------

const SCREENSHOTS_DIR = '/home/z/my-project/public/agent-screenshots'
const COMMAND_TIMEOUT_MS = 45_000

mkdirSync(SCREENSHOTS_DIR, { recursive: true })

export interface BrowserSession {
  sessionId: string
  runId: string
}

export interface SnapshotResult {
  ok: boolean
  snapshot?: any
  raw?: string
  stderr?: string
}

export interface ScreenshotResult {
  ok: boolean
  webPath?: string
  filePath?: string
  error?: string
}

function run(cmd: string, timeout = COMMAND_TIMEOUT_MS): {
  ok: boolean
  stdout: string
  stderr: string
  code: number
} {
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      maxBuffer: 100 * 1024 * 1024,
      timeout,
    })
    return { ok: true, stdout, stderr: '', code: 0 }
  } catch (e: any) {
    return {
      ok: false,
      stdout: e?.stdout ?? '',
      stderr: e?.stderr ?? e?.message ?? 'unknown error',
      code: e?.status ?? 1,
    }
  }
}

function shellEscape(s: string): string {
  return String(s).replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$')
}

export function createBrowserSession(runId: string): BrowserSession {
  const sessionId = `s-${Date.now()}-${randomUUID().slice(0, 8)}`
  mkdirSync(pathJoin(SCREENSHOTS_DIR, runId), { recursive: true })
  return { sessionId, runId }
}

export function navigate(session: BrowserSession, url: string) {
  const r = run(
    `agent-browser --session ${session.sessionId} open "${shellEscape(url)}"`
  )
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr }
}

export function snapshotInteractive(session: BrowserSession): SnapshotResult {
  const r = run(
    `agent-browser --session ${session.sessionId} snapshot -i --json`
  )
  let snapshot: any = null
  try {
    snapshot = JSON.parse(r.stdout)
  } catch {
    snapshot = { raw: r.stdout }
  }
  return { ok: r.ok, snapshot, stderr: r.stderr }
}

export function snapshotText(session: BrowserSession) {
  // Use eval to get the visible text of the page body (not the accessibility tree)
  const r = run(
    `agent-browser --session ${session.sessionId} eval "document.body.innerText"`
  )
  // The CLI may wrap the result in quotes — strip outer quotes if present
  let text = r.stdout || ''
  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'")))
  ) {
    try {
      text = JSON.parse(text)
    } catch {
      text = text.slice(1, -1)
    }
  }
  return { ok: r.ok, text, stderr: r.stderr }
}

export function screenshot(
  session: BrowserSession,
  stepIdx: number
): ScreenshotResult {
  const filePath = pathJoin(
    SCREENSHOTS_DIR,
    session.runId,
    `step-${stepIdx}.png`
  )
  const r = run(
    `agent-browser --session ${session.sessionId} screenshot "${filePath}"`,
    20_000
  )
  if (!r.ok) {
    return { ok: false, error: r.stderr || 'screenshot failed' }
  }
  return {
    ok: true,
    webPath: `/agent-screenshots/${session.runId}/step-${stepIdx}.png`,
    filePath,
  }
}

// Take a "live frame" screenshot — used by the live-feed poller that runs
// in parallel with the main agent loop. Each frame gets a unique filename
// (frame-{frameIdx}.png) so the browser always sees a fresh URL and never
// serves a cached image. Short timeout so we skip frames fast when the
// session is busy with an action.
export function liveFrame(
  session: BrowserSession,
  frameIdx: number
): ScreenshotResult {
  const filePath = pathJoin(
    SCREENSHOTS_DIR,
    session.runId,
    `frame-${frameIdx}.png`
  )
  const r = run(
    `agent-browser --session ${session.sessionId} screenshot "${filePath}"`,
    5_000
  )
  if (!r.ok) {
    return { ok: false, error: r.stderr || 'live frame failed' }
  }
  return {
    ok: true,
    webPath: `/agent-screenshots/${session.runId}/frame-${frameIdx}.png?ts=${Date.now()}`,
    filePath,
  }
}

// Re-attach to an existing browser session by id — used by the live-frame
// poller which runs in the route handler (separate from the agent
// generator's closure).
export function attachToSession(
  sessionId: string,
  runId: string
): BrowserSession {
  return { sessionId, runId }
}

// Remove all live-frame PNGs for a run (called after the run completes —
// the per-step PNGs are kept since they're linked to step records for the
// timeline + history).
export function cleanupLiveFrames(runId: string) {
  const dir = pathJoin(SCREENSHOTS_DIR, runId)
  try {
    const files = readdirSync(dir)
    for (const f of files) {
      if (f.startsWith('frame-')) {
        try {
          unlinkSync(pathJoin(dir, f))
        } catch {}
      }
    }
  } catch {
    /* dir doesn't exist or not readable — ignore */
  }
}

export function clickByRef(session: BrowserSession, ref: string) {
  const r = run(
    `agent-browser --session ${session.sessionId} click "${shellEscape(ref)}"`
  )
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr }
}

export function clickByText(session: BrowserSession, text: string) {
  const r = run(
    `agent-browser --session ${session.sessionId} find text "${shellEscape(text)}" click`
  )
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr }
}

export function clickByRole(
  session: BrowserSession,
  role: string,
  name: string
) {
  const r = run(
    `agent-browser --session ${session.sessionId} find role ${shellEscape(role)} click --name "${shellEscape(name)}"`
  )
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr }
}

export function typeIntoField(
  session: BrowserSession,
  ref: string,
  text: string
) {
  const r = run(
    `agent-browser --session ${session.sessionId} fill "${shellEscape(ref)}" "${shellEscape(text)}"`
  )
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr }
}

export function pressKey(session: BrowserSession, key: string) {
  const r = run(
    `agent-browser --session ${session.sessionId} press "${shellEscape(key)}"`
  )
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr }
}

export function waitMs(session: BrowserSession, ms: number) {
  const r = run(
    `agent-browser --session ${session.sessionId} wait ${Math.min(Math.max(ms, 100), 10_000)}`
  )
  return { ok: r.ok, stderr: r.stderr }
}

export function getUrl(session: BrowserSession) {
  const r = run(`agent-browser --session ${session.sessionId} get url`)
  return { ok: r.ok, url: r.stdout.trim(), stderr: r.stderr }
}

export function closeSession(session: BrowserSession, cleanup = false) {
  const r = run(`agent-browser --session ${session.sessionId} close`)
  if (cleanup) {
    try {
      rmSync(pathJoin(SCREENSHOTS_DIR, session.runId), {
        recursive: true,
        force: true,
      })
    } catch {
      /* ignore */
    }
  }
  return { ok: r.ok, stderr: r.stderr }
}
