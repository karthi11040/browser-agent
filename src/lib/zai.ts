import ZAI from 'z-ai-web-dev-sdk'

let zaiInstance: ZAI | null = null

export async function getZAI(): Promise<ZAI> {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}
