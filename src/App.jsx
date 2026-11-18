import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase.js'

const SECTION_COLORS = { A: '#1e7d4f', B: '#b5651d', C: '#7a4fb5', D: '#2b6cb0', E: '#c0392b' }
const STAGES = [
  { key: 'submitted', label: 'Submitted', hint: 'Cover letter on its way' },
  { key: 'letter_ready', label: 'Letter ready', hint: 'Fine-tune & send' },
  { key: 'sent', label: 'Sent', hint: 'Awaiting response' },
  { key: 'response_received', label: 'Response', hint: 'Outcome logged' },
]
const RESPONSE_TYPES = [
  ['acknowledgement', 'Acknowledgement'],
  ['interview', 'Interview invite'],
  ['test_task', 'Test / task'],
  ['info_request', 'Asked for more info'],
  ['offer', 'Offer'],
  ['rejection', 'Rejection'],
  ['other', 'Other'],
]

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })
const fmtDate = (d) =>
  d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000)

/* ---------------- Auth ---------------- */
function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const redirect = window.location.origin + window.location.pathname
    let res
    if (mode === 'signin') res = await supabase.auth.signInWithPassword({ email, password })
    else if (mode === 'signup')
      res = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
    else res = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect })
    setBusy(false)
    if (res.error) return setMsg({ err: true, text: res.error.message })
    if (mode === 'signup') setMsg({ text: 'Account created. Check your inbox to confirm your email, then sign in.' })
    if (mode === 'reset') setMsg({ text: 'Password reset link sent to your email.' })
  }

  return (
    <div className="login">
      <div className="login-card">
        <img src="./icon.svg" alt="" width="64" height="64" />
        <h1>Career Tracker</h1>
        <p className="muted">Opportunities · Applications · Responses</p>
        <form onSubmit={submit}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          {mode !== 'reset' && (
            <input type="password" placeholder="Password (min 6 characters)" value={password} minLength={6}
              onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>
        </form>
        {msg && <p className={msg.err ? 'error' : 'ok'}>{msg.text}</p>}
        <div className="login-links">
          {mode !== 'signin' && <button className="link" onClick={() => setMode('signin')}>Sign in</button>}
          {mode !== 'signup' && <button className="link" onClick={() => setMode('signup')}>First time? Create account</button>}
          {mode !== 'reset' && <button className="link" onClick={() => setMode('reset')}>Forgot password</button>}
        </div>
      </div>
    </div>
  )
}

function PasswordReset({ onDone }) {
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState(null)
  const save = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) setMsg(error.message)
    else onDone()
  }
  return (
    <div className="login"><div className="login-card">
      <h1>Set new password</h1>
      <form onSubmit={save}>
        <input type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" required />
        <button className="btn primary">Save password</button>
      </form>
      {msg && <p className="error">{msg}</p>}
    </div></div>
  )
}

/* ---------------- Shared bits ---------------- */
function CodeBadge({ code, section }) {
  return <span className="code" style={{ background: SECTION_COLORS[section] || '#555' }}>{code}</span>
}

function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  return (
    <button className="btn small" type="button"
      onClick={async () => { await navigator.clipboard.writeText(text || ''); setDone(true); setTimeout(() => setDone(false), 1500) }}>
      {done ? 'Copied ✓' : label}
    </button>
  )
}

function Attachments({ paths }) {
  const open = async (p) => {
    const { data, error } = await supabase.storage.from('mails').createSignedUrl(p, 300)
    if (!error) window.open(data.signedUrl, '_blank')
  }
  if (!paths?.length) return null
  return (
    <div className="attach">
      {paths.map((p) => (
        <button key={p} className="chip" onClick={() => open(p)}>📎 {p.split('/').pop().replace(/^\d+-/, '')}</button>
      ))}
    </div>
  )
}

async function uploadFiles(appId, kind, files) {
  const paths = []
  for (const f of files) {
    const safe = f.name.replace(/[^\w.\-]+/g, '_')
    const path = `${appId}/${kind}/${Date.now()}-${safe}`
    const { error } = await supabase.storage.from('mails').upload(path, f, { upsert: false })
    if (error) throw error
    paths.push(path)
  }
  return paths
}

