import { useCallback, useEffect, useRef, useState } from 'react'
import { clientId } from './api'
import { record, type Recorder } from './recorder'

export type Line = { text: string; start_ms: number; end_ms: number; lang: string | null }
export type Status = 'idle' | 'starting' | 'recording' | 'saving' | 'done' | 'error'

type State = {
  status: Status
  lines: Line[]
  partial: string
  error: string
  savedId: string | null
  reason: string
}

const quiet: number[] = Array(24).fill(0)

const blank: State = { status: 'idle', lines: [], partial: '', error: '', savedId: null, reason: '' }

function micError(e: unknown) {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError') return 'Microphone access was blocked. Allow it in the browser and try again.'
  if (name === 'NotFoundError') return 'No microphone was found on this device.'
  return 'Could not start the microphone.'
}

export function useLive() {
  const [state, setState] = useState(blank)
  const [levels, setLevels] = useState(quiet)
  const [ms, setMs] = useState(0)
  const ws = useRef<WebSocket | null>(null)
  const rec = useRef<Recorder | null>(null)
  const queue = useRef<ArrayBuffer[]>([])
  const open = useRef(false)
  const t0 = useRef(0)

  const release = useCallback(() => {
    rec.current?.stop()
    rec.current = null
    open.current = false
    queue.current = []
    setLevels(quiet)
  }, [])

  const start = useCallback(
    async (engine: string) => {
      setState({ ...blank, status: 'starting' })
      setMs(0)
      try {
        rec.current = await record(pcm => {
          const s = ws.current
          if (open.current && s?.readyState === WebSocket.OPEN) s.send(pcm)
          else if (queue.current.length < 100) queue.current.push(pcm)
        }, peak => setLevels(l => [...l.slice(1), peak]))
      } catch (e) {
        setState({ ...blank, status: 'error', error: micError(e) })
        return
      }

      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const s = new WebSocket(
        `${proto}//${location.host}/ws/transcribe?engine=${engine}&client_id=${clientId}`,
      )
      s.binaryType = 'arraybuffer'
      ws.current = s
      let ended = false

      s.onmessage = e => {
        const m = JSON.parse(e.data)
        if (m.type === 'ready') {
          open.current = true
          queue.current.forEach(c => s.send(c))
          queue.current = []
          t0.current = Date.now()
          setState(st => ({ ...st, status: 'recording' }))
        } else if (m.type === 'partial') {
          setState(st => ({ ...st, partial: m.text }))
        } else if (m.type === 'final') {
          setState(st => ({ ...st, partial: '', lines: [...st.lines, m] }))
        } else if (m.type === 'done') {
          ended = true
          release()
          setState(st => ({ ...st, status: 'done', partial: '', savedId: m.id, reason: m.reason }))
        } else if (m.type === 'error') {
          ended = true
          release()
          setState(st => ({ ...st, status: 'error', error: m.message }))
        }
      }
      s.onclose = () => {
        if (ended) return
        release()
        setState(st => ({ ...st, status: 'error', partial: '', error: 'The connection to the server was lost.' }))
      }
    },
    [release],
  )

  const stop = useCallback(() => {
    rec.current?.stop()
    rec.current = null
    setLevels(quiet)
    const s = ws.current
    if (s?.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify({ type: 'stop' }))
      setState(st => ({ ...st, status: 'saving' }))
    } else {
      s?.close()
    }
  }, [])

  const reset = useCallback(() => setState(blank), [])

  useEffect(() => {
    if (state.status !== 'recording') return
    const t = setInterval(() => setMs(Date.now() - t0.current), 200)
    return () => clearInterval(t)
  }, [state.status])

  useEffect(
    () => () => {
      rec.current?.stop()
      const s = ws.current
      if (s) {
        s.onclose = null
        s.onmessage = null
        s.close()
      }
    },
    [],
  )

  return { ...state, levels, ms, start, stop, reset }
}
