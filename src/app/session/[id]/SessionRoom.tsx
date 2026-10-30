'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState, Collaborator, SocketId, BinaryFiles, BinaryFileData } from '@excalidraw/excalidraw/types'
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import '@excalidraw/excalidraw/index.css'
import { Icons } from '@/components/ui/icons'
import { InfoTip } from '@/components/ui/info-tip'
import LatexRenderer from '@/components/latex-renderer'
import { QuestionMedia } from '@/components/question-media'
import type { FigureSpec } from '@/lib/figures'
import { formatDate } from '@/lib/dates'

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
  studentProfileId: string | null
}) {
  const { sessionId, isTutor } = props
  const [initial, setInitial] = useState<ExcalidrawInitialDataState | null>(null)
  const [question, setQuestion] = useState<ShownQuestion | null>(null)
  const [questionOpen, setQuestionOpen] = useState(true)
  const [online, setOnline] = useState(1)
  const [connected, setConnected] = useState(false)
  const [startedAt, setStartedAt] = useState(props.startedAt)
  const [ended, setEnded] = useState(false)
  const [ending, setEnding] = useState(false)
  const [followUp, setFollowUp] = useState(true)
  const [endNote, setEndNote] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState<string[]>([])
  const [panel, setPanel] = useState<'notes' | 'question' | null>(isTutor ? 'question' : null)
  const clock = useClock(startedAt)

  const api = useRef<ExcalidrawImperativeAPI | null>(null)
  const clientId = useRef('')
  const known = useRef(new Map<string, number>())
  const pending = useRef(new Map<string, OrderedExcalidrawElement>())
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPointer = useRef(0)
  const peers = useRef(new Map<SocketId, Collaborator>())
  // Image file ids the server already has (uploaded by us or fetched from it)
  const knownFiles = useRef(new Set<string>())
  const pointer = useRef<{ x: number; y: number } | null>(null)

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

  /** Fetch board images by id and hand them to Excalidraw. */
  const loadFiles = useCallback(async (list: { id: string; mimeType: string }[]) => {
    const fresh = list.filter(f => !knownFiles.current.has(f.id))
    if (fresh.length === 0) return
    fresh.forEach(f => knownFiles.current.add(f.id))
    const loaded = await Promise.all(fresh.map(async f => {
      try {
        const blob = await (await fetch(`/api/sessions/${sessionId}/board/files/${encodeURIComponent(f.id)}`)).blob()
        const dataURL = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(blob) })
        return { id: f.id, mimeType: f.mimeType, dataURL, created: Date.now() } as unknown as BinaryFileData
      } catch { knownFiles.current.delete(f.id); return null }
    }))
    // Excalidraw may still be mounting on first load
    for (let i = 0; i < 50 && !api.current; i++) await new Promise(r => setTimeout(r, 100))
    api.current?.addFiles(loaded.filter((f): f is BinaryFileData => f !== null))
  }, [sessionId])

  // Load the board, then follow it live
  useEffect(() => {
    clientId.current = crypto.randomUUID()
    let es: EventSource | null = null
    let cancelled = false

    const load = async () => {
      const res = await fetch(`/api/sessions/${sessionId}/board`)
      const data = await res.json()
      return data as { elements: Remote[]; files?: { id: string; mimeType: string }[]; question: ShownQuestion | null; online: number; reviewed?: string[] }
    }

    load().then(data => {
      if (cancelled) return
      for (const el of data.elements) known.current.set(el.id, el.version)
      setInitial({ elements: data.elements as never, appState: { viewBackgroundColor: '#fbfaf6', currentItemStrokeColor: '#17202f', currentItemRoughness: 0, currentItemFontFamily: 2 }, scrollToContent: true })
      setQuestion(data.question)
      setReviewed(data.reviewed ?? [])
      void loadFiles(data.files ?? [])
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
        else if (ev.type === 'file') void loadFiles([{ id: ev.id, mimeType: ev.mimeType }])
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
  }, [sessionId, applyRemote, loadFiles])

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

  const onChange = useCallback((elements: readonly OrderedExcalidrawElement[], _appState: unknown, files: BinaryFiles) => {
    // New images (pasted, dropped or inserted): send each to the server once
    for (const f of Object.values(files)) {
      if (knownFiles.current.has(f.id)) continue
      knownFiles.current.add(f.id)
      fetch(`/api/sessions/${sessionId}/board/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId.current, id: f.id, mimeType: f.mimeType, dataURL: f.dataURL }),
      }).then(r => { if (!r.ok) knownFiles.current.delete(f.id) }).catch(() => knownFiles.current.delete(f.id))
    }
    for (const el of elements) {
      if (known.current.get(el.id) !== el.version) {
        known.current.set(el.id, el.version)
        pending.current.set(el.id, el)
      }
    }
    if (pending.current.size && !flushTimer.current) flushTimer.current = setTimeout(flush, 80)
  }, [flush, sessionId])

  async function insertImage(file: File) {
    const ex = api.current
    if (!ex) return
    const { dataURL, width, height, mimeType } = await prepareImage(file)
    const { convertToExcalidrawElements, CaptureUpdateAction } = await import('@excalidraw/excalidraw')
    const st = ex.getAppState()
    const zoom = st.zoom.value
    // Under the pointer if it is over the board, otherwise the middle of the view
    const px = pointer.current ? pointer.current.x - st.offsetLeft : st.width / 2
    const py = pointer.current ? pointer.current.y - st.offsetTop : st.height / 2
    const x = px / zoom - st.scrollX - width / 2
    const y = py / zoom - st.scrollY - height / 2
    const fileId = crypto.randomUUID().replace(/-/g, '')
    ex.addFiles([{ id: fileId, dataURL, mimeType, created: Date.now() } as unknown as BinaryFileData])
    const [el] = convertToExcalidrawElements([{ type: 'image', fileId: fileId as never, x, y, width, height }])
    ex.updateScene({ elements: [...ex.getSceneElementsIncludingDeleted(), el], captureUpdate: CaptureUpdateAction.IMMEDIATELY })
    ex.setActiveTool({ type: 'selection' })
  }

  // Image paste: handled here rather than by Excalidraw, which ignores a paste
  // unless keyboard focus is in the canvas and the pointer is over it.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.('input, textarea, [contenteditable="true"]')) return
      const items = [...(e.clipboardData?.items ?? [])]
      const file = items.map(i => (i.kind === 'file' ? i.getAsFile() : null)).find((f): f is File => !!f && /^image\/(png|jpeg|gif|webp)$/.test(f.type))
      if (!file || !api.current) return
      e.preventDefault()
      e.stopImmediatePropagation()
      void insertImage(file)
    }
    window.addEventListener('paste', onPaste, true)
    return () => window.removeEventListener('paste', onPaste, true)
  }, [])

  const onPointerUpdate = useCallback((payload: { pointer: { x: number; y: number; tool: 'pointer' | 'laser' }; button: 'down' | 'up' }) => {
    const t = Date.now()
    if (t - lastPointer.current < 50) return
    lastPointer.current = t
    void post({ type: 'pointer', pointer: payload.pointer, button: payload.button })
  }, [post])

  async function endSession() {
    const res = await fetch(`/api/sessions/${sessionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'end' }) })
    if (!res.ok) { setEndNote('Could not end the session'); return }
    setEnded(true)
    setEnding(false)
    if (followUp && reviewed.length > 0 && props.studentProfileId) {
      const day = formatDate(new Date())
      const due = new Date(Date.now() + 7 * 86_400_000).toISOString()
      const a = await fetch('/api/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `Follow-up from ${day}`, description: 'Questions from our session. Try them again on your own.', studentProfileId: props.studentProfileId, questionIds: reviewed, dueAt: due }) })
      setEndNote(a.ok ? `Follow-up with ${reviewed.length} question${reviewed.length === 1 ? '' : 's'} assigned` : 'Session ended, but the follow-up could not be assigned')
    } else setEndNote('Session ended')
  }

  const Back = Icons.chevronLeft
  const Video = Icons.video
  const Notes = Icons.notes
  const Board = Icons.board

  return (
    <div className="relative flex h-dvh flex-col bg-paper">
      <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-line bg-white px-3 sm:px-4">
        <Link href={props.backHref} className="rounded-lg p-1.5 text-gray-500 hover:bg-paper hover:text-ink" aria-label="Leave the room"><Back className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-extrabold text-ink sm:text-base">{props.title}</h1>
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <span className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-[#2f855a]' : 'bg-gray-300'}`} aria-hidden />
            <span>{connected ? (online > 1 ? `${online} here` : 'Only you so far') : 'Connecting…'}</span>
            {clock && !ended && <span className="tnum">· {clock}</span>}
            {ended && <span className="chip chip-good !py-0">{endNote || 'Ended'}</span>}
          </p>
        </div>
        {props.meetLink && (
          <a href={props.meetLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><Video className="h-4 w-4" /><span className="hidden sm:inline">Video call</span></a>
        )}
        {isTutor && (
          <>
            <button type="button" onClick={() => setPanel(p => (p === 'question' ? null : 'question'))} aria-pressed={panel === 'question'} className={`btn btn-sm ${panel === 'question' ? 'btn-primary' : 'btn-secondary'}`}><Board className="h-4 w-4" /><span className="hidden sm:inline">Questions</span></button>
            <button type="button" onClick={() => setPanel(p => (p === 'notes' ? null : 'notes'))} aria-pressed={panel === 'notes'} className={`btn btn-sm ${panel === 'notes' ? 'btn-primary' : 'btn-secondary'}`}><Notes className="h-4 w-4" /><span className="hidden sm:inline">Notes</span></button>
            {!ended && <button type="button" onClick={() => setEnding(e => !e)} aria-expanded={ending} className="btn btn-ghost btn-sm">End</button>}
          </>
        )}
      </header>

      {ending && !ended && (
        <div className="absolute right-3 top-16 z-30 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-white p-4 shadow-xl" role="dialog" aria-label="End the session">
          <p className="font-extrabold text-ink">End this session?</p>
          <p className="mt-1 text-sm text-gray-500">The board and your notes stay saved with the session.</p>
          {reviewed.length > 0 && props.studentProfileId && (
            <label className="mt-3 flex items-start gap-2 rounded-xl bg-paper p-3 text-sm text-gray-700">
              <input type="checkbox" checked={followUp} onChange={e => setFollowUp(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
              <span>Assign the {reviewed.length} question{reviewed.length === 1 ? '' : 's'} we looked at as follow-up practice, due in a week</span>
            </label>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setEnding(false)} className="btn btn-ghost btn-sm">Not yet</button>
            <button type="button" onClick={endSession} className="btn btn-primary btn-sm">End session</button>
          </div>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1" onPointerMove={e => { pointer.current = { x: e.clientX, y: e.clientY } }} onPointerLeave={() => { pointer.current = null }}>
          {initial ? (
            <Excalidraw
              excalidrawAPI={a => { api.current = a }}
              initialData={initial}
              onChange={onChange}
              onPointerUpdate={onPointerUpdate}
              isCollaborating
              theme="light"
              name={props.title}
              UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: false, export: false, changeViewBackgroundColor: true, clearCanvas: isTutor, saveAsImage: true }, tools: { image: true } }}
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
              : <QuestionPanel sessionId={sessionId} shownId={question?.id ?? null} onShow={async id => { const res = await post({ type: 'question', questionId: id }); const d = await res.json(); setQuestion(d.question); setQuestionOpen(true); if (Array.isArray(d.reviewed)) setReviewed(d.reviewed) }} onClose={() => setPanel(null)} />}
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

/**
 * Read a pasted image, scaled down so its longest side is at most 1600 px
 * (keeps uploads small), and work out a display size on the board.
 */
async function prepareImage(file: File): Promise<{ dataURL: string; width: number; height: number; mimeType: string }> {
  const original = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file) })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = original })
  const MAX = 1600
  let dataURL = original
  let mimeType = file.type
  if ((img.naturalWidth > MAX || img.naturalHeight > MAX || file.size > 2_000_000) && file.type !== 'image/gif') {
    const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * k)
    c.height = Math.round(img.naturalHeight * k)
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
    mimeType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
    dataURL = c.toDataURL(mimeType, 0.88)
  }
  // On the board: at most 600 x 450, keeping the shape
  const k = Math.min(1, 600 / img.naturalWidth, 450 / img.naturalHeight)
  return { dataURL, width: Math.round(img.naturalWidth * k), height: Math.round(img.naturalHeight * k), mimeType }
}