/* ---------------- Opportunities ---------------- */
function OpportunityCard({ o, app, selected, onToggle }) {
  const [open, setOpen] = useState(false)
  const expired = o.deadline && o.deadline < today()
  return (
    <div className={`card ${selected ? 'selected' : ''} ${o.status !== 'open' || expired ? 'dim' : ''}`}>
      <div className="card-head" onClick={() => setOpen(!open)}>
        <CodeBadge code={o.code} section={o.section} />
        <div className="card-title">
          <strong>{o.role}</strong>
          <span className="muted">{o.employer} · {o.location}</span>
        </div>
        <span className="chev">{open ? '▴' : '▾'}</span>
      </div>
      <div className="tags">
        {o.job_type && <span className="tag">{o.job_type}</span>}
        {o.language_req && <span className="tag">🗣 {o.language_req}</span>}
        {o.deadline && <span className={`tag ${expired ? 'warn' : ''}`}>⏰ {fmtDate(o.deadline)}</span>}
        {o.is_speculative && o.job_type !== 'Speculative' && <span className="tag">Speculative</span>}
        {o.status !== 'open' && <span className="tag warn">{o.status}</span>}
        {o.source && o.source !== 'claude' && <span className="tag">via {o.source}</span>}
      </div>
      {open && (
        <dl className="details">
          {o.requirements && <><dt>Requirements</dt><dd>{o.requirements}</dd></>}
          {o.hours && <><dt>Hours</dt><dd>{o.hours}</dd></>}
          {o.pay && <><dt>Pay</dt><dd>{o.pay}</dd></>}
          {o.deadline_note && <><dt>Deadline note</dt><dd>{o.deadline_note}</dd></>}
          {o.reference_no && <><dt>Reference</dt><dd>{o.reference_no}</dd></>}
          {o.contact_person && <><dt>Contact</dt><dd>{o.contact_person}</dd></>}
          {o.contact_email && <><dt>Email</dt><dd><a href={`mailto:${o.contact_email}`}>{o.contact_email}</a></dd></>}
          {o.notes && <><dt>Notes</dt><dd>{o.notes}</dd></>}
          {o.link && <><dt>Link</dt><dd><a href={o.link} target="_blank" rel="noreferrer">Open posting ↗</a></dd></>}
        </dl>
      )}
      <div className="card-foot">
        {app ? (
          <span className="status-pill">{STAGES.find((s) => s.key === app.status)?.label || app.status}</span>
        ) : o.section === 'A' || o.section === 'D' || o.section === 'E' ? (
          <label className="select">
            <input type="checkbox" checked={selected} onChange={() => onToggle(o.id)} /> Apply for this
          </label>
        ) : (
          <label className="select muted">
            <input type="checkbox" checked={selected} onChange={() => onToggle(o.id)} /> Apply anyway
          </label>
        )}
      </div>
    </div>
  )
}

