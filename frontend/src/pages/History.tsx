import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Stats, type Transcript } from '../api'
import { clock, engineName, when } from '../format'
import Icon from '../Icon'

const SIZE = 20

export default function History() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Transcript[] | null>(null)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const [asking, setAsking] = useState('')
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .list(q, SIZE, 0)
        .then(p => {
          setItems(p.items)
          setTotal(p.total)
          setError('')
        })
        .catch(e => setError(e.message))
    }, 200)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    api.stats().then(setStats, () => {})
  }, [total])

  async function more() {
    if (!items) return
    const p = await api.list(q, SIZE, items.length)
    setItems([...items, ...p.items])
    setTotal(p.total)
  }

  async function remove(id: string) {
    try {
      await api.remove(id)
      setItems(list => list?.filter(t => t.id !== id) ?? null)
      setTotal(n => n - 1)
    } catch (e) {
      setError((e as Error).message)
    }
    setAsking('')
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    try {
      const t = await api.create({ title, text })
      nav(`/history/${t.id}`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="history">
      <div className="head">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>History</h1>
          <p className="soft">Every recording made in this browser, saved in PostgreSQL.</p>
        </div>
        <Link className="btn primary" to="/">
          <Icon name="mic" /> New recording
        </Link>
      </div>

      <div className="tiles">
        <div className="card tile">
          <span className="ico">
            <Icon name="file" />
          </span>
          <div>
            <b>{stats?.count ?? '–'}</b>
            <span>Transcripts</span>
          </div>
        </div>
        <div className="card tile">
          <span className="ico">
            <Icon name="clock" />
          </span>
          <div>
            <b>{stats ? clock(stats.duration_ms) : '–'}</b>
            <span>Time recorded</span>
          </div>
        </div>
        <div className="card tile">
          <span className="ico">
            <Icon name="text" />
          </span>
          <div>
            <b>{stats?.words ?? '–'}</b>
            <span>Words</span>
          </div>
        </div>
      </div>

      <div className="bar">
        <label className="search">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Search titles and text"
            value={q}
            onChange={e => setQ(e.target.value)}
            aria-label="Search"
          />
        </label>
        <button className="btn" onClick={() => setAdding(a => !a)}>
          {adding ? (
            'Cancel'
          ) : (
            <>
              <Icon name="plus" /> Add typed note
            </>
          )}
        </button>
      </div>

      {adding && (
        <form className="card form" onSubmit={add}>
          <input
            placeholder="Title"
            value={title}
            maxLength={200}
            required
            autoFocus
            onChange={e => setTitle(e.target.value)}
          />
          <textarea placeholder="Text" rows={4} value={text} onChange={e => setText(e.target.value)} />
          <div className="row">
            <span className="grow" />
            <button className="btn primary" type="submit">
              Save
            </button>
          </div>
        </form>
      )}

      {error && <p className="alert">{error}</p>}

      {items && items.length === 0 && (
        <div className="card blank">
          <span className="ico">
            <Icon name={q ? 'search' : 'mic'} size={22} />
          </span>
          <p>{q ? 'Nothing matches that search.' : 'No transcripts yet.'}</p>
          {!q && (
            <Link className="btn primary" to="/">
              Make your first recording
            </Link>
          )}
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="rows">
          {items.map(t => (
            <li key={t.id} className="card">
              <Link to={`/history/${t.id}`} className="what">
                <strong>{t.title}</strong>
                <span className="soft">{t.text || 'No text'}</span>
              </Link>
              <div className="meta soft">
                <span className={'tag ' + t.engine}>{engineName[t.engine] ?? t.engine}</span>
                {t.duration_ms > 0 && <span>{clock(t.duration_ms)}</span>}
                <span>{t.word_count} words</span>
                <span>{when(t.created_at)}</span>
              </div>
              <div className="acts">
                {asking === t.id ? (
                  <>
                    <button className="btn danger" onClick={() => remove(t.id)}>
                      Delete
                    </button>
                    <button className="btn" onClick={() => setAsking('')}>
                      Keep
                    </button>
                  </>
                ) : (
                  <>
                    <Link className="btn" to={`/history/${t.id}`}>
                      <Icon name="edit" size={16} /> Edit
                    </Link>
                    <button className="btn" onClick={() => setAsking(t.id)} aria-label={`Delete ${t.title}`}>
                      <Icon name="trash" size={16} /> Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {items && items.length < total && (
        <button className="btn wide" onClick={more}>
          Show more ({total - items.length} left)
        </button>
      )}
    </section>
  )
}
