'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState, Collaborator, SocketId } from '@excalidraw/excalidraw/types'
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import '@excalidraw/excalidraw/index.css'
import { Icons } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'
import LatexRenderer from '@/components/latex-renderer'
import { QuestionMedia } from '@/components/question-media'
import type { FigureSpec } from '@/lib/figures'

const Excalidraw = dynamic(async () => (await import('@excalidraw/excalidraw')).Excalidraw, {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-gray-500">Opening the board…</div>,
})

interface ShownQuestion { id: string; prompt_text: string; prompt_latex: string | null; figure_json: unknown; prompt_image_r2_key: string | null }
interface SearchHit { id: string; prompt_text: string; prompt_latex: string | null; difficulty: number | null; topics: { name: string } | null }
type Remote = { id: string; version: number; versionNonce: number }

const PEER_COLORS = [{ background: '#d2ecea', stroke: '#0f7a77' }, { background: '#fde9c8', stroke: '#b9771a' }, { background: '#e6e1f5', stroke: '#5b4b9a' }]

function useClock(startIso: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const start = startIso ? new Date(startIso).getTime() : null
  if (!start) return null
  const s = Math.max(0, Math.floor((now - start) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function SessionRoom(props: {
  sessionId: string
  isTutor: boolean
  myName: string
  title: string
  meetLink: string | null
  scheduledAt: string | null
  durationMinutes: number | null
  initialNotes: string
  startedAt: string | null
  backHref: string
}) {
  const { sessionId, isTutor } = props
  const [initial, setInitial] = useState<ExcalidrawInitialDataState | null>(null)
  const [question, setQuestion] = useState<ShownQuestion | null>(null)
  const [questionOpen, setQuestionOpen] = useState(true)
  const [online, setOnline] = useState(1)
  const [connected, setConnected] = useState(false)
  const [startedAt, setStartedAt] = useState(props.startedAt)
  const [ended, setEnded] = useState(false)
  const [panel, setPanel] = useState<'notes' | 'question' | null>(isTutor ? 'question' : null)
  const clock = useClock(startedAt)

  const api = useRef<ExcalidrawImperativeAPI | null>(null)
  const clientId = useRef('')
  const known = useRef(new Map<string, number>())
  const pending = useRef(new Map<string, OrderedExcalidrawElement>())
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPointer = useRef(0)
  const peers = useRef(new Map<SocketId, Collaborator>())

  const post = useCallback((body: Record<string, unknown>) => fetch(`/api/sessions/${sessionId}/board`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: clientId.current, ...body }), keepalive: true,
  }), [sessionId])

  const applyRemote = useCallback(async (remote: Remote[]) => {
    const ex = api.current
    if (!ex || remote.length === 0) return
    const { reconcileElements, CaptureUpdateAction } = await import('@excalidraw/excalidraw')
    for (const el of remote) known.current.set(el.id, el.version)
    const merged = reconcileElements(ex.getSceneElementsIncludingDeleted(), remote as never, ex.getAppState())
    ex.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER })
  }, [])

  // Load the board, then follow it live
  useEffect(() => {
    clientId.current = crypto.randomUUID()
    let es: EventSource | null = null
    let cancelled = false

    const load = async () => {
      const res = await fetch(`/api/sessions/${sessionId}/board`)
      const data = await res.json()
      return data as { elements: Remote[]; question: ShownQuestion | null; online: number }
    }

    load().then(data => {
      if (cancelled) return
      for (const el of data.elements) known.current.set(el.id, el.version)
      setInitial({ elements: data.elements as never, appState: { viewBackgroundColor: '#fbfaf6', currentItemStrokeColor: '#17202f', currentItemRoughness: 0, currentItemFontFamily: 2 }, scrollToContent: true })
      setQuestion(data.question)
      es = new EventSource(`/api/sessions/${sessionId}/board/stream?client=${clientId.current}`)
      let first = true
      es.onopen = () => {
        setConnected(true)
        // After a reconnect, catch up on anything missed
        if (!first) load().then(d => { void applyRemote(d.elements); setQuestion(d.question) })
        first = false
      }
      es.onerror = () => setConnected(false)
      es.onmessage = msg => {
        const ev = JSON.parse(msg.data)
        if (ev.type === 'elements') void applyRemote(ev.elements)
        else if (ev.type === 'question') { setQuestion(ev.question); setQuestionOpen(true) }
        else if (ev.type === 'presence') {
          setOnline(ev.online)
          if (ev.leftClient && api.current) { peers.current.delete(ev.leftClient); api.current.updateScene({ collaborators: new Map(peers.current) }) }
        } else if (ev.type === 'pointer' && api.current) {
          const color = PEER_COLORS[ev.isTutor ? 0 : 1]
          peers.current.set(ev.from, { pointer: ev.pointer, button: ev.button, username: ev.name, color, id: ev.from })
          api.current.updateScene({ collaborators: new Map(peers.current) })
        }
      }
    })
    return () => { cancelled = true; es?.close() }
  }, [sessionId, applyRemote])

  // Tutor opening the room starts the session clock
  useEffect(() => {
    if (!isTutor || props.startedAt) return
    fetch(`/api/sessions/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) })
      .then(r => r.json()).then(d => { if (d.session?.actual_start) setStartedAt(d.session.actual_start) })
  }, [isTutor, props.startedAt, sessionId])

  const flush = useCallback(() => {
    flushTimer.current = null
    const elements = [...pending.current.values()]
    pending.current.clear()
    if (elements.length) void post({ type: 'elements', elements })
  }, [post])

  const onChange = useCallback((elements: readonly OrderedExcalidrawElement[]) => {
    for (const el of elements) {
      if (known.current.get(el.id) !== el.version) {
        known.current.set(el.id, el.version)
        pending.current.set(el.id, el)
      }
    }
    if (pending.current.size && !flushTimer.current) flushTimer.current = setTimeout(flush, 80)
  }, [flush])

  const onPointerUpdate = useCallback((payload: { pointer: { x: number; y: number; tool: 'pointer' | 'laser' }; button: 'down' | 'up' }) => {
    const t = Date.now()
    if (t - lastPointer.current < 50) return
    lastPointer.current = t
    void post({ type: 'pointer', pointer: payload.pointer, button: payload.button })
  }, [post])

  async function endSession() {
    const res = await fetch(`/api/sessions/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'end' }) })
    if (res.ok) setEnded(true)
  }

  const Back = Icons.chevronLeft
  const Video = Icons.video
  const Notes = Icons.notes
  const Board = Icons.board

  return (
    <div className="flex h-dvh flex-col bg-paper">
      <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-line bg-white px-3 sm:px-4">
        <Link href={props.backHref} className="rounded-lg p-1.5 text-gray-500 hover:bg-paper hover:text-ink" aria-label="Leave the room"><Back className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-extrabold text-ink sm:text-base">{props.title}</h1>
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <span className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-[#2f855a]' : 'bg-gray-300'}`} aria-hidden />
            <span>{connected ? (online > 1 ? `${online} here` : 'Only you so far') : 'Connecting…'}</span>
            {clock && <span className="tnum">· {clock}</span>}
            {ended && <span className="chip chip-good !py-0">Ended</span>}
          </p>
        </div>
        {props.meetLink && (
          <a href={props.meetLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><Video className="h-4 w-4" /><span className="hidden sm:inline">Video call</span></a>
        )}
        {isTutor && (
          <>
            <button type="button" onClick={() => setPanel(p => (p === 'question' ? null : 'question'))} aria-pressed={panel === 'question'} className={`btn btn-sm ${panel === 'question' ? 'btn-primary' : 'btn-secondary'}`}><Board className="h-4 w-4" /><span className="hidden sm:inline">Questions</span></button>
            <button type="button" onClick={() => setPanel(p => (p === 'notes' ? null : 'notes'))} aria-pressed={panel === 'notes'} className={`btn btn-sm ${panel === 'notes' ? 'btn-primary' : 'btn-secondary'}`}><Notes className="h-4 w-4" /><span className="hidden sm:inline">Notes</span></button>
            {!ended && <button type="button" onClick={endSession} className="btn btn-ghost btn-sm hidden sm:inline-flex">End</button>}
          </>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          {initial ? (
            <Excalidraw
              excalidrawAPI={a => { api.current = a }}
              initialData={initial}
              onChange={onChange}
              onPointerUpdate={onPointerUpdate}
              isCollaborating
              theme="light"
              name={props.title}
              UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: false, export: false, changeViewBackgroundColor: true, clearCanvas: isTutor, saveAsImage: true }, tools: { image: false } }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">Opening the board…</div>
          )}

          {question && (
            <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center px-3">
              <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-line bg-white/95 shadow-lg backdrop-blur">
                <div className="flex items-center justify-between gap-2 px-4 py-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-brand-700">Question</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setQuestionOpen(o => !o)} className="btn btn-ghost btn-sm !min-h-8">{questionOpen ? 'Minimise' : 'Show'}</button>
                    {isTutor && <button type="button" onClick={() => { setQuestion(null); void post({ type: 'question', questionId: null }) }} className="btn btn-ghost btn-sm !min-h-8" aria-label="Stop showing the question"><Icons.x className="h-4 w-4" /></button>}
                  </div>
                </div>
                {questionOpen && (
                  <div className="max-h-[40vh] overflow-y-auto px-4 pb-4 text-ink">
                    <LatexRenderer content={question.prompt_latex || question.prompt_text} />
                    <QuestionMedia imageKey={question.prompt_image_r2_key} figure={question.figure_json as FigureSpec | null} className="mt-3" />
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {isTutor && panel && (
          <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-line bg-white shadow-xl sm:static sm:w-80 sm:shadow-none">
            {panel === 'notes'
              ? <NotesPanel sessionId={sessionId} initial={props.initialNotes} onClose={() => setPanel(null)} />
              : <QuestionPanel sessionId={sessionId} shownId={question?.id ?? null} onShow={async id => { const res = await post({ type: 'question', questionId: id }); const d = await res.json(); setQuestion(d.question); setQuestionOpen(true) }} onClose={() => setPanel(null)} />}
          </aside>
        )}
      </div>
    </div>
  )
}

function PanelHeader({ title, tip, onClose }: { title: string; tip?: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-3">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-extrabold text-ink">{title}{tip && <InfoTip text={tip} className="text-gray-400" />}</h2>
      <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-paper hover:text-ink" aria-label="Close panel"><Icons.x className="h-4 w-4" /></button>
    </div>
  )
}

function NotesPanel({ sessionId, initial, onClose }: { sessionId: string; initial: string; onClose: () => void }) {
  const [notes, setNotes] = useState(initial)
  const [state, setState] = useState<'saved' | 'saving' | 'idle'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function change(v: string) {
    setNotes(v)
    setState('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await fetch(`/api/sessions/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: v }) })
      setState('saved')
    }, 800)
  }
  return (
    <>
      <PanelHeader title="Session notes" tip="Only tutors see these. They are saved with the session." onClose={onClose} />
      <textarea value={notes} onChange={e => change(e.target.value)} placeholder="What you covered, what to practise next…" className="min-h-0 flex-1 resize-none p-4 text-sm text-ink outline-none" aria-label="Session notes" />
      <p className="border-t border-line px-4 py-2 text-xs text-gray-500" role="status">{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Saved automatically'}</p>
    </>
  )
}

function QuestionPanel({ sessionId, shownId, onShow, onClose }: { sessionId: string; shownId: string | null; onShow: (id: string) => Promise<void>; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/sessions/${sessionId}/board?q=${encodeURIComponent(q)}`).then(r => r.json()).then(d => setHits(d.questions || []))
    }, 250)
    return () => clearTimeout(t)
  }, [q, sessionId])
  const Search = Icons.search
  return (
    <>
      <PanelHeader title="Show a question" tip="Puts the question above the board for both of you. Work through it together on the board." onClose={onClose} />
      <div className="border-b border-line p-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search your question bank…" className="input !pl-9" aria-label="Search questions" />
        </label>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {hits.map(h => (
          <li key={h.id}>
            <button type="button" disabled={busy === h.id} onClick={async () => { setBusy(h.id); await onShow(h.id); setBusy(null) }} className={`block w-full px-4 py-3 text-left text-sm hover:bg-paper ${shownId === h.id ? 'bg-brand-50' : ''}`}>
              {h.topics?.name && <span className="mb-1 block text-xs font-semibold text-brand-700">{h.topics.name}</span>}
              <span className="line-clamp-3 text-ink"><LatexRenderer content={h.prompt_latex || h.prompt_text} /></span>
              {shownId === h.id && <span className="mt-1 block text-xs font-bold text-brand-700">On the board</span>}
            </button>
          </li>
        ))}
        {hits.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-500">No questions found</li>}
      </ul>
    </>
  )
}
