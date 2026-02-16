/**
 * Typdeklaration für das Cloudflare-Runtime-Modul 'cloudflare:workers'.
 * Das Modul wird zur Laufzeit von Cloudflare Workers bereitgestellt.
 * Hinweis: env.d.ts nicht überschreiben – diese Datei bleibt erhalten.
 */
/// <reference types="@cloudflare/workers-types" />
declare module 'cloudflare:workers' {
  export class DurableObject<Env = object> {
    constructor(ctx: DurableObjectState, env: Env)
  }
}
