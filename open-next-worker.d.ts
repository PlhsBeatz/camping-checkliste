/**
 * OpenNext erzeugt `.open-next/worker.js` erst nach `next build`.
 * Ohne diese Deklaration schlägt die Typprüfung fehl, solange die Datei noch nicht existiert.
 */
declare module './.open-next/worker.js' {
  const handler: {
    fetch(
      request: Request,
      env: unknown,
      ctx: ExecutionContext
    ): Response | Promise<Response>
  }
  export default handler
}
