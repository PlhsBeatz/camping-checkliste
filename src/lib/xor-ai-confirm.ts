/**
 * KI-Veto für XOR-Kandidaten: nur prüfen, ob die Regel-Treffer echte Alternativen sind.
 * Erfindet keine neuen Paare.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { chatJson } from '@/lib/ai/openrouter-client'
import { getAiCallCache, hashCacheKey, setAiCallCache } from '@/lib/ai/ai-call-cache'

export type XorCandidateForAi = {
  ids: string[]
  names: string[]
  options: Array<{ ids: string[]; names: string[] }>
  together: number
  either: number
}

const SYSTEM = `Du prüfst Camping-/Wohnwagen-Ausrüstung auf echte Entweder-oder-Alternativen.
Eine Alternative bedeutet: gleiche Funktion, man nimmt üblicherweise ENTWEDER die eine ODER die andere Seite mit – nicht beides, und nicht zwei zufällig selten gemeinsam gepackte Dinge.
Komplemente (zusammen sinnvoll, z. B. Lichtquellen, Getränke, Kleidung verschiedener Art) sind KEINE Alternativen.
Antworte nur mit JSON:
{"entscheide":[{"index":0,"alternativ":true,"grund":"kurzer Satz auf Deutsch"}]}
Für jeden übergebenen Kandidaten genau einen Eintrag. Im Zweifel alternativ=false.`

type XorCand = XorCandidateForAi

function labelOf(c: XorCand): { left: string; right: string } {
  const left = c.options[0]?.names.join(' und ') ?? c.names[0] ?? ''
  const right = c.options[1]?.names.join(' und ') ?? c.names[1] ?? ''
  return { left, right }
}

export async function confirmXorCandidatesWithAi(
  db: D1Database,
  apiKey: string | null | undefined,
  candidates: XorCand[]
): Promise<XorCand[]> {
  if (candidates.length === 0) return []
  if (!apiKey) return candidates

  const cacheKey = hashCacheKey([
    'xor-veto-v1',
    ...candidates.map((c) => c.ids.slice().sort().join(',')),
  ])
  const cached = await getAiCallCache(db, cacheKey)
  if (cached && Array.isArray(cached.keepIndexes)) {
    const keep = new Set((cached.keepIndexes as unknown[]).map((n) => Number(n)).filter(Number.isFinite))
    return candidates.filter((_, i) => keep.has(i))
  }

  const list = candidates
    .map((c, index) => {
      const { left, right } = labelOf(c)
      return `${index}: ENTWEDER „${left}“ ODER „${right}“ (zusammen ${c.together}×, mindestens eines ${c.either}×)`
    })
    .join('\n')

  try {
    const result = await chatJson({
      apiKey,
      system: SYSTEM,
      user: `Kandidaten:\n${list}`,
      temperature: 0,
      trigger: 'auto',
      title: 'Camping Packliste XOR-Veto',
    })
    const raw = result.json.entscheide
    if (!Array.isArray(raw)) return candidates
    const keep = new Set<number>()
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue
      const rec = row as { index?: unknown; alternativ?: unknown }
      const index = Number(rec.index)
      if (!Number.isInteger(index) || index < 0 || index >= candidates.length) continue
      if (rec.alternativ === true) keep.add(index)
    }
    await setAiCallCache(db, cacheKey, { keepIndexes: [...keep] })
    return candidates.filter((_, i) => keep.has(i))
  } catch (error) {
    console.error('XOR-KI-Veto:', error)
    return candidates
  }
}
