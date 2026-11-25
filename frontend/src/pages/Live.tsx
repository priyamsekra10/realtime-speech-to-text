import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Engine } from '../api'
import { clock, engineName } from '../format'
import Icon, { type IconName } from '../Icon'
import { useLive } from '../useLive'

const about: Record<string, { text: string; tag: string; icon: IconName }> = {
  whisper: { text: 'Whisper tuned for Hinglish, running on this server', tag: 'Self-hosted', icon: 'cpu' },
  gemini: { text: "Google's live transcription model", tag: 'API', icon: 'spark' },
}

const tries = [
  'Mujhe kal office jaana hai, because meeting hai at ten.',
  'Please paanch sau kilo cement ka quotation bhej do by Friday.',
]

const label = {
  idle: 'Ready',
  starting: 'Starting',
  recording: 'Recording',
  saving: 'Saving',
  done: 'Saved',
  error: 'Stopped',
}

function doneNote(reason: string, saved: boolean, max: number) {
  if (!saved) return 'Nothing was heard, so nothing was saved.'
  if (reason === 'limit') return `Stopped at the ${Math.round(max / 60)} minute limit and saved.`
  if (reason === 'engine') return 'The speech engine stopped early. What it heard is saved.'
  return 'Saved to history.'
}

function Wave({ levels, flip }: { levels: number[]; flip?: boolean }) {
  const list = flip ? levels : [...levels].reverse()
  return (
    <div className="wave" aria-hidden="true">
      {list.map((v, i) => (
        <i key={i} style={{ height: 3 + Math.min(1, v * 2.2) * 30 }} />
      ))}
    </div>
  )
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
  const words = (text + ' ' + live.partial).split(/\s+/).filter(Boolean).length
  const current = engines?.find(e => e.name === engine)

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
          <p className="eyebrow">हिंदी + English</p>
          <h1>Speak in Hindi, English, or both</h1>
          <p className="soft">Words appear as you talk. Each recording is saved to your history.</p>
        </div>
      </div>

      {loadError && <p className="alert">{loadError}</p>}
      {engines?.length === 0 && <p className="alert">No speech engine is set up on this server.</p>}

      <div className="grid">
        <div>
          <div className={'card stage' + (recording ? ' rec' : '')}>
            <div className="stagebar">
              <span className={'pill ' + live.status}>
                <i />
                {label[live.status]}
              </span>
              {current && (
                <span className="soft small">
                  {engineName[current.name] ?? current.name} · {current.model}
                </span>
              )}
            </div>

            <div className="words" ref={box} aria-live="polite">
              {hasText ? (
                <p>
                  {live.lines.map((l, i) => (
                    <span key={i}>{l.text} </span>
                  ))}
                  {live.partial && <span className="partial">{live.partial}</span>}
                  {recording && <span className="caret" />}
                </p>
              ) : (
                <div className="hint">
                  {recording ? (
                    <p>Listening…</p>
                  ) : (
                    <>
                      <p>Press the mic and start talking.</p>
                      <p className="soft">Mix Hindi and English the way you normally speak.</p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="controls">
              <Wave levels={live.levels} flip />
              <button
                className={'mic' + (recording ? ' rec' : '')}
                onClick={toggle}
                disabled={!engine || live.status === 'starting' || live.status === 'saving'}
                aria-label={recording ? 'Stop recording' : 'Start recording'}
              >
                {recording ? (
                  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                    <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" />
                  </svg>
                ) : (
                  <Icon name="mic" size={30} />
                )}
              </button>
              <Wave levels={live.levels} />
            </div>

            <p className="under soft">
              {live.status === 'idle' && 'Press the mic to start'}
              {live.status === 'starting' && 'Starting…'}
              {live.status === 'recording' && 'Press again to stop and save'}
              {live.status === 'saving' && 'Saving…'}
              {live.status === 'done' && 'Done'}
              {live.status === 'error' && 'Stopped'}
            </p>
          </div>

          {live.status === 'error' && <p className="alert">{live.error}</p>}

          {live.status === 'done' && (
            <div className="after">
              <Icon name="check" />
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
        </div>

        <aside>
          {engines && engines.length > 0 && (
            <div className="card panel">
              <h2>Speech engine</h2>
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
                    <span className="ico">
                      <Icon name={about[e.name]?.icon ?? 'cpu'} />
                    </span>
                    <span className="grow">
                      <strong>
                        {engineName[e.name] ?? e.name}
                        {about[e.name] && <em>{about[e.name].tag}</em>}
                      </strong>
                      <span>{about[e.name]?.text ?? e.model}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card panel">
            <h2>This recording</h2>
            <dl className="facts">
              <div>
                <dt>Time</dt>
                <dd>
                  {clock(live.ms)} <span className="soft">/ {clock(max * 1000)}</span>
                </dd>
              </div>
              <div>
                <dt>Words</dt>
                <dd>{words}</dd>
              </div>
              <div>
                <dt>Sentences</dt>
                <dd>{live.lines.length}</dd>
              </div>
            </dl>
          </div>

          <div className="card panel">
            <h2>Try saying</h2>
            <ul className="tries">
              {tries.map(t => (
                <li key={t}>“{t}”</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  )
}