function Opportunities({ opps, apps, sections, reload }) {
  const [filter, setFilter] = useState('ALL')
  const [hideApplied, setHideApplied] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(new Set())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const appByOpp = useMemo(() => Object.fromEntries(apps.map((a) => [a.opportunity_id, a])), [apps])

  const filtered = opps.filter((o) =>
    (filter === 'ALL' || o.section === filter) &&
    (!hideApplied || !appByOpp[o.id]) &&
    (!q || `${o.code} ${o.employer} ${o.role} ${o.location}`.toLowerCase().includes(q.toLowerCase())))

  const byDate = useMemo(() => {
    const m = {}
    for (const o of filtered) (m[o.found_on] ||= []).push(o)
    return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const submit = async () => {
    setBusy(true)
    const rows = [...sel].map((id) => ({ opportunity_id: id, candidate_note: note || null }))
    const { error } = await supabase.from('applications').insert(rows)
    setBusy(false)
    if (error) return setMsg({ err: true, text: error.message })
    setSel(new Set()); setNote('')
    setMsg({ text: `${rows.length} submitted ✓ Your cover letters and tips will arrive by email within about an hour.` })
    reload()
  }

  return (
    <>
      <div className="toolbar">
        <input className="search" placeholder="Search code, employer, role…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          <button className={`chip ${filter === 'ALL' ? 'on' : ''}`} onClick={() => setFilter('ALL')}>All</button>
          {sections.map((s) => (
            <button key={s.code} className={`chip ${filter === s.code ? 'on' : ''}`} onClick={() => setFilter(s.code)}
              style={filter === s.code ? { background: SECTION_COLORS[s.code], borderColor: SECTION_COLORS[s.code] } : {}}>
              {s.code} · {s.title.split('–')[0].trim()}
            </button>
          ))}
        </div>
        <label className="toggle"><input type="checkbox" checked={hideApplied} onChange={(e) => setHideApplied(e.target.checked)} /> Hide already selected</label>
      </div>
      {msg && <p className={msg.err ? 'error banner' : 'ok banner'} onClick={() => setMsg(null)}>{msg.text}</p>}
      {byDate.length === 0 && <p className="empty">No opportunities match.</p>}
      {byDate.map(([date, list]) => (
        <section key={date}>
          <h2 className="date-head">📅 {fmtDate(date)} <span className="muted">({list.length})</span></h2>
          {sections.filter((s) => list.some((o) => o.section === s.code)).map((s) => (
            <div key={s.code} className="section-block">
              <h3 style={{ color: SECTION_COLORS[s.code] }}>{s.code}. {s.title}</h3>
              {list.filter((o) => o.section === s.code).sort((a, b) => a.code.localeCompare(b.code)).map((o) => (
                <OpportunityCard key={o.id} o={o} app={appByOpp[o.id]} selected={sel.has(o.id)} onToggle={toggle} />
              ))}
            </div>
          ))}
        </section>
      ))}
      {sel.size > 0 && (
        <div className="submit-bar">
          <input placeholder="Optional note for the cover letters (e.g. start date, hours)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn primary" disabled={busy} onClick={submit}>
            {busy ? 'Submitting…' : `Submit ${sel.size} selection${sel.size > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </>
  )
}

/* ---------------- Applications ---------------- */
function SentForm({ app, reload }) {
  const [date, setDate] = useState(app.sent_on || today())
  const [content, setContent] = useState(app.sent_mail_content || '')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      const paths = await uploadFiles(app.id, 'sent', files)
      const { error } = await supabase.from('applications').update({
        sent_on: date, sent_mail_content: content,
        sent_attachments: [...(app.sent_attachments || []), ...paths],
        status: app.status === 'response_received' ? app.status : 'sent',
      }).eq('id', app.id)
      if (error) throw error
      reload()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <form className="form" onSubmit={save}>
      <h4>📤 Log the application you sent</h4>
      <label>Date sent<input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required /></label>
      <label>Mail you sent (paste the full text)<textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} required /></label>
      <label>Attach screenshot / PDF / .eml (optional)<input type="file" multiple onChange={(e) => setFiles([...e.target.files])} /></label>
      {err && <p className="error">{err}</p>}
      <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save as sent'}</button>
    </form>
  )
}

function ResponseForm({ app, reload }) {
  const [date, setDate] = useState(app.response_on || today())
  const [type, setType] = useState(app.response_type || 'acknowledgement')
  const [content, setContent] = useState(app.response_content || '')
  const [outcome, setOutcome] = useState(app.outcome_note || '')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      const paths = await uploadFiles(app.id, 'response', files)
      const { error } = await supabase.from('applications').update({
        response_on: date, response_type: type, response_content: content, outcome_note: outcome || null,
        response_attachments: [...(app.response_attachments || []), ...paths], status: 'response_received',
      }).eq('id', app.id)
      if (error) throw error
      reload()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <form className="form" onSubmit={save}>
      <h4>📥 Log the response</h4>
      <label>Date received<input type="date" value={date} min={app.sent_on || undefined} max={today()} onChange={(e) => setDate(e.target.value)} required /></label>
      <label>Type of response
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {RESPONSE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>Response mail (paste the full text)<textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} required /></label>
      <label>Your note / next step (optional)<input value={outcome} onChange={(e) => setOutcome(e.target.value)} /></label>
      <label>Attach screenshot / PDF / .eml (optional)<input type="file" multiple onChange={(e) => setFiles([...e.target.files])} /></label>
      {err && <p className="error">{err}</p>}
      <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save response'}</button>
    </form>
  )
}

function ApplicationCard({ a, reload }) {
  const o = a.opportunities
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState(null)
  const stageIdx = STAGES.findIndex((s) => s.key === a.status)
  const waiting = a.sent_on && !a.response_on ? daysBetween(a.sent_on, today()) : null

  const withdraw = async () => {
    if (!confirm(`Withdraw ${o.code}?`)) return
    await supabase.from('applications').delete().eq('id', a.id)
    reload()
  }

  return (
    <div className="card">
      <div className="card-head" onClick={() => setOpen(!open)}>
        <CodeBadge code={o.code} section={o.section} />
        <div className="card-title">
          <strong>{o.role}</strong>
          <span className="muted">{o.employer} · {o.location}</span>
        </div>
        <span className="chev">{open ? '▴' : '▾'}</span>
      </div>
      <div className="stepper">
        {STAGES.map((s, i) => <div key={s.key} className={`step ${i <= stageIdx ? 'done' : ''}`}><span />{s.label}</div>)}
      </div>
      <div className="tags">
        <span className="tag">Selected {fmtDate(a.selected_at?.slice(0, 10))}</span>
        {a.sent_on && <span className="tag">Sent {fmtDate(a.sent_on)}</span>}
        {waiting !== null && <span className={`tag ${waiting >= 14 ? 'warn' : ''}`}>⏳ {waiting} days waiting</span>}
        {a.response_on && <span className="tag good">Reply {fmtDate(a.response_on)} · {RESPONSE_TYPES.find((r) => r[0] === a.response_type)?.[1]}</span>}
      </div>
      {open && (
        <div className="app-body">
          {a.candidate_note && <p className="muted">Your note: {a.candidate_note}</p>}
          {a.status === 'submitted' && (
            <div className="info">
              ⏳ Cover letter and tips are being prepared and will be emailed to you (usually within an hour).
              <div><button className="btn small danger" onClick={withdraw}>Withdraw selection</button></div>
            </div>
          )}
          {a.cover_letter && (
            <div className="letter">
              <div className="row-between"><h4>✉️ Cover letter</h4><CopyButton text={a.cover_letter} /></div>
              <pre>{a.cover_letter}</pre>
            </div>
          )}
          {a.tips && (
            <div className="letter tips">
              <h4>💡 Advice & tips</h4>
              <pre>{a.tips}</pre>
            </div>
          )}
          {o.link && <p><a href={o.link} target="_blank" rel="noreferrer">Open job posting ↗</a>{o.contact_email && <> · <a href={`mailto:${o.contact_email}`}>{o.contact_email}</a></>}</p>}

          {a.sent_on && edit !== 'sent' && (
            <div className="logged">
              <div className="row-between"><h4>📤 Sent on {fmtDate(a.sent_on)}</h4><button className="btn small" onClick={() => setEdit('sent')}>Edit</button></div>
              <pre>{a.sent_mail_content}</pre>
              <Attachments paths={a.sent_attachments} />
            </div>
          )}
          {(a.status === 'letter_ready' || a.status === 'submitted' || edit === 'sent') && !a.response_on && (
            (!a.sent_on || edit === 'sent') && <SentForm app={a} reload={() => { setEdit(null); reload() }} />
          )}

          {a.response_on && edit !== 'resp' && (
            <div className="logged">
              <div className="row-between"><h4>📥 Response on {fmtDate(a.response_on)} ({daysBetween(a.sent_on, a.response_on)} days)</h4><button className="btn small" onClick={() => setEdit('resp')}>Edit</button></div>
              <pre>{a.response_content}</pre>
              {a.outcome_note && <p className="muted">Note: {a.outcome_note}</p>}
              <Attachments paths={a.response_attachments} />
            </div>
          )}
          {((a.sent_on && !a.response_on) || edit === 'resp') && <ResponseForm app={a} reload={() => { setEdit(null); reload() }} />}
        </div>
      )}
    </div>
  )
}

function Applications({ apps, reload }) {
  const [stage, setStage] = useState('ALL')
  const list = apps.filter((a) => stage === 'ALL' || a.status === stage)
  return (
    <>
      <div className="toolbar">
        <div className="chips">
          <button className={`chip ${stage === 'ALL' ? 'on' : ''}`} onClick={() => setStage('ALL')}>All ({apps.length})</button>
          {STAGES.map((s) => (
            <button key={s.key} className={`chip ${stage === s.key ? 'on' : ''}`} onClick={() => setStage(s.key)}>
              {s.label} ({apps.filter((a) => a.status === s.key).length})
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 && <p className="empty">Nothing here yet. Select opportunities in the Opportunities tab and submit them.</p>}
      {list.map((a) => <ApplicationCard key={a.id} a={a} reload={reload} />)}
    </>
  )
}

/* ---------------- Insights ---------------- */
function Insights({ apps }) {
  const [stats, setStats] = useState([])
  useEffect(() => { supabase.from('section_stats').select('*').then(({ data }) => setStats(data || [])) }, [apps])
  const sent = apps.filter((a) => a.sent_on)
  const replied = sent.filter((a) => a.response_on)
  const overdue = sent.filter((a) => !a.response_on && daysBetween(a.sent_on, today()) >= 14)
  const pct = (n, d) => (d ? Math.round((100 * n) / d) + '%' : '—')
  return (
    <>
      <div className="kpis">
        <div className="kpi"><b>{apps.length}</b><span>Selected</span></div>
        <div className="kpi"><b>{sent.length}</b><span>Sent</span></div>
        <div className="kpi"><b>{replied.length}</b><span>Replies</span></div>
        <div className="kpi"><b>{pct(replied.length, sent.length)}</b><span>Reply rate</span></div>
      </div>
      <h3>By section</h3>
      {stats.map((s) => (
        <div className="card stat" key={s.section}>
          <div className="row-between">
            <strong><CodeBadge code={s.section} section={s.section} /> {s.title}</strong>
          </div>
          <ul className="statlist">
            <li>Opportunities found: <b>{s.opportunities}</b></li>
            <li>Selected: <b>{s.selected}</b> · Sent: <b>{s.sent}</b></li>
            <li>Responses: <b>{s.responses}</b> ({pct(s.responses, s.sent)}) · Positive: <b>{s.positive}</b></li>
            <li>Avg. days to response: <b>{s.avg_days_to_response ?? '—'}</b></li>
          </ul>
        </div>
      ))}
      {overdue.length > 0 && (
        <>
          <h3>Follow up (14+ days, no reply)</h3>
          {overdue.map((a) => (
            <div className="card" key={a.id}>
              <CodeBadge code={a.opportunities.code} section={a.opportunities.section} /> {a.opportunities.employer} — sent {fmtDate(a.sent_on)}
            </div>
          ))}
        </>
      )}
    </>
  )
}

/* ---------------- Import (admin) ---------------- */
function ImportScreen({ reload }) {
  const [text, setText] = useState('')
  const [source, setSource] = useState('grok')
  const [res, setRes] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setErr(null); setRes(null)
    let items
    try {
      const m = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
      const parsed = JSON.parse(m ? m[0] : text)
      items = Array.isArray(parsed) ? parsed : parsed.items
      if (!Array.isArray(items)) throw new Error('Expected a JSON array or { "items": [...] }')
    } catch (x) { return setErr('Could not read JSON: ' + x.message) }
    setBusy(true)
    const { data, error } = await supabase.rpc('import_opportunities', { items, p_source: source })
    setBusy(false)
    if (error) return setErr(error.message)
    setRes(data); setText(''); reload()
  }
  return (
    <>
      <h3>Import opportunities from another AI</h3>
      <p className="muted small">Paste the JSON that Grok, Gemini or ChatGPT produced. Duplicates are skipped automatically and new items get the next code in their section.</p>
      <label className="toggle">Source&nbsp;
        <select value={source} onChange={(e) => setSource(e.target.value)} style={{ width: 'auto' }}>
          {['grok', 'gemini', 'chatgpt', 'claude', 'other'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder='[ { "section": "A", "employer": "…", "role": "…", … } ]' />
      <p><button className="btn primary" disabled={busy || !text} onClick={run}>{busy ? 'Importing…' : 'Import'}</button></p>
      {err && <p className="error">{err}</p>}
      {res && (
        <div className="card">
          <b>Added {res.added.length}</b>
          <ul className="statlist">{res.added.map((a) => <li key={a.code}>{a.code} – {a.employer} – {a.role}</li>)}</ul>
          <b>Skipped as duplicates {res.skipped_duplicates.length}</b>
          <ul className="statlist">{res.skipped_duplicates.map((a, i) => <li key={i}>{a.employer} – {a.role} (= {a.duplicate_of})</li>)}</ul>
          {res.rejected.length > 0 && <><b>Rejected {res.rejected.length}</b>
            <ul className="statlist">{res.rejected.map((a, i) => <li key={i}>{a.item?.employer || '?'} – {a.reason}</li>)}</ul></>}
        </div>
      )}
    </>
  )
}

/* ---------------- App shell ---------------- */
export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [me, setMe] = useState(undefined)
  const [tab, setTab] = useState('opps')
  const [opps, setOpps] = useState([])
  const [apps, setApps] = useState([])
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      setSession(s)
      if (evt === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [u, s, o, a] = await Promise.all([
      supabase.from('allowed_users').select('*'),
      supabase.from('sections').select('*').order('sort'),
      supabase.from('opportunities').select('*').order('found_on', { ascending: false }).order('code'),
      supabase.from('applications').select('*, opportunities(*)').order('selected_at', { ascending: false }),
    ])
    const email = session?.user?.email?.toLowerCase()
    setMe((u.data || []).find((x) => x.email.toLowerCase() === email) || null)
    setSections(s.data || []); setOpps(o.data || []); setApps(a.data || [])
    setLoading(false)
  }, [session])

  useEffect(() => { if (session) load() }, [session, load])

  if (!ready) return <div className="splash">Loading…</div>
  if (recovery) return <PasswordReset onDone={() => setRecovery(false)} />
  if (!session) return <Login />
  if (me === null)
    return (
      <div className="login"><div className="login-card">
        <h1>Not authorised</h1>
        <p>{session.user.email} is not on the access list for this app.</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div></div>
    )

  const pending = apps.filter((a) => a.status === 'letter_ready').length

  return (
    <div className="app">
      <header>
        <div>
          <h1>Career Tracker</h1>
          <span className="muted small">Hi {me?.display_name || ''} · {loading ? 'syncing…' : `${opps.length} opportunities`}</span>
        </div>
        <div className="head-actions">
          <button className="btn small" onClick={load} title="Refresh">⟳</button>
          <button className="btn small" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>
      <main>
        {tab === 'opps' && <Opportunities opps={opps} apps={apps} sections={sections} reload={load} />}
        {tab === 'apps' && <Applications apps={apps} reload={load} />}
        {tab === 'insights' && <Insights apps={apps} />}
        {tab === 'import' && me?.role === 'admin' && <ImportScreen reload={load} />}
      </main>
      <nav className="tabs">
        <button className={tab === 'opps' ? 'on' : ''} onClick={() => setTab('opps')}>🔎<span>Opportunities</span></button>
        <button className={tab === 'apps' ? 'on' : ''} onClick={() => setTab('apps')}>
          📋<span>Applications{pending ? ` (${pending})` : ''}</span>
        </button>
        <button className={tab === 'insights' ? 'on' : ''} onClick={() => setTab('insights')}>📈<span>Insights</span></button>
        {me?.role === 'admin' && <button className={tab === 'import' ? 'on' : ''} onClick={() => setTab('import')}>📥<span>Import</span></button>}
      </nav>
    </div>
  )
}
