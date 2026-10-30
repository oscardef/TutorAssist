import { authorizeRoom } from '@/lib/session-board'
import { subscribe, publish, listenerCount, type LiveEvent } from '@/lib/live-bus'

export const dynamic = 'force-dynamic'

/** Server-Sent Events: everything other people do on this board. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await authorizeRoom(id, request.headers.get('cookie'))
  if (!access) return new Response('Not found', { status: 404 })
  const clientId = new URL(request.url).searchParams.get('client') || ''
  const room = `board:${id}`
  const encoder = new TextEncoder()

  let cleanup = () => {}
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: LiveEvent) => {
        if (event.from && event.from === clientId) return
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)) } catch { cleanup() }
      }
      const unsubscribe = subscribe(room, send)
      publish(room, { type: 'presence', online: listenerCount(room), joined: access.name })
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')) } catch { cleanup() }
      }, 25_000)
      cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
        publish(room, { type: 'presence', online: listenerCount(room), left: access.name, leftClient: clientId })
        cleanup = () => {}
        try { controller.close() } catch { /* already closed */ }
      }
      request.signal.addEventListener('abort', () => cleanup())
      controller.enqueue(encoder.encode(`retry: 2000\ndata: ${JSON.stringify({ type: 'presence', online: listenerCount(room) })}\n\n`))
    },
    cancel() { cleanup() },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
