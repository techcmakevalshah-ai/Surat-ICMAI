'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Copy,
  GraduationCap,
  Hash,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase-browser'

type Student = {
  id: number
  source: 'FND' | 'INTER'
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

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(date)
}

export default function Home() {
  const supabase = useMemo(() => createBrowserSupabase(), [])
  const [ready, setReady] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Student[]>([])
  const [selected, setSelected] = useState<Student | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{type:'error'|'success';text:string} | null>(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setUserEmail(data.session?.user?.email || '')
      setReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUserEmail(session?.user?.email || '')
      setReady(true)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [supabase])

  async function login(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
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
  }

  async function searchStudents(event: FormEvent) {
    event.preventDefault()
    const term = query.trim()
    if (term.length < 2) {
      setMessage({ type: 'error', text: 'Enter at least 2 characters.' })
      return
    }

    setLoading(true)
    setMessage(null)
    setSelected(null)

    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    if (!token) {
      setLoading(false)
      setMessage({ type: 'error', text: 'Your login session has expired.' })
      return
    }

    const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => ({}))
    setLoading(false)

    if (!response.ok) {
      setResults([])
      setMessage({ type: 'error', text: payload.error || 'Search failed.' })
      return
    }

    const students: Student[] = payload.students || []
    setResults(students)
    if (students.length === 1) setSelected(students[0])
    if (!students.length) setMessage({ type: 'error', text: 'No matching student found.' })
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
            <div><strong>Student Registration Finder</strong><span>Internal team access</span></div>
          </div>
          <div className="login-copy">
            <span className="eyebrow"><ShieldCheck size={15} /> Authorized access</span>
            <h1>Team Login</h1>
            <p>Search student registration details securely.</p>
          </div>
          <form className="form" onSubmit={login}>
            <label><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
            <label><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
            {message && <div className={`message ${message.type}`}><AlertCircle size={17}/>{message.text}</div>}
            <button className="primary-button" disabled={loading}>{loading ? 'Signing in...' : 'Login'}</button>
          </form>
          <div className="security-note">No public student access</div>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-row compact">
          <div className="brand-icon"><GraduationCap size={21}/></div>
          <div><strong>Student Registration Finder</strong><span>{userEmail}</span></div>
        </div>
        <button className="secondary-button" onClick={logout}><LogOut size={16}/>Logout</button>
      </header>

      <section className="content">
        <div className="hero-copy">
          <span className="eyebrow"><ShieldCheck size={15}/> Internal database</span>
          <h1>Find a student</h1>
          <p>Search by name, registered mobile number, or registration number.</p>
        </div>

        <section className="finder-card">
          <form className="search-form" onSubmit={searchStudents}>
            <div className="search-input"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, mobile or registration no." autoComplete="off" /></div>
            <button className="primary-button search-button" disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
          </form>

          {message && <div className={`message ${message.type} result-message`}>{message.type==='success'?<CheckCircle2 size={17}/>:<AlertCircle size={17}/>} {message.text}</div>}

          {!!results.length && (
            <div className="results">
              <div className="results-label">{results.length} match{results.length===1?'':'es'}</div>
              {results.map(student => (
                <button key={student.id} className={`result-row ${selected?.id===student.id?'selected':''}`} onClick={()=>setSelected(student)}>
                  <div><strong>{student.studentName}</strong><span>{student.source} · {student.registrationNumber}</span></div>
                  <span>{student.mobile || 'No mobile'}</span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="details">
              <div className="details-head">
                <div><span className="source-badge">{selected.source}</span><h2>{selected.studentName}</h2><p>{selected.fatherHusbandName || 'Father / Husband name unavailable'}</p></div>
                <button className="secondary-button" onClick={()=>copyRegistration(selected.registrationNumber)}>{copied===selected.registrationNumber?<CheckCircle2 size={16}/>:<Copy size={16}/>} {copied===selected.registrationNumber?'Copied':'Copy Registration'}</button>
              </div>
              <div className="detail-grid">
                <Detail icon={<Hash size={17}/>} label="Registration Number" value={selected.registrationNumber}/>
                <Detail icon={<Phone size={17}/>} label="Registered Mobile" value={selected.mobile || '—'}/>
                <Detail icon={<CalendarDays size={17}/>} label="Date of Birth" value={formatDate(selected.dateOfBirth)}/>
                <Detail icon={<Mail size={17}/>} label="Email" value={selected.email || '—'}/>
                <Detail wide icon={<MapPin size={17}/>} label="Address" value={[selected.address1,selected.address2,selected.address3,selected.city,selected.pinCode].filter(Boolean).join(', ') || '—'}/>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

function Detail({ icon, label, value, wide=false }: {icon:React.ReactNode;label:string;value:string;wide?:boolean}) {
  return <div className={`detail-item ${wide?'wide':''}`}>{icon}<span>{label}</span><strong>{value}</strong></div>
}
