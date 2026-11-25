export type Segment = { idx: number; text: string; start_ms: number; end_ms: number; lang: string | null }

export type Transcript = {
  id: string
  title: string
  text: string
  engine: string
  model: string
  status: string
  duration_ms: number
  word_count: number
  created_at: string
  updated_at: string
  segments?: Segment[]
}

export type Page = { items: Transcript[]; total: number }
export type Stats = { count: number; words: number; duration_ms: number }
export type Engine = { name: string; model: string }

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
}

function loadId() {
  try {
    let id = localStorage.getItem('client_id')
    if (!id) {
      id = makeId()
      localStorage.setItem('client_id', id)
    }
    return id
  } catch {
    return makeId()
  }
}

export const clientId = loadId()

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch('/api' + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId, ...init.headers },
  })
  if (!r.ok) {
    const body = await r.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : r.statusText
    throw new Error(detail || 'Request failed')
  }
  return r.status === 204 ? (undefined as T) : r.json()
}

export const api = {
  engines: () => call<{ engines: Engine[]; max_seconds: number }>('/engines'),
  list: (q: string, limit: number, offset: number) =>
    call<Page>(`/transcripts?${new URLSearchParams({ q, limit: String(limit), offset: String(offset) })}`),
  stats: () => call<Stats>('/transcripts/stats'),
  get: (id: string) => call<Transcript>(`/transcripts/${id}`),
  create: (body: { title: string; text: string }) =>
    call<Transcript>('/transcripts', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: { title?: string; text?: string }) =>
    call<Transcript>(`/transcripts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => call<void>(`/transcripts/${id}`, { method: 'DELETE' }),
}
