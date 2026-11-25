import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Transcript } from '../api'
import { clock, engineName, when } from '../format'

export default function Detail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [t, setT] = useState<Transcript | null>(null)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    api
      .get(id)
      .then(r => {
        setT(r)
        setTitle(r.title)
        setText(r.text)
      })
      .catch(e => setError(e.message))
  }, [id])

  function flash(msg: string) {
    setNote(msg)
    setTimeout(() => setNote(''), 1800)
  }

  async function save() {
    try {
      const r = await api.update(id, { title, text })
      setT(r)
      setTitle(r.title)
      setText(r.text)
      setError('')
      flash('Saved')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function remove() {
    try {
      await api.remove(id)
      nav('/history')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(text)
    flash('Copied')
  }

  function download() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    a.download = (title.trim() || 'transcript').slice(0, 60) + '.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (error && !t) {
    return (
      <section>
        <p className="alert">{error === 'transcript not found' ? 'This transcript does not exist.' : error}</p>
        <Link className="btn" to="/history">
          Back to history
        </Link>
      </section>
    )
  }
  if (!t) return <p className="empty">Loading…</p>

  const dirty = title !== t.title || text !== t.text
  const segments = t.segments ?? []

  return (
    <section className="detail">
      <Link to="/history" className="back">
        ← History
      </Link>

      <div className="card form">
        <input
          className="title"
          value={title}
          maxLength={200}
          onChange={e => setTitle(e.target.value)}
          aria-label="Title"
        />
        <div className="meta soft">
          <span className={'tag ' + t.engine}>{engineName[t.engine] ?? t.engine}</span>
          {t.model && <span>{t.model}</span>}
          {t.duration_ms > 0 && <span>{clock(t.duration_ms)}</span>}
          <span>{text.trim() ? text.trim().split(/\s+/).length : 0} words</span>
          <span>{when(t.created_at)}</span>
          {t.updated_at !== t.created_at && <span>edited {when(t.updated_at)}</span>}
        </div>
        <textarea rows={10} value={text} onChange={e => setText(e.target.value)} aria-label="Transcript text" />

        {error && <p className="alert">{error}</p>}

        <div className="row">
          {asking ? (
            <>
              <button className="btn danger" onClick={remove}>
                Yes, delete
              </button>
              <button className="btn" onClick={() => setAsking(false)}>
                Keep
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => setAsking(true)}>
              Delete
            </button>
          )}
          <span className="grow" />
          {note && <span className="soft">{note}</span>}
          <button className="btn" onClick={copy}>
            Copy
          </button>
          <button className="btn" onClick={download}>
            Download .txt
          </button>
          <button className="btn primary" onClick={save} disabled={!dirty || !title.trim()}>
            Save changes
          </button>
        </div>
      </div>

      {segments.length > 0 && (
        <>
          <h2>As it was spoken</h2>
          <ol className="segments">
            {segments.map(s => (
              <li key={s.idx}>
                <time>
                  {clock(s.start_ms)} – {clock(s.end_ms)}
                </time>
                <span>{s.text}</span>
                {s.lang && <span className="tag">{s.lang}</span>}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
