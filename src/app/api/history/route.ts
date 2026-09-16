import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '20'), 100)

  const runs = await db.agentRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      prompt: true,
      mode: true,
      status: true,
      createdAt: true,
      error: true,
    },
  })

  return NextResponse.json({ runs })
}
