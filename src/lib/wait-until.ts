import { getCloudflareContext } from '@opennextjs/cloudflare'

/** Fire-and-forget: Worker waitUntil, sonst void. */
export async function runInBackground(job: Promise<unknown>): Promise<void> {
  const wrapped = job.catch((error) => {
    console.error('Hintergrundjob fehlgeschlagen:', error)
  })
  try {
    const cf = await getCloudflareContext({ async: true })
    const ctx = (cf as unknown as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } }).ctx
    if (ctx?.waitUntil) {
      ctx.waitUntil(wrapped)
      return
    }
  } catch {
    /* kein Worker-Kontext */
  }
  void wrapped
}
