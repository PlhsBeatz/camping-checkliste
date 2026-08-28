/**
 * Gemeinsamer OpenRouter-Client für strukturierte JSON-Antworten.
 * Feature-Code entscheidet über trigger 'auto' | 'explicit'.
 */

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
export const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-4o-mini'

export type AiTrigger = 'auto' | 'explicit'

export type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'file'; file: { filename: string; file_data: string } }

export type OpenRouterUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

export type ChatJsonInput = {
  apiKey: string
  system: string
  user: string | OpenRouterContentPart[]
  model?: string
  temperature?: number
  /** PDF-Plugin aktivieren, wenn Dateien im User-Content sind */
  pdfPlugin?: boolean
  /** Zusätzliche OpenRouter-Plugins, z. B. Websuche */
  plugins?: Array<Record<string, unknown>>
  trigger?: AiTrigger
  referer?: string
  title?: string
}

export type ChatJsonResult = {
  json: Record<string, unknown>
  model: string
  usage?: OpenRouterUsage
  trigger: AiTrigger
}

function parseJsonContent(content: string): Record<string, unknown> {
  const trimmed = content.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  const raw = (fenced?.[1] ?? trimmed).trim()
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    throw new Error('KI-Antwort ist kein gültiges JSON')
  }
}

export async function chatJson(input: ChatJsonInput): Promise<ChatJsonResult> {
  const model = input.model?.trim() || OPENROUTER_DEFAULT_MODEL
  const trigger = input.trigger ?? 'explicit'
  const userContent = input.user

  const body: Record<string, unknown> = {
    model,
    temperature: input.temperature ?? 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: userContent },
    ],
  }

  if (input.pdfPlugin || (input.plugins && input.plugins.length > 0)) {
    const plugins: Array<Record<string, unknown>> = []
    if (input.pdfPlugin) plugins.push({ id: 'file-parser', pdf: { engine: 'pdf-text' } })
    if (input.plugins) plugins.push(...input.plugins)
    body.plugins = plugins
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': input.referer ?? 'https://github.com/PlhsBeatz/camping-checkliste',
      'X-Title': input.title ?? 'Camping Packliste',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: OpenRouterUsage
    model?: string
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Leere KI-Antwort')

  return {
    json: parseJsonContent(content),
    model: data.model || model,
    usage: data.usage,
    trigger,
  }
}
