'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Copy,
  Database,
  GraduationCap,
  Hash,
  LogOut,
  Mail,
  MapPin,
  Phone,
  PlusCircle,
  Search,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import AddStudents from '@/app/AddStudents'
import ChairmanBrand from '@/app/ChairmanBrand'
import { createBrowserSupabase } from '@/lib/supabase-browser'

type Level = 'foundation' | 'intermediate' | 'all'
type View = 'search' | 'add'

type Student = {
  id: number
  source: 'FOUNDATION' | 'INTERMEDIATE'
  registrationNumber: string
  studentName: string
  fatherHusbandName: string | null
  dateOfBirth: string | null
  address1: string | null
  address2: string | null
  address3: string | null
  city: string | null
  pinCode: string | null
  email: string | null
  mobile: string | null
}

type Row = {
  id: number
  registration_number: string
  student_name: string
  father_husband_name: string | null
  date_of_birth: string | null
  address_1: string | null
  address_2: string | null
  address_3: string | null
  city: string | null
  pin_code: string | null
  email: string | null
  mobile: string | null
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function sourceLabel(source: Student['source']) {
  return source === 'FOUNDATION' ? 'Foundation' : 'Intermediate'
}

function normalizeDigits(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length > 10 && digits.startsWith('91')
    ? digits.slice(-10)
    : digits
}

function looksLikePhoneQuery(value: string) {
  return /^[+\d\s().-]+$/.test(value.trim())
}

function mapRows(rows: Row[], source: Student['source']): Student[] {
  return rows.map(row => ({
    id: row.id,
    source,
    registrationNumber: row.registration_number,
    studentName: row.student_name,
    fatherHusbandName: row.father_husband_name,
    dateOfBirth: row.date_of_birth,
    address1: row.address_1,
    address2: row.address_2,
    address3: row.address_3,
    city: row.city,
    pinCode: row.pin_code,
    email: row.email,
    mobile: row.mobile,
  }))
}

export default function Home() {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [ready, setReady] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [view, setView] = useState<View>('search')
  const [level, setLevel] = useState<Level>('foundation')
  const [counts, setCounts] = useState({ foundation: 870, intermediate: 290 })
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Student[]>([])
  const [selected, setSelected] = useState<Student | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [copied, setCopied] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  async function loadCounts() {
    const [foundation, intermediate] = await Promise.all([
      supabase
        .from('foundation_students')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('intermediate_students')
        .select('id', { count: 'exact', head: true }),
    ])

    setCounts({
      foundation: foundation.count ?? 0,
      intermediate: intermediate.count ?? 0,
    })
  }

  async function refreshAccess(userId?: string, emailValue?: string) {
    if (!userId) {
      setAuthorized(false)
      setUserEmail('')
      setReady(true)
      return
    }

    const { data: profile } = await supabase
      .from('team_profiles')
      .select('active')
      .eq('id', userId)
      .maybeSingle()

    setAuthorized(Boolean(profile?.active))
    setUserEmail(emailValue || '')
    setReady(true)
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      await refreshAccess(data.session?.user?.id, data.session?.user?.email)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      window.setTimeout(() => {
        refreshAccess(session?.user?.id, session?.user?.email)
      }, 0)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    if (authorized) void loadCounts()
  }, [authorized])

  async function authenticate(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)

    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      })
      setLoading(false)

      if (error) {
        setMessage({ type: 'error', text: error.message })
        return
      }

      setPassword('')
      if (data.session) {
        setMessage({
          type: 'success',
          text: 'Account created. Your access still needs administrator approval.',
        })
      } else {
        setMessage({
          type: 'success',
          text: 'Account created. Check your email to confirm it, then log in. Administrator approval is still required.',
        })
        setAuthMode('login')
      }
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    setLoading(false)
    if (error) {
      setMessage({ type: 'error', text: 'Invalid email or password.' })
      return
    }
    setPassword('')
  }

  async function logout() {
    await supabase.auth.signOut()
    setResults([])
    setSelected(null)
    setQuery('')
    setMessage(null)
    setHasSearched(false)
    setView('search')
  }

  function changeLevel(next: Level) {
    setLevel(next)
    setResults([])
    setSelected(null)
    setMessage(null)
  }

  async function searchOne(
    table: 'foundation_students' | 'intermediate_students',
    source: Student['source'],
    term: string,
  ) {
    const columns =
      'id,registration_number,student_name,father_husband_name,date_of_birth,address_1,address_2,address_3,city,pin_code,email,mobile'
    const digits = normalizeDigits(term)

    const searches = [
      supabase.from(table).select(columns).ilike('student_name', `%${term}%`).limit(20),
      supabase.from(table).select(columns).ilike('registration_number', `%${term}%`).limit(20),
      supabase.from(table).select(columns).ilike('email', `%${term}%`).limit(20),
    ]

    if (looksLikePhoneQuery(term) && digits.length >= 4) {
      searches.push(
        supabase.from(table).select(columns).ilike('mobile', `%${digits}%`).limit(20)
      )
    }

    const responses = await Promise.all(searches)
    const firstError = responses.find(item => item.error)?.error
    if (firstError) throw firstError

    const byId = new Map<number, Row>()
    for (const response of responses) {
      for (const row of (response.data || []) as Row[]) {
        byId.set(row.id, row)
      }
    }

    return mapRows(Array.from(byId.values()), source)
  }

  async function searchStudents(event: FormEvent) {
    event.preventDefault()
    const term = query.trim()

    if (term.length < 2) {
      setMessage({ type: 'error', text: 'Enter at least 2 characters.' })
      return
    }

    setHasSearched(true)
    setLoading(true)
    setMessage(null)
    setSelected(null)

    try {
      const tasks: Promise<Student[]>[] = []
      if (level === 'foundation' || level === 'all') {
        tasks.push(searchOne('foundation_students', 'FOUNDATION', term))
      }
      if (level === 'intermediate' || level === 'all') {
        tasks.push(searchOne('intermediate_students', 'INTERMEDIATE', term))
      }

      const students = (await Promise.all(tasks))
        .flat()
        .sort((a, b) => a.studentName.localeCompare(b.studentName))
        .slice(0, 40)

      setResults(students)
      if (students.length === 1) setSelected(students[0])
      if (!students.length) {
        setMessage({ type: 'error', text: 'No matching student found.' })
      }
    } catch {
      setResults([])
      setMessage({
        type: 'error',
        text: 'Search failed. Please confirm your team access is active.',
      })
    } finally {
      setLoading(false)
    }
  }

  async function copyRegistration(registrationNumber: string) {
    await navigator.clipboard.writeText(registrationNumber)
    setCopied(registrationNumber)
    window.setTimeout(() => setCopied(''), 1500)
  }

  if (!ready) {
    return <main className="loading"><div className="spinner" /></main>
  }

  if (!userEmail) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="brand-row">
            <div className="brand-icon"><GraduationCap size={22} /></div>
            <div>
              <strong>Student Registration Finder</strong>
              <span>Surat ICMAI · Internal team access</span>
            </div>
          </div>

          <div className="login-copy">
            <span className="eyebrow"><ShieldCheck size={15} /> Authorized access</span>
            <h1>{authMode === 'login' ? 'Team Login' : 'Create Account'}</h1>
            <p>
              {authMode === 'login'
                ? 'Search Foundation and Intermediate registration details securely.'
                : 'Create your account. An administrator must approve it before student data becomes available.'}
            </p>
          </div>

          <form className="form" onSubmit={authenticate}>
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </label>
            <label>
              <span>Password</span>
              <input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
            </label>

            {message && (
              <div className={`message ${message.type}`}>
                {message.type === 'success' ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
                {message.text}
              </div>
            )}

            <button className="primary-button" disabled={loading}>
              {loading ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>

          <button
            className="auth-switch"
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'signup' : 'login')
              setMessage(null)
            }}
          >
            <UserPlus size={15} />
            {authMode === 'login' ? 'Create a new team account' : 'Back to login'}
          </button>

          <div className="security-note">No public student access</div>
        </section>
      </main>
    )
  }

  if (!authorized) {
    return (
      <main className="login-shell">
        <section className="login-card pending-card">
          <div className="brand-row">
            <div className="brand-icon"><ShieldCheck size={22} /></div>
            <div>
              <strong>Access Pending</strong>
              <span>{userEmail}</span>
            </div>
          </div>
          <div className="login-copy">
            <h1>Account created</h1>
            <p>Your login is valid, but this account has not yet been approved for student database access.</p>
          </div>
          <button className="secondary-button" onClick={logout}><LogOut size={16} />Logout</button>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-row compact">
          <div className="brand-icon"><GraduationCap size={21} /></div>
          <div>
            <strong>Student Registration Finder</strong>
            <span>{userEmail}</span>
          </div>
        </div>

        <div className="top-actions">
          <nav className="app-nav">
            <button
              className={view === 'search' ? 'active' : ''}
              onClick={() => setView('search')}
            >
              <Database size={16} />
              Search
            </button>
            <button
              className={view === 'add' ? 'active' : ''}
              onClick={() => setView('add')}
            >
              <PlusCircle size={16} />
              Add Students
            </button>
          </nav>
          <button className="secondary-button" onClick={logout}><LogOut size={16} />Logout</button>
        </div>
      </header>

      <section className={`content ${view === 'add' ? 'content-wide' : ''}`}>
        {view === 'search' ? (
          <>
            <div className="hero-copy">
              <span className="eyebrow"><ShieldCheck size={15} /> Surat ICMAI database</span>
              <h1>Find a student</h1>
              <p>Select the database first, then search by name, mobile, or registration number.</p>
            </div>

            <section className="finder-card">
              <div className="database-tabs">
                <button
                  type="button"
                  className={level === 'foundation' ? 'active' : ''}
                  onClick={() => changeLevel('foundation')}
                >
                  Foundation
                  <span>{counts.foundation} students</span>
                </button>

                <button
                  type="button"
                  className={level === 'intermediate' ? 'active' : ''}
                  onClick={() => changeLevel('intermediate')}
                >
                  Intermediate
                  <span>{counts.intermediate} students</span>
                </button>

                <button
                  type="button"
                  className={level === 'all' ? 'active' : ''}
                  onClick={() => changeLevel('all')}
                >
                  All
                  <span>{counts.foundation + counts.intermediate} students</span>
                </button>
              </div>

              <form className="search-form" onSubmit={searchStudents}>
                <div className="search-input">
                  <Search size={19} />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Name, email, mobile or registration no."
                    autoComplete="off"
                  />
                </div>
                <button className="primary-button search-button" disabled={loading}>
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </form>

              {message && (
                <div className={`message ${message.type} result-message`}>
                  <AlertCircle size={17} />
                  {message.text}
                </div>
              )}

              {!!results.length && (
                <div className="results">
                  <div className="results-label">
                    {results.length} match{results.length === 1 ? '' : 'es'}
                  </div>

                  {results.map(student => (
                    <button
                      key={`${student.source}-${student.id}`}
                      className={`result-row ${
                        selected?.id === student.id && selected?.source === student.source
                          ? 'selected'
                          : ''
                      }`}
                      onClick={() => setSelected(student)}
                    >
                      <div>
                        <strong>{student.studentName}</strong>
                        <span>{sourceLabel(student.source)} · {student.registrationNumber}</span>
                      </div>
                      <span>{student.mobile || 'No mobile'}</span>
                    </button>
                  ))}
                </div>
              )}

              {selected && (
                <div className="details">
                  <div className="details-head">
                    <div>
                      <span className="source-badge">{sourceLabel(selected.source)}</span>
                      <h2>{selected.studentName}</h2>
                    </div>

                    <button
                      className="secondary-button"
                      onClick={() => copyRegistration(selected.registrationNumber)}
                    >
                      {copied === selected.registrationNumber
                        ? <CheckCircle2 size={16} />
                        : <Copy size={16} />}
                      {copied === selected.registrationNumber ? 'Copied' : 'Copy Registration'}
                    </button>
                  </div>

                  <div className="detail-grid">
                    <Detail icon={<Hash size={17} />} label="Registration Number" value={selected.registrationNumber} />
                    <Detail icon={<Phone size={17} />} label="Registered Mobile" value={selected.mobile || '—'} />
                    <Detail icon={<CalendarDays size={17} />} label="Date of Birth" value={formatDate(selected.dateOfBirth)} />
                    <Detail icon={<Mail size={17} />} label="Email" value={selected.email || '—'} />
                    <Detail
                      wide
                      icon={<MapPin size={17} />}
                      label="Address"
                      value={[
                        selected.address1,
                        selected.address2,
                        selected.address3,
                        selected.city,
                        selected.pinCode,
                      ].filter(Boolean).join(', ') || '—'}
                    />
                  </div>
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <div className="hero-copy">
              <span className="eyebrow"><PlusCircle size={15} /> Student management</span>
              <h1>Add students</h1>
              <p>Add one student manually or import multiple students using the website's blank Excel format.</p>
            </div>
            <AddStudents onChanged={loadCounts} />
          </>
        )}
        {view === 'search' && hasSearched && <ChairmanBrand />}
      </section>
    </main>
  )
}

function Detail({
  icon,
  label,
  value,
  wide = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={`detail-item ${wide ? 'wide' : ''}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
