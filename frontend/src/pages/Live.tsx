import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Engine } from '../api'
import { clock, engineName } from '../format'
import { useLive } from '../useLive'

const about: Record<string, string> = {
  whisper: 'Whisper tuned for Hinglish, running on this server',
  gemini: "Google's live transcription API",
}

function doneNote(reason: string, saved: boolean, max: number) {
  if (!saved) return 'Nothing was heard, so nothing was saved.'
  if (reason === 'limit') return `Stopped at the ${Math.round(max / 60)} minute limit and saved.`
  if (reason === 'engine') return 'The speech engine stopped early. What it heard is saved.'
  return 'Saved to history.'
}

export default function Live() {
  const live = useLive()
  const [engines, setEngines] = useState<Engine[] | null>(null)
  const [max, setMax] = useState(180)
  const [engine, setEngine] = useState(() => localStorage.getItem('engine') ?? '')
  const [loadError, setLoadError] = useState('')
  const [copied, setCopied] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .engines()
      .then(r => {
        setEngines(r.engines)
        setMax(r.max_seconds)
        setEngine(e => (r.engines.some(x => x.name === e) ? e : (r.engines[0]?.name ?? '')))
      })
      .catch(() => setLoadError('Could not reach the server.'))
  }, [])

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight })
  }, [live.lines, live.partial])

  const busy = live.status === 'starting' || live.status === 'recording' || live.status === 'saving'
  const recording = live.status === 'recording'
  const text = live.lines.map(l => l.text).join(' ')
  const hasText = live.lines.length > 0 || live.partial

  function pick(name: string) {
    setEngine(name)
    localStorage.setItem('engine', name)
  }

  function toggle() {
    if (recording) live.stop()
    else if (!busy && engine) void live.start(engine)
  }

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="live">
      <div className="head">
        <div>
          <h1>Speak in Hindi, English, or both</h1>
          <p className="soft">Words appear as you talk. Each recording is saved to your history.</p>
        </div>
      </div>

      {loadError && <p className="alert">{loadError}</p>}
      {engines?.length === 0 && <p className="alert">No speech engine is set up on this server.</p>}

      {engines && engines.length > 0 && (
        <div className="engines" role="radiogroup" aria-label="Speech engine">
          {engines.map(e => (
            <button
              key={e.name}
              role="radio"
              aria-checked={engine === e.name}
              className={engine === e.name ? 'on' : ''}
              disabled={busy}
              onClick={() => pick(e.name)}
            >
              <strong>{engineName[e.name] ?? e.name}</strong>
              <span>{about[e.name] ?? e.model}</span>
            </button>
          ))}
        </div>
      )}

      <div className="card stage">
        <div className="words" ref={box} aria-live="polite">
          {hasText ? (
            <p>
              {live.lines.map((l, i) => (
                <span key={i}>{l.text} </span>
              ))}
              {live.partial && <span className="partial">{live.partial}</span>}
            </p>
          ) : (
            <div className="hint">
              {recording ? (
                <p>Listening…</p>
              ) : (
                <>
                  <p>Press the mic and start talking.</p>
                  <p className="soft">Try: “Mujhe kal office jaana hai, because meeting hai at ten.”</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="controls">
          <div className="time">
            {recording && <i className="dot" />}
            <b>{clock(live.ms)}</b>
            <span className="soft"> / {clock(max * 1000)}</span>
          </div>

          <button
            className={'mic' + (recording ? ' rec' : '')}
            style={{ boxShadow: recording ? `0 0 0 ${4 + live.level * 22}px var(--red-soft)` : undefined }}
            onClick={toggle}
            disabled={!engine || live.status === 'starting' || live.status === 'saving'}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
          >
            {recording ? (
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
                <path
                  d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>

          <div className="state soft">
            {live.status === 'idle' && 'Ready'}
            {live.status === 'starting' && 'Starting…'}
            {live.status === 'recording' && 'Recording. Press to stop.'}
            {live.status === 'saving' && 'Saving…'}
            {live.status === 'done' && 'Done'}
            {live.status === 'error' && 'Stopped'}
          </div>
        </div>
      </div>

      {live.status === 'error' && <p className="alert">{live.error}</p>}

      {live.status === 'done' && (
        <div className="after">
          <span>{doneNote(live.reason, !!live.savedId, max)}</span>
          <span className="grow" />
          {live.savedId && (
            <>
              <button className="btn" onClick={copy}>
                {copied ? 'Copied' : 'Copy text'}
              </button>
              <Link className="btn" to={`/history/${live.savedId}`}>
                Open
              </Link>
            </>
          )}
          <button className="btn primary" onClick={live.reset}>
            New recording
          </button>
        </div>
      )}
    </section>
  )
}
